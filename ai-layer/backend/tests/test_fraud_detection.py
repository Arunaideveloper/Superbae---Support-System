from __future__ import annotations

import unittest
from datetime import datetime, timezone

from pydantic import ValidationError

from services.ai_admin_service import InMemoryAuditSink
from services.fraud_detection_service import (
    ConversionRateAnalyzer,
    DeviceBehaviorAnalyzer,
    FraudActivityInput,
    FraudAssessment,
    FraudDetectionService,
    GeoLocationAnalyzer,
    InMemoryFraudRepository,
    NormalizedActivity,
    ReferralVelocityAnalyzer,
    RiskScorer,
    SignalAnalysis,
    TemporalAnomalyAnalyzer,
)


class FraudActivityInputTests(unittest.TestCase):
    def test_valid_input_with_all_fields(self) -> None:
        input_data = FraudActivityInput(
            activity_id="act-001",
            activity_type="referral",
            user_id="user-123",
            account_id="acc-456",
            referrer_id="ref-789",
            referred_user_id="ref-user-101",
            affiliate_id="aff-202",
            campaign_id="camp-303",
            clicks=100,
            conversions=8,
            conversion_status="completed",
            activity_date="2026-08-31T10:00:00Z",
            timestamp="2026-08-31T10:00:00+00:00",
            device_type="desktop",
            country="US",
            transaction_amount=49.99,
            metadata={"source": "partner_portal", "custom_tag": "vip"},
        )
        self.assertEqual(input_data.activity_id, "act-001")
        self.assertEqual(input_data.clicks, 100)
        self.assertEqual(input_data.conversions, 8)
        self.assertEqual(input_data.country, "US")

    def test_valid_input_with_minimal_fields(self) -> None:
        input_data = FraudActivityInput(activity_id="act-min")
        self.assertEqual(input_data.activity_id, "act-min")
        self.assertEqual(input_data.activity_type, "referral")
        self.assertIsNone(input_data.clicks)
        self.assertIsNone(input_data.conversions)
        self.assertEqual(input_data.metadata, {})

    def test_unknown_and_extra_fields_allowed_safely(self) -> None:
        raw_payload = {
            "activity_id": "act-extra",
            "activity_type": "affiliate",
            "future_custom_field": "some_backend_value",
            "nested_extra": {"foo": "bar", "baz": 123},
        }
        input_data = FraudActivityInput(**raw_payload)
        self.assertEqual(input_data.activity_id, "act-extra")
        self.assertEqual(input_data.model_extra.get("future_custom_field"), "some_backend_value")

    def test_invalid_timestamps_raise_validation_error(self) -> None:
        with self.assertRaises(ValidationError):
            FraudActivityInput(activity_id="act-err", timestamp="not-a-valid-timestamp")
        with self.assertRaises(ValidationError):
            FraudActivityInput(activity_id="act-err", activity_date="invalid-date")

    def test_negative_numeric_bounds_raise_validation_error(self) -> None:
        with self.assertRaises(ValidationError):
            FraudActivityInput(activity_id="act-err", clicks=-10)
        with self.assertRaises(ValidationError):
            FraudActivityInput(activity_id="act-err", conversions=-1)
        with self.assertRaises(ValidationError):
            FraudActivityInput(activity_id="act-err", transaction_amount=-5.0)

    def test_secrets_in_metadata_are_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            FraudActivityInput(
                activity_id="act-secret",
                metadata={"api_key": "sensitive-credential"},
            )
        with self.assertRaises(ValidationError):
            FraudActivityInput(
                activity_id="act-secret",
                metadata={"user_password": "super-secret-password"},
            )

    def test_normalization_tracks_available_and_missing_signals(self) -> None:
        input_data = FraudActivityInput(
            activity_id="act-norm",
            clicks=50,
            conversions=5,
            referrer_id="ref-1",
            timestamp="2026-08-31T12:00:00Z",
        )
        normalized = NormalizedActivity.from_input(input_data)
        self.assertEqual(normalized.activity_id, "act-norm")
        self.assertAlmostEqual(normalized.conversion_rate, 0.10)
        self.assertIn("clicks", normalized.available_signals)
        self.assertIn("conversions", normalized.available_signals)
        self.assertIn("timestamp", normalized.available_signals)
        self.assertIn("referrer_context", normalized.available_signals)
        self.assertIn("device_type", normalized.missing_signals)
        self.assertIn("country", normalized.missing_signals)


class SignalAnalyzerTests(unittest.TestCase):
    def test_conversion_rate_analyzer_normal(self) -> None:
        analyzer = ConversionRateAnalyzer(baseline_rate=0.08, multiplier_threshold=2.0)
        activity = NormalizedActivity(
            activity_id="act-1",
            activity_type="referral",
            clicks=100,
            conversions=8,
            conversion_rate=0.08,
        )
        signal = analyzer.analyze(activity)
        self.assertTrue(signal.evaluable)
        self.assertFalse(signal.triggered)
        self.assertEqual(signal.risk_contribution, 0.0)

    def test_conversion_rate_analyzer_spike(self) -> None:
        analyzer = ConversionRateAnalyzer(baseline_rate=0.08, multiplier_threshold=2.0, weight=40.0)
        activity = NormalizedActivity(
            activity_id="act-2",
            activity_type="referral",
            clicks=50,
            conversions=45,
            conversion_rate=0.90,
        )
        signal = analyzer.analyze(activity)
        self.assertTrue(signal.evaluable)
        self.assertTrue(signal.triggered)
        self.assertEqual(signal.risk_contribution, 40.0)
        self.assertIn("significantly higher", signal.explanation)

    def test_conversion_rate_analyzer_low_sample_volume(self) -> None:
        analyzer = ConversionRateAnalyzer(baseline_rate=0.08, min_sample_size=10)
        activity = NormalizedActivity(
            activity_id="act-3",
            activity_type="referral",
            clicks=2,
            conversions=1,
            conversion_rate=0.50,
        )
        signal = analyzer.analyze(activity)
        self.assertTrue(signal.evaluable)
        self.assertFalse(signal.triggered)
        self.assertIn("too low", signal.explanation)

    def test_conversion_rate_analyzer_impossible_anomaly(self) -> None:
        analyzer = ConversionRateAnalyzer()
        activity = NormalizedActivity(
            activity_id="act-4",
            activity_type="referral",
            clicks=10,
            conversions=20,
            conversion_rate=2.0,
        )
        signal = analyzer.analyze(activity)
        self.assertTrue(signal.triggered)
        self.assertIn("Impossible conversion rate", signal.explanation)

    def test_conversion_rate_analyzer_missing_data(self) -> None:
        analyzer = ConversionRateAnalyzer()
        activity = NormalizedActivity(
            activity_id="act-5",
            activity_type="referral",
            clicks=None,
            conversions=None,
        )
        signal = analyzer.analyze(activity)
        self.assertFalse(signal.evaluable)
        self.assertFalse(signal.triggered)

    def test_referral_velocity_analyzer_normal_and_burst(self) -> None:
        analyzer = ReferralVelocityAnalyzer(baseline_velocity=2.0, multiplier_threshold=3.0, weight=35.0)

        # Normal velocity
        norm_activity = NormalizedActivity(
            activity_id="act-v1",
            activity_type="referral",
            referrer_id="ref-normal",
            metadata={"referrals_in_window": 3, "time_window_hours": 6},
        )
        sig_norm = analyzer.analyze(norm_activity)
        self.assertTrue(sig_norm.evaluable)
        self.assertFalse(sig_norm.triggered)

        # Burst velocity
        burst_activity = NormalizedActivity(
            activity_id="act-v2",
            activity_type="referral",
            referrer_id="ref-spammer",
            metadata={"referrals_in_window": 20, "time_window_hours": 6},
        )
        sig_burst = analyzer.analyze(burst_activity)
        self.assertTrue(sig_burst.evaluable)
        self.assertTrue(sig_burst.triggered)
        self.assertEqual(sig_burst.risk_contribution, 35.0)
        self.assertIn("spike detected", sig_burst.explanation)

    def test_referral_velocity_missing_data(self) -> None:
        analyzer = ReferralVelocityAnalyzer()
        activity = NormalizedActivity(activity_id="act-v3", activity_type="referral")
        signal = analyzer.analyze(activity)
        self.assertFalse(signal.evaluable)
        self.assertFalse(signal.triggered)

    def test_temporal_anomaly_analyzer(self) -> None:
        analyzer = TemporalAnomalyAnalyzer(weight=25.0)

        # Severe burst duration (<10 seconds for 5 conversions)
        burst_activity = NormalizedActivity(
            activity_id="act-t1",
            activity_type="referral",
            conversions=5,
            metadata={"duration_seconds": 3},
        )
        sig_burst = analyzer.analyze(burst_activity)
        self.assertTrue(sig_burst.triggered)
        self.assertEqual(sig_burst.risk_contribution, 25.0)

        # Sub-second interval bot pattern
        bot_activity = NormalizedActivity(
            activity_id="act-t2",
            activity_type="referral",
            clicks=20,
            metadata={"avg_interval_seconds": 0.15},
        )
        sig_bot = analyzer.analyze(bot_activity)
        self.assertTrue(sig_bot.triggered)

        # Missing timing metadata
        missing_activity = NormalizedActivity(activity_id="act-t3", activity_type="referral")
        sig_missing = analyzer.analyze(missing_activity)
        self.assertFalse(sig_missing.evaluable)
        self.assertFalse(sig_missing.triggered)

    def test_device_behavior_analyzer(self) -> None:
        analyzer = DeviceBehaviorAnalyzer(weight=20.0)

        # Clustered device fingerprint
        clustered_activity = NormalizedActivity(
            activity_id="act-d1",
            activity_type="referral",
            device_type="mobile",
            metadata={"device_clustering": True},
        )
        sig_clustered = analyzer.analyze(clustered_activity)
        self.assertTrue(sig_clustered.triggered)
        self.assertEqual(sig_clustered.risk_contribution, 20.0)

        # Missing device data does NOT flag
        missing_activity = NormalizedActivity(activity_id="act-d2", activity_type="referral")
        sig_missing = analyzer.analyze(missing_activity)
        self.assertFalse(sig_missing.evaluable)
        self.assertFalse(sig_missing.triggered)

    def test_geolocation_analyzer(self) -> None:
        analyzer = GeoLocationAnalyzer(weight=15.0)

        # Rapid geo shift
        shift_activity = NormalizedActivity(
            activity_id="act-g1",
            activity_type="referral",
            country="US",
            metadata={"rapid_geo_shift": True},
        )
        sig_shift = analyzer.analyze(shift_activity)
        self.assertTrue(sig_shift.triggered)
        self.assertEqual(sig_shift.risk_contribution, 15.0)

        # Missing geo data does NOT flag
        missing_activity = NormalizedActivity(activity_id="act-g2", activity_type="referral")
        sig_missing = analyzer.analyze(missing_activity)
        self.assertFalse(sig_missing.evaluable)
        self.assertFalse(sig_missing.triggered)


class RiskScorerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.scorer = RiskScorer(low_threshold=30.0, high_threshold=60.0)
        self.activity = NormalizedActivity(activity_id="act-score", activity_type="referral")

    def test_all_signals_normal_yields_low_risk(self) -> None:
        signals = [
            SignalAnalysis("abnormal_conversion_rate", False, 0.05, 0.0, "Normal rate", {}, True),
            SignalAnalysis("referral_velocity_spike", False, 1, 0.0, "Normal velocity", {}, True),
            SignalAnalysis("unusual_timing_pattern", False, "normal", 0.0, "Normal timing", {}, True),
        ]
        assessment = self.scorer.score(self.activity, signals)
        self.assertEqual(assessment.risk_score, 0.0)
        self.assertEqual(assessment.risk_level, "low")
        self.assertEqual(len(assessment.indicators), 0)
        self.assertIn("LOW risk", assessment.explanation)

    def test_single_signal_triggered_yields_medium_risk(self) -> None:
        signals = [
            SignalAnalysis("abnormal_conversion_rate", True, 0.85, 40.0, "High conversion rate", {}, True),
            SignalAnalysis("referral_velocity_spike", False, 1, 0.0, "Normal velocity", {}, True),
            SignalAnalysis("unusual_timing_pattern", False, "normal", 0.0, "Normal timing", {}, True),
        ]
        assessment = self.scorer.score(self.activity, signals)
        self.assertEqual(assessment.risk_score, 40.0)
        self.assertEqual(assessment.risk_level, "medium")
        self.assertEqual(len(assessment.indicators), 1)
        self.assertIn("MEDIUM risk", assessment.explanation)

    def test_multiple_signals_triggered_yields_high_risk(self) -> None:
        signals = [
            SignalAnalysis("abnormal_conversion_rate", True, 0.95, 40.0, "High conversion rate", {}, True),
            SignalAnalysis("referral_velocity_spike", True, 25, 35.0, "Velocity spike", {}, True),
            SignalAnalysis("unusual_timing_pattern", True, "clustered", 25.0, "Timing burst", {}, True),
        ]
        assessment = self.scorer.score(self.activity, signals)
        self.assertEqual(assessment.risk_score, 100.0)
        self.assertEqual(assessment.risk_level, "high")
        self.assertEqual(len(assessment.indicators), 3)
        self.assertIn("HIGH risk", assessment.explanation)

    def test_missing_signals_reduce_confidence_and_tracked(self) -> None:
        signals = [
            SignalAnalysis("abnormal_conversion_rate", False, None, 0.0, "No data", {}, False),
            SignalAnalysis("referral_velocity_spike", False, None, 0.0, "No data", {}, False),
            SignalAnalysis("unusual_timing_pattern", False, None, 0.0, "No data", {}, False),
            SignalAnalysis("device_clustering", False, None, 0.0, "No data", {}, False),
            SignalAnalysis("geo_clustering", False, None, 0.0, "No data", {}, False),
        ]
        assessment = self.scorer.score(self.activity, signals)
        self.assertLess(assessment.confidence, 1.0)
        self.assertEqual(len(assessment.signals_unavailable), 5)
        self.assertIn("could not be evaluated", assessment.explanation)


class RepositoryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.repo = InMemoryFraudRepository()

    def test_create_and_get_assessment(self) -> None:
        assessment = FraudAssessment(
            id="test-ass-1",
            activity_id="act-1",
            activity_type="referral",
            risk_score=75.0,
            risk_level="high",
            indicators=[],
            explanation="High risk test",
            signals_available={"clicks": True},
            signals_used=["clicks"],
            signals_unavailable=[],
            analysis_method="deterministic_v1",
            confidence=0.9,
            analysis_date="2026-08-31T10:00:00Z",
            investigation_status="flagged",
        )
        created = self.repo.create_assessment(assessment)
        self.assertEqual(created.id, "test-ass-1")

        retrieved = self.repo.get_assessment("test-ass-1")
        self.assertEqual(retrieved.activity_id, "act-1")
        self.assertEqual(retrieved.risk_score, 75.0)

    def test_unknown_assessment_raises_value_error(self) -> None:
        with self.assertRaises(ValueError):
            self.repo.get_assessment("non-existent-id")

    def test_update_assessment(self) -> None:
        assessment = FraudAssessment(
            id="test-ass-2",
            activity_id="act-2",
            activity_type="referral",
            risk_score=45.0,
            risk_level="medium",
            indicators=[],
            explanation="Medium risk",
            signals_available={},
            signals_used=[],
            signals_unavailable=[],
            analysis_method="deterministic_v1",
            confidence=0.8,
            analysis_date="2026-08-31T11:00:00Z",
            investigation_status="flagged",
        )
        self.repo.create_assessment(assessment)

        assessment.investigation_status = "dismissed"
        assessment.review_notes = "Legitimate campaign false positive"
        updated = self.repo.update_assessment(assessment)

        self.assertEqual(updated.investigation_status, "dismissed")
        self.assertEqual(updated.review_notes, "Legitimate campaign false positive")

    def test_list_and_filter_assessments(self) -> None:
        for i in range(5):
            self.repo.create_assessment(
                FraudAssessment(
                    id=f"ass-{i}",
                    activity_id=f"act-{i % 2}",
                    activity_type="referral",
                    risk_score=float(i * 20),
                    risk_level="high" if i >= 3 else "low",
                    indicators=[],
                    explanation="test",
                    signals_available={},
                    signals_used=[],
                    signals_unavailable=[],
                    analysis_method="deterministic_v1",
                    confidence=0.9,
                    analysis_date=f"2026-08-31T1{i}:00:00Z",
                    investigation_status="flagged" if i >= 2 else "dismissed",
                )
            )

        all_items = self.repo.list_assessments(limit=10)
        self.assertEqual(len(all_items), 5)

        filtered_by_activity = self.repo.list_assessments(activity_id="act-0")
        self.assertEqual(len(filtered_by_activity), 3)

        filtered_by_status = self.repo.list_assessments(status="flagged")
        self.assertEqual(len(filtered_by_status), 3)

        flagged_list = self.repo.list_flagged_assessments()
        self.assertEqual(len(flagged_list), 3)

        count = self.repo.count_assessments(status="flagged")
        self.assertEqual(count, 3)


class InvestigationWorkflowAndAuditTests(unittest.TestCase):
    def setUp(self) -> None:
        self.repo = InMemoryFraudRepository()
        self.audit = InMemoryAuditSink()
        self.service = FraudDetectionService(repository=self.repo, audit_sink=self.audit)

    def test_full_analysis_workflow_and_investigation_transitions(self) -> None:
        # 1. Analyze suspicious activity
        input_data = FraudActivityInput(
            activity_id="act-workflow",
            clicks=100,
            conversions=90,
            referrer_id="ref-workflow",
            metadata={"referrals_in_window": 25, "temporal_clustering": True},
        )
        assessment = self.service.analyze(input_data)
        self.assertEqual(assessment.risk_level, "high")
        self.assertEqual(assessment.investigation_status, "flagged")

        # 2. Admin moves case to under_review
        under_review = self.service.update_assessment_status(
            assessment_id=assessment.id,
            new_status="under_review",
            review_notes="Investigating anomalous conversion and velocity spike",
            reviewed_by="admin-sarah",
        )
        self.assertEqual(under_review.investigation_status, "under_review")
        self.assertEqual(under_review.reviewed_by, "admin-sarah")

        # 3. Admin confirms fraud
        confirmed = self.service.update_assessment_status(
            assessment_id=assessment.id,
            new_status="confirmed",
            review_notes="Confirmed bot traffic from click farm",
            reviewed_by="admin-sarah",
        )
        self.assertEqual(confirmed.investigation_status, "confirmed")

        # Check audit trail
        self.assertEqual(len(self.audit.events), 2)
        event_review, event_confirm = self.audit.events
        self.assertEqual(event_review.action, "fraud_assessment_under_review")
        self.assertEqual(event_review.resource_id, assessment.id)
        self.assertEqual(event_review.actor, "admin-sarah")
        self.assertEqual(event_confirm.action, "fraud_assessment_confirmed")
        self.assertNotIn("secret", str(self.audit.events))

    def test_false_positive_dismissal_workflow(self) -> None:
        input_data = FraudActivityInput(
            activity_id="act-fp",
            clicks=50,
            conversions=40,
            referrer_id="ref-partner",
        )
        assessment = self.service.analyze(input_data)

        # Admin dismisses as legitimate promotion partner
        dismissed = self.service.update_assessment_status(
            assessment_id=assessment.id,
            new_status="dismissed",
            review_notes="Approved verified affiliate partner launch promotion",
            reviewed_by="admin-lead",
        )
        self.assertEqual(dismissed.investigation_status, "dismissed")
        self.assertEqual(len(self.audit.events), 1)
        self.assertEqual(self.audit.events[0].action, "fraud_assessment_dismissed")

    def test_invalid_status_transition_rejected(self) -> None:
        assessment = self.service.analyze(FraudActivityInput(activity_id="act-invalid"))
        with self.assertRaises(ValueError):
            self.service.update_assessment_status(
                assessment_id=assessment.id,
                new_status="invalid_status",  # type: ignore
            )

    def test_secret_in_review_notes_is_rejected(self) -> None:
        assessment = self.service.analyze(FraudActivityInput(activity_id="act-secret-note"))
        with self.assertRaises(ValueError):
            self.service.update_assessment_status(
                assessment_id=assessment.id,
                new_status="dismissed",
                review_notes="User password was 12345",
            )


if __name__ == "__main__":
    unittest.main()
