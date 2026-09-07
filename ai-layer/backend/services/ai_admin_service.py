from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Protocol

from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, Field, field_validator

HealthStatus = Literal["unknown", "healthy", "unhealthy"]
ResourceStatus = Literal["configured", "not_configured", "disabled", "invalid"]


@dataclass(frozen=True)
class ProviderDefinition:
    id: str
    display_name: str
    credential_env: str
    default_model: str
    model_env: str
    capabilities: tuple[str, ...]


@dataclass(frozen=True)
class ModelDefinition:
    id: str
    provider_id: str
    capabilities: tuple[str, ...]
    enabled: bool = True


@dataclass
class ProviderState:
    id: str
    enabled: bool = True
    configuration: dict[str, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        _validate_safe_configuration(self.configuration)


@dataclass
class ModelState:
    provider_id: str
    model_id: str
    enabled: bool = True
    configuration: dict[str, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        _validate_safe_configuration(self.configuration)


PROVIDER_DEFINITIONS: dict[str, ProviderDefinition] = {
    "openai": ProviderDefinition(
        "openai", "OpenAI", "OPENAI_API_KEY", "gpt-4o-mini", "OPENAI_MODEL", ("text_generation",)
    ),
    "gemini": ProviderDefinition(
        "gemini", "Google Gemini", "GEMINI_API_KEY", "gemini-1.5-flash", "GEMINI_MODEL", ("text_generation",)
    ),
    "openrouter": ProviderDefinition(
        "openrouter", "OpenRouter", "OPENROUTER_API_KEY", "openrouter/free", "OPENROUTER_MODEL", ("text_generation",)
    ),
}

MODEL_DEFINITIONS = {
    provider_id: ModelDefinition(
        definition.default_model, provider_id, definition.capabilities
    )
    for provider_id, definition in PROVIDER_DEFINITIONS.items()
}


@dataclass
class ServiceState:
    id: str
    display_name: str
    provider_id: str
    model_id: str
    enabled: bool = True
    fallback_provider_ids: list[str] = field(default_factory=list)


@dataclass
class RuntimeSettings:
    active_service_id: str = "customer_support"
    updated_source: str | None = None


@dataclass
class ConfigurationVersion:
    revision: int = 0
    updated_at: str | None = None
    updated_source: str | None = None


@dataclass
class AIConfigurationSnapshot:
    providers: dict[str, ProviderState]
    models: dict[tuple[str, str], ModelState]
    services: dict[str, ServiceState]
    runtime_settings: RuntimeSettings
    version: ConfigurationVersion


class ConfigurationConflictError(RuntimeError):
    pass


class AIConfigurationRepository(Protocol):
    def load_providers(self) -> dict[str, ProviderState]: ...
    def save_provider(self, provider: ProviderState) -> None: ...
    def load_models(self) -> dict[tuple[str, str], ModelState]: ...
    def save_model(self, model: ModelState) -> None: ...
    def load_services(self) -> dict[str, ServiceState]: ...
    def save_service(self, service: ServiceState) -> None: ...
    def load_runtime_settings(self) -> RuntimeSettings: ...
    def save_runtime_settings(self, settings: RuntimeSettings) -> None: ...
    def load_configuration(self) -> AIConfigurationSnapshot: ...
    def save_configuration(
        self, configuration: AIConfigurationSnapshot, expected_revision: int
    ) -> ConfigurationVersion: ...


@dataclass(frozen=True)
class AuditEvent:
    action: str
    resource: str
    resource_id: str
    previous: dict[str, object]
    current: dict[str, object]
    occurred_at: str
    actor: str | None = None


class AuditSink(Protocol):
    def record(self, event: AuditEvent) -> None: ...


class InMemoryConfigurationRepository:
    """Runtime adapter; production persistence belongs to the main backend."""

    def __init__(
        self,
        initial_services: dict[str, ServiceState] | None = None,
        initial_providers: dict[str, ProviderState] | None = None,
        initial_models: dict[tuple[str, str], ModelState] | None = None,
        runtime_settings: RuntimeSettings | None = None,
    ) -> None:
        self._providers = initial_providers or {}
        self._models = initial_models or {}
        self._services = initial_services or {}
        self._runtime_settings = runtime_settings or RuntimeSettings()
        self._version = ConfigurationVersion()

    def load_providers(self) -> dict[str, ProviderState]:
        return {
            key: ProviderState(value.id, value.enabled, dict(value.configuration))
            for key, value in self._providers.items()
        }

    def save_provider(self, provider: ProviderState) -> None:
        self._providers[provider.id] = ProviderState(
            provider.id, provider.enabled, dict(provider.configuration)
        )

    def load_models(self) -> dict[tuple[str, str], ModelState]:
        return {
            key: ModelState(value.provider_id, value.model_id, value.enabled, dict(value.configuration))
            for key, value in self._models.items()
        }

    def save_model(self, model: ModelState) -> None:
        self._models[(model.provider_id, model.model_id)] = ModelState(
            model.provider_id, model.model_id, model.enabled, dict(model.configuration)
        )

    def load_services(self) -> dict[str, ServiceState]:
        return {
            key: ServiceState(
                value.id, value.display_name, value.provider_id, value.model_id,
                value.enabled, list(value.fallback_provider_ids)
            )
            for key, value in self._services.items()
        }

    def save_service(self, service: ServiceState) -> None:
        self._services[service.id] = ServiceState(
            service.id, service.display_name, service.provider_id, service.model_id,
            service.enabled, list(service.fallback_provider_ids)
        )

    def load_runtime_settings(self) -> RuntimeSettings:
        return RuntimeSettings(self._runtime_settings.active_service_id, self._runtime_settings.updated_source)

    def save_runtime_settings(self, settings: RuntimeSettings) -> None:
        self._runtime_settings = RuntimeSettings(settings.active_service_id, settings.updated_source)

    def load_configuration(self) -> AIConfigurationSnapshot:
        return AIConfigurationSnapshot(
            self.load_providers(), self.load_models(), self.load_services(),
            self.load_runtime_settings(),
            ConfigurationVersion(self._version.revision, self._version.updated_at, self._version.updated_source),
        )

    def save_configuration(
        self, configuration: AIConfigurationSnapshot, expected_revision: int
    ) -> ConfigurationVersion:
        if self._version.revision != expected_revision:
            raise ConfigurationConflictError("AI configuration revision conflict")
        self._providers = self.load_providers()
        self._models = self.load_models()
        self._services = self.load_services()
        self._providers.update(configuration.providers)
        self._models.update(configuration.models)
        self._services.update(configuration.services)
        self.save_runtime_settings(configuration.runtime_settings)
        self._version = ConfigurationVersion(
            expected_revision + 1,
            datetime.now(timezone.utc).isoformat(),
            configuration.version.updated_source,
        )
        return ConfigurationVersion(self._version.revision, self._version.updated_at, self._version.updated_source)


class InMemoryAuditSink:
    def __init__(self) -> None:
        self.events: list[AuditEvent] = []

    def record(self, event: AuditEvent) -> None:
        self.events.append(event)


class ProviderResponse(BaseModel):
    id: str
    display_name: str
    enabled: bool
    configured: bool
    health: HealthStatus
    status: ResourceStatus
    capabilities: list[str]
    models: list[str]


class ModelResponse(BaseModel):
    id: str
    provider_id: str
    enabled: bool
    available: bool
    is_default: bool
    capabilities: list[str]
    status: ResourceStatus


class AIModelUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool


class AIProviderUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool


class AIServiceResponse(BaseModel):
    id: str
    display_name: str
    provider_id: str
    model_id: str
    enabled: bool
    fallback_provider_ids: list[str]
    status: ResourceStatus
    provider_configured: bool
    provider_health: HealthStatus
    model_available: bool


class AIServiceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider_id: str | None = None
    model_id: str | None = Field(default=None, min_length=1, max_length=200)
    enabled: bool | None = None
    fallback_provider_ids: list[str] | None = None

    @field_validator("provider_id")
    @classmethod
    def normalize_provider(cls, value: str | None) -> str | None:
        return value.lower() if value is not None else None

    @field_validator("fallback_provider_ids")
    @classmethod
    def normalize_fallbacks(cls, value: list[str] | None) -> list[str] | None:
        return [item.lower() for item in value] if value is not None else None


class AIServiceAdmin:
    def __init__(
        self,
        repository: AIConfigurationRepository | None = None,
        audit_sink: AuditSink | None = None,
    ) -> None:
        load_dotenv(Path(__file__).resolve().parent.parent / ".env")
        self._audit_sink = audit_sink or InMemoryAuditSink()
        self._repository = repository or InMemoryConfigurationRepository()
        snapshot = self._repository.load_configuration()
        self._providers = snapshot.providers or self._default_providers()
        self._models = snapshot.models or self._default_models()
        self._services = snapshot.services or self._default_services()
        self._runtime_settings = snapshot.runtime_settings
        self._version = snapshot.version

    def _default_providers(self) -> dict[str, ProviderState]:
        return {
            provider_id: ProviderState(provider_id, _env_bool(f"AI_{provider_id.upper()}_ENABLED", provider_id != "openrouter"))
            for provider_id in PROVIDER_DEFINITIONS
        }

    def _default_models(self) -> dict[tuple[str, str], ModelState]:
        # Register the model actually resolved from env (<PROVIDER>_MODEL), so routing —
        # which resolves the same way — always finds a matching, enabled model.
        return {
            (provider_id, model): ModelState(provider_id, model, True)
            for provider_id, definition in PROVIDER_DEFINITIONS.items()
            for model in (os.getenv(definition.model_env, definition.default_model),)
        }

    def _default_services(self) -> dict[str, ServiceState]:
        primary = os.getenv("AI_CUSTOMER_SUPPORT_PROVIDER", "openai").lower()
        if primary not in PROVIDER_DEFINITIONS:
            primary = "openai"
        definition = PROVIDER_DEFINITIONS[primary]
        fallbacks = [
            item.strip().lower()
            for item in os.getenv("AI_CUSTOMER_SUPPORT_FALLBACKS", "gemini").split(",")
            if item.strip()
        ]
        return {
            "customer_support": ServiceState(
                "customer_support", "Customer Support", primary,
                os.getenv(definition.model_env, definition.default_model),
                _env_bool("AI_CUSTOMER_SUPPORT_ENABLED", True), fallbacks
            )
        }

    def _service(self, service_id: str) -> ServiceState:
        try:
            return self._services[service_id.lower()]
        except KeyError as error:
            raise KeyError("Unknown AI service") from error

    def _provider(self, provider_id: str) -> ProviderDefinition:
        try:
            return PROVIDER_DEFINITIONS[provider_id.lower()]
        except KeyError as error:
            raise ValueError("Unknown AI provider") from error

    def _model(self, provider_id: str, model_id: str) -> ModelDefinition:
        definition = MODEL_DEFINITIONS.get(provider_id)
        expected_model = os.getenv(PROVIDER_DEFINITIONS[provider_id].model_env, definition.id) if definition else None
        if definition is None or model_id != expected_model:
            raise ValueError("Unknown model for provider")
        return ModelDefinition(model_id, provider_id, definition.capabilities)

    def _provider_configured(self, provider_id: str) -> bool:
        value = os.getenv(PROVIDER_DEFINITIONS[provider_id].credential_env)
        return bool(value and value != "your_key_here")

    def _provider_enabled(self, provider_id: str) -> bool:
        state = self._providers.get(provider_id)
        return state.enabled if state is not None else False

    def _service_response(self, service: ServiceState) -> AIServiceResponse:
        self._provider(service.provider_id)
        model = self._model(service.provider_id, service.model_id)
        configured = self._provider_configured(service.provider_id)
        enabled = self._provider_enabled(service.provider_id)
        status: ResourceStatus = (
            "disabled" if not service.enabled or not enabled
            else "configured" if configured else "not_configured"
        )
        return AIServiceResponse(
            id=service.id, display_name=service.display_name,
            provider_id=service.provider_id, model_id=service.model_id,
            enabled=service.enabled, fallback_provider_ids=list(service.fallback_provider_ids),
            status=status, provider_configured=configured,
            provider_health="unknown" if configured and enabled else "unhealthy",
            model_available=self._model_enabled(model.provider_id, model.id),
        )

    def list_providers(self) -> list[ProviderResponse]:
        return [self.get_provider(provider_id) for provider_id in PROVIDER_DEFINITIONS]

    def get_provider(self, provider_id: str) -> ProviderResponse:
        provider = self._provider(provider_id)
        models = [os.getenv(provider.model_env, provider.default_model)]
        configured = self._provider_configured(provider.id)
        enabled = self._provider_enabled(provider.id)
        return ProviderResponse(
            id=provider.id, display_name=provider.display_name, enabled=enabled,
            configured=configured, health="unknown" if configured and enabled else "unhealthy",
            status="configured" if enabled and configured else "disabled" if not enabled else "not_configured",
            capabilities=list(provider.capabilities), models=models,
        )

    def list_models(self, provider_id: str | None = None) -> list[ModelResponse]:
        if provider_id is not None:
            self._provider(provider_id)
        providers = [provider_id.lower()] if provider_id else list(PROVIDER_DEFINITIONS)
        models = [
            self._model(item, os.getenv(PROVIDER_DEFINITIONS[item].model_env, MODEL_DEFINITIONS[item].id))
            for item in providers
        ]
        return [self._model_response(model) for model in models]

    def _model_response(self, model: ModelDefinition) -> ModelResponse:
        provider = self._provider(model.provider_id)
        configured = self._provider_configured(provider.id)
        enabled = self._provider_enabled(provider.id)
        model_enabled = self._model_enabled(model.provider_id, model.id)
        available = model_enabled and enabled and configured
        return ModelResponse(
            id=model.id, provider_id=model.provider_id, enabled=model_enabled,
            available=available, is_default=model.id == provider.default_model,
            capabilities=list(model.capabilities),
            status="configured" if available else "disabled" if not model_enabled or not enabled else "not_configured",
        )

    def list_services(self) -> list[AIServiceResponse]:
        return [self._service_response(service) for service in self._services.values()]

    def get_service(self, service_id: str) -> AIServiceResponse:
        return self._service_response(self._service(service_id))

    def update_service(self, service_id: str, update: AIServiceUpdate, actor: str | None = None) -> AIServiceResponse:
        current = self._service(service_id)
        previous = self._safe_state(current)
        provider_id = update.provider_id or current.provider_id
        self._provider(provider_id)
        model_id = update.model_id or current.model_id
        model = self._model(provider_id, model_id)
        if not model.enabled or not self._model_enabled(provider_id, model_id):
            raise ValueError("Model is disabled")
        fallbacks = update.fallback_provider_ids if update.fallback_provider_ids is not None else current.fallback_provider_ids
        for fallback in fallbacks:
            self._provider(fallback)
            if fallback == provider_id:
                raise ValueError("Fallback provider must differ from primary provider")
            if not self._provider_enabled(fallback):
                raise ValueError("Fallback provider is disabled")
        if update.enabled is True and (not self._provider_enabled(provider_id) or not self._provider_configured(provider_id)):
            raise ValueError("Enabled service requires an enabled, configured provider")
        current.provider_id, current.model_id = provider_id, model_id
        if update.enabled is not None:
            current.enabled = update.enabled
        current.fallback_provider_ids = fallbacks
        self._repository.save_service(current)
        self._services[current.id] = current
        self._bump_revision(actor)
        self._audit_sink.record(AuditEvent("update", "service", current.id, previous, self._safe_state(current), datetime.now(timezone.utc).isoformat(), actor))
        return self._service_response(current)

    def update_model(self, provider_id: str, model_id: str, enabled: bool, actor: str | None = None) -> ModelResponse:
        model = self._model(provider_id, model_id)
        state = self._models[(provider_id, model_id)]
        previous = state.enabled
        state.enabled = enabled
        self._repository.save_model(state)
        self._audit_sink.record(AuditEvent(
            "update", "model", model_id,
            {"provider_id": provider_id, "enabled": previous},
            {"provider_id": provider_id, "enabled": enabled},
            datetime.now(timezone.utc).isoformat(), actor,
        ))
        self._bump_revision(actor)
        return self._model_response(model)

    def update_provider(self, provider_id: str, enabled: bool, actor: str | None = None) -> ProviderResponse:
        provider = self._provider(provider_id)
        state = self._providers[provider.id]
        previous = state.enabled
        state.enabled = enabled
        self._repository.save_provider(state)
        self._audit_sink.record(AuditEvent(
            "update", "provider", provider.id,
            {"enabled": previous}, {"enabled": enabled},
            datetime.now(timezone.utc).isoformat(), actor,
        ))
        self._bump_revision(actor)
        return self.get_provider(provider.id)

    def _model_enabled(self, provider_id: str, model_id: str) -> bool:
        state = self._models.get((provider_id, model_id))
        return state is not None and state.enabled

    def _bump_revision(self, source: str | None) -> None:
        self._version = ConfigurationVersion(
            self._version.revision + 1, datetime.now(timezone.utc).isoformat(), source
        )
        self._runtime_settings.updated_source = source
        self._repository.save_runtime_settings(self._runtime_settings)

    def routing(self, service_id: str) -> list[tuple[str, str]]:
        service = self._service(service_id)
        if not service.enabled:
            raise ValueError("AI service is disabled")
        candidates = [service.provider_id, *service.fallback_provider_ids]
        result = []
        for provider_id in candidates:
            self._provider(provider_id)
            if self._provider_enabled(provider_id) and self._provider_configured(provider_id):
                model = service.model_id if provider_id == service.provider_id else os.getenv(
                    PROVIDER_DEFINITIONS[provider_id].model_env, MODEL_DEFINITIONS[provider_id].id
                )
                if self._model_enabled(provider_id, model):
                    result.append((provider_id, model))
        if not result:
            raise ValueError("No enabled, configured provider is available")
        return result

    @staticmethod
    def _safe_state(service: ServiceState) -> dict[str, object]:
        return {"id": service.id, "provider_id": service.provider_id, "model_id": service.model_id, "enabled": service.enabled, "fallback_provider_ids": list(service.fallback_provider_ids)}


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    return default if value is None else value.lower() in {"1", "true", "yes", "on"}


def _validate_safe_configuration(configuration: dict[str, str]) -> None:
    forbidden = ("key", "token", "password", "secret", "credential", "authorization")
    if any(any(term in name.lower() for term in forbidden) for name in configuration):
        raise ValueError("Secret-bearing configuration is not persistable")


AIAdminService = AIServiceAdmin


def _build_ai_admin_service() -> AIServiceAdmin:
    """Use durable Mongo persistence when AI_MONGODB_URI is set; else in-memory."""
    if not os.getenv("AI_MONGODB_URI"):
        return AIServiceAdmin()
    from mongo_store import get_database, MongoConfigurationRepository, MongoAuditSink

    db = get_database()
    if db is None:
        return AIServiceAdmin()
    return AIServiceAdmin(
        repository=MongoConfigurationRepository(db),
        audit_sink=MongoAuditSink(db),
    )


ai_admin_service = _build_ai_admin_service()
