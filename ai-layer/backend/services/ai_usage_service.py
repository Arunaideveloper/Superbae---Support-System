from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


UsageStatus = Literal["success", "failed"]
UsageSource = Literal["provider_reported", "estimated", "unavailable"]


def _utc(value: datetime | None) -> datetime:
    value = value or datetime.now(timezone.utc)
    if value.tzinfo is None:
        raise ValueError("timestamp must include a UTC offset")
    return value.astimezone(timezone.utc)


class UsageEventInput(BaseModel):
    """Safe, content-free usage input. Token values are never inferred here."""

    model_config = ConfigDict(extra="forbid")

    request_id: str = Field(min_length=1, max_length=100)
    timestamp: datetime | None = None
    provider_id: str | None = Field(default=None, max_length=100)
    model_id: str | None = Field(default=None, max_length=200)
    feature: str | None = Field(default="unknown", max_length=100)
    operation: str | None = Field(default=None, max_length=100)
    status: UsageStatus
    input_tokens: int | None = Field(default=None, ge=0)
    output_tokens: int | None = Field(default=None, ge=0)
    total_tokens: int | None = Field(default=None, ge=0)
    token_usage_source: UsageSource = "unavailable"
    latency_ms: float | None = Field(default=None, ge=0)
    error_category: str | None = Field(default=None, max_length=100)
    currency: Literal["USD"] = "USD"

    @field_validator("provider_id", "feature", "operation", "error_category", mode="before")
    @classmethod
    def normalize_identifiers(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip().lower()
        return normalized or None

    @field_validator("timestamp")
    @classmethod
    def normalize_timestamp(cls, value: datetime | None) -> datetime | None:
        return _utc(value) if value is not None else None

    @model_validator(mode="after")
    def validate_tokens(self) -> "UsageEventInput":
        if self.input_tokens is not None and self.output_tokens is not None:
            expected = self.input_tokens + self.output_tokens
            if self.total_tokens is not None and self.total_tokens != expected:
                raise ValueError("total_tokens must equal input_tokens + output_tokens when both are provided")
            self.total_tokens = expected
        if self.token_usage_source == "unavailable" and any(
            value is not None for value in (self.input_tokens, self.output_tokens, self.total_tokens)
        ):
            raise ValueError("token_usage_source cannot be unavailable when token usage is supplied")
        if self.token_usage_source != "unavailable" and self.total_tokens is None:
            raise ValueError("reported or estimated token usage requires total_tokens")
        return self


@dataclass(frozen=True)
class UsageEvent:
    id: str
    request_id: str
    timestamp: datetime
    provider_id: str | None
    model_id: str | None
    feature: str
    operation: str | None
    status: UsageStatus
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None
    token_usage_source: UsageSource
    latency_ms: float | None
    estimated_cost: float | None
    currency: str
    error_category: str | None


@dataclass(frozen=True)
class ModelPricing:
    """USD rates per one million tokens; injected by deployment, never embedded in events."""

    input_per_million: float
    output_per_million: float
    currency: str = "USD"

    def __post_init__(self) -> None:
        if self.input_per_million < 0 or self.output_per_million < 0:
            raise ValueError("Token prices cannot be negative")


class PricingCatalog(Protocol):
    def get(self, provider_id: str | None, model_id: str | None) -> ModelPricing | None: ...


class InMemoryPricingCatalog:
    def __init__(self, prices: dict[tuple[str, str], ModelPricing] | None = None) -> None:
        self._prices = {(provider.lower(), model): price for (provider, model), price in (prices or {}).items()}

    def get(self, provider_id: str | None, model_id: str | None) -> ModelPricing | None:
        if not provider_id or not model_id:
            return None
        return self._prices.get((provider_id.lower(), model_id))


class AIUsageRepository(Protocol):
    def record_event(self, event: UsageEvent) -> UsageEvent: ...
    def list_events(
        self,
        provider_id: str | None = None,
        model_id: str | None = None,
        feature: str | None = None,
        status: UsageStatus | None = None,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
    ) -> list[UsageEvent]: ...


class InMemoryAIUsageRepository:
    """Development/test adapter; production persistence is supplied by the main backend."""

    def __init__(self, initial_events: list[UsageEvent] | None = None) -> None:
        self._events = list(initial_events or [])

    def record_event(self, event: UsageEvent) -> UsageEvent:
        self._events.append(event)
        return event

    def list_events(self, provider_id: str | None = None, model_id: str | None = None, feature: str | None = None,
                    status: UsageStatus | None = None, start_at: datetime | None = None,
                    end_at: datetime | None = None) -> list[UsageEvent]:
        return [event for event in self._events if
                (provider_id is None or event.provider_id == provider_id.lower()) and
                (model_id is None or event.model_id == model_id) and
                (feature is None or event.feature == feature.lower()) and
                (status is None or event.status == status) and
                (start_at is None or event.timestamp >= _utc(start_at)) and
                (end_at is None or event.timestamp < _utc(end_at))]


class UsageEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    request_id: str
    timestamp: datetime
    provider_id: str | None
    model_id: str | None
    feature: str
    operation: str | None
    status: UsageStatus
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None
    token_usage_source: UsageSource
    latency_ms: float | None
    estimated_cost: float | None
    currency: str
    error_category: str | None


class UsageSummaryResponse(BaseModel):
    total_requests: int
    successful_requests: int
    failed_requests: int
    requests_with_token_usage: int
    known_total_tokens: int
    requests_with_estimated_cost: int
    estimated_cost: float | None
    currency: str = "USD"


class UsageBreakdownResponse(UsageSummaryResponse):
    group: str


class AIUsageService:
    def __init__(self, repository: AIUsageRepository | None = None, pricing: PricingCatalog | None = None) -> None:
        self._repository = repository or InMemoryAIUsageRepository()
        # No default provider prices: pricing changes and must be owned/configured by deployment.
        self._pricing = pricing or InMemoryPricingCatalog()

    def record(self, usage: UsageEventInput | dict) -> UsageEvent:
        if isinstance(usage, dict):
            usage = UsageEventInput(**usage)
        timestamp = _utc(usage.timestamp)
        provider_id = usage.provider_id
        model_id = usage.model_id.strip() if usage.model_id else None
        estimated_cost = self._calculate_cost(provider_id, model_id, usage)
        event = UsageEvent(
            id=f"usage-{uuid.uuid4().hex}", request_id=usage.request_id, timestamp=timestamp,
            provider_id=provider_id, model_id=model_id, feature=usage.feature or "unknown",
            operation=usage.operation, status=usage.status, input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens, total_tokens=usage.total_tokens,
            token_usage_source=usage.token_usage_source, latency_ms=usage.latency_ms,
            estimated_cost=estimated_cost, currency=usage.currency, error_category=usage.error_category,
        )
        return self._repository.record_event(event)

    def _calculate_cost(self, provider_id: str | None, model_id: str | None, usage: UsageEventInput) -> float | None:
        if usage.input_tokens is None or usage.output_tokens is None:
            return None
        price = self._pricing.get(provider_id, model_id)
        if price is None or price.currency != usage.currency:
            return None
        return round((usage.input_tokens * price.input_per_million + usage.output_tokens * price.output_per_million) / 1_000_000, 12)

    def summary(self, **filters: object) -> UsageSummaryResponse:
        return self._summarize(self._repository.list_events(**filters))

    def breakdown(self, group_by: Literal["provider", "model", "feature"], **filters: object) -> list[UsageBreakdownResponse]:
        events = self._repository.list_events(**filters)
        groups: dict[str, list[UsageEvent]] = {}
        field = {"provider": "provider_id", "model": "model_id", "feature": "feature"}[group_by]
        for event in events:
            key = getattr(event, field) or "unknown"
            groups.setdefault(key, []).append(event)
        return [UsageBreakdownResponse(group=key, **self._summarize(items).model_dump()) for key, items in sorted(groups.items())]

    @staticmethod
    def _summarize(events: list[UsageEvent]) -> UsageSummaryResponse:
        token_events = [event for event in events if event.total_tokens is not None]
        priced_events = [event for event in events if event.estimated_cost is not None]
        return UsageSummaryResponse(
            total_requests=len(events), successful_requests=sum(event.status == "success" for event in events),
            failed_requests=sum(event.status == "failed" for event in events),
            requests_with_token_usage=len(token_events), known_total_tokens=sum(event.total_tokens or 0 for event in token_events),
            requests_with_estimated_cost=len(priced_events),
            estimated_cost=round(sum(event.estimated_cost or 0 for event in priced_events), 12) if priced_events else None,
        )


def _build_ai_usage_service() -> AIUsageService:
    """Use durable Mongo persistence when AI_MONGODB_URI is set; else in-memory."""
    import os

    pricing = InMemoryPricingCatalog({
        ("openai", "gpt-4o-mini"): ModelPricing(input_per_million=0.15, output_per_million=0.60),
    })
    if not os.getenv("AI_MONGODB_URI"):
        return AIUsageService(pricing=pricing)
    from mongo_store import get_database, MongoAIUsageRepository

    db = get_database()
    if db is None:
        return AIUsageService(pricing=pricing)
    return AIUsageService(repository=MongoAIUsageRepository(db), pricing=pricing)


ai_usage_service = _build_ai_usage_service()
