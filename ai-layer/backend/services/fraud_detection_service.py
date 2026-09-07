from __future__ import annotations

import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, field_validator

from services.ai_admin_service import AuditEvent, AuditSink, InMemoryAuditSink

RiskLevel = Literal["low", "medium", "high"]
InvestigationStatus = Literal["flagged", "under_review", "confirmed", "dismissed"]

FORBIDDEN_SECRET_KEYWORDS = (
    "api_key",
    "apikey",
    "secret",
    "password",
    "token",
    "authorization",
    "bearer",
    "private_key",
)


def _validate_no_secrets(data: dict[str, Any] | None) -> None:
    if not data:
        return
    for key, value in data.items():
        key_lower = str(key).lower()
        if any(secret_kw in key_lower for secret_kw in FORBIDDEN_SECRET_KEYWORDS):
            raise ValueError(f"Sensitive credential or secret found in data key: {key}")
        if isinstance(value, dict):
            _validate_no_secrets(value)
        elif isinstance(value, (list, tuple, set)):
            for item in value:
                if isinstance(item, dict):
                    _validate_no_secrets(item)
                elif isinstance(item, str):
                    item_lower = item.lower()
                    if any(secret_kw in item_lower for secret_kw in FORBIDDEN_SECRET_KEYWORDS + ("bearer ", "ghp_", "sk-", "xoxb-")):
                        raise ValueError(f"Sensitive token or credential found in data content: {item}")
        elif isinstance(value, str):
            value_lower = value.lower()
            if any(secret_kw in value_lower for secret_kw in FORBIDDEN_SECRET_KEYWORDS + ("bearer ", "ghp_", "sk-", "xoxb-")):
                raise ValueError(f"Sensitive token or credential found in data content: {value}")


class FraudActivityInput(BaseModel):
    """
    Flexible activity input model that gracefully handles varying fields.
    Known fields are validated and normalized; unknown fields are safely accepted.
    """

    activity_id: str = Field(min_length=1, max_length=100)
    activity_type: str = Field(default="referral", min_length=1, max_length=50)

    # Optional user / account context
    user_id: str | None = Field(default=None, min_length=1, max_length=100)
    account_id: str | None = Field(default=None, min_length=1, max_length=100)

    # Optional referral context
    referrer_id: str | None = Field(default=None, min_length=1, max_length=100)
    referred_user_id: str | None = Field(default=None, min_length=1, max_length=100)

    # Optional affiliate context
    affiliate_id: str | None = Field(default=None, min_length=1, max_length=100)
    campaign_id: str | None = Field(default=None, min_length=1, max_length=100)

    # Conversion & performance metrics
    clicks: int | None = Field(default=None, ge=0)
    conversions: int | None = Field(default=None, ge=0)
    conversion_status: str | None = Field(default=None, min_length=1, max_length=50)

    # Temporal context
    activity_date: str | None = Field(default=None)
    timestamp: str | None = Field(default=None)

    # Behavioral / Device / Geo context
    device_type: str | None = Field(default=None, min_length=1, max_length=50)
    country: str | None = Field(default=None, min_length=2, max_length=10)
    transaction_amount: float | None = Field(default=None, ge=0.0)

    # Flexible metadata dictionary
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(
        extra="allow",
        use_enum_values=True,
    )

    @field_validator("activity_date", mode="before")
    @classmethod
    def validate_activity_date(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value_clean = str(value).strip()
        try:
            # Validate ISO date or datetime format
            datetime.fromisoformat(value_clean.replace("Z", "+00:00"))
            return value_clean
        except (ValueError, TypeError) as error:
            raise ValueError("activity_date must be in ISO format") from error

    @field_validator("timestamp", mode="before")
    @classmethod
    def validate_timestamp(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value_clean = str(value).strip()
        try:
            # Validate ISO timestamp format
            datetime.fromisoformat(value_clean.replace("Z", "+00:00"))
            return value_clean
        except (ValueError, TypeError) as error:
            raise ValueError("timestamp must be in ISO format") from error

    @field_validator("metadata")
    @classmethod
    def validate_safe_metadata(cls, value: dict[str, Any]) -> dict[str, Any]:
        _validate_no_secrets(value)
        return value


@dataclass
class NormalizedActivity:
    """Internal normalized activity with explicit tracking of available vs missing signals."""

    activity_id: str
    activity_type: str
    user_id: str | None = None
    account_id: str | None = None
    referrer_id: str | None = None
    referred_user_id: str | None = None
    affiliate_id: str | None = None
    campaign_id: str | None = None
    clicks: int | None = None
    conversions: int | None = None
    conversion_rate: float | None = None
    conversion_status: str | None = None
    timestamp: datetime | None = None
    activity_date: str | None = None
    device_type: str | None = None
    country: str | None = None
    transaction_amount: float | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    raw_extra: dict[str, Any] = field(default_factory=dict)
    available_signals: set[str] = field(default_factory=set)
    missing_signals: set[str] = field(default_factory=set)

    @classmethod
    def from_input(cls, input_data: FraudActivityInput) -> NormalizedActivity:
        available: set[str] = set()
        missing: set[str] = set()

        # Check core metrics
        if input_data.clicks is not None:
            available.add("clicks")
        else:
            missing.add("clicks")

        if input_data.conversions is not None:
            available.add("conversions")
        else:
            missing.add("conversions")

        conversion_rate: float | None = None
        if input_data.clicks is not None and input_data.conversions is not None:
            if input_data.clicks > 0:
                conversion_rate = input_data.conversions / input_data.clicks
            elif input_data.conversions > 0:
                conversion_rate = 1.0  # 100% anomaly if conversions without clicks
            else:
                conversion_rate = 0.0

        parsed_timestamp: datetime | None = None
        ts_str = input_data.timestamp or input_data.activity_date
        if ts_str:
            available.add("timestamp")
            try:
                parsed_timestamp = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
            except ValueError:
                parsed_timestamp = None
        else:
            missing.add("timestamp")

        if input_data.referrer_id or input_data.affiliate_id:
            available.add("referrer_context")
        else:
            missing.add("referrer_context")

        if input_data.device_type:
            available.add("device_type")
        else:
            missing.add("device_type")

        if input_data.country:
            available.add("country")
        else:
            missing.add("country")

        if input_data.transaction_amount is not None:
            available.add("transaction_amount")
        else:
            missing.add("transaction_amount")

        extra_fields = {
            k: v for k, v in input_data.model_extra.items()
            if k not in input_data.__dict__
        } if input_data.model_extra else {}

        return cls(
            activity_id=input_data.activity_id,
            activity_type=input_data.activity_type,
            user_id=input_data.user_id,
            account_id=input_data.account_id,
            referrer_id=input_data.referrer_id,
            referred_user_id=input_data.referred_user_id,
            affiliate_id=input_data.affiliate_id,
            campaign_id=input_data.campaign_id,
            clicks=input_data.clicks,
            conversions=input_data.conversions,
            conversion_rate=conversion_rate,
            conversion_status=input_data.conversion_status,
            timestamp=parsed_timestamp,
            activity_date=input_data.activity_date,
            device_type=input_data.device_type,
            country=input_data.country,
            transaction_amount=input_data.transaction_amount,
            metadata=dict(input_data.metadata),
            raw_extra=extra_fields,
            available_signals=available,
            missing_signals=missing,
        )


@dataclass(frozen=True)
class SignalAnalysis:
    """Result of an individual signal analyzer evaluation."""

    signal_name: str
    triggered: bool
    signal_value: Any
    risk_contribution: float
    explanation: str
    data_used: dict[str, Any]
    evaluable: bool = True


@dataclass
class FraudAssessment:
    """Core fraud risk assessment entity."""

    id: str
    activity_id: str
    activity_type: str
    risk_score: float
    risk_level: RiskLevel
    indicators: list[SignalAnalysis]
    explanation: str
    signals_available: dict[str, bool]
    signals_used: list[str]
    signals_unavailable: list[str]
    analysis_method: str
    confidence: float
    analysis_date: str
    investigation_status: InvestigationStatus = "flagged"
    reviewed_at: str | None = None
    reviewed_by: str | None = None
    review_notes: str | None = None

    def __post_init__(self) -> None:
        _validate_no_secrets({
            "explanation": self.explanation,
            "review_notes": self.review_notes,
            "reviewed_by": self.reviewed_by,
        })


class SignalAnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    signal_name: str
    triggered: bool
    signal_value: Any
    risk_contribution: float
    explanation: str
    data_used: dict[str, Any]
    evaluable: bool = True


class FraudAssessmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    activity_id: str
    activity_type: str
    risk_score: float
    risk_level: RiskLevel
    indicators: list[SignalAnalysisResponse]
    explanation: str
    signals_available: dict[str, bool]
    signals_used: list[str]
    signals_unavailable: list[str]
    analysis_method: str
    confidence: float
    analysis_date: str
    investigation_status: InvestigationStatus
    reviewed_at: str | None = None
    reviewed_by: str | None = None
    review_notes: str | None = None


class FraudAssessmentUpdate(BaseModel):
    investigation_status: InvestigationStatus
    review_notes: str | None = Field(default=None, max_length=2000)
    reviewed_by: str | None = Field(default=None, max_length=100)

    model_config = ConfigDict(extra="forbid")

    @field_validator("review_notes")
    @classmethod
    def validate_review_notes_safe(cls, value: str | None) -> str | None:
        if value is not None:
            _validate_no_secrets({"notes": value})
        return value


class FraudAssessmentListResponse(BaseModel):
    assessments: list[FraudAssessmentResponse]
    total: int
    limit: int
    offset: int


# --- Deterministic Signal Analyzers ---

class ConversionRateAnalyzer:
    """
    Analyzes conversion rate anomalies.
    Compares conversion rate against a baseline if available and evaluates sample size.
    """

    def __init__(
        self,
        baseline_rate: float = 0.08,
        multiplier_threshold: float = 2.0,
        min_sample_size: int = 10,
        weight: float = 40.0,
    ) -> None:
        self.baseline_rate = float(
            os.getenv("FRAUD_DEFAULT_CONVERSION_BASELINE", baseline_rate)
        )
        self.multiplier_threshold = multiplier_threshold
        self.min_sample_size = min_sample_size
        self.weight = float(os.getenv("FRAUD_CONVERSION_WEIGHT", weight))

    def analyze(self, activity: NormalizedActivity) -> SignalAnalysis:
        if activity.clicks is None and activity.conversions is None:
            return SignalAnalysis(
                signal_name="abnormal_conversion_rate",
                triggered=False,
                signal_value=None,
                risk_contribution=0.0,
                explanation="Conversion rate could not be evaluated because neither clicks nor conversions were provided.",
                data_used={},
                evaluable=False,
            )

        clicks = activity.clicks if activity.clicks is not None else 0
        conversions = activity.conversions if activity.conversions is not None else 0

        data_used = {
            "clicks": clicks,
            "conversions": conversions,
            "baseline_rate": self.baseline_rate,
        }

        # Conversion count exceeds clicks
        if conversions > clicks and clicks > 0:
            return SignalAnalysis(
                signal_name="abnormal_conversion_rate",
                triggered=True,
                signal_value=conversions / clicks,
                risk_contribution=self.weight,
                explanation=f"Impossible conversion rate anomaly: {conversions} conversions recorded from {clicks} clicks (>100%).",
                data_used=data_used,
                evaluable=True,
            )

        # Conversions with 0 clicks
        if conversions > 0 and clicks == 0:
            return SignalAnalysis(
                signal_name="abnormal_conversion_rate",
                triggered=True,
                signal_value=1.0,
                risk_contribution=self.weight,
                explanation=f"Conversions recorded ({conversions}) without any registered clicks.",
                data_used=data_used,
                evaluable=True,
            )

        # Insufficient sample volume check
        total_volume = clicks + conversions
        if total_volume < self.min_sample_size and conversions <= 2:
            return SignalAnalysis(
                signal_name="abnormal_conversion_rate",
                triggered=False,
                signal_value=activity.conversion_rate,
                risk_contribution=0.0,
                explanation=f"Activity volume too low ({clicks} clicks, {conversions} conversions) to reliably determine a statistical conversion anomaly.",
                data_used=data_used,
                evaluable=True,
            )

        rate = activity.conversion_rate if activity.conversion_rate is not None else 0.0
        threshold = self.baseline_rate * self.multiplier_threshold

        if rate >= threshold and conversions >= 3:
            return SignalAnalysis(
                signal_name="abnormal_conversion_rate",
                triggered=True,
                signal_value=round(rate, 4),
                risk_contribution=self.weight,
                explanation=f"Conversion rate of {rate:.1%} is significantly higher than the expected baseline ({self.baseline_rate:.1%}) with {conversions} conversions from {clicks} clicks.",
                data_used=data_used,
                evaluable=True,
            )

        return SignalAnalysis(
            signal_name="abnormal_conversion_rate",
            triggered=False,
            signal_value=round(rate, 4),
            risk_contribution=0.0,
            explanation=f"Conversion rate of {rate:.1%} ({conversions}/{clicks}) falls within normal expected bounds (baseline {self.baseline_rate:.1%}).",
            data_used=data_used,
            evaluable=True,
        )


class ReferralVelocityAnalyzer:
    """
    Analyzes referral and affiliate velocity bursts.
    Checks for high frequency spikes over expected baseline.
    """

    def __init__(
        self,
        baseline_velocity: float = 2.0,
        multiplier_threshold: float = 3.0,
        weight: float = 35.0,
    ) -> None:
        self.baseline_velocity = float(
            os.getenv("FRAUD_DEFAULT_REFERRAL_VELOCITY", baseline_velocity)
        )
        self.multiplier_threshold = multiplier_threshold
        self.weight = float(os.getenv("FRAUD_VELOCITY_WEIGHT", weight))

    def analyze(self, activity: NormalizedActivity) -> SignalAnalysis:
        # Check if activity has velocity data in metadata or explicit fields
        velocity_count = (
            activity.metadata.get("referrals_in_window")
            or activity.metadata.get("velocity_count")
            or activity.metadata.get("referral_count_6h")
            or activity.metadata.get("recent_count")
        )
        window_hours = activity.metadata.get("time_window_hours", 6)

        if velocity_count is None and not activity.referrer_id and not activity.affiliate_id:
            return SignalAnalysis(
                signal_name="referral_velocity_spike",
                triggered=False,
                signal_value=None,
                risk_contribution=0.0,
                explanation="Referral velocity could not be evaluated because no referrer ID or velocity metrics were provided.",
                data_used={},
                evaluable=False,
            )

        if velocity_count is None:
            # If explicit conversion bursts are provided directly in the activity
            if activity.conversions is not None and activity.conversions >= (self.baseline_velocity * self.multiplier_threshold * 2):
                velocity_count = activity.conversions
                window_hours = 24

        if velocity_count is None:
            return SignalAnalysis(
                signal_name="referral_velocity_spike",
                triggered=False,
                signal_value=None,
                risk_contribution=0.0,
                explanation="Referral velocity history for this referrer/affiliate is not present in the payload.",
                data_used={"referrer_id": activity.referrer_id, "affiliate_id": activity.affiliate_id},
                evaluable=False,
            )

        threshold = self.baseline_velocity * self.multiplier_threshold
        data_used = {
            "velocity_count": velocity_count,
            "baseline_velocity": self.baseline_velocity,
            "window_hours": window_hours,
            "referrer_id": activity.referrer_id or activity.affiliate_id,
        }

        if float(velocity_count) >= threshold:
            return SignalAnalysis(
                signal_name="referral_velocity_spike",
                triggered=True,
                signal_value=velocity_count,
                risk_contribution=self.weight,
                explanation=f"Referral velocity spike detected: {velocity_count} referrals in {window_hours}h exceeds normal baseline ({self.baseline_velocity}/day).",
                data_used=data_used,
                evaluable=True,
            )

        return SignalAnalysis(
            signal_name="referral_velocity_spike",
            triggered=False,
            signal_value=velocity_count,
            risk_contribution=0.0,
            explanation=f"Referral velocity of {velocity_count} events in {window_hours}h is within normal range.",
            data_used=data_used,
            evaluable=True,
        )


class TemporalAnomalyAnalyzer:
    """
    Analyzes temporal anomalies such as severe clustering, instantaneous conversions, or suspicious burst windows.
    """

    def __init__(self, weight: float = 25.0) -> None:
        self.weight = float(os.getenv("FRAUD_TEMPORAL_WEIGHT", weight))

    def analyze(self, activity: NormalizedActivity) -> SignalAnalysis:
        # Check if temporal clustering metadata or timestamps are present
        duration_seconds = activity.metadata.get("duration_seconds")
        burst_clustering = activity.metadata.get("temporal_clustering")
        interval_seconds = activity.metadata.get("avg_interval_seconds")

        if duration_seconds is None and burst_clustering is None and interval_seconds is None and not activity.timestamp:
            return SignalAnalysis(
                signal_name="unusual_timing_pattern",
                triggered=False,
                signal_value=None,
                risk_contribution=0.0,
                explanation="Temporal patterns could not be evaluated due to lack of timing data.",
                data_used={},
                evaluable=False,
            )

        data_used: dict[str, Any] = {}
        if duration_seconds is not None:
            data_used["duration_seconds"] = duration_seconds
        if burst_clustering is not None:
            data_used["temporal_clustering"] = burst_clustering
        if interval_seconds is not None:
            data_used["avg_interval_seconds"] = interval_seconds

        # Evaluate burst clustering indicators
        if burst_clustering is True or (isinstance(burst_clustering, str) and burst_clustering.lower() in ("true", "high", "clustered")):
            return SignalAnalysis(
                signal_name="unusual_timing_pattern",
                triggered=True,
                signal_value="clustered",
                risk_contribution=self.weight,
                explanation="Severe temporal clustering detected: activity events occurred in an abnormally narrow window.",
                data_used=data_used,
                evaluable=True,
            )

        # Clicks and conversions with near-zero duration (< 10 seconds for multiple conversions)
        if duration_seconds is not None and duration_seconds < 10 and (activity.conversions or 0) >= 3:
            return SignalAnalysis(
                signal_name="unusual_timing_pattern",
                triggered=True,
                signal_value=f"{duration_seconds}s",
                risk_contribution=self.weight,
                explanation=f"Rapid automated burst detected: {activity.conversions} conversions occurred within {duration_seconds} seconds.",
                data_used=data_used,
                evaluable=True,
            )

        # Micro-intervals indicative of scripted/bot behavior
        if interval_seconds is not None and interval_seconds < 1.0 and (activity.clicks or 0) >= 5:
            return SignalAnalysis(
                signal_name="unusual_timing_pattern",
                triggered=True,
                signal_value=f"{interval_seconds}s interval",
                risk_contribution=self.weight,
                explanation=f"Sub-second intervals ({interval_seconds}s average) between actions strongly indicate automated traffic.",
                data_used=data_used,
                evaluable=True,
            )

        return SignalAnalysis(
            signal_name="unusual_timing_pattern",
            triggered=False,
            signal_value="normal",
            risk_contribution=0.0,
            explanation="Temporal distribution and event intervals appear normal.",
            data_used=data_used,
            evaluable=True,
        )


class DeviceBehaviorAnalyzer:
    """
    Analyzes device clustering and suspicious device signatures.
    Does NOT flag if device data is simply missing.
    """

    def __init__(self, weight: float = 20.0) -> None:
        self.weight = weight

    def analyze(self, activity: NormalizedActivity) -> SignalAnalysis:
        device_type = activity.device_type
        device_fingerprint_clustering = activity.metadata.get("device_clustering")
        unique_devices = activity.metadata.get("unique_device_count")
        user_agent_anomaly = activity.metadata.get("suspicious_user_agent")

        if device_type is None and device_fingerprint_clustering is None and unique_devices is None and user_agent_anomaly is None:
            return SignalAnalysis(
                signal_name="device_clustering",
                triggered=False,
                signal_value=None,
                risk_contribution=0.0,
                explanation="Device behavior could not be evaluated because no device metadata was provided.",
                data_used={},
                evaluable=False,
            )

        data_used: dict[str, Any] = {
            "device_type": device_type,
        }
        if device_fingerprint_clustering is not None:
            data_used["device_clustering"] = device_fingerprint_clustering
        if unique_devices is not None:
            data_used["unique_device_count"] = unique_devices
        if user_agent_anomaly is not None:
            data_used["suspicious_user_agent"] = user_agent_anomaly

        if device_fingerprint_clustering is True or (isinstance(device_fingerprint_clustering, str) and device_fingerprint_clustering.lower() == "true"):
            return SignalAnalysis(
                signal_name="device_clustering",
                triggered=True,
                signal_value="clustered",
                risk_contribution=self.weight,
                explanation="Multiple distinct referred users generated conversions from the exact same device fingerprint.",
                data_used=data_used,
                evaluable=True,
            )

        if unique_devices == 1 and (activity.conversions or 0) >= 5:
            return SignalAnalysis(
                signal_name="device_clustering",
                triggered=True,
                signal_value="single_device_multiple_conversions",
                risk_contribution=self.weight,
                explanation=f"{activity.conversions} conversions originated from a single device instance.",
                data_used=data_used,
                evaluable=True,
            )

        if user_agent_anomaly is True:
            return SignalAnalysis(
                signal_name="device_clustering",
                triggered=True,
                signal_value="suspicious_user_agent",
                risk_contribution=self.weight,
                explanation="Device user agent exhibits synthetic or known automated scraper/bot traits.",
                data_used=data_used,
                evaluable=True,
            )

        return SignalAnalysis(
            signal_name="device_clustering",
            triggered=False,
            signal_value=device_type or "normal",
            risk_contribution=0.0,
            explanation="Device characteristics and fingerprint distribution appear legitimate.",
            data_used=data_used,
            evaluable=True,
        )


class GeoLocationAnalyzer:
    """
    Analyzes geographic concentration or geographical anomalies.
    Does NOT flag if geographic data is simply missing.
    """

    def __init__(self, weight: float = 15.0) -> None:
        self.weight = weight

    def analyze(self, activity: NormalizedActivity) -> SignalAnalysis:
        country = activity.country
        geo_clustering = activity.metadata.get("geo_clustering")
        rapid_geo_shift = activity.metadata.get("rapid_geo_shift")
        datacenter_proxy = activity.metadata.get("datacenter_proxy")

        if country is None and geo_clustering is None and rapid_geo_shift is None and datacenter_proxy is None:
            return SignalAnalysis(
                signal_name="geo_clustering",
                triggered=False,
                signal_value=None,
                risk_contribution=0.0,
                explanation="Geographic analysis could not be evaluated because no location metadata was provided.",
                data_used={},
                evaluable=False,
            )

        data_used: dict[str, Any] = {"country": country}
        if geo_clustering is not None:
            data_used["geo_clustering"] = geo_clustering
        if rapid_geo_shift is not None:
            data_used["rapid_geo_shift"] = rapid_geo_shift
        if datacenter_proxy is not None:
            data_used["datacenter_proxy"] = datacenter_proxy

        if rapid_geo_shift is True:
            return SignalAnalysis(
                signal_name="geo_clustering",
                triggered=True,
                signal_value="rapid_geo_shift",
                risk_contribution=self.weight,
                explanation="Physically impossible travel velocity detected between consecutive activity events across different countries.",
                data_used=data_used,
                evaluable=True,
            )

        if geo_clustering is True:
            return SignalAnalysis(
                signal_name="geo_clustering",
                triggered=True,
                signal_value="concentrated",
                risk_contribution=self.weight,
                explanation="Abnormal geographic concentration detected from an unexpected IP/region cluster.",
                data_used=data_used,
                evaluable=True,
            )

        return SignalAnalysis(
            signal_name="geo_clustering",
            triggered=False,
            signal_value=country or "normal",
            risk_contribution=0.0,
            explanation="Geographic distribution appears consistent and normal.",
            data_used=data_used,
            evaluable=True,
        )


# --- Risk Scorer ---

class RiskScorer:
    """
    Combines independent analyzer outputs deterministically into a unified risk assessment.
    Produces score (0-100), risk level (low/medium/high), confidence, and explainability text.
    """

    def __init__(
        self,
        low_threshold: float = 30.0,
        high_threshold: float = 60.0,
    ) -> None:
        self.low_threshold = low_threshold
        self.high_threshold = high_threshold

    def score(
        self,
        activity: NormalizedActivity,
        signals: list[SignalAnalysis],
    ) -> FraudAssessment:
        total_risk = 0.0
        triggered_signals: list[SignalAnalysis] = []
        signals_available: dict[str, bool] = {}
        signals_used: list[str] = []
        signals_unavailable: list[str] = []

        total_possible_signals = len(signals)
        unevaluable_count = 0

        for sig in signals:
            signals_available[sig.signal_name] = sig.evaluable
            if sig.evaluable:
                signals_used.append(sig.signal_name)
                if sig.triggered:
                    total_risk += sig.risk_contribution
                    triggered_signals.append(sig)
            else:
                signals_unavailable.append(sig.signal_name)
                unevaluable_count += 1

        # Bound score between 0.0 and 100.0
        risk_score = round(min(100.0, max(0.0, total_risk)), 2)

        # Assign risk level
        if risk_score >= self.high_threshold:
            risk_level: RiskLevel = "high"
        elif risk_score >= self.low_threshold:
            risk_level = "medium"
        else:
            risk_level = "low"

        # Calculate confidence: missing signals reduce confidence
        confidence = round(
            max(0.2, 1.0 - (0.12 * unevaluable_count / max(1, total_possible_signals) * 5)),
            2,
        )

        # Generate clear, explainable summary
        if triggered_signals:
            signal_reasons = "; ".join(
                f"{s.signal_name.replace('_', ' ').capitalize()} ({s.explanation})"
                for s in triggered_signals
            )
            explanation = (
                f"Activity flagged with {risk_level.upper()} risk (score: {risk_score}/100) due to "
                f"{len(triggered_signals)} triggered indicator(s): {signal_reasons}."
            )
        else:
            if unevaluable_count == total_possible_signals:
                explanation = "Activity shows LOW risk (score: 0.0/100) because insufficient signal data was available to evaluate risk."
            else:
                explanation = (
                    f"Activity assessed as LOW risk (score: {risk_score}/100). All {len(signals_used)} evaluated "
                    "signals fell within normal expected behavioral boundaries."
                )

        if signals_unavailable:
            explanation += f" Note: {len(signals_unavailable)} signal(s) could not be evaluated due to missing input fields ({', '.join(signals_unavailable)})."

        assessment_id = f"assessment-{uuid.uuid4().hex[:12]}"
        analysis_date = datetime.now(timezone.utc).isoformat()

        investigation_status: InvestigationStatus = "flagged"

        return FraudAssessment(
            id=assessment_id,
            activity_id=activity.activity_id,
            activity_type=activity.activity_type,
            risk_score=risk_score,
            risk_level=risk_level,
            indicators=triggered_signals,
            explanation=explanation,
            signals_available=signals_available,
            signals_used=signals_used,
            signals_unavailable=signals_unavailable,
            analysis_method="deterministic_v1",
            confidence=confidence,
            analysis_date=analysis_date,
            investigation_status=investigation_status,
        )


# --- Repository Protocol & InMemory Implementation ---

class FraudRepository(Protocol):
    """Database-neutral persistence boundary for fraud assessments."""

    def create_assessment(self, assessment: FraudAssessment) -> FraudAssessment: ...
    def get_assessment(self, assessment_id: str) -> FraudAssessment: ...
    def update_assessment(self, assessment: FraudAssessment) -> FraudAssessment: ...
    def list_assessments(
        self,
        activity_id: str | None = None,
        status: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[FraudAssessment]: ...
    def list_flagged_assessments(self, limit: int = 100) -> list[FraudAssessment]: ...
    def count_assessments(
        self,
        activity_id: str | None = None,
        status: str | None = None,
    ) -> int: ...


class InMemoryFraudRepository:
    """In-memory implementation of FraudRepository for development and testing."""

    def __init__(self, initial_assessments: dict[str, FraudAssessment] | None = None) -> None:
        self._assessments: dict[str, FraudAssessment] = initial_assessments or {}
        self._counter: int = len(self._assessments) + 1

    def _clone_assessment(self, a: FraudAssessment) -> FraudAssessment:
        return FraudAssessment(
            id=a.id,
            activity_id=a.activity_id,
            activity_type=a.activity_type,
            risk_score=a.risk_score,
            risk_level=a.risk_level,
            indicators=list(a.indicators),
            explanation=a.explanation,
            signals_available=dict(a.signals_available),
            signals_used=list(a.signals_used),
            signals_unavailable=list(a.signals_unavailable),
            analysis_method=a.analysis_method,
            confidence=a.confidence,
            analysis_date=a.analysis_date,
            investigation_status=a.investigation_status,
            reviewed_at=a.reviewed_at,
            reviewed_by=a.reviewed_by,
            review_notes=a.review_notes,
        )

    def create_assessment(self, assessment: FraudAssessment) -> FraudAssessment:
        if not assessment.id or assessment.id.startswith("temp-"):
            assessment.id = f"assessment-{self._counter}"
            self._counter += 1
        cloned = self._clone_assessment(assessment)
        self._assessments[cloned.id] = cloned
        return self._clone_assessment(cloned)

    def get_assessment(self, assessment_id: str) -> FraudAssessment:
        if assessment_id not in self._assessments:
            raise ValueError(f"Fraud assessment '{assessment_id}' not found")
        return self._clone_assessment(self._assessments[assessment_id])

    def update_assessment(self, assessment: FraudAssessment) -> FraudAssessment:
        if assessment.id not in self._assessments:
            raise ValueError(f"Fraud assessment '{assessment.id}' not found")
        cloned = self._clone_assessment(assessment)
        self._assessments[cloned.id] = cloned
        return self._clone_assessment(cloned)

    def list_assessments(
        self,
        activity_id: str | None = None,
        status: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[FraudAssessment]:
        results = list(self._assessments.values())
        if activity_id:
            results = [a for a in results if a.activity_id == activity_id]
        if status:
            results = [a for a in results if a.investigation_status == status]

        # Sort descending by analysis date
        results.sort(key=lambda x: x.analysis_date, reverse=True)
        return [self._clone_assessment(a) for a in results[offset : offset + limit]]

    def list_flagged_assessments(self, limit: int = 100) -> list[FraudAssessment]:
        flagged = [a for a in self._assessments.values() if a.investigation_status == "flagged"]
        flagged.sort(key=lambda x: x.analysis_date, reverse=True)
        return [self._clone_assessment(a) for a in flagged[:limit]]

    def count_assessments(
        self,
        activity_id: str | None = None,
        status: str | None = None,
    ) -> int:
        results = list(self._assessments.values())
        if activity_id:
            results = [a for a in results if a.activity_id == activity_id]
        if status:
            results = [a for a in results if a.investigation_status == status]
        return len(results)


# --- Fraud Detection Service ---

class FraudDetectionService:
    """
    Main orchestration service for AI-002 Fraud Detection Intelligence.
    Accepts flexible activity input, extracts signals, calculates deterministic risk scores,
    persists assessments to repository, and manages investigation workflows with audit logging.
    """

    def __init__(
        self,
        repository: FraudRepository | None = None,
        audit_sink: AuditSink | None = None,
        analyzers: list[Any] | None = None,
        scorer: RiskScorer | None = None,
    ) -> None:
        self._repository = repository or InMemoryFraudRepository()
        self._audit_sink = audit_sink or InMemoryAuditSink()
        self._analyzers = analyzers or [
            ConversionRateAnalyzer(),
            ReferralVelocityAnalyzer(),
            TemporalAnomalyAnalyzer(),
            DeviceBehaviorAnalyzer(),
            GeoLocationAnalyzer(),
        ]
        self._scorer = scorer or RiskScorer()

    def analyze(self, activity_input: FraudActivityInput | dict[str, Any]) -> FraudAssessment:
        """
        Processes an incoming activity record and generates a structured, explainable fraud assessment.
        """
        if isinstance(activity_input, dict):
            activity_input = FraudActivityInput(**activity_input)

        normalized = NormalizedActivity.from_input(activity_input)

        # Run independent signal extractors
        signal_results: list[SignalAnalysis] = []
        for analyzer in self._analyzers:
            signal_results.append(analyzer.analyze(normalized))

        # Score and generate assessment
        assessment = self._scorer.score(normalized, signal_results)

        # Persist assessment via database-neutral repository
        persisted = self._repository.create_assessment(assessment)
        return persisted

    def get_assessment(self, assessment_id: str) -> FraudAssessment:
        """Retrieves an existing assessment by ID."""
        return self._repository.get_assessment(assessment_id)

    def list_assessments(
        self,
        activity_id: str | None = None,
        status: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[FraudAssessment], int]:
        """Queries assessments with filtering and pagination, returning (items, total_count)."""
        items = self._repository.list_assessments(
            activity_id=activity_id,
            status=status,
            limit=limit,
            offset=offset,
        )
        total = self._repository.count_assessments(
            activity_id=activity_id,
            status=status,
        )
        return items, total

    def list_flagged(self, limit: int = 100) -> list[FraudAssessment]:
        """Returns assessments currently in 'flagged' status."""
        return self._repository.list_flagged_assessments(limit=limit)

    def update_assessment_status(
        self,
        assessment_id: str,
        new_status: InvestigationStatus,
        review_notes: str | None = None,
        reviewed_by: str | None = None,
    ) -> FraudAssessment:
        """
        Updates the investigation status (e.g. dismissed, confirmed, under_review)
        and records an audit event.
        """
        valid_statuses = ("flagged", "under_review", "confirmed", "dismissed")
        if new_status not in valid_statuses:
            raise ValueError(f"Invalid investigation status '{new_status}'. Must be one of {valid_statuses}")

        # Ensure review notes do not contain secrets
        if review_notes:
            _validate_no_secrets({"review_notes": review_notes})

        existing = self._repository.get_assessment(assessment_id)
        prev_status = existing.investigation_status

        now_iso = datetime.now(timezone.utc).isoformat()
        existing.investigation_status = new_status
        existing.reviewed_at = now_iso
        existing.reviewed_by = reviewed_by
        existing.review_notes = review_notes

        updated = self._repository.update_assessment(existing)

        # Record safe audit event
        self._audit_sink.record(
            AuditEvent(
                action=f"fraud_assessment_{new_status}",
                resource="fraud_assessment",
                resource_id=assessment_id,
                previous={"investigation_status": prev_status},
                current={
                    "investigation_status": new_status,
                    "review_notes": review_notes,
                    "activity_id": updated.activity_id,
                },
                occurred_at=now_iso,
                actor=reviewed_by,
            )
        )

        return updated


# Default singleton instance for application runtime
fraud_detection_service = FraudDetectionService()
