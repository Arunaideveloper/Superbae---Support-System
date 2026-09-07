from __future__ import annotations

import asyncio
import os
import unittest
from datetime import datetime, timedelta, timezone

from pydantic import ValidationError

# Avoid a network attempt while importing the existing RAG-enabled AI service in tests.
os.environ.setdefault("HF_HUB_OFFLINE", "1")

from services.ai_service import AIService, ChatMessage, ProviderTokenUsage
from services.ai_usage_service import (
    AIUsageService,
    InMemoryAIUsageRepository,
    InMemoryPricingCatalog,
    ModelPricing,
    UsageEventInput,
    ai_usage_service,
)


class UsageEventAndAggregationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.repository = InMemoryAIUsageRepository()
        self.service = AIUsageService(
            self.repository,
            InMemoryPricingCatalog({("openai", "model-a"): ModelPricing(2.0, 4.0)}),
        )
        self.now = datetime(2026, 9, 1, 12, tzinfo=timezone.utc)

    def record(self, request_id: str, **overrides: object) -> None:
        data: dict[str, object] = {
            "request_id": request_id, "timestamp": self.now, "provider_id": "openai",
            "model_id": "model-a", "feature": "customer_support", "operation": "chat",
            "status": "success", "input_tokens": 100, "output_tokens": 50,
            "token_usage_source": "provider_reported",
        }
        data.update(overrides)
        self.service.record(data)

    def test_valid_event_calculates_total_and_configured_estimated_cost(self) -> None:
        self.record("request-1")
        event = self.repository.list_events()[0]
        self.assertEqual(event.total_tokens, 150)
        self.assertEqual(event.token_usage_source, "provider_reported")
        self.assertEqual(event.estimated_cost, 0.0004)

    def test_invalid_token_counts_and_inconsistent_totals_are_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            UsageEventInput(request_id="bad", status="success", input_tokens=-1)
        with self.assertRaises(ValidationError):
            UsageEventInput(request_id="bad", status="success", input_tokens=1, output_tokens=2, total_tokens=9,
                            token_usage_source="provider_reported")
        with self.assertRaises(ValidationError):
            UsageEventInput(request_id="bad", status="success", timestamp=datetime(2026, 9, 1, 12))

    def test_missing_usage_and_unknown_pricing_do_not_fabricate_tokens_or_cost(self) -> None:
        self.service.record({"request_id": "unknown", "status": "failed", "feature": "future_feature"})
        self.service.record({"request_id": "no-price", "status": "success", "provider_id": "unknown", "model_id": "x",
                             "input_tokens": 1, "output_tokens": 2, "token_usage_source": "provider_reported"})
        events = self.repository.list_events()
        self.assertEqual(events[0].feature, "future_feature")
        self.assertIsNone(events[0].total_tokens)
        self.assertIsNone(events[1].estimated_cost)

    def test_live_service_configures_official_gpt_4o_mini_pricing(self) -> None:
        event = ai_usage_service.record({
            "request_id": "live-gpt-4o-mini-pricing", "provider_id": "openai",
            "model_id": "gpt-4o-mini", "status": "success", "input_tokens": 1_000_000,
            "output_tokens": 1_000_000, "token_usage_source": "provider_reported",
        })
        self.assertEqual(event.estimated_cost, 0.75)

    def test_provider_model_feature_and_volume_aggregations_with_time_filter(self) -> None:
        self.record("one")
        self.record("two", provider_id="gemini", model_id="gemini-a", feature="fraud_detection", status="failed",
                    input_tokens=10, output_tokens=5)
        self.record("old", timestamp=self.now - timedelta(days=2))
        summary = self.service.summary(start_at=self.now - timedelta(hours=1), end_at=self.now + timedelta(hours=1))
        self.assertEqual((summary.total_requests, summary.successful_requests, summary.failed_requests), (2, 1, 1))
        self.assertEqual(summary.known_total_tokens, 165)
        self.assertEqual(summary.requests_with_estimated_cost, 1)
        self.assertEqual(self.service.breakdown("provider")[0].group, "gemini")
        self.assertEqual({item.group for item in self.service.breakdown("model")}, {"model-a", "gemini-a"})
        self.assertEqual({item.group for item in self.service.breakdown("feature")}, {"customer_support", "fraud_detection"})

    def test_empty_dataset_and_repository_filtering(self) -> None:
        self.assertEqual(self.service.summary().total_requests, 0)
        self.record("only")
        self.assertEqual(len(self.repository.list_events(provider_id="openai", feature="customer_support")), 1)
        self.assertEqual(len(self.repository.list_events(provider_id="gemini")), 0)


class _Admin:
    def routing(self, service_id: str) -> list[tuple[str, str]]:
        self.service_id = service_id
        return [("openai", "model-a")]


class _Provider:
    last_usage = ProviderTokenUsage(input_tokens=7, output_tokens=3, total_tokens=10)

    async def generate_response(self, messages: list[ChatMessage]) -> str:
        return "ok"


class _BrokenRecorder:
    def record(self, event: UsageEventInput) -> None:
        raise RuntimeError("analytics store unavailable")


class CentralInstrumentationTests(unittest.TestCase):
    def test_provider_reported_usage_is_recorded_centrally(self) -> None:
        usage = AIUsageService()
        ai = AIService(providers=[_Provider()], admin_service=_Admin(), usage_service=usage)
        ai._retriever = None
        self.assertEqual(asyncio.run(ai.chat("hello", [])), "ok")
        summary = usage.summary()
        self.assertEqual((summary.total_requests, summary.known_total_tokens), (1, 10))
        self.assertEqual(usage.breakdown("feature")[0].group, "customer_support")

    def test_usage_recorder_failure_does_not_break_chat(self) -> None:
        ai = AIService(providers=[_Provider()], admin_service=_Admin(), usage_service=_BrokenRecorder())  # type: ignore[arg-type]
        ai._retriever = None
        self.assertEqual(asyncio.run(ai.chat("hello", [])), "ok")


if __name__ == "__main__":
    unittest.main()
