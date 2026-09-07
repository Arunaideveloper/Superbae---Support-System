"""Tests for AI-004 Recommendation Repository and Configuration."""

import unittest
from services.recommendation_service import (
    InMemoryRecommendationRepository,
    RecommendationRule,
    PromptTemplate,
    RecommendationFeature,
    RecommendationConfigSnapshot,
    ConfigurationVersion,
    ConfigurationConflictError,
)


class TestRecommendationRepository(unittest.TestCase):
    """Test the in-memory recommendation repository."""

    def setUp(self) -> None:
        """Set up test fixtures."""
        self.repository = InMemoryRecommendationRepository()

    def test_save_and_load_rule(self) -> None:
        """Test saving and loading a rule."""
        rule = RecommendationRule(
            id="rule-1",
            name="Test Rule",
            description="A test rule",
            rule_type="filter",
            priority=50,
        )
        self.repository.save_rule(rule)

        loaded = self.repository.load_rules()
        self.assertIn("rule-1", loaded)
        self.assertEqual(loaded["rule-1"].name, "Test Rule")

    def test_save_multiple_rules(self) -> None:
        """Test saving multiple rules."""
        for i in range(5):
            rule = RecommendationRule(
                id=f"rule-{i}",
                name=f"Rule {i}",
                description=f"Rule {i} description",
                rule_type="filter",
            )
            self.repository.save_rule(rule)

        loaded = self.repository.load_rules()
        self.assertEqual(len(loaded), 5)

    def test_save_and_load_template(self) -> None:
        """Test saving and loading a template."""
        template = PromptTemplate(
            id="template-1",
            name="Test Template",
            description="A test template",
            template_type="instruction",
            prompt_text="Test prompt",
        )
        self.repository.save_template(template)

        loaded = self.repository.load_templates()
        self.assertIn("template-1", loaded)
        self.assertEqual(loaded["template-1"].name, "Test Template")

    def test_save_and_load_feature(self) -> None:
        """Test saving and loading a feature."""
        feature = RecommendationFeature(
            id="feature-1",
            display_name="Test Feature",
            description="A test feature",
        )
        self.repository.save_feature(feature)

        loaded = self.repository.load_features()
        self.assertIn("feature-1", loaded)
        self.assertEqual(loaded["feature-1"].display_name, "Test Feature")

    def test_load_configuration_snapshot(self) -> None:
        """Test loading full configuration snapshot."""
        rule = RecommendationRule(
            id="rule-1",
            name="Test Rule",
            description="Test rule description",
            rule_type="filter",
        )
        template = PromptTemplate(
            id="template-1",
            name="Test Template",
            template_type="instruction",
            prompt_text="This is a test template",
        )
        feature = RecommendationFeature(
            id="feature-1",
            display_name="Test Feature",
        )

        self.repository.save_rule(rule)
        self.repository.save_template(template)
        self.repository.save_feature(feature)

        config = self.repository.load_configuration()

        self.assertEqual(len(config.rules), 1)
        self.assertEqual(len(config.templates), 1)
        self.assertEqual(len(config.features), 1)
        self.assertIsNotNone(config.version)

    def test_version_incremented_on_save(self) -> None:
        """Test that version is incremented when saving."""
        initial_config = self.repository.load_configuration()
        initial_version = initial_config.version.revision

        rule = RecommendationRule(
            id="rule-1",
            name="Test",
            description="Test rule",
            rule_type="filter",
        )
        self.repository.save_rule(rule)

        updated_config = self.repository.load_configuration()
        self.assertGreater(updated_config.version.revision, initial_version)

    def test_save_configuration_snapshot_with_matching_revision(self) -> None:
        """Test saving configuration snapshot with optimistic concurrency."""
        rule1 = RecommendationRule(
            id="rule-1",
            name="Rule 1",
            description="Rule 1 description",
            rule_type="filter",
        )
        self.repository.save_rule(rule1)

        config = self.repository.load_configuration()
        current_revision = config.version.revision

        # Add another rule to the snapshot
        rule2 = RecommendationRule(
            id="rule-2",
            name="Rule 2",
            description="Rule 2 description",
            rule_type="rank",
        )
        config.rules["rule-2"] = rule2

        # Save with matching revision should succeed
        new_version = self.repository.save_configuration(config, current_revision)
        self.assertGreater(new_version.revision, current_revision)

    def test_save_configuration_snapshot_with_conflicting_revision(self) -> None:
        """Test that conflicting revision raises error."""
        rule1 = RecommendationRule(
            id="rule-1",
            name="Rule 1",
            description="Rule 1 description",
            rule_type="filter",
        )
        self.repository.save_rule(rule1)

        config = self.repository.load_configuration()

        # Try to save with wrong revision
        with self.assertRaises(ConfigurationConflictError):
            self.repository.save_configuration(config, 999)

    def test_repository_isolation_between_operations(self) -> None:
        """Test that repository operations don't interfere with each other."""
        rule1 = RecommendationRule(
            id="rule-1",
            name="Rule 1",
            description="Rule 1 description",
            rule_type="filter",
        )
        self.repository.save_rule(rule1)

        template1 = PromptTemplate(
            id="template-1",
            name="Template 1",
            template_type="instruction",
            prompt_text="This is a test template",
        )
        self.repository.save_template(template1)

        # Load should show both
        config = self.repository.load_configuration()
        self.assertEqual(len(config.rules), 1)
        self.assertEqual(len(config.templates), 1)
        self.assertEqual(len(config.features), 0)

    def test_initial_configuration_empty(self) -> None:
        """Test that initial configuration is empty."""
        config = self.repository.load_configuration()

        self.assertEqual(len(config.rules), 0)
        self.assertEqual(len(config.templates), 0)
        self.assertEqual(len(config.features), 0)
        self.assertEqual(config.version.revision, 0)

    def test_repository_with_initial_data(self) -> None:
        """Test creating repository with initial data."""
        rule = RecommendationRule(
            id="rule-1",
            name="Test Rule",
            description="Test rule description",
            rule_type="filter",
        )
        template = PromptTemplate(
            id="template-1",
            name="Test Template",
            template_type="instruction",
            prompt_text="This is a test template",
        )
        feature = RecommendationFeature(
            id="feature-1",
            display_name="Test Feature",
        )

        repo = InMemoryRecommendationRepository(
            initial_rules={"rule-1": rule},
            initial_templates={"template-1": template},
            initial_features={"feature-1": feature},
        )

        config = repo.load_configuration()
        self.assertEqual(len(config.rules), 1)
        self.assertEqual(len(config.templates), 1)
        self.assertEqual(len(config.features), 1)

    def test_load_returns_copy_not_reference(self) -> None:
        """Test that load operations return copies, not references."""
        rule = RecommendationRule(
            id="rule-1",
            name="Test Rule",
            description="Test rule description",
            rule_type="filter",
        )
        self.repository.save_rule(rule)

        loaded1 = self.repository.load_rules()
        loaded1["rule-1"].name = "Modified"

        loaded2 = self.repository.load_rules()
        # Original should be unchanged
        self.assertEqual(loaded2["rule-1"].name, "Test Rule")


if __name__ == "__main__":
    unittest.main()
