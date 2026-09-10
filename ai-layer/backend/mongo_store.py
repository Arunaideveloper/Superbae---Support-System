"""
Durable MongoDB-backed implementations of the AI layer's persistence boundaries:
  - AIConfigurationRepository  (providers / models / services / runtime / version)
  - AuditSink                  (admin change audit trail)
  - AIUsageRepository          (AI-003 safe, content-free usage events)

Activated only when AI_MONGODB_URI is set, so tests and local runs without a
database keep using the in-memory defaults. The AI layer writes into the SAME
MongoDB the main Superbae backend uses. pymongo is imported lazily.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone

from services.ai_admin_service import (
    AIConfigurationSnapshot,
    AuditEvent,
    ConfigurationConflictError,
    ConfigurationVersion,
    ModelState,
    ProviderState,
    RuntimeSettings,
    ServiceState,
)
from services.ai_usage_service import UsageEvent, UsageStatus


def _model_key(provider_id: str, model_id: str) -> str:
    return f"{provider_id} {model_id}"


class MongoConfigurationRepository:
    def __init__(self, db) -> None:
        self._providers = db["ai_providers"]
        self._models = db["ai_models"]
        self._services = db["ai_services"]
        self._runtime = db["ai_runtime_settings"]
        self._version = db["ai_config_version"]

    def load_providers(self) -> dict[str, ProviderState]:
        out: dict[str, ProviderState] = {}
        for doc in self._providers.find():
            out[doc["_id"]] = ProviderState(doc["_id"], doc.get("enabled", True), dict(doc.get("configuration", {})))
        return out

    def save_provider(self, provider: ProviderState) -> None:
        self._providers.update_one(
            {"_id": provider.id},
            {"$set": {"enabled": provider.enabled, "configuration": dict(provider.configuration)}},
            upsert=True,
        )

    def load_models(self) -> dict[tuple[str, str], ModelState]:
        out: dict[tuple[str, str], ModelState] = {}
        for doc in self._models.find():
            out[(doc["provider_id"], doc["model_id"])] = ModelState(
                doc["provider_id"], doc["model_id"], doc.get("enabled", True), dict(doc.get("configuration", {}))
            )
        return out

    def save_model(self, model: ModelState) -> None:
        self._models.update_one(
            {"_id": _model_key(model.provider_id, model.model_id)},
            {"$set": {"provider_id": model.provider_id, "model_id": model.model_id,
                      "enabled": model.enabled, "configuration": dict(model.configuration)}},
            upsert=True,
        )

    def load_services(self) -> dict[str, ServiceState]:
        out: dict[str, ServiceState] = {}
        for doc in self._services.find():
            out[doc["_id"]] = ServiceState(
                doc["_id"], doc.get("display_name", ""), doc["provider_id"], doc["model_id"],
                doc.get("enabled", True), list(doc.get("fallback_provider_ids", [])),
            )
        return out

    def save_service(self, service: ServiceState) -> None:
        self._services.update_one(
            {"_id": service.id},
            {"$set": {"display_name": service.display_name, "provider_id": service.provider_id,
                      "model_id": service.model_id, "enabled": service.enabled,
                      "fallback_provider_ids": list(service.fallback_provider_ids)}},
            upsert=True,
        )

    def load_runtime_settings(self) -> RuntimeSettings:
        doc = self._runtime.find_one({"_id": "runtime"})
        if not doc:
            return RuntimeSettings()
        return RuntimeSettings(doc.get("active_service_id", "customer_support"), doc.get("updated_source"))

    def save_runtime_settings(self, settings: RuntimeSettings) -> None:
        self._runtime.update_one(
            {"_id": "runtime"},
            {"$set": {"active_service_id": settings.active_service_id, "updated_source": settings.updated_source}},
            upsert=True,
        )

    def _load_version(self) -> ConfigurationVersion:
        doc = self._version.find_one({"_id": "version"})
        if not doc:
            return ConfigurationVersion()
        return ConfigurationVersion(doc.get("revision", 0), doc.get("updated_at"), doc.get("updated_source"))

    def _save_version(self, version: ConfigurationVersion) -> None:
        self._version.update_one(
            {"_id": "version"},
            {"$set": {"revision": version.revision, "updated_at": version.updated_at, "updated_source": version.updated_source}},
            upsert=True,
        )

    def load_configuration(self) -> AIConfigurationSnapshot:
        return AIConfigurationSnapshot(
            self.load_providers(), self.load_models(), self.load_services(),
            self.load_runtime_settings(), self._load_version(),
        )

    def save_configuration(self, configuration: AIConfigurationSnapshot, expected_revision: int) -> ConfigurationVersion:
        current = self._load_version()
        if current.revision != expected_revision:
            raise ConfigurationConflictError("AI configuration revision conflict")
        for provider in configuration.providers.values():
            self.save_provider(provider)
        for model in configuration.models.values():
            self.save_model(model)
        for service in configuration.services.values():
            self.save_service(service)
        self.save_runtime_settings(configuration.runtime_settings)
        new_version = ConfigurationVersion(
            expected_revision + 1, datetime.now(timezone.utc).isoformat(), configuration.version.updated_source
        )
        self._save_version(new_version)
        return new_version


class MongoAuditSink:
    def __init__(self, db) -> None:
        self._events = db["ai_audit_events"]

    def record(self, event: AuditEvent) -> None:
        self._events.insert_one({
            "action": event.action, "resource": event.resource, "resource_id": event.resource_id,
            "previous": event.previous, "current": event.current,
            "occurred_at": event.occurred_at, "actor": event.actor,
        })


class MongoAIUsageRepository:
    def __init__(self, db) -> None:
        self._events = db["ai_usage_events"]

    def record_event(self, event: UsageEvent) -> UsageEvent:
        self._events.insert_one({
            "_id": event.id, "request_id": event.request_id, "timestamp": event.timestamp,
            "provider_id": event.provider_id, "model_id": event.model_id, "feature": event.feature,
            "operation": event.operation, "status": event.status, "input_tokens": event.input_tokens,
            "output_tokens": event.output_tokens, "total_tokens": event.total_tokens,
            "token_usage_source": event.token_usage_source, "latency_ms": event.latency_ms,
            "estimated_cost": event.estimated_cost, "currency": event.currency,
            "error_category": event.error_category,
        })
        return event

    def list_events(self, provider_id: str | None = None, model_id: str | None = None,
                    feature: str | None = None, status: UsageStatus | None = None,
                    start_at: datetime | None = None, end_at: datetime | None = None) -> list[UsageEvent]:
        query: dict[str, object] = {}
        if provider_id is not None:
            query["provider_id"] = provider_id.lower()
        if model_id is not None:
            query["model_id"] = model_id
        if feature is not None:
            query["feature"] = feature.lower()
        if status is not None:
            query["status"] = status
        if start_at is not None or end_at is not None:
            ts: dict[str, datetime] = {}
            if start_at is not None:
                ts["$gte"] = start_at.astimezone(timezone.utc)
            if end_at is not None:
                ts["$lt"] = end_at.astimezone(timezone.utc)
            query["timestamp"] = ts
        events: list[UsageEvent] = []
        for doc in self._events.find(query):
            ts_value = doc["timestamp"]
            if isinstance(ts_value, datetime) and ts_value.tzinfo is None:
                ts_value = ts_value.replace(tzinfo=timezone.utc)
            events.append(UsageEvent(
                id=doc["_id"], request_id=doc["request_id"], timestamp=ts_value,
                provider_id=doc.get("provider_id"), model_id=doc.get("model_id"),
                feature=doc.get("feature", "unknown"), operation=doc.get("operation"),
                status=doc["status"], input_tokens=doc.get("input_tokens"),
                output_tokens=doc.get("output_tokens"), total_tokens=doc.get("total_tokens"),
                token_usage_source=doc.get("token_usage_source", "unavailable"),
                latency_ms=doc.get("latency_ms"), estimated_cost=doc.get("estimated_cost"),
                currency=doc.get("currency", "USD"), error_category=doc.get("error_category"),
            ))
        return events


class MongoFraudRepository:
    """Durable store for fraud assessments (AI-002). Same shape as the in-memory
    repository, backed by the 'fraud_assessments' collection. Fraud dataclasses
    are imported lazily to avoid a circular import at module load."""

    def __init__(self, db) -> None:
        self._col = db["fraud_assessments"]
        # Best-effort indexes for the review console's filters/sort.
        try:
            self._col.create_index("activity_id")
            self._col.create_index("investigation_status")
            self._col.create_index([("analysis_date", -1)])
        except Exception:
            pass  # index creation is best-effort; never block on it

    @staticmethod
    def _to_doc(a) -> dict:
        return {
            "_id": a.id, "activity_id": a.activity_id, "activity_type": a.activity_type,
            "risk_score": a.risk_score, "risk_level": a.risk_level,
            "indicators": [
                {
                    "signal_name": s.signal_name, "triggered": s.triggered,
                    "signal_value": s.signal_value, "risk_contribution": s.risk_contribution,
                    "explanation": s.explanation, "data_used": s.data_used, "evaluable": s.evaluable,
                }
                for s in a.indicators
            ],
            "explanation": a.explanation, "signals_available": a.signals_available,
            "signals_used": a.signals_used, "signals_unavailable": a.signals_unavailable,
            "analysis_method": a.analysis_method, "confidence": a.confidence,
            "analysis_date": a.analysis_date, "investigation_status": a.investigation_status,
            "reviewed_at": a.reviewed_at, "reviewed_by": a.reviewed_by, "review_notes": a.review_notes,
        }

    @staticmethod
    def _to_assessment(doc):
        from services.fraud_detection_service import FraudAssessment, SignalAnalysis
        return FraudAssessment(
            id=doc["_id"], activity_id=doc["activity_id"], activity_type=doc["activity_type"],
            risk_score=doc["risk_score"], risk_level=doc["risk_level"],
            indicators=[
                SignalAnalysis(
                    signal_name=i["signal_name"], triggered=i["triggered"],
                    signal_value=i.get("signal_value"), risk_contribution=i["risk_contribution"],
                    explanation=i["explanation"], data_used=i.get("data_used", {}),
                    evaluable=i.get("evaluable", True),
                )
                for i in doc.get("indicators", [])
            ],
            explanation=doc["explanation"], signals_available=doc.get("signals_available", {}),
            signals_used=doc.get("signals_used", []), signals_unavailable=doc.get("signals_unavailable", []),
            analysis_method=doc["analysis_method"], confidence=doc["confidence"],
            analysis_date=doc["analysis_date"], investigation_status=doc["investigation_status"],
            reviewed_at=doc.get("reviewed_at"), reviewed_by=doc.get("reviewed_by"),
            review_notes=doc.get("review_notes"),
        )

    @staticmethod
    def _query(activity_id, status) -> dict:
        q: dict = {}
        if activity_id:
            q["activity_id"] = activity_id
        if status:
            q["investigation_status"] = status
        return q

    def create_assessment(self, assessment):
        self._col.replace_one({"_id": assessment.id}, self._to_doc(assessment), upsert=True)
        return assessment

    def get_assessment(self, assessment_id: str):
        doc = self._col.find_one({"_id": assessment_id})
        if not doc:
            raise ValueError(f"Fraud assessment '{assessment_id}' not found")
        return self._to_assessment(doc)

    def update_assessment(self, assessment):
        result = self._col.replace_one({"_id": assessment.id}, self._to_doc(assessment))
        if result.matched_count == 0:
            raise ValueError(f"Fraud assessment '{assessment.id}' not found")
        return assessment

    def list_assessments(self, activity_id=None, status=None, limit=100, offset=0):
        cursor = self._col.find(self._query(activity_id, status)).sort("analysis_date", -1).skip(offset).limit(limit)
        return [self._to_assessment(d) for d in cursor]

    def list_flagged_assessments(self, limit=100):
        cursor = self._col.find({"investigation_status": "flagged"}).sort("analysis_date", -1).limit(limit)
        return [self._to_assessment(d) for d in cursor]

    def count_assessments(self, activity_id=None, status=None):
        return self._col.count_documents(self._query(activity_id, status))


def get_database(uri: str | None = None, db_name: str | None = None):
    uri = uri or os.getenv("AI_MONGODB_URI")
    if not uri:
        return None
    from pymongo import MongoClient
    name = db_name or os.getenv("AI_MONGODB_DB") or "superbae"
    return MongoClient(uri)[name]
