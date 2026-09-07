from __future__ import annotations

import os
import unittest
from unittest.mock import patch

os.environ.setdefault("HF_HUB_OFFLINE", "1")

from fastapi.testclient import TestClient

from main import app


class AIUsageApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.env_patch = patch.dict(os.environ, {"AI_ADMIN_API_KEY": "usage-test-key"})
        self.env_patch.start()
        self.client = TestClient(app)
        self.headers = {"X-AI-Admin-Key": "usage-test-key"}

    def tearDown(self) -> None:
        self.env_patch.stop()

    def test_admin_authorization_and_safe_recording(self) -> None:
        payload = {
            "request_id": "api-usage-1", "provider_id": "openai", "model_id": "test-model",
            "feature": "recommendation", "operation": "rank", "status": "success",
            "input_tokens": 12, "output_tokens": 8, "token_usage_source": "provider_reported",
        }
        self.assertEqual(self.client.post("/ai/usage/record", json=payload).status_code, 401)
        response = self.client.post("/ai/usage/record", json=payload, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["total_tokens"], 20)
        self.assertNotIn("prompt", data)
        self.assertNotIn("authorization", data)
        forbidden_content = self.client.post("/ai/usage/record", json={
            "request_id": "unsafe", "status": "success", "prompt": "private customer message",
        }, headers=self.headers)
        self.assertEqual(forbidden_content.status_code, 422)

    def test_summary_breakdowns_and_validation(self) -> None:
        for request_id, provider, feature in (("api-usage-2", "openai", "customer_support"), ("api-usage-3", "gemini", "fraud_detection")):
            response = self.client.post("/ai/usage/record", json={
                "request_id": request_id, "provider_id": provider, "model_id": "test-model",
                "feature": feature, "status": "failed", "error_category": "provider_error",
            }, headers=self.headers)
            self.assertEqual(response.status_code, 200)
        summary = self.client.get("/ai/usage/summary?feature=fraud_detection", headers=self.headers)
        self.assertEqual(summary.status_code, 200)
        self.assertGreaterEqual(summary.json()["failed_requests"], 1)
        self.assertTrue(self.client.get("/ai/usage/by-provider", headers=self.headers).json())
        self.assertTrue(self.client.get("/ai/usage/by-model", headers=self.headers).json())
        self.assertTrue(self.client.get("/ai/usage/by-feature", headers=self.headers).json())
        invalid = self.client.post("/ai/usage/record", json={
            "request_id": "bad", "status": "success", "input_tokens": 1, "output_tokens": 2,
            "total_tokens": 9, "token_usage_source": "provider_reported",
        }, headers=self.headers)
        self.assertEqual(invalid.status_code, 422)


if __name__ == "__main__":
    unittest.main()
