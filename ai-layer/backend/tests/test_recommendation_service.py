"""Tests for AI-004 Recommendation Service Integration."""

import unittest
from services.recommendation_service import (
    RecommendationConfigService,
    RecommendationRuleInput,
    PromptTemplateInput,
    RecommendationFeatureInput,
    InMemoryRecommendationRepository,
)


class TestRecommendationServiceIntegration(unittest.TestCase):
    """Test high-level service integration."""

    def setUp(self) -> None:
        """Set up test fixtures."""
        self.repository = InMemoryRecommendationRepository()
        self.service = RecommendationConfigService(repository=self.repository)

    def test_get_summary_empty_configuration(self) -> None:
        """Test summary for empty configuration."""
        summary = self.service.get_summary()

        self.assertEqual(summary.total_rules, 0)
        self.assertEqual(summary.enabled_rules, 0)
        self.assertEqual(summary.total_templates, 0)
        self.assertEqual(summary.enabled_templates, 0)
        self.assertEqual(summary.total_features, 0)
        self.assertEqual(summary.enabled_features, 0)
        self.assertEqual(summary.config_version, 0)

    def test_get_summary_with_data(self) -> None:
        """Test summary reflects actual data."""
        # Create 3 rules: 2 enabled, 1 disabled
        for i, enabled in enumerate([True, True, False]):
            input_data = RecommendationRuleInput(
                name=f"Rule {i}",
                rule_type="filter",
                enabled=enabled,
            )
            self.service.create_rule(input_data)

        # Create 2 templates: 1 enabled, 1 disabled
        for i, enabled in enumerate([True, False]):
            input_data = PromptTemplateInput(
                name=f"Template {i}",
                template_type="instruction",
                prompt_text="This is a template prompt",
                enabled=enabled,
            )
            self.service.create_template(input_data)

        # Create 1 feature: enabled
        feature_input = RecommendationFeatureInput(
            display_name="Feature",
            enabled=True,
        )
        self.service.create_feature("feature-1", feature_input)

        summary = self.service.get_summary()

        self.assertEqual(summary.total_rules, 3)
        self.assertEqual(summary.enabled_rules, 2)
        self.assertEqual(summary.total_templates, 2)
        self.assertEqual(summary.enabled_templates, 1)
        self.assertEqual(summary.total_features, 1)
        self.assertEqual(summary.enabled_features, 1)
        self.assertGreater(summary.config_version, 0)

    def test_get_configuration_response_model(self) -> None:
        """Test getting full configuration response model."""
        # Create some data
        rule_input = RecommendationRuleInput(
            name="Test Rule",
            rule_type="filter",
            priority=50,
        )
        self.service.create_rule(rule_input)

        template_input = PromptTemplateInput(
            name="Test Template",
            template_type="instruction",
            prompt_text="Test prompt",
        )
        self.service.create_template(template_input)

        feature_input = RecommendationFeatureInput(
            display_name="Test Feature",
            applicable_contexts=["homepage"],
        )
        self.service.create_feature("test-feature", feature_input)

        # Get configuration
        config = self.service.get_configuration()

        self.assertEqual(len(config.rules), 1)
        self.assertEqual(len(config.templates), 1)
        self.assertEqual(len(config.features), 1)

        # Verify rule response
        rule = config.rules[0]
        self.assertEqual(rule.name, "Test Rule")
        self.assertEqual(rule.rule_type, "filter")
        self.assertEqual(rule.priority, 50)

        # Verify template response
        template = config.templates[0]
        self.assertEqual(template.name, "Test Template")
        self.assertEqual(template.template_type, "instruction")

        # Verify feature response
        feature = config.features[0]
        self.assertEqual(feature.display_name, "Test Feature")
        self.assertEqual(len(feature.applicable_contexts), 1)

    def test_complex_rule_with_templates_and_context(self) -> None:
        """Test creating complex rule with templates."""
        # Create template first
        template_input = PromptTemplateInput(
            name="Ranking Template",
            template_type="ranking",
            prompt_text="Rank products for segment {{ segment }}",
            variables={"segment": "User segment"},
        )
        template = self.service.create_template(template_input)

        # Create rule that uses template
        rule_input = RecommendationRuleInput(
            name="Segment Rule",
            rule_type="rank",
            priority=75,
            condition={"segment": "premium"},
            action={"boost_factor": 1.5},
            template_ids=[template.id],
        )
        rule = self.service.create_rule(rule_input)

        # Verify rule has template reference
        self.assertEqual(len(rule.template_ids), 1)
        self.assertIn(template.id, rule.template_ids)

        # Verify we can retrieve both
        retrieved_rule = self.service.get_rule(rule.id)
        retrieved_template = self.service.get_template(template.id)

        self.assertEqual(retrieved_rule.name, "Segment Rule")
        self.assertEqual(retrieved_template.name, "Ranking Template")

    def test_feature_with_multiple_rules(self) -> None:
        """Test feature that applies multiple rules."""
        # Create multiple rules
        rule_ids = []
        for i in range(3):
            input_data = RecommendationRuleInput(
                name=f"Rule {i}",
                rule_type="filter",
                priority=50 + i * 10,
            )
            rule = self.service.create_rule(input_data)
            rule_ids.append(rule.id)

        # Create feature with all rules
        feature_input = RecommendationFeatureInput(
            display_name="Multi-Rule Feature",
            applicable_contexts=["homepage", "product_page"],
            rule_ids=rule_ids,
        )
        feature = self.service.create_feature("multi-rule", feature_input)

        # Verify feature has all rules
        self.assertEqual(len(feature.rule_ids), 3)
        for rule_id in rule_ids:
            self.assertIn(rule_id, feature.rule_ids)

    def test_bulk_enable_disable_simulation(self) -> None:
        """Test simulating bulk enable/disable of features."""
        # Create feature with multiple rules
        rule_ids = []
        for i in range(3):
            input_data = RecommendationRuleInput(
                name=f"Rule {i}",
                rule_type="filter",
                enabled=True,
            )
            rule = self.service.create_rule(input_data)
            rule_ids.append(rule.id)

        # Create feature
        feature_input = RecommendationFeatureInput(
            display_name="Bulk Test",
            enabled=True,
            rule_ids=rule_ids,
        )
        self.service.create_feature("bulk-test", feature_input)

        # Disable feature
        feature = self.service.toggle_feature("bulk-test", False)
        self.assertFalse(feature.enabled)

        # All rules should still be enabled
        for rule_id in rule_ids:
            rule = self.service.get_rule(rule_id)
            self.assertTrue(rule.enabled)

        # But could be toggled together by client
        for rule_id in rule_ids:
            self.service.toggle_rule(rule_id, False)

        # Verify all disabled
        summary = self.service.get_summary()
        self.assertEqual(summary.enabled_rules, 0)

    def test_configuration_consistency_across_operations(self) -> None:
        """Test that configuration remains consistent through multiple operations."""
        # Create initial configuration
        rule_input = RecommendationRuleInput(
            name="Rule 1",
            rule_type="filter",
        )
        rule1 = self.service.create_rule(rule_input)

        template_input = PromptTemplateInput(
            name="Template 1",
            template_type="instruction",
            prompt_text="This is a template prompt",
        )
        template1 = self.service.create_template(template_input)

        # Get configuration
        config1 = self.service.get_configuration()
        self.assertEqual(len(config1.rules), 1)
        self.assertEqual(len(config1.templates), 1)

        # Add more data
        rule_input2 = RecommendationRuleInput(
            name="Rule 2",
            rule_type="rank",
        )
        rule2 = self.service.create_rule(rule_input2)

        # Get configuration again
        config2 = self.service.get_configuration()
        self.assertEqual(len(config2.rules), 2)
        self.assertEqual(len(config2.templates), 1)

        # Verify all data is present
        rule_names = {r.name for r in config2.rules}
        self.assertIn("Rule 1", rule_names)
        self.assertIn("Rule 2", rule_names)

    def test_error_handling_for_invalid_operations(self) -> None:
        """Test error handling for various invalid operations."""
        # Getting nonexistent items should raise errors
        with self.assertRaises(ValueError):
            self.service.get_rule("nonexistent")

        with self.assertRaises(ValueError):
            self.service.get_template("nonexistent")

        with self.assertRaises(ValueError):
            self.service.get_feature("nonexistent")

        # Updating nonexistent items should raise errors
        input_data = RecommendationRuleInput(
            name="Test",
            rule_type="filter",
        )
        with self.assertRaises(ValueError):
            self.service.update_rule("nonexistent", input_data)

        template_input = PromptTemplateInput(
            name="Test",
            template_type="instruction",
            prompt_text="This is a test template",
        )
        with self.assertRaises(ValueError):
            self.service.update_template("nonexistent", template_input)

        feature_input = RecommendationFeatureInput(
            display_name="Test",
        )
        with self.assertRaises(ValueError):
            self.service.update_feature("nonexistent", feature_input)


if __name__ == "__main__":
    unittest.main()
