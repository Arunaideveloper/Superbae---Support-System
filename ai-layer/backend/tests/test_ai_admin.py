from __future__ import annotations

import asyncio
import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from services.ai_admin_service import (
    AIConfigurationSnapshot,
    AIServiceAdmin,
    AIServiceUpdate,
    ConfigurationConflictError,
    ConfigurationVersion,
    InMemoryAuditSink,
    InMemoryConfigurationRepository,
    ModelState,
    ProviderState,
    RuntimeSettings,
    ServiceState,
)
from services.ai_service import AIProviderError, AIService, ChatMessage


class FakeProvider:
    def __init__(self, response: str = "ok", fail: bool = False) -> None:
        self.response = response
        self.fail = fail

    async def generate_response(self, messages: list[ChatMessage]) -> str:
        if self.fail:
            raise RuntimeError("provider failure")
        return self.response


class AIAdminTests(unittest.TestCase):
    def setUp(self) -> None:
        self.environment = patch.dict(
            os.environ,
            {
                "OPENAI_API_KEY": "test-secret",
                "GEMINI_API_KEY": "fallback-secret",
                "AI_OPENROUTER_ENABLED": "false",
            },
        )
        self.environment.start()
        self.audit = InMemoryAuditSink()
        self.repository = InMemoryConfigurationRepository(
            {"customer_support": ServiceState("customer_support", "Customer Support", "openai", "gpt-4o-mini", True, ["gemini"])}
        )
        self.admin = AIServiceAdmin(self.repository, self.audit)

    def tearDown(self) -> None:
        self.environment.stop()

    def test_provider_and_model_relationship_is_safe(self) -> None:
        provider = self.admin.get_provider("openai")
        model = self.admin.list_models("openai")[0]

        self.assertEqual(provider.models, ["gpt-4o-mini"])
        self.assertEqual(model.provider_id, "openai")
        self.assertTrue(model.available)
        self.assertNotIn("test-secret", provider.model_dump_json())
        self.assertNotIn("api_key", provider.model_dump_json())

    def test_service_assignment_and_audit(self) -> None:
        updated = self.admin.update_service(
            "customer_support",
            AIServiceUpdate(
                provider_id="gemini",
                model_id="gemini-3.1-flash-lite",
                fallback_provider_ids=[],
            ),
            actor="local-admin",
        )

        self.assertEqual(updated.provider_id, "gemini")
        self.assertEqual(updated.model_id, "gemini-3.1-flash-lite")
        self.assertEqual(len(self.audit.events), 1)
        self.assertEqual(self.audit.events[0].actor, "local-admin")
        self.assertNotIn("secret", str(self.audit.events[0]))

    def test_invalid_assignment_and_disabled_service_are_rejected(self) -> None:
        with self.assertRaises(ValueError):
            self.admin.update_service("customer_support", AIServiceUpdate(provider_id="openai", model_id="gemini-3.1-flash-lite"))
        with self.assertRaises(ValueError):
            self.admin.update_service("customer_support", AIServiceUpdate(fallback_provider_ids=["openrouter"]))
        self.admin.update_service("customer_support", AIServiceUpdate(enabled=False))
        with self.assertRaises(ValueError):
            self.admin.routing("customer_support")

    def test_disabled_model_cannot_be_assigned(self) -> None:
        self.admin.update_model("gemini", "gemini-3.1-flash-lite", False)
        with self.assertRaises(ValueError):
            self.admin.update_service(
                "customer_support",
                AIServiceUpdate(provider_id="gemini", model_id="gemini-3.1-flash-lite", fallback_provider_ids=[]),
            )

    def test_routing_and_request_metadata_support_fallback(self) -> None:
        observer_events = []
        service = AIService(
            providers=[FakeProvider(fail=True), FakeProvider("fallback response")],
            admin_service=self.admin,
            request_observer=observer_events.append,
        )

        response = asyncio.run(service.chat("hello", []))

        self.assertEqual(response, "fallback response")
        self.assertEqual(observer_events[0].provider_id, "gemini")
        self.assertEqual(observer_events[0].model_id, "gemini-3.1-flash-lite")
        self.assertTrue(observer_events[0].success)
        self.assertIsNotNone(observer_events[0].request_id)
        self.assertGreaterEqual(observer_events[0].latency_ms, 0)

    def test_unknown_resources_are_rejected(self) -> None:
        with self.assertRaises(KeyError):
            self.admin.get_service("missing")
        with self.assertRaises(ValueError):
            self.admin.get_provider("missing")
        with self.assertRaises(ValueError):
            self.admin.list_models("missing")

    def test_disabled_provider_is_not_routable(self) -> None:
        self.admin.update_provider("openai", False)
        routes = self.admin.routing("customer_support")
        self.assertEqual(routes, [("gemini", "gemini-3.1-flash-lite")])

    def test_repository_round_trip_and_revision_conflict(self) -> None:
        repository = InMemoryConfigurationRepository(
            initial_providers={"openai": ProviderState("openai", True, {"region": "us"})},
            initial_models={("openai", "gpt-4o-mini"): ModelState("openai", "gpt-4o-mini", True, {"tier": "standard"})},
            initial_services={"customer_support": ServiceState("customer_support", "Customer Support", "openai", "gpt-4o-mini")},
            runtime_settings=RuntimeSettings("customer_support", "test"),
        )
        snapshot = repository.load_configuration()
        snapshot.services["customer_support"].enabled = False
        snapshot.version = ConfigurationVersion(0, None, "test")
        version = repository.save_configuration(snapshot, expected_revision=0)
        reloaded = repository.load_configuration()

        self.assertEqual(version.revision, 1)
        self.assertFalse(reloaded.services["customer_support"].enabled)
        self.assertEqual(reloaded.providers["openai"].configuration["region"], "us")
        self.assertEqual(reloaded.models[("openai", "gpt-4o-mini")].configuration["tier"], "standard")
        self.assertEqual(reloaded.runtime_settings.updated_source, "test")
        with self.assertRaises(ConfigurationConflictError):
            repository.save_configuration(snapshot, expected_revision=0)

    def test_admin_reloads_runtime_provider_and_model_state(self) -> None:
        self.admin.update_provider("openai", False)
        self.admin.update_model("gemini", "gemini-3.1-flash-lite", False)

        reloaded = AIServiceAdmin(self.repository, self.audit)

        self.assertFalse(reloaded.get_provider("openai").enabled)
        self.assertFalse(reloaded.list_models("gemini")[0].enabled)

    def test_secret_configuration_cannot_be_persisted(self) -> None:
        with self.assertRaises(ValueError):
            ProviderState("openai", True, {"api_key": "never-store-this"})

    def test_admin_key_is_required_when_configured(self) -> None:
        from main import app

        with patch.dict(os.environ, {"AI_ADMIN_API_KEY": "admin-secret"}):
            with TestClient(app) as client:
                unauthorized = client.get("/ai/providers")
                authorized = client.get(
                    "/ai/providers", headers={"X-AI-Admin-Key": "admin-secret"}
                )

        self.assertEqual(unauthorized.status_code, 401)
        self.assertEqual(authorized.status_code, 200)

    def test_api_and_existing_chat_contract(self) -> None:
        from main import app, ai_service

        async def fake_chat(message: str, history: list[ChatMessage]) -> str:
            return f"echo: {message} ({len(history)} history messages)"

        with patch.object(ai_service, "chat", fake_chat):
            with TestClient(app) as client:
                health = client.get("/")
                providers = client.get("/ai/providers")
                models = client.get("/ai/models")
                services = client.get("/ai/services")
                provider_update = client.put("/ai/providers/openai", json={"enabled": False})
                model_update = client.put("/ai/models/openai/gpt-4o-mini", json={"enabled": False})
                unknown = client.get("/ai/services/missing")
                invalid = client.put("/ai/services/customer_support", json={"model_id": "not-a-model"})
                chat = client.post("/chat", json={"message": "Hello", "history": [{"role": "user", "content": "Earlier"}]})

        self.assertEqual(health.status_code, 200)
        self.assertEqual(providers.status_code, 200)
        self.assertEqual(models.status_code, 200)
        self.assertEqual(provider_update.status_code, 200)
        self.assertEqual(model_update.status_code, 200)
        self.assertEqual(services.json()[0]["id"], "customer_support")
        self.assertEqual(unknown.status_code, 404)
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(chat.status_code, 200)
        self.assertEqual(chat.json()["response"], "echo: Hello (1 history messages)")
        self.assertFalse(any("api_key" in key or "secret" in key for key in services.json()[0]))


if __name__ == "__main__":
    unittest.main()
