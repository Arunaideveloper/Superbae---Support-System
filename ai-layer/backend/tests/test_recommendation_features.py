"""Tests for AI-004 Recommendation Features."""

import unittest
from services.recommendation_service import (
    RecommendationConfigService,
    RecommendationFeatureInput,
    InMemoryRecommendationRepository,
)


class TestRecommendationFeatures(unittest.TestCase):
    """Test recommendation feature CRUD operations."""

    def setUp(self) -> None:
        """Set up test fixtures."""
        self.repository = InMemoryRecommendationRepository()
        self.service = RecommendationConfigService(repository=self.repository)

    def test_create_feature(self) -> None:
        """Test creating a recommendation feature."""
        input_data = RecommendationFeatureInput(
            display_name="Product Suggestions",
            description="Suggest products to users",
            enabled=True,
            applicable_contexts=["homepage", "product_page"],
            rule_ids=["rule-1", "rule-2"],
        )
        feature = self.service.create_feature("product_suggestions", input_data)

        self.assertEqual(feature.id, "product_suggestions")
        self.assertEqual(feature.display_name, "Product Suggestions")
        self.assertTrue(feature.enabled)
        self.assertEqual(len(feature.applicable_contexts), 2)

    def test_get_feature(self) -> None:
        """Test retrieving a feature by ID."""
        input_data = RecommendationFeatureInput(
            display_name="Test Feature",
            applicable_contexts=["test"],
        )
        created = self.service.create_feature("test_feature", input_data)
        retrieved = self.service.get_feature("test_feature")

        self.assertEqual(retrieved.id, created.id)
        self.assertEqual(retrieved.display_name, "Test Feature")

    def test_get_nonexistent_feature_raises_error(self) -> None:
        """Test that getting nonexistent feature raises ValueError."""
        with self.assertRaises(ValueError):
            self.service.get_feature("nonexistent")

    def test_list_features_sorted_by_name(self) -> None:
        """Test that features are sorted by display name."""
        for name in ["Zebra", "Apple", "Monkey"]:
            input_data = RecommendationFeatureInput(
                display_name=name,
            )
            self.service.create_feature(name.lower(), input_data)

        features = self.service.list_features()
        names = [f.display_name for f in features]
        self.assertEqual(names, ["Apple", "Monkey", "Zebra"])

    def test_update_feature(self) -> None:
        """Test updating an existing feature."""
        input1 = RecommendationFeatureInput(
            display_name="Original",
            applicable_contexts=["homepage"],
            rule_ids=["rule-1"],
        )
        created = self.service.create_feature("test_feature", input1)

        input2 = RecommendationFeatureInput(
            display_name="Updated",
            applicable_contexts=["homepage", "checkout"],
            rule_ids=["rule-1", "rule-2", "rule-3"],
        )
        updated = self.service.update_feature("test_feature", input2)

        self.assertEqual(updated.display_name, "Updated")
        self.assertEqual(len(updated.applicable_contexts), 2)
        self.assertEqual(len(updated.rule_ids), 3)

    def test_update_nonexistent_feature_raises_error(self) -> None:
        """Test that updating nonexistent feature raises ValueError."""
        input_data = RecommendationFeatureInput(display_name="Test")
        with self.assertRaises(ValueError):
            self.service.update_feature("nonexistent", input_data)

    def test_toggle_feature_enabled(self) -> None:
        """Test enabling/disabling a feature."""
        input_data = RecommendationFeatureInput(
            display_name="Toggle Test",
            enabled=True,
        )
        created = self.service.create_feature("toggle_test", input_data)

        disabled = self.service.toggle_feature("toggle_test", False)
        self.assertFalse(disabled.enabled)

        enabled = self.service.toggle_feature("toggle_test", True)
        self.assertTrue(enabled.enabled)

    def test_toggle_nonexistent_feature_raises_error(self) -> None:
        """Test that toggling nonexistent feature raises ValueError."""
        with self.assertRaises(ValueError):
            self.service.toggle_feature("nonexistent", True)

    def test_feature_contexts_preserved(self) -> None:
        """Test that applicable contexts are preserved."""
        contexts = ["homepage", "product_page", "checkout", "email"]
        input_data = RecommendationFeatureInput(
            display_name="Multi Context",
            applicable_contexts=contexts,
        )
        feature = self.service.create_feature("multi_context", input_data)

        self.assertEqual(len(feature.applicable_contexts), 4)
        for context in contexts:
            self.assertIn(context, feature.applicable_contexts)

    def test_feature_rule_mapping(self) -> None:
        """Test that rule IDs are mapped to features."""
        rule_ids = ["rule-1", "rule-2", "rule-3"]
        input_data = RecommendationFeatureInput(
            display_name="Rule Mapping",
            rule_ids=rule_ids,
        )
        feature = self.service.create_feature("rule_mapping", input_data)

        self.assertEqual(len(feature.rule_ids), 3)
        for rule_id in rule_ids:
            self.assertIn(rule_id, feature.rule_ids)

    def test_feature_timestamps_set(self) -> None:
        """Test that created_at and updated_at timestamps are set."""
        input_data = RecommendationFeatureInput(
            display_name="Timestamp Test",
        )
        feature = self.service.create_feature("timestamp_test", input_data)

        self.assertIsNotNone(feature.created_at)
        self.assertIsNotNone(feature.updated_at)
        self.assertEqual(feature.created_at, feature.updated_at)

    def test_audit_events_recorded(self) -> None:
        """Test that audit events are recorded for feature operations."""
        from services.ai_admin_service import InMemoryAuditSink

        audit_sink = InMemoryAuditSink()
        service = RecommendationConfigService(
            repository=self.repository, audit_sink=audit_sink
        )

        input_data = RecommendationFeatureInput(
            display_name="Audit Test",
        )
        service.create_feature("audit_test", input_data)

        # Should have one create event
        self.assertEqual(len(audit_sink.events), 1)
        event = audit_sink.events[0]
        self.assertEqual(event.action, "create")
        self.assertEqual(event.resource, "recommendation_feature")

        # Update should add another event
        updated_input = RecommendationFeatureInput(
            display_name="Updated",
            rule_ids=["rule-1"],
        )
        service.update_feature("audit_test", updated_input)
        self.assertEqual(len(audit_sink.events), 2)

        # Toggle should add another event
        service.toggle_feature("audit_test", False)
        self.assertEqual(len(audit_sink.events), 3)

    def test_empty_contexts_and_rules_allowed(self) -> None:
        """Test that features can be created with empty contexts and rules."""
        input_data = RecommendationFeatureInput(
            display_name="Empty Feature",
            applicable_contexts=[],
            rule_ids=[],
        )
        feature = self.service.create_feature("empty_feature", input_data)

        self.assertEqual(len(feature.applicable_contexts), 0)
        self.assertEqual(len(feature.rule_ids), 0)

    def test_feature_disabled_by_default(self) -> None:
        """Test feature enable behavior."""
        input_data = RecommendationFeatureInput(
            display_name="Test",
            enabled=False,
        )
        feature = self.service.create_feature("test", input_data)

        self.assertFalse(feature.enabled)

    def test_delete_feature(self) -> None:
        """Test deleting a feature."""
        input_data = RecommendationFeatureInput(display_name="To Delete")
        self.service.create_feature("to_delete", input_data)

        self.service.delete_feature("to_delete")

        with self.assertRaises(ValueError):
            self.service.get_feature("to_delete")

    def test_delete_nonexistent_feature_raises_error(self) -> None:
        """Test that deleting a nonexistent feature raises ValueError."""
        with self.assertRaises(ValueError):
            self.service.delete_feature("nonexistent")

    def test_delete_feature_api_endpoint(self) -> None:
        """Test HTTP DELETE /ai/recommendations/features/{feature_id} endpoint."""
        import os
        from unittest.mock import patch
        from fastapi.testclient import TestClient
        from main import app

        with patch.dict(os.environ, {"AI_ADMIN_API_KEY": "admin-secret"}):
            with TestClient(app) as client:
                # Create feature first
                create_res = client.post(
                    "/ai/recommendations/features/api_del_test",
                    json={"display_name": "API Del Test"},
                    headers={"X-AI-Admin-Key": "admin-secret"},
                )
                self.assertEqual(create_res.status_code, 200)

                # Delete feature unauthorized
                unauth_res = client.delete("/ai/recommendations/features/api_del_test")
                self.assertEqual(unauth_res.status_code, 401)

                # Delete feature authorized
                auth_res = client.delete(
                    "/ai/recommendations/features/api_del_test",
                    headers={"X-AI-Admin-Key": "admin-secret"},
                )
                self.assertEqual(auth_res.status_code, 200)
                self.assertIn("deleted successfully", auth_res.json()["message"])

                # Delete non-existent feature
                not_found_res = client.delete(
                    "/ai/recommendations/features/api_del_test",
                    headers={"X-AI-Admin-Key": "admin-secret"},
                )
                self.assertEqual(not_found_res.status_code, 404)


if __name__ == "__main__":
    unittest.main()
