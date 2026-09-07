"""Tests for AI-004 Recommendation Prompt Templates."""

import unittest
from pydantic import ValidationError
from services.recommendation_service import (
    RecommendationConfigService,
    PromptTemplateInput,
    InMemoryRecommendationRepository,
)


class TestPromptTemplates(unittest.TestCase):
    """Test prompt template CRUD operations."""

    def setUp(self) -> None:
        """Set up test fixtures."""
        self.repository = InMemoryRecommendationRepository()
        self.service = RecommendationConfigService(repository=self.repository)

    def test_create_template(self) -> None:
        """Test creating a prompt template."""
        input_data = PromptTemplateInput(
            name="Product Ranking",
            description="Template for ranking products",
            template_type="ranking",
            prompt_text="Rank these products for user segment {{ segment }}",
            variables={"segment": "User segment (e.g., premium, standard)"},
            enabled=True,
        )
        template = self.service.create_template(input_data)

        self.assertEqual(template.name, "Product Ranking")
        self.assertEqual(template.template_type, "ranking")
        self.assertTrue(template.enabled)
        self.assertIn("template-", template.id)

    def test_create_template_rejects_secrets_in_prompt(self) -> None:
        """Test that templates with secrets in prompt text raise error."""
        with self.assertRaises(ValidationError):
            input_data = PromptTemplateInput(
                name="Bad Template",
                template_type="instruction",
                prompt_text="Use this API key: sk-abc123def456",
            )
            self.service.create_template(input_data)

    def test_create_template_rejects_secrets_in_variables(self) -> None:
        """Test that templates with secrets in variables raise error."""
        with self.assertRaises(ValidationError):
            input_data = PromptTemplateInput(
                name="Bad Template",
                template_type="instruction",
                prompt_text="Rank products",
                variables={"api_key": "The API key"},
            )
            self.service.create_template(input_data)

    def test_get_template(self) -> None:
        """Test retrieving a template by ID."""
        input_data = PromptTemplateInput(
            name="Test Template",
            template_type="context",
            prompt_text="Provide context for recommendations",
        )
        created = self.service.create_template(input_data)
        retrieved = self.service.get_template(created.id)

        self.assertEqual(retrieved.id, created.id)
        self.assertEqual(retrieved.name, "Test Template")

    def test_get_nonexistent_template_raises_error(self) -> None:
        """Test that getting nonexistent template raises ValueError."""
        with self.assertRaises(ValueError):
            self.service.get_template("nonexistent-template")

    def test_list_templates_sorted_by_name(self) -> None:
        """Test that templates are sorted by name."""
        for name in ["Zebra", "Apple", "Monkey"]:
            input_data = PromptTemplateInput(
                name=name,
                template_type="instruction",
                prompt_text="Test prompt",
            )
            self.service.create_template(input_data)

        templates = self.service.list_templates()
        names = [t.name for t in templates]
        self.assertEqual(names, ["Apple", "Monkey", "Zebra"])

    def test_update_template(self) -> None:
        """Test updating an existing template."""
        input1 = PromptTemplateInput(
            name="Original",
            template_type="instruction",
            prompt_text="Original prompt",
        )
        created = self.service.create_template(input1)

        input2 = PromptTemplateInput(
            name="Updated",
            template_type="ranking",
            prompt_text="Updated prompt with {{ variable }}",
            variables={"variable": "A placeholder variable"},
        )
        updated = self.service.update_template(created.id, input2)

        self.assertEqual(updated.name, "Updated")
        self.assertEqual(updated.template_type, "ranking")
        self.assertIn("{{ variable }}", updated.prompt_text)
        self.assertGreater(updated.version, 1)

    def test_update_nonexistent_template_raises_error(self) -> None:
        """Test that updating nonexistent template raises ValueError."""
        input_data = PromptTemplateInput(
            name="Test",
            template_type="instruction",
            prompt_text="This is a test",
        )
        with self.assertRaises(ValueError):
            self.service.update_template("nonexistent", input_data)

    def test_delete_template(self) -> None:
        """Test deleting a template."""
        input_data = PromptTemplateInput(
            name="To Delete",
            template_type="instruction",
            prompt_text="This is a template",
        )
        created = self.service.create_template(input_data)
        template_id = created.id

        self.service.delete_template(template_id)

        with self.assertRaises(ValueError):
            self.service.get_template(template_id)

    def test_delete_nonexistent_template_raises_error(self) -> None:
        """Test that deleting nonexistent template raises ValueError."""
        with self.assertRaises(ValueError):
            self.service.delete_template("nonexistent")

    def test_toggle_template_enabled(self) -> None:
        """Test enabling/disabling a template."""
        input_data = PromptTemplateInput(
            name="Toggle Test",
            template_type="instruction",
            prompt_text="This is a toggle test",
            enabled=True,
        )
        created = self.service.create_template(input_data)

        disabled = self.service.toggle_template(created.id, False)
        self.assertFalse(disabled.enabled)

        enabled = self.service.toggle_template(created.id, True)
        self.assertTrue(enabled.enabled)

    def test_toggle_nonexistent_template_raises_error(self) -> None:
        """Test that toggling nonexistent template raises ValueError."""
        with self.assertRaises(ValueError):
            self.service.toggle_template("nonexistent", True)

    def test_template_type_validation(self) -> None:
        """Test that template types are validated."""
        for template_type in ["instruction", "context", "ranking"]:
            input_data = PromptTemplateInput(
                name=f"Type {template_type}",
                template_type=template_type,
                prompt_text="Test prompt",
            )
            template = self.service.create_template(input_data)
            self.assertEqual(template.template_type, template_type)

    def test_template_variables_preserved(self) -> None:
        """Test that template variables are preserved correctly."""
        input_data = PromptTemplateInput(
            name="Variables Test",
            template_type="instruction",
            prompt_text="Use {{ var1 }} and {{ var2 }}",
            variables={
                "var1": "First variable",
                "var2": "Second variable",
            },
        )
        template = self.service.create_template(input_data)

        self.assertEqual(len(template.variables), 2)
        self.assertIn("var1", template.variables)
        self.assertIn("var2", template.variables)

    def test_template_timestamps_set(self) -> None:
        """Test that created_at and updated_at timestamps are set."""
        input_data = PromptTemplateInput(
            name="Timestamp Test",
            template_type="instruction",
            prompt_text="This is a timestamp test",
        )
        template = self.service.create_template(input_data)

        self.assertIsNotNone(template.created_at)
        self.assertIsNotNone(template.updated_at)
        self.assertEqual(template.created_at, template.updated_at)

    def test_audit_events_recorded(self) -> None:
        """Test that audit events are recorded for template operations."""
        from services.ai_admin_service import InMemoryAuditSink

        audit_sink = InMemoryAuditSink()
        service = RecommendationConfigService(
            repository=self.repository, audit_sink=audit_sink
        )

        input_data = PromptTemplateInput(
            name="Audit Test",
            template_type="instruction",
            prompt_text="This is an audit test",
        )
        created = service.create_template(input_data)

        # Should have one create event
        self.assertEqual(len(audit_sink.events), 1)
        event = audit_sink.events[0]
        self.assertEqual(event.action, "create")
        self.assertEqual(event.resource, "prompt_template")

        # Update should add another event
        updated_input = PromptTemplateInput(
            name="Updated",
            template_type="ranking",
            prompt_text="This is an updated template",
        )
        service.update_template(created.id, updated_input)
        self.assertEqual(len(audit_sink.events), 2)

        # Toggle should add another event
        service.toggle_template(created.id, False)
        self.assertEqual(len(audit_sink.events), 3)

    def test_template_min_length_validation(self) -> None:
        """Test that template prompt text has minimum length."""
        # Valid: 10 characters
        input_data = PromptTemplateInput(
            name="Valid",
            template_type="instruction",
            prompt_text="Valid text",
        )
        template = self.service.create_template(input_data)
        self.assertIsNotNone(template)

    def test_delete_template_removes_template_id_from_rules(self) -> None:
        """Test that deleting a template removes its ID from rules."""
        from services.recommendation_service import RecommendationRuleInput

        tmpl = self.service.create_template(
            PromptTemplateInput(name="Tmpl 1", template_type="instruction", prompt_text="Prompt text valid")
        )
        rule = self.service.create_rule(
            RecommendationRuleInput(name="Rule 1", rule_type="filter", template_ids=[tmpl.id, "other-tmpl"])
        )
        self.assertIn(tmpl.id, rule.template_ids)

        self.service.delete_template(tmpl.id)

        updated_rule = self.service.get_rule(rule.id)
        self.assertNotIn(tmpl.id, updated_rule.template_ids)
        self.assertEqual(updated_rule.template_ids, ["other-tmpl"])


if __name__ == "__main__":
    unittest.main()
