from __future__ import annotations

import copy
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, field_validator

from services.ai_admin_service import AuditEvent, AuditSink, InMemoryAuditSink

RecommendationType = Literal["filter", "rank", "personalize"]
RecommendationFeatureStatus = Literal["enabled", "disabled"]

FORBIDDEN_SECRET_KEYWORDS = (
    "api_key",
    "apikey",
    "secret",
    "password",
    "token",
    "authorization",
    "bearer",
    "private_key",
    "email",
    "phone",
)


def _validate_no_secrets(data: dict[str, Any] | None) -> None:
    """Validate that configuration does not contain secrets or PII."""
    if not data:
        return
    for key, value in data.items():
        key_lower = str(key).lower()
        if any(secret_kw in key_lower for secret_kw in FORBIDDEN_SECRET_KEYWORDS):
            raise ValueError(f"Sensitive credential or secret found in data key: {key}")
        if isinstance(value, dict):
            _validate_no_secrets(value)
        elif isinstance(value, (list, tuple, set)):
            for item in value:
                if isinstance(item, dict):
                    _validate_no_secrets(item)
                elif isinstance(item, str):
                    item_lower = item.lower()
                    if any(secret_kw in item_lower for secret_kw in FORBIDDEN_SECRET_KEYWORDS + ("bearer ", "ghp_", "sk-", "xoxb-")):
                        raise ValueError(f"Sensitive token or credential found in data content: {item}")
        elif isinstance(value, str):
            value_lower = value.lower()
            if any(secret_kw in value_lower for secret_kw in FORBIDDEN_SECRET_KEYWORDS + ("bearer ", "ghp_", "sk-", "xoxb-")):
                raise ValueError(f"Sensitive token or credential found in data content: {value}")


@dataclass
class RecommendationRule:
    """Core recommendation rule entity."""

    id: str
    name: str
    rule_type: RecommendationType
    description: str = ""
    enabled: bool = True
    priority: int = 50
    condition: dict[str, Any] = field(default_factory=dict)
    action: dict[str, Any] = field(default_factory=dict)
    template_ids: list[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str | None = field(default=None)
    version: int = 1

    def __post_init__(self) -> None:
        _validate_no_secrets(self.condition)
        _validate_no_secrets(self.action)
        # Ensure updated_at matches created_at if not explicitly set
        if self.updated_at is None:
            self.updated_at = self.created_at


@dataclass
class PromptTemplate:
    """Prompt template for recommendation generation."""

    id: str
    name: str
    template_type: Literal["instruction", "context", "ranking"]
    prompt_text: str
    description: str = ""
    variables: dict[str, str] = field(default_factory=dict)
    enabled: bool = True
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str | None = field(default=None)
    version: int = 1

    def __post_init__(self) -> None:
        _validate_no_secrets({"prompt_text": self.prompt_text})
        _validate_no_secrets(self.variables)
        # Ensure updated_at matches created_at if not explicitly set
        if self.updated_at is None:
            self.updated_at = self.created_at


@dataclass
class RecommendationFeature:
    """Configurable recommendation feature."""

    id: str
    display_name: str
    description: str = ""
    enabled: bool = True
    applicable_contexts: list[str] = field(default_factory=list)
    rule_ids: list[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str | None = field(default=None)

    def __post_init__(self) -> None:
        # Ensure updated_at matches created_at if not explicitly set
        if self.updated_at is None:
            self.updated_at = self.created_at


@dataclass
class ConfigurationVersion:
    revision: int = 0
    updated_at: str | None = None
    updated_source: str | None = None


@dataclass
class RecommendationConfigSnapshot:
    rules: dict[str, RecommendationRule]
    templates: dict[str, PromptTemplate]
    features: dict[str, RecommendationFeature]
    version: ConfigurationVersion


class ConfigurationConflictError(RuntimeError):
    pass


class RecommendationConfigRepository(Protocol):
    """Database-neutral persistence boundary for recommendation configuration."""

    def load_rules(self) -> dict[str, RecommendationRule]: ...
    def save_rule(self, rule: RecommendationRule) -> None: ...
    def load_templates(self) -> dict[str, PromptTemplate]: ...
    def save_template(self, template: PromptTemplate) -> None: ...
    def load_features(self) -> dict[str, RecommendationFeature]: ...
    def save_feature(self, feature: RecommendationFeature) -> None: ...
    def load_configuration(self) -> RecommendationConfigSnapshot: ...
    def save_configuration(
        self, configuration: RecommendationConfigSnapshot, expected_revision: int
    ) -> ConfigurationVersion: ...


class InMemoryRecommendationRepository:
    """In-memory repository for development and testing."""

    def __init__(
        self,
        initial_rules: dict[str, RecommendationRule] | None = None,
        initial_templates: dict[str, PromptTemplate] | None = None,
        initial_features: dict[str, RecommendationFeature] | None = None,
    ) -> None:
        self._rules = initial_rules or {}
        self._templates = initial_templates or {}
        self._features = initial_features or {}
        self._version = ConfigurationVersion(revision=0)

    def load_rules(self) -> dict[str, RecommendationRule]:
        return copy.deepcopy(self._rules)

    def save_rule(self, rule: RecommendationRule) -> None:
        self._rules[rule.id] = rule
        self._version.revision += 1
        self._version.updated_at = datetime.now(timezone.utc).isoformat()

    def load_templates(self) -> dict[str, PromptTemplate]:
        return copy.deepcopy(self._templates)

    def save_template(self, template: PromptTemplate) -> None:
        self._templates[template.id] = template
        self._version.revision += 1
        self._version.updated_at = datetime.now(timezone.utc).isoformat()

    def load_features(self) -> dict[str, RecommendationFeature]:
        return copy.deepcopy(self._features)

    def save_feature(self, feature: RecommendationFeature) -> None:
        self._features[feature.id] = feature
        self._version.revision += 1
        self._version.updated_at = datetime.now(timezone.utc).isoformat()

    def load_configuration(self) -> RecommendationConfigSnapshot:
        return RecommendationConfigSnapshot(
            rules=self.load_rules(),
            templates=self.load_templates(),
            features=self.load_features(),
            version=ConfigurationVersion(
                revision=self._version.revision,
                updated_at=self._version.updated_at,
                updated_source=self._version.updated_source,
            ),
        )

    def save_configuration(
        self, configuration: RecommendationConfigSnapshot, expected_revision: int
    ) -> ConfigurationVersion:
        if expected_revision != self._version.revision:
            raise ConfigurationConflictError(
                f"Configuration conflict: expected revision {expected_revision}, "
                f"but current revision is {self._version.revision}"
            )
        self._rules = configuration.rules
        self._templates = configuration.templates
        self._features = configuration.features
        self._version.revision += 1
        self._version.updated_at = datetime.now(timezone.utc).isoformat()
        return ConfigurationVersion(
            revision=self._version.revision,
            updated_at=self._version.updated_at,
            updated_source=self._version.updated_source,
        )


# --- Pydantic Input Models ---


class RecommendationRuleInput(BaseModel):
    """Safe input model for creating/updating recommendation rules."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    rule_type: RecommendationType
    enabled: bool = True
    priority: int = Field(default=50, ge=1, le=100)
    condition: dict[str, Any] = Field(default_factory=dict)
    action: dict[str, Any] = Field(default_factory=dict)
    template_ids: list[str] = Field(default_factory=list)

    @field_validator("condition", "action", mode="before")
    @classmethod
    def validate_no_secrets(cls, value: dict[str, Any]) -> dict[str, Any]:
        _validate_no_secrets(value)
        return value


class PromptTemplateInput(BaseModel):
    """Safe input model for creating/updating prompt templates."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    template_type: Literal["instruction", "context", "ranking"]
    prompt_text: str = Field(min_length=10, max_length=5000)
    variables: dict[str, str] = Field(default_factory=dict)
    enabled: bool = True

    @field_validator("prompt_text")
    @classmethod
    def validate_no_secrets_in_prompt(cls, value: str) -> str:
        _validate_no_secrets({"prompt_text": value})
        return value

    @field_validator("variables")
    @classmethod
    def validate_no_secrets_in_variables(cls, value: dict[str, str]) -> dict[str, str]:
        _validate_no_secrets(value)
        return value


class RecommendationFeatureInput(BaseModel):
    """Safe input model for creating/updating recommendation features."""

    model_config = ConfigDict(extra="forbid")

    display_name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    enabled: bool = True
    applicable_contexts: list[str] = Field(default_factory=list)
    rule_ids: list[str] = Field(default_factory=list)


# --- Response Models ---


class RecommendationRuleResponse(BaseModel):
    """Response model for recommendation rules."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str
    rule_type: RecommendationType
    enabled: bool
    priority: int
    condition: dict[str, Any]
    action: dict[str, Any]
    template_ids: list[str]
    created_at: str
    updated_at: str
    version: int


class PromptTemplateResponse(BaseModel):
    """Response model for prompt templates."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str
    template_type: Literal["instruction", "context", "ranking"]
    prompt_text: str
    variables: dict[str, str]
    enabled: bool
    created_at: str
    updated_at: str
    version: int


class RecommendationFeatureResponse(BaseModel):
    """Response model for recommendation features."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    display_name: str
    description: str
    enabled: bool
    applicable_contexts: list[str]
    rule_ids: list[str]
    created_at: str
    updated_at: str


class RecommendationConfigResponse(BaseModel):
    """Response model for recommendation configuration snapshot."""

    rules: list[RecommendationRuleResponse]
    templates: list[PromptTemplateResponse]
    features: list[RecommendationFeatureResponse]
    version: int


class RecommendationSummaryResponse(BaseModel):
    """Summary statistics for recommendation system."""

    total_rules: int
    enabled_rules: int
    total_templates: int
    enabled_templates: int
    total_features: int
    enabled_features: int
    config_version: int


# --- Service ---


class RecommendationConfigService:
    """
    Main orchestration service for AI-004 Recommendation Configuration.
    Manages rules, templates, and features with audit logging.
    """

    def __init__(
        self,
        repository: RecommendationConfigRepository | None = None,
        audit_sink: AuditSink | None = None,
    ) -> None:
        self._repository = repository or InMemoryRecommendationRepository()
        self._audit_sink = audit_sink or InMemoryAuditSink()

    # --- Rule Operations ---

    def create_rule(self, rule_input: RecommendationRuleInput) -> RecommendationRule:
        """Create a new recommendation rule."""
        rule = RecommendationRule(
            id=f"rule-{uuid.uuid4().hex[:12]}",
            name=rule_input.name,
            description=rule_input.description or "",
            rule_type=rule_input.rule_type,
            enabled=rule_input.enabled,
            priority=rule_input.priority,
            condition=dict(rule_input.condition),
            action=dict(rule_input.action),
            template_ids=list(rule_input.template_ids),
        )
        self._repository.save_rule(rule)
        self._audit_sink.record(
            AuditEvent(
                action="create",
                resource="recommendation_rule",
                resource_id=rule.id,
                previous={},
                current={
                    "name": rule.name,
                    "rule_type": rule.rule_type,
                    "enabled": rule.enabled,
                    "priority": rule.priority,
                },
                occurred_at=datetime.now(timezone.utc).isoformat(),
            )
        )
        return rule

    def get_rule(self, rule_id: str) -> RecommendationRule:
        """Retrieve a rule by ID."""
        rules = self._repository.load_rules()
        if rule_id not in rules:
            raise ValueError(f"Recommendation rule '{rule_id}' not found")
        return rules[rule_id]

    def list_rules(self) -> list[RecommendationRule]:
        """List all rules, sorted by priority."""
        rules = self._repository.load_rules()
        return sorted(rules.values(), key=lambda r: (not r.enabled, r.priority))

    def update_rule(self, rule_id: str, rule_input: RecommendationRuleInput) -> RecommendationRule:
        """Update an existing rule."""
        existing = self.get_rule(rule_id)
        prev_state = {
            "name": existing.name,
            "rule_type": existing.rule_type,
            "enabled": existing.enabled,
            "priority": existing.priority,
        }

        existing.name = rule_input.name
        existing.description = rule_input.description or ""
        existing.rule_type = rule_input.rule_type
        existing.enabled = rule_input.enabled
        existing.priority = rule_input.priority
        existing.condition = dict(rule_input.condition)
        existing.action = dict(rule_input.action)
        existing.template_ids = list(rule_input.template_ids)
        existing.updated_at = datetime.now(timezone.utc).isoformat()
        existing.version += 1

        self._repository.save_rule(existing)
        self._audit_sink.record(
            AuditEvent(
                action="update",
                resource="recommendation_rule",
                resource_id=rule_id,
                previous=prev_state,
                current={
                    "name": existing.name,
                    "rule_type": existing.rule_type,
                    "enabled": existing.enabled,
                    "priority": existing.priority,
                },
                occurred_at=existing.updated_at,
            )
        )
        return existing

    def delete_rule(self, rule_id: str) -> None:
        """Delete a rule and remove its ID from all features."""
        existing = self.get_rule(rule_id)
        config = self._repository.load_configuration()
        # Remove the rule from configuration
        if rule_id in config.rules:
            del config.rules[rule_id]
        # Remove rule_id from all feature rule_ids
        for feature in config.features.values():
            if rule_id in feature.rule_ids:
                feature.rule_ids = [rid for rid in feature.rule_ids if rid != rule_id]
                feature.updated_at = datetime.now(timezone.utc).isoformat()
        # Save the updated configuration (use current revision for deletion)
        self._repository.save_configuration(config, config.version.revision)
        self._audit_sink.record(
            AuditEvent(
                action="delete",
                resource="recommendation_rule",
                resource_id=rule_id,
                previous={
                    "name": existing.name,
                    "rule_type": existing.rule_type,
                    "enabled": existing.enabled,
                    "priority": existing.priority,
                },
                current={},
                occurred_at=datetime.now(timezone.utc).isoformat(),
            )
        )

    def toggle_rule(self, rule_id: str, enabled: bool) -> RecommendationRule:
        """Enable or disable a rule."""
        existing = self.get_rule(rule_id)
        prev_enabled = existing.enabled
        existing.enabled = enabled
        existing.updated_at = datetime.now(timezone.utc).isoformat()
        existing.version += 1
        self._repository.save_rule(existing)
        self._audit_sink.record(
            AuditEvent(
                action="toggle",
                resource="recommendation_rule",
                resource_id=rule_id,
                previous={"enabled": prev_enabled},
                current={"enabled": enabled},
                occurred_at=existing.updated_at,
            )
        )
        return existing

    # --- Template Operations ---

    def create_template(self, template_input: PromptTemplateInput) -> PromptTemplate:
        """Create a new prompt template."""
        template = PromptTemplate(
            id=f"template-{uuid.uuid4().hex[:12]}",
            name=template_input.name,
            description=template_input.description or "",
            template_type=template_input.template_type,
            prompt_text=template_input.prompt_text,
            variables=dict(template_input.variables),
            enabled=template_input.enabled,
        )
        self._repository.save_template(template)
        self._audit_sink.record(
            AuditEvent(
                action="create",
                resource="prompt_template",
                resource_id=template.id,
                previous={},
                current={
                    "name": template.name,
                    "template_type": template.template_type,
                    "enabled": template.enabled,
                },
                occurred_at=datetime.now(timezone.utc).isoformat(),
            )
        )
        return template

    def get_template(self, template_id: str) -> PromptTemplate:
        """Retrieve a template by ID."""
        templates = self._repository.load_templates()
        if template_id not in templates:
            raise ValueError(f"Prompt template '{template_id}' not found")
        return templates[template_id]

    def list_templates(self) -> list[PromptTemplate]:
        """List all templates."""
        templates = self._repository.load_templates()
        return sorted(templates.values(), key=lambda t: t.name)

    def update_template(self, template_id: str, template_input: PromptTemplateInput) -> PromptTemplate:
        """Update an existing template."""
        existing = self.get_template(template_id)
        prev_state = {
            "name": existing.name,
            "template_type": existing.template_type,
            "enabled": existing.enabled,
        }

        existing.name = template_input.name
        existing.description = template_input.description or ""
        existing.template_type = template_input.template_type
        existing.prompt_text = template_input.prompt_text
        existing.variables = dict(template_input.variables)
        existing.enabled = template_input.enabled
        existing.updated_at = datetime.now(timezone.utc).isoformat()
        existing.version += 1

        self._repository.save_template(existing)
        self._audit_sink.record(
            AuditEvent(
                action="update",
                resource="prompt_template",
                resource_id=template_id,
                previous=prev_state,
                current={
                    "name": existing.name,
                    "template_type": existing.template_type,
                    "enabled": existing.enabled,
                },
                occurred_at=existing.updated_at,
            )
        )
        return existing

    def delete_template(self, template_id: str) -> None:
        """Delete a template and remove its ID from all rules."""
        existing = self.get_template(template_id)
        config = self._repository.load_configuration()
        # Remove the template from configuration
        if template_id in config.templates:
            del config.templates[template_id]
        # Remove template_id from all rule template_ids
        for rule in config.rules.values():
            if template_id in rule.template_ids:
                rule.template_ids = [tid for tid in rule.template_ids if tid != template_id]
                rule.updated_at = datetime.now(timezone.utc).isoformat()
        # Save the updated configuration (use current revision for deletion)
        self._repository.save_configuration(config, config.version.revision)
        self._audit_sink.record(
            AuditEvent(
                action="delete",
                resource="prompt_template",
                resource_id=template_id,
                previous={
                    "name": existing.name,
                    "template_type": existing.template_type,
                    "enabled": existing.enabled,
                },
                current={},
                occurred_at=datetime.now(timezone.utc).isoformat(),
            )
        )

    def toggle_template(self, template_id: str, enabled: bool) -> PromptTemplate:
        """Enable or disable a template."""
        existing = self.get_template(template_id)
        prev_enabled = existing.enabled
        existing.enabled = enabled
        existing.updated_at = datetime.now(timezone.utc).isoformat()
        existing.version += 1
        self._repository.save_template(existing)
        self._audit_sink.record(
            AuditEvent(
                action="toggle",
                resource="prompt_template",
                resource_id=template_id,
                previous={"enabled": prev_enabled},
                current={"enabled": enabled},
                occurred_at=existing.updated_at,
            )
        )
        return existing

    # --- Feature Operations ---

    def create_feature(self, feature_id: str, feature_input: RecommendationFeatureInput) -> RecommendationFeature:
        """Create a new recommendation feature."""
        feature = RecommendationFeature(
            id=feature_id,
            display_name=feature_input.display_name,
            description=feature_input.description or "",
            enabled=feature_input.enabled,
            applicable_contexts=list(feature_input.applicable_contexts),
            rule_ids=list(feature_input.rule_ids),
        )
        self._repository.save_feature(feature)
        self._audit_sink.record(
            AuditEvent(
                action="create",
                resource="recommendation_feature",
                resource_id=feature.id,
                previous={},
                current={
                    "display_name": feature.display_name,
                    "enabled": feature.enabled,
                    "contexts": len(feature.applicable_contexts),
                },
                occurred_at=datetime.now(timezone.utc).isoformat(),
            )
        )
        return feature

    def get_feature(self, feature_id: str) -> RecommendationFeature:
        """Retrieve a feature by ID."""
        features = self._repository.load_features()
        if feature_id not in features:
            raise ValueError(f"Recommendation feature '{feature_id}' not found")
        return features[feature_id]

    def list_features(self) -> list[RecommendationFeature]:
        """List all features."""
        features = self._repository.load_features()
        return sorted(features.values(), key=lambda f: f.display_name)

    def update_feature(self, feature_id: str, feature_input: RecommendationFeatureInput) -> RecommendationFeature:
        """Update an existing feature."""
        existing = self.get_feature(feature_id)
        prev_state = {
            "display_name": existing.display_name,
            "enabled": existing.enabled,
            "rule_ids": list(existing.rule_ids),
        }

        existing.display_name = feature_input.display_name
        existing.description = feature_input.description or ""
        existing.enabled = feature_input.enabled
        existing.applicable_contexts = list(feature_input.applicable_contexts)
        existing.rule_ids = list(feature_input.rule_ids)
        existing.updated_at = datetime.now(timezone.utc).isoformat()

        self._repository.save_feature(existing)
        self._audit_sink.record(
            AuditEvent(
                action="update",
                resource="recommendation_feature",
                resource_id=feature_id,
                previous=prev_state,
                current={
                    "display_name": existing.display_name,
                    "enabled": existing.enabled,
                    "rule_ids": list(existing.rule_ids),
                },
                occurred_at=existing.updated_at,
            )
        )
        return existing

    def toggle_feature(self, feature_id: str, enabled: bool) -> RecommendationFeature:
        """Enable or disable a feature."""
        existing = self.get_feature(feature_id)
        prev_enabled = existing.enabled
        existing.enabled = enabled
        existing.updated_at = datetime.now(timezone.utc).isoformat()
        self._repository.save_feature(existing)
        self._audit_sink.record(
            AuditEvent(
                action="toggle",
                resource="recommendation_feature",
                resource_id=feature_id,
                previous={"enabled": prev_enabled},
                current={"enabled": enabled},
                occurred_at=existing.updated_at,
            )
        )
        return existing

    def delete_feature(self, feature_id: str) -> None:
        """Delete a feature."""
        existing = self.get_feature(feature_id)
        config = self._repository.load_configuration()
        if feature_id in config.features:
            del config.features[feature_id]
        self._repository.save_configuration(config, config.version.revision)
        self._audit_sink.record(
            AuditEvent(
                action="delete",
                resource="recommendation_feature",
                resource_id=feature_id,
                previous={
                    "display_name": existing.display_name,
                    "enabled": existing.enabled,
                    "rule_ids": list(existing.rule_ids),
                },
                current={},
                occurred_at=datetime.now(timezone.utc).isoformat(),
            )
        )

    # --- Summary Operations ---

    def get_summary(self) -> RecommendationSummaryResponse:
        """Get summary statistics."""
        config = self._repository.load_configuration()
        enabled_rules = sum(1 for r in config.rules.values() if r.enabled)
        enabled_templates = sum(1 for t in config.templates.values() if t.enabled)
        enabled_features = sum(1 for f in config.features.values() if f.enabled)

        return RecommendationSummaryResponse(
            total_rules=len(config.rules),
            enabled_rules=enabled_rules,
            total_templates=len(config.templates),
            enabled_templates=enabled_templates,
            total_features=len(config.features),
            enabled_features=enabled_features,
            config_version=config.version.revision,
        )

    def get_configuration(self) -> RecommendationConfigResponse:
        """Get full configuration snapshot."""
        config = self._repository.load_configuration()
        return RecommendationConfigResponse(
            rules=[RecommendationRuleResponse.model_validate(r) for r in config.rules.values()],
            templates=[PromptTemplateResponse.model_validate(t) for t in config.templates.values()],
            features=[RecommendationFeatureResponse.model_validate(f) for f in config.features.values()],
            version=config.version.revision,
        )


# Default singleton instance for application runtime
recommendation_service = RecommendationConfigService()
