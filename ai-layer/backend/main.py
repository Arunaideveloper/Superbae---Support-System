from __future__ import annotations

import hmac
import os
from datetime import datetime
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Path, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.ai_admin_service import (
    AIServiceResponse,
    AIModelUpdate,
    AIProviderUpdate,
    AIServiceUpdate,
    ModelResponse,
    ProviderResponse,
    ai_admin_service,
)
from services.ai_service import AIProviderError, ChatMessage, ai_service
from services.ai_usage_service import (
    UsageBreakdownResponse,
    UsageEventInput,
    UsageEventResponse,
    UsageStatus,
    UsageSummaryResponse,
    ai_usage_service,
)
from services.fraud_detection_service import (
    FraudActivityInput,
    FraudAssessmentListResponse,
    FraudAssessmentResponse,
    FraudAssessmentUpdate,
    fraud_detection_service,
)
from services.recommendation_service import (
    PromptTemplateInput,
    PromptTemplateResponse,
    RecommendationConfigResponse,
    RecommendationFeatureInput,
    RecommendationFeatureResponse,
    RecommendationRuleInput,
    RecommendationRuleResponse,
    RecommendationSummaryResponse,
    recommendation_service,
)


class ConversationMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=10000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=10000)
    history: list[ConversationMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    response: str


app = FastAPI(title="Superbae AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "superbae-ai"}


def require_ai_admin(
    admin_key: Annotated[str | None, Header(alias="X-AI-Admin-Key")] = None,
) -> None:
    configured_key = os.getenv("AI_ADMIN_API_KEY")
    if configured_key and not admin_key or configured_key and not hmac.compare_digest(admin_key or "", configured_key):
        raise HTTPException(status_code=401, detail="AI administration authorization required")


@app.get("/ai/providers", response_model=list[ProviderResponse], dependencies=[Depends(require_ai_admin)])
def list_ai_providers() -> list[ProviderResponse]:
    return ai_admin_service.list_providers()


@app.get("/ai/providers/{provider_id}", response_model=ProviderResponse, dependencies=[Depends(require_ai_admin)])
def get_ai_provider(provider_id: str = Path(min_length=1, max_length=100)) -> ProviderResponse:
    try:
        return ai_admin_service.get_provider(provider_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail="Unknown AI provider") from error


@app.get("/ai/providers/{provider_id}/health", response_model=ProviderResponse, dependencies=[Depends(require_ai_admin)])
def get_ai_provider_health(provider_id: str = Path(min_length=1, max_length=100)) -> ProviderResponse:
    try:
        return ai_admin_service.get_provider(provider_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail="Unknown AI provider") from error


@app.put("/ai/providers/{provider_id}", response_model=ProviderResponse, dependencies=[Depends(require_ai_admin)])
def update_ai_provider(
    update: AIProviderUpdate,
    provider_id: str = Path(min_length=1, max_length=100),
) -> ProviderResponse:
    try:
        return ai_admin_service.update_provider(provider_id, update.enabled)
    except ValueError as error:
        raise HTTPException(status_code=404, detail="Unknown AI provider") from error


@app.get("/ai/models", response_model=list[ModelResponse], dependencies=[Depends(require_ai_admin)])
def list_ai_models(provider_id: str | None = None) -> list[ModelResponse]:
    try:
        return ai_admin_service.list_models(provider_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail="Unknown AI provider") from error


@app.put("/ai/models/{provider_id}/{model_id}", response_model=ModelResponse, dependencies=[Depends(require_ai_admin)])
def update_ai_model(
    update: AIModelUpdate,
    provider_id: str = Path(min_length=1, max_length=100),
    model_id: str = Path(min_length=1, max_length=200),
) -> ModelResponse:
    try:
        return ai_admin_service.update_model(provider_id, model_id, update.enabled)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.get("/ai/services", response_model=list[AIServiceResponse], dependencies=[Depends(require_ai_admin)])
def list_ai_services() -> list[AIServiceResponse]:
    return ai_admin_service.list_services()


@app.get("/ai/services/{service_name}", response_model=AIServiceResponse, dependencies=[Depends(require_ai_admin)])
def get_ai_service(
    service_name: str = Path(min_length=1, max_length=100),
) -> AIServiceResponse:
    try:
        return ai_admin_service.get_service(service_name)
    except (KeyError, ValueError) as error:
        raise HTTPException(status_code=404, detail="Unknown AI service") from error


@app.put("/ai/services/{service_name}", response_model=AIServiceResponse, dependencies=[Depends(require_ai_admin)])
def update_ai_service(
    update: AIServiceUpdate,
    service_name: str = Path(min_length=1, max_length=100),
) -> AIServiceResponse:
    try:
        return ai_admin_service.update_service(service_name, update)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Unknown AI service") from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


def _usage_filters(
    provider_id: str | None,
    model_id: str | None,
    feature: str | None,
    status: UsageStatus | None,
    start_at: datetime | None,
    end_at: datetime | None,
) -> dict[str, object]:
    if (start_at and start_at.tzinfo is None) or (end_at and end_at.tzinfo is None):
        raise HTTPException(status_code=422, detail="start_at and end_at must include a UTC offset")
    if start_at and end_at and start_at >= end_at:
        raise HTTPException(status_code=422, detail="start_at must be before end_at")
    return {
        "provider_id": provider_id,
        "model_id": model_id,
        "feature": feature,
        "status": status,
        "start_at": start_at,
        "end_at": end_at,
    }


@app.post("/ai/usage/record", response_model=UsageEventResponse, dependencies=[Depends(require_ai_admin)])
def record_ai_usage(event: UsageEventInput) -> UsageEventResponse:
    """Optional safe ingestion endpoint for AI-layer features outside AIService."""
    return UsageEventResponse.model_validate(ai_usage_service.record(event))


@app.get("/ai/usage/summary", response_model=UsageSummaryResponse, dependencies=[Depends(require_ai_admin)])
def get_ai_usage_summary(
    provider_id: str | None = None, model_id: str | None = None, feature: str | None = None,
    status: UsageStatus | None = None, start_at: datetime | None = None, end_at: datetime | None = None,
) -> UsageSummaryResponse:
    return ai_usage_service.summary(**_usage_filters(provider_id, model_id, feature, status, start_at, end_at))


@app.get("/ai/usage/by-provider", response_model=list[UsageBreakdownResponse], dependencies=[Depends(require_ai_admin)])
def get_ai_usage_by_provider(
    model_id: str | None = None, feature: str | None = None, status: UsageStatus | None = None,
    start_at: datetime | None = None, end_at: datetime | None = None,
) -> list[UsageBreakdownResponse]:
    return ai_usage_service.breakdown("provider", **_usage_filters(None, model_id, feature, status, start_at, end_at))


@app.get("/ai/usage/by-model", response_model=list[UsageBreakdownResponse], dependencies=[Depends(require_ai_admin)])
def get_ai_usage_by_model(
    provider_id: str | None = None, feature: str | None = None, status: UsageStatus | None = None,
    start_at: datetime | None = None, end_at: datetime | None = None,
) -> list[UsageBreakdownResponse]:
    return ai_usage_service.breakdown("model", **_usage_filters(provider_id, None, feature, status, start_at, end_at))


@app.get("/ai/usage/by-feature", response_model=list[UsageBreakdownResponse], dependencies=[Depends(require_ai_admin)])
def get_ai_usage_by_feature(
    provider_id: str | None = None, model_id: str | None = None, status: UsageStatus | None = None,
    start_at: datetime | None = None, end_at: datetime | None = None,
) -> list[UsageBreakdownResponse]:
    return ai_usage_service.breakdown("feature", **_usage_filters(provider_id, model_id, None, status, start_at, end_at))


@app.post("/ai/fraud/analyze", response_model=FraudAssessmentResponse, dependencies=[Depends(require_ai_admin)])
def analyze_fraud_activity(request: FraudActivityInput) -> FraudAssessmentResponse:
    try:
        assessment = fraud_detection_service.analyze(request)
        return FraudAssessmentResponse.model_validate(assessment)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=502, detail="Fraud analysis failed") from error


@app.get("/ai/fraud/assessments", response_model=FraudAssessmentListResponse, dependencies=[Depends(require_ai_admin)])
def list_fraud_assessments(
    activity_id: str | None = None,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> FraudAssessmentListResponse:
    items, total = fraud_detection_service.list_assessments(
        activity_id=activity_id,
        status=status,
        limit=limit,
        offset=offset,
    )
    return FraudAssessmentListResponse(
        assessments=[FraudAssessmentResponse.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@app.get("/ai/fraud/assessments/{assessment_id}", response_model=FraudAssessmentResponse, dependencies=[Depends(require_ai_admin)])
def get_fraud_assessment(
    assessment_id: str = Path(min_length=1, max_length=100),
) -> FraudAssessmentResponse:
    try:
        assessment = fraud_detection_service.get_assessment(assessment_id)
        return FraudAssessmentResponse.model_validate(assessment)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.put("/ai/fraud/assessments/{assessment_id}", response_model=FraudAssessmentResponse, dependencies=[Depends(require_ai_admin)])
def update_fraud_assessment(
    update: FraudAssessmentUpdate,
    assessment_id: str = Path(min_length=1, max_length=100),
) -> FraudAssessmentResponse:
    try:
        updated = fraud_detection_service.update_assessment_status(
            assessment_id=assessment_id,
            new_status=update.investigation_status,
            review_notes=update.review_notes,
            reviewed_by=update.reviewed_by,
        )
        return FraudAssessmentResponse.model_validate(updated)
    except ValueError as error:
        if "not found" in str(error).lower():
            raise HTTPException(status_code=404, detail=str(error)) from error
        raise HTTPException(status_code=400, detail=str(error)) from error


# --- AI-004: Recommendation Configuration ---


@app.get(
    "/ai/recommendations/summary",
    response_model=RecommendationSummaryResponse,
    dependencies=[Depends(require_ai_admin)],
)
def get_recommendation_summary() -> RecommendationSummaryResponse:
    return recommendation_service.get_summary()


@app.get(
    "/ai/recommendations/config",
    response_model=RecommendationConfigResponse,
    dependencies=[Depends(require_ai_admin)],
)
def get_recommendation_config() -> RecommendationConfigResponse:
    return recommendation_service.get_configuration()


# --- Recommendation Rules ---


@app.post(
    "/ai/recommendations/rules",
    response_model=RecommendationRuleResponse,
    dependencies=[Depends(require_ai_admin)],
)
def create_recommendation_rule(rule_input: RecommendationRuleInput) -> RecommendationRuleResponse:
    try:
        rule = recommendation_service.create_rule(rule_input)
        return RecommendationRuleResponse.model_validate(rule)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.get(
    "/ai/recommendations/rules",
    response_model=list[RecommendationRuleResponse],
    dependencies=[Depends(require_ai_admin)],
)
def list_recommendation_rules() -> list[RecommendationRuleResponse]:
    rules = recommendation_service.list_rules()
    return [RecommendationRuleResponse.model_validate(r) for r in rules]


@app.get(
    "/ai/recommendations/rules/{rule_id}",
    response_model=RecommendationRuleResponse,
    dependencies=[Depends(require_ai_admin)],
)
def get_recommendation_rule(rule_id: str = Path(min_length=1, max_length=100)) -> RecommendationRuleResponse:
    try:
        rule = recommendation_service.get_rule(rule_id)
        return RecommendationRuleResponse.model_validate(rule)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.put(
    "/ai/recommendations/rules/{rule_id}",
    response_model=RecommendationRuleResponse,
    dependencies=[Depends(require_ai_admin)],
)
def update_recommendation_rule(
    rule_input: RecommendationRuleInput,
    rule_id: str = Path(min_length=1, max_length=100),
) -> RecommendationRuleResponse:
    try:
        rule = recommendation_service.update_rule(rule_id, rule_input)
        return RecommendationRuleResponse.model_validate(rule)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.delete("/ai/recommendations/rules/{rule_id}", dependencies=[Depends(require_ai_admin)])
def delete_recommendation_rule(rule_id: str = Path(min_length=1, max_length=100)) -> dict[str, str]:
    try:
        recommendation_service.delete_rule(rule_id)
        return {"message": f"Rule '{rule_id}' deleted successfully"}
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.put(
    "/ai/recommendations/rules/{rule_id}/enabled",
    response_model=RecommendationRuleResponse,
    dependencies=[Depends(require_ai_admin)],
)
def toggle_recommendation_rule(
    rule_id: str = Path(min_length=1, max_length=100),
    enabled: bool = Query(...),
) -> RecommendationRuleResponse:
    try:
        rule = recommendation_service.toggle_rule(rule_id, enabled)
        return RecommendationRuleResponse.model_validate(rule)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


# --- Prompt Templates ---


@app.post(
    "/ai/recommendations/templates",
    response_model=PromptTemplateResponse,
    dependencies=[Depends(require_ai_admin)],
)
def create_prompt_template(template_input: PromptTemplateInput) -> PromptTemplateResponse:
    try:
        template = recommendation_service.create_template(template_input)
        return PromptTemplateResponse.model_validate(template)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.get(
    "/ai/recommendations/templates",
    response_model=list[PromptTemplateResponse],
    dependencies=[Depends(require_ai_admin)],
)
def list_prompt_templates() -> list[PromptTemplateResponse]:
    templates = recommendation_service.list_templates()
    return [PromptTemplateResponse.model_validate(t) for t in templates]


@app.get(
    "/ai/recommendations/templates/{template_id}",
    response_model=PromptTemplateResponse,
    dependencies=[Depends(require_ai_admin)],
)
def get_prompt_template(template_id: str = Path(min_length=1, max_length=100)) -> PromptTemplateResponse:
    try:
        template = recommendation_service.get_template(template_id)
        return PromptTemplateResponse.model_validate(template)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.put(
    "/ai/recommendations/templates/{template_id}",
    response_model=PromptTemplateResponse,
    dependencies=[Depends(require_ai_admin)],
)
def update_prompt_template(
    template_input: PromptTemplateInput,
    template_id: str = Path(min_length=1, max_length=100),
) -> PromptTemplateResponse:
    try:
        template = recommendation_service.update_template(template_id, template_input)
        return PromptTemplateResponse.model_validate(template)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.delete("/ai/recommendations/templates/{template_id}", dependencies=[Depends(require_ai_admin)])
def delete_prompt_template(template_id: str = Path(min_length=1, max_length=100)) -> dict[str, str]:
    try:
        recommendation_service.delete_template(template_id)
        return {"message": f"Template '{template_id}' deleted successfully"}
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.put(
    "/ai/recommendations/templates/{template_id}/enabled",
    response_model=PromptTemplateResponse,
    dependencies=[Depends(require_ai_admin)],
)
def toggle_prompt_template(
    template_id: str = Path(min_length=1, max_length=100),
    enabled: bool = Query(...),
) -> PromptTemplateResponse:
    try:
        template = recommendation_service.toggle_template(template_id, enabled)
        return PromptTemplateResponse.model_validate(template)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


# --- Recommendation Features ---


@app.post(
    "/ai/recommendations/features/{feature_id}",
    response_model=RecommendationFeatureResponse,
    dependencies=[Depends(require_ai_admin)],
)
def create_recommendation_feature(
    feature_input: RecommendationFeatureInput,
    feature_id: str = Path(min_length=1, max_length=100),
) -> RecommendationFeatureResponse:
    try:
        feature = recommendation_service.create_feature(feature_id, feature_input)
        return RecommendationFeatureResponse.model_validate(feature)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.get(
    "/ai/recommendations/features",
    response_model=list[RecommendationFeatureResponse],
    dependencies=[Depends(require_ai_admin)],
)
def list_recommendation_features() -> list[RecommendationFeatureResponse]:
    features = recommendation_service.list_features()
    return [RecommendationFeatureResponse.model_validate(f) for f in features]


@app.get(
    "/ai/recommendations/features/{feature_id}",
    response_model=RecommendationFeatureResponse,
    dependencies=[Depends(require_ai_admin)],
)
def get_recommendation_feature(feature_id: str = Path(min_length=1, max_length=100)) -> RecommendationFeatureResponse:
    try:
        feature = recommendation_service.get_feature(feature_id)
        return RecommendationFeatureResponse.model_validate(feature)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.put(
    "/ai/recommendations/features/{feature_id}",
    response_model=RecommendationFeatureResponse,
    dependencies=[Depends(require_ai_admin)],
)
def update_recommendation_feature(
    feature_input: RecommendationFeatureInput,
    feature_id: str = Path(min_length=1, max_length=100),
) -> RecommendationFeatureResponse:
    try:
        feature = recommendation_service.update_feature(feature_id, feature_input)
        return RecommendationFeatureResponse.model_validate(feature)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.put(
    "/ai/recommendations/features/{feature_id}/enabled",
    response_model=RecommendationFeatureResponse,
    dependencies=[Depends(require_ai_admin)],
)
def toggle_recommendation_feature(
    feature_id: str = Path(min_length=1, max_length=100),
    enabled: bool = Query(...),
) -> RecommendationFeatureResponse:
    try:
        feature = recommendation_service.toggle_feature(feature_id, enabled)
        return RecommendationFeatureResponse.model_validate(feature)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.delete("/ai/recommendations/features/{feature_id}", dependencies=[Depends(require_ai_admin)])
def delete_recommendation_feature(feature_id: str = Path(min_length=1, max_length=100)) -> dict[str, str]:
    try:
        recommendation_service.delete_feature(feature_id)
        return {"message": f"Feature '{feature_id}' deleted successfully"}
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    try:
        history = [
            ChatMessage(role=item.role, content=item.content)
            for item in request.history
        ]
        response = await ai_service.chat(request.message, history)
        return ChatResponse(response=response)
    except AIProviderError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    except RuntimeError as error:
        if str(error) == "GEMINI_API_KEY is not configured":
            raise HTTPException(status_code=503, detail="AI service is not configured") from error
        raise HTTPException(status_code=502, detail="AI provider failed to respond") from error
    except Exception as error:
        raise HTTPException(status_code=500, detail="Unable to process chat request") from error
