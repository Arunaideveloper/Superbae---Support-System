"""Tests for AI-004 Recommendation Rules."""

import unittest
from pydantic import ValidationError
from services.recommendation_service import (
    RecommendationConfigService,
    RecommendationRuleInput,
    InMemoryRecommendationRepository,
)


class TestRecommendationRules(unittest.TestCase):
    """Test recommendation rule CRUD operations."""

    def setUp(self) -> None:
        """Set up test fixtures."""
        self.repository = InMemoryRecommendationRepository()
        self.service = RecommendationConfigService(repository=self.repository)

    def test_create_rule(self) -> None:
        """Test creating a recommendation rule."""
        input_data = RecommendationRuleInput(
            name="Test Rule",
            description="A test rule",
            rule_type="filter",
            enabled=True,
            priority=50,
            condition={"user_segment": "premium"},
            action={"filter_category": "exclusive"},
            template_ids=["template-1"],
        )
        rule = self.service.create_rule(input_data)

        self.assertEqual(rule.name, "Test Rule")
        self.assertEqual(rule.rule_type, "filter")
        self.assertTrue(rule.enabled)
        self.assertEqual(rule.priority, 50)
        self.assertIn("rule-", rule.id)

    def test_create_rule_rejects_secrets_in_condition(self) -> None:
        """Test that creating a rule with secrets in condition raises error."""
        with self.assertRaises(ValidationError):
            input_data = RecommendationRuleInput(
                name="Bad Rule",
                rule_type="filter",
                condition={"api_key": "secret123"},
                action={},
            )
            self.service.create_rule(input_data)

    def test_create_rule_rejects_secrets_in_action(self) -> None:
        """Test that creating a rule with secrets in action raises error."""
        with self.assertRaises(ValidationError):
            input_data = RecommendationRuleInput(
                name="Bad Rule",
                rule_type="filter",
                condition={},
                action={"password": "secret123"},
            )
            self.service.create_rule(input_data)

    def test_get_rule(self) -> None:
        """Test retrieving a rule by ID."""
        input_data = RecommendationRuleInput(
            name="Test Rule",
            rule_type="rank",
            priority=25,
        )
        created = self.service.create_rule(input_data)
        retrieved = self.service.get_rule(created.id)

        self.assertEqual(retrieved.id, created.id)
        self.assertEqual(retrieved.name, "Test Rule")

    def test_get_nonexistent_rule_raises_error(self) -> None:
        """Test that getting nonexistent rule raises ValueError."""
        with self.assertRaises(ValueError):
            self.service.get_rule("nonexistent-rule")

    def test_list_rules_sorted_by_priority(self) -> None:
        """Test that rules are sorted by priority."""
        for priority in [50, 30, 70]:
            input_data = RecommendationRuleInput(
                name=f"Rule {priority}",
                rule_type="filter",
                priority=priority,
                enabled=True,
            )
            self.service.create_rule(input_data)

        rules = self.service.list_rules()
        priorities = [r.priority for r in rules]
        # Enabled rules come first, then sorted by priority
        self.assertEqual(priorities, [30, 50, 70])

    def test_list_rules_disabled_last(self) -> None:
        """Test that disabled rules appear last."""
        input1 = RecommendationRuleInput(
            name="Enabled Rule",
            rule_type="filter",
            priority=50,
            enabled=True,
        )
        input2 = RecommendationRuleInput(
            name="Disabled Rule",
            rule_type="filter",
            priority=10,
            enabled=False,
        )
        self.service.create_rule(input1)
        self.service.create_rule(input2)

        rules = self.service.list_rules()
        self.assertTrue(rules[0].enabled)
        self.assertFalse(rules[1].enabled)

    def test_update_rule(self) -> None:
        """Test updating an existing rule."""
        input1 = RecommendationRuleInput(
            name="Original",
            rule_type="filter",
            priority=50,
            condition={"segment": "vip"},
        )
        created = self.service.create_rule(input1)

        input2 = RecommendationRuleInput(
            name="Updated",
            rule_type="rank",
            priority=75,
            condition={"segment": "premium"},
        )
        updated = self.service.update_rule(created.id, input2)

        self.assertEqual(updated.name, "Updated")
        self.assertEqual(updated.rule_type, "rank")
        self.assertEqual(updated.priority, 75)
        self.assertGreater(updated.version, 1)

    def test_update_nonexistent_rule_raises_error(self) -> None:
        """Test that updating nonexistent rule raises ValueError."""
        input_data = RecommendationRuleInput(
            name="Test",
            rule_type="filter",
        )
        with self.assertRaises(ValueError):
            self.service.update_rule("nonexistent", input_data)

    def test_delete_rule(self) -> None:
        """Test deleting a rule."""
        input_data = RecommendationRuleInput(
            name="To Delete",
            rule_type="filter",
        )
        created = self.service.create_rule(input_data)
        rule_id = created.id

        self.service.delete_rule(rule_id)

        with self.assertRaises(ValueError):
            self.service.get_rule(rule_id)

    def test_delete_nonexistent_rule_raises_error(self) -> None:
        """Test that deleting nonexistent rule raises ValueError."""
        with self.assertRaises(ValueError):
            self.service.delete_rule("nonexistent")

    def test_toggle_rule_enabled(self) -> None:
        """Test enabling/disabling a rule."""
        input_data = RecommendationRuleInput(
            name="Toggle Test",
            rule_type="filter",
            enabled=True,
        )
        created = self.service.create_rule(input_data)

        disabled = self.service.toggle_rule(created.id, False)
        self.assertFalse(disabled.enabled)

        enabled = self.service.toggle_rule(created.id, True)
        self.assertTrue(enabled.enabled)

    def test_toggle_nonexistent_rule_raises_error(self) -> None:
        """Test that toggling nonexistent rule raises ValueError."""
        with self.assertRaises(ValueError):
            self.service.toggle_rule("nonexistent", True)

    def test_rule_priority_validation(self) -> None:
        """Test that priority is within valid range."""
        # Valid priorities
        for priority in [1, 50, 100]:
            input_data = RecommendationRuleInput(
                name=f"Priority {priority}",
                rule_type="filter",
                priority=priority,
            )
            rule = self.service.create_rule(input_data)
            self.assertEqual(rule.priority, priority)

    def test_rule_type_validation(self) -> None:
        """Test that rule types are validated."""
        for rule_type in ["filter", "rank", "personalize"]:
            input_data = RecommendationRuleInput(
                name=f"Type {rule_type}",
                rule_type=rule_type,
            )
            rule = self.service.create_rule(input_data)
            self.assertEqual(rule.rule_type, rule_type)

    def test_rule_timestamps_set(self) -> None:
        """Test that created_at and updated_at timestamps are set."""
        input_data = RecommendationRuleInput(
            name="Timestamp Test",
            rule_type="filter",
        )
        rule = self.service.create_rule(input_data)

        self.assertIsNotNone(rule.created_at)
        self.assertIsNotNone(rule.updated_at)
        self.assertEqual(rule.created_at, rule.updated_at)

    def test_audit_events_recorded(self) -> None:
        """Test that audit events are recorded for rule operations."""
        from services.ai_admin_service import InMemoryAuditSink

        audit_sink = InMemoryAuditSink()
        service = RecommendationConfigService(
            repository=self.repository, audit_sink=audit_sink
        )

        input_data = RecommendationRuleInput(
            name="Audit Test",
            rule_type="filter",
        )
        created = service.create_rule(input_data)

        # Should have one create event
        self.assertEqual(len(audit_sink.events), 1)
        event = audit_sink.events[0]
        self.assertEqual(event.action, "create")
        self.assertEqual(event.resource, "recommendation_rule")

        # Update should add another event
        updated_input = RecommendationRuleInput(
            name="Updated",
            rule_type="rank",
        )
        service.update_rule(created.id, updated_input)
        self.assertEqual(len(audit_sink.events), 2)

        # Toggle should add another event
        service.toggle_rule(created.id, False)
        self.assertEqual(len(audit_sink.events), 3)

    def test_delete_rule_removes_rule_id_from_features(self) -> None:
        """Test that deleting a rule removes its ID from features."""
        from services.recommendation_service import RecommendationFeatureInput

        rule = self.service.create_rule(RecommendationRuleInput(name="Rule 1", rule_type="filter"))
        feature_input = RecommendationFeatureInput(display_name="Feature 1", rule_ids=[rule.id, "other-rule"])
        feature = self.service.create_feature("feat-1", feature_input)
        self.assertIn(rule.id, feature.rule_ids)

        self.service.delete_rule(rule.id)

        updated_feature = self.service.get_feature("feat-1")
        self.assertNotIn(rule.id, updated_feature.rule_ids)
        self.assertEqual(updated_feature.rule_ids, ["other-rule"])


if __name__ == "__main__":
    unittest.main()
