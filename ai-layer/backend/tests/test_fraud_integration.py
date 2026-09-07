from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app
from services.ai_service import ChatMessage, ai_service


class FraudIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.env_patch = patch.dict(
            os.environ,
            {
                "AI_ADMIN_API_KEY": "test-admin-secret-key",
            },
        )
        self.env_patch.start()
        self.client = TestClient(app)
        self.auth_headers = {"X-AI-Admin-Key": "test-admin-secret-key"}

    def tearDown(self) -> None:
        self.env_patch.stop()

    def test_admin_authorization_enforced_on_fraud_endpoints(self) -> None:
        # Unauthorized requests (no key)
        unauth_analyze = self.client.post("/ai/fraud/analyze", json={"activity_id": "act-auth"})
        unauth_list = self.client.get("/ai/fraud/assessments")
        unauth_get = self.client.get("/ai/fraud/assessments/ass-123")
        unauth_put = self.client.put("/ai/fraud/assessments/ass-123", json={"investigation_status": "dismissed"})

        self.assertEqual(unauth_analyze.status_code, 401)
        self.assertEqual(unauth_list.status_code, 401)
        self.assertEqual(unauth_get.status_code, 401)
        self.assertEqual(unauth_put.status_code, 401)

        # Invalid key
        invalid_headers = {"X-AI-Admin-Key": "wrong-secret"}
        bad_auth = self.client.get("/ai/fraud/assessments", headers=invalid_headers)
        self.assertEqual(bad_auth.status_code, 401)

    def test_analyze_normal_activity_endpoint(self) -> None:
        payload = {
            "activity_id": "act-api-normal",
            "activity_type": "referral",
            "clicks": 100,
            "conversions": 5,
            "referrer_id": "ref-api-1",
            "timestamp": "2026-08-31T12:00:00Z",
        }
        response = self.client.post("/ai/fraud/analyze", json=payload, headers=self.auth_headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertEqual(data["activity_id"], "act-api-normal")
        self.assertEqual(data["risk_level"], "low")
        self.assertEqual(data["risk_score"], 0.0)
        self.assertEqual(data["investigation_status"], "flagged")
        self.assertIn("LOW risk", data["explanation"])
        self.assertIsInstance(data["signals_available"], dict)
        self.assertIsInstance(data["signals_used"], list)

    def test_analyze_suspicious_activity_endpoint(self) -> None:
        payload = {
            "activity_id": "act-api-suspicious",
            "activity_type": "referral",
            "clicks": 50,
            "conversions": 48,
            "referrer_id": "ref-spammer-99",
            "timestamp": "2026-08-31T14:30:00Z",
            "metadata": {
                "referrals_in_window": 30,
                "temporal_clustering": True,
            },
        }
        response = self.client.post("/ai/fraud/analyze", json=payload, headers=self.auth_headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertEqual(data["activity_id"], "act-api-suspicious")
        self.assertEqual(data["risk_level"], "high")
        self.assertGreaterEqual(data["risk_score"], 60.0)
        self.assertGreater(len(data["indicators"]), 0)
        self.assertIn("HIGH risk", data["explanation"])

    def test_analyze_with_partial_and_unknown_fields(self) -> None:
        payload = {
            "activity_id": "act-api-flexible",
            "some_unknown_backend_key": "arbitrary_data",
            "another_future_field": 12345,
        }
        response = self.client.post("/ai/fraud/analyze", json=payload, headers=self.auth_headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["activity_id"], "act-api-flexible")
        self.assertEqual(data["risk_level"], "low")

    def test_get_assessment_by_id_and_404_handling(self) -> None:
        # 1. Create via analyze
        create_resp = self.client.post(
            "/ai/fraud/analyze",
            json={"activity_id": "act-get-test", "clicks": 20, "conversions": 19},
            headers=self.auth_headers,
        )
        assessment_id = create_resp.json()["id"]

        # 2. Retrieve by ID
        get_resp = self.client.get(f"/ai/fraud/assessments/{assessment_id}", headers=self.auth_headers)
        self.assertEqual(get_resp.status_code, 200)
        self.assertEqual(get_resp.json()["id"], assessment_id)

        # 3. 404 for unknown ID
        not_found_resp = self.client.get("/ai/fraud/assessments/non-existent-id-999", headers=self.auth_headers)
        self.assertEqual(not_found_resp.status_code, 404)

    def test_list_assessments_with_filters_and_pagination(self) -> None:
        # Create multiple assessments
        for i in range(4):
            self.client.post(
                "/ai/fraud/analyze",
                json={"activity_id": f"act-list-{i}", "clicks": 10, "conversions": 1},
                headers=self.auth_headers,
            )

        list_resp = self.client.get("/ai/fraud/assessments?limit=2&offset=0", headers=self.auth_headers)
        self.assertEqual(list_resp.status_code, 200)
        data = list_resp.json()
        self.assertEqual(len(data["assessments"]), 2)
        self.assertGreaterEqual(data["total"], 4)
        self.assertEqual(data["limit"], 2)
        self.assertEqual(data["offset"], 0)

        # Filter by activity_id
        filtered_resp = self.client.get("/ai/fraud/assessments?activity_id=act-list-1", headers=self.auth_headers)
        self.assertEqual(filtered_resp.status_code, 200)
        self.assertEqual(len(filtered_resp.json()["assessments"]), 1)

    def test_update_investigation_workflow_and_false_positive_dismissal(self) -> None:
        create_resp = self.client.post(
            "/ai/fraud/analyze",
            json={"activity_id": "act-update-test", "clicks": 50, "conversions": 45},
            headers=self.auth_headers,
        )
        assessment_id = create_resp.json()["id"]

        # 1. Update status to dismissed (false positive)
        update_payload = {
            "investigation_status": "dismissed",
            "review_notes": "Legitimate affiliate holiday promotion approved",
            "reviewed_by": "lead-fraud-analyst",
        }
        put_resp = self.client.put(
            f"/ai/fraud/assessments/{assessment_id}",
            json=update_payload,
            headers=self.auth_headers,
        )
        self.assertEqual(put_resp.status_code, 200)
        updated_data = put_resp.json()
        self.assertEqual(updated_data["investigation_status"], "dismissed")
        self.assertEqual(updated_data["reviewed_by"], "lead-fraud-analyst")
        self.assertEqual(updated_data["review_notes"], "Legitimate affiliate holiday promotion approved")
        self.assertIsNotNone(updated_data["reviewed_at"])

        # 2. Update invalid status -> 400 or 422
        bad_status_resp = self.client.put(
            f"/ai/fraud/assessments/{assessment_id}",
            json={"investigation_status": "not_a_valid_status"},
            headers=self.auth_headers,
        )
        self.assertIn(bad_status_resp.status_code, (400, 422))

        # 3. Update unknown assessment -> 404
        not_found_resp = self.client.put(
            "/ai/fraud/assessments/unknown-id-888",
            json={"investigation_status": "confirmed"},
            headers=self.auth_headers,
        )
        self.assertEqual(not_found_resp.status_code, 404)

    def test_existing_ai_001_and_chat_endpoints_regression(self) -> None:
        # Health check
        health = self.client.get("/")
        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.json()["service"], "superbae-ai")

        # AI-001 admin endpoints
        providers = self.client.get("/ai/providers", headers=self.auth_headers)
        models = self.client.get("/ai/models", headers=self.auth_headers)
        services = self.client.get("/ai/services", headers=self.auth_headers)

        self.assertEqual(providers.status_code, 200)
        self.assertEqual(models.status_code, 200)
        self.assertEqual(services.status_code, 200)

        # /chat endpoint regression
        async def fake_chat(message: str, history: list[ChatMessage]) -> str:
            return f"Chat response: {message}"

        with patch.object(ai_service, "chat", fake_chat):
            chat_resp = self.client.post(
                "/chat",
                json={"message": "Hello AI", "history": []},
            )
            self.assertEqual(chat_resp.status_code, 200)
            self.assertEqual(chat_resp.json()["response"], "Chat response: Hello AI")


if __name__ == "__main__":
    unittest.main()
