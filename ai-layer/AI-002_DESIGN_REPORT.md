# AI-002: Fraud Detection Intelligence - Architecture Design Report

**Date**: 2026-08-31  
**Status**: DESIGN PHASE (NO IMPLEMENTATION YET)  
**Scope**: Database-neutral fraud detection for referral/affiliate activity  
**Ownership**: AI layer (Superbae AI team)  

---

## Executive Summary

AI-002 must detect suspicious referral and affiliate activity through flexible, deterministic risk analysis. The design follows the same database-neutral patterns established by AI-001, enabling the main Superbae backend to provide varying activity data without requiring the AI layer to know the underlying database schema or technology.

**Key Principle**: Accept what you're given, analyze what's available, explain what was used.

---

## 1. Existing Architecture Relevant to AI-002

### 1.1 Layered Responsibility Model

```
Frontend Team
    ↓
    └─→ UI/UX (will own fraud admin dashboard later)

Main Superbae Backend
    ↓
    ├─→ User authentication & authorization
    ├─→ Application APIs
    ├─→ Database (MongoDB later)
    ├─→ Referral/Affiliate business logic
    ├─→ Activity/Event collection & storage
    └─→ Durable persistence (configuration, assessments)

AI Layer (This Repository)
    ↓
    ├─→ Provider adapters (OpenAI, Gemini, OpenRouter)
    ├─→ Service administration (AI-001)
    ├─→ Fraud detection analysis (AI-002 - this work)
    ├─→ (Future: Recommendations, Moderation, etc. AI-003+)
    └─→ Database-neutral boundaries (repositories, audit)
```

**Implication for AI-002**: The AI layer cannot assume the main backend's schema. It must accept flexible, variable activity payloads and gracefully handle missing fields.

### 1.2 Database-Neutral Repository Pattern (from AI-001)

AI-001 defines a repository protocol:

```python
class AIConfigurationRepository(Protocol):
    def load_providers(self) -> dict[str, ProviderState]: ...
    def save_provider(self, provider: ProviderState) -> None: ...
    def load_models(self) -> dict[tuple[str, str], ModelState]: ...
    def save_model(self, model: ModelState) -> None: ...
    def load_services(self) -> dict[str, ServiceState]: ...
    def save_service(self, service: ServiceState) -> None: ...
    def load_runtime_settings(self) -> RuntimeSettings: ...
    def save_runtime_settings(self, settings: RuntimeSettings) -> None: ...
    def load_configuration(self) -> AIConfigurationSnapshot: ...
    def save_configuration(self, configuration: AIConfigurationSnapshot, expected_revision: int) -> ConfigurationVersion: ...
```

**Key Principles**:
- Repository is a Protocol (not a class), so implementations can vary
- Development uses `InMemoryConfigurationRepository`
- Production uses whatever the main backend provides
- No MongoDB coupling in the AI layer
- Optimistic concurrency via revision numbers
- Configuration is snapshottable and versionable

**Implication for AI-002**: If fraud assessments require persistence, design a similar repository protocol. Do NOT assume MongoDB.

### 1.3 Audit Pattern (from AI-001)

AI-001 defines a separate audit boundary:

```python
@dataclass(frozen=True)
class AuditEvent:
    action: str                          # e.g., "update", "create"
    resource: str                        # e.g., "provider", "service"
    resource_id: str                     # e.g., "openai"
    previous: dict[str, object]          # Previous state (safe only)
    current: dict[str, object]           # Current state (safe only)
    occurred_at: str                     # ISO timestamp
    actor: str | None = None             # Who made the change

class AuditSink(Protocol):
    def record(self, event: AuditEvent) -> None: ...

class InMemoryAuditSink:
    def __init__(self) -> None:
        self.events: list[AuditEvent] = []
    def record(self, event: AuditEvent) -> None:
        self.events.append(event)
```

**Key Principles**:
- Audit is a Protocol (implementation varies)
- Never store secrets in audit records
- Events contain only safe metadata
- Timestamps are ISO format (timezone-aware)
- Actor is optional (for local development)

**Implication for AI-002**: Administrative actions on fraud assessments (dismiss, mark false positive, escalate) should flow through the audit sink.

### 1.4 Pydantic Models & API Validation (from AI-001)

AI-001 uses Pydantic for:
- Request/response validation
- Type safety
- Explicit forbidden fields (`model_config = ConfigDict(extra="forbid")`)
- Field validators for normalization

Example:
```python
class AIServiceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    provider_id: str | None = None
    model_id: str | None = Field(default=None, min_length=1, max_length=200)
    enabled: bool | None = None
    fallback_provider_ids: list[str] | None = None

    @field_validator("provider_id")
    @classmethod
    def normalize_provider(cls, value: str | None) -> str | None:
        return value.lower() if value is not None else None
```

**Key Principles**:
- Explicit contract validation
- Normalization happens in validators
- Forbid unknown fields to catch mistakes

**Implication for AI-002**: Fraud analysis requests should use similar patterns. Accept a flexible payload but validate known fields.

### 1.5 Dependency Injection & Testability (from AI-001)

AI-001 services accept dependencies:

```python
class AIServiceAdmin:
    def __init__(
        self,
        repository: AIConfigurationRepository | None = None,
        audit_sink: AuditSink | None = None,
    ) -> None:
        self._repository = repository or InMemoryConfigurationRepository()
        self._audit_sink = audit_sink or InMemoryAuditSink()
```

**Key Principles**:
- Services accept protocol-based dependencies
- Defaults enable local development
- Tests inject mocks
- No hard-coded singletons

**Implication for AI-002**: Fraud detection service should accept repository and audit dependencies.

### 1.6 Error Handling Conventions (from AI-001)

AI-001 uses:
- Custom exceptions (`AIProviderError`, `ConfigurationConflictError`)
- HTTP status codes mapped to business errors
- Descriptive error messages
- No stack traces in API responses

**Implication for AI-002**: Define custom fraud detection exceptions and map them to appropriate HTTP responses.

---

## 2. Existing Referral/Affiliate Functionality in Repository

**Finding**: There is NO existing referral/affiliate code in the AI layer.

The Superbae application (main backend) owns referral/affiliate business logic. The AI layer will receive referral and affiliate activity data from the main backend as input for analysis.

**Where referral/affiliate data lives**:
- User authentication & referral programs → Main backend
- Activity collection & storage → Main backend (database to be determined)
- Referral link generation → Main backend
- Affiliate program configuration → Main backend

**What AI-002 does with this data**:
- Receives activity snapshots or event streams
- Analyzes for suspicious patterns
- Produces risk assessments
- Returns to main backend for action

---

## 3. Existing Activity/Event Data Structures in Repository

**Finding**: There are NO existing activity or event data structures in the AI layer.

The only event concept is `AuditEvent`, which tracks administrative changes to AI configuration (e.g., "provider enabled changed from true to false").

**For AI-002**: The main backend will define what activity data looks like. The AI layer must design a flexible intake that doesn't require a fixed schema.

---

## 4. Existing Repository Pattern from AI-001

### Database-Neutral Boundary

```
AI-002 → FraudRepository (Protocol) → ?
                                      ├─→ InMemoryFraudRepository (dev/test)
                                      ├─→ Main Backend's Repository Impl (production)
                                      └─→ Backend's MongoDB Adapter (eventually)
```

**Key Properties**:
- Repository is a Protocol (duck typing)
- No knowledge of underlying persistence
- Development uses in-memory storage
- Production delegates to main backend
- Supports snapshot/version patterns for concurrency

### Suggested Pattern for AI-002

```python
@dataclass
class FraudAssessment:
    id: str                              # Unique assessment ID
    activity_id: str                     # Reference to activity being assessed
    risk_level: Literal["low", "medium", "high"]
    risk_score: float                    # 0.0 to 100.0
    indicators: list[str]                # Signal names that triggered
    explanation: str                     # Human-readable summary
    signals_used: dict[str, object]      # Which signals were analyzed
    signals_unavailable: list[str]       # Which signals were missing
    investigation_status: Literal["flagged", "under_review", "confirmed", "dismissed"]
    created_at: str                      # ISO timestamp
    reviewed_at: str | None              # ISO timestamp (if investigated)
    reviewed_by: str | None              # Actor who reviewed
    review_notes: str | None             # Why it was dismissed/confirmed

class FraudRepository(Protocol):
    def create_assessment(self, assessment: FraudAssessment) -> FraudAssessment: ...
    def get_assessment(self, assessment_id: str) -> FraudAssessment: ...
    def list_assessments(self, activity_id: str | None = None, status: str | None = None) -> list[FraudAssessment]: ...
    def update_assessment(self, assessment: FraudAssessment) -> FraudAssessment: ...
    def list_flagged_assessments(self, limit: int = 100) -> list[FraudAssessment]: ...

class InMemoryFraudRepository:
    def __init__(self) -> None:
        self._assessments: dict[str, FraudAssessment] = {}
    def create_assessment(self, assessment: FraudAssessment) -> FraudAssessment: ...
    # ... implement protocol
```

---

## 5. Existing Audit Pattern

The audit pattern from AI-001 should be reused by AI-002 for administrative actions:

```python
# When an admin dismisses a flagged assessment:
self._audit_sink.record(AuditEvent(
    action="dismiss",
    resource="fraud_assessment",
    resource_id=assessment_id,
    previous={"investigation_status": "flagged"},
    current={"investigation_status": "dismissed"},
    occurred_at=datetime.now(timezone.utc).isoformat(),
    actor=admin_user_id,
))

# When an admin marks as confirmed:
self._audit_sink.record(AuditEvent(
    action="confirm",
    resource="fraud_assessment",
    resource_id=assessment_id,
    previous={"investigation_status": "flagged"},
    current={"investigation_status": "confirmed"},
    occurred_at=datetime.now(timezone.utc).isoformat(),
    actor=admin_user_id,
))
```

**Never include in audit**:
- Raw API responses
- User personal data
- Transaction amounts (only status changes)
- IP addresses or device info (only changes to assessment status)

---

## 6. Proposed AI-002 Architecture

### 6.1 Overall Structure

```
FraudDetectionService
    ├─→ Flexible Activity Input Adapter
    │   └─→ Accepts arbitrary activity payloads
    │       Normalizes known fields
    │       Tracks what was available
    │       Ignores unknowns
    │
    ├─→ Risk Analysis Engine
    │   ├─→ Signal Extractors (independent analyzers)
    │   │   ├─→ ConversionRateAnalyzer
    │   │   ├─→ ReferralVelocityAnalyzer
    │   │   ├─→ TemporalAnomalyAnalyzer
    │   │   ├─→ DeviceBehaviorAnalyzer (if data available)
    │   │   └─→ (more can be added)
    │   │
    │   ├─→ Risk Scorer
    │   │   ├─→ Combines signals → risk score (0-100)
    │   │   ├─→ Assigns risk level (low/medium/high)
    │   │   └─→ Produces explanation
    │   │
    │   └─→ Investigation Support
    │       ├─→ Tracks which signals fired
    │       ├─→ Records missing signals
    │       └─→ Provides context for investigation
    │
    ├─→ Repository (Protocol)
    │   ├─→ InMemoryFraudRepository (development)
    │   └─→ (Main backend provides production impl)
    │
    └─→ Audit Sink (Protocol)
        └─→ (Shared with AI-001)
```

### 6.2 Component Responsibilities

**FraudDetectionService**
- Public interface for fraud analysis
- Orchestrates activity input → analysis → assessment storage
- Manages investigation workflow (dismiss, confirm)
- Returns assessments via repository

**Activity Input Adapter**
- Accepts flexible activity payload (dict[str, Any])
- Extracts and normalizes known fields
- Tracks what was available vs. missing
- Validates data types safely
- Never fails on unknown fields

**Signal Extractors**
- Each analyzer is independent
- Computes a signal (e.g., "high_conversion_rate", "unusual_timing")
- Returns signal data, not a verdict
- Clearly states what data it used
- Gracefully handles missing input

**Risk Scorer**
- Combines signals into a risk assessment
- Does NOT make a fraud verdict alone from one signal
- Produces explainable reasoning
- Generates human-readable summary
- Records metadata for investigation

**Repository**
- Persists assessments
- Queries by activity, status, or ID
- Never stores secrets

**Audit Sink**
- Records admin actions (dismiss, confirm)
- Reuses existing AuditEvent pattern
- Never stores sensitive activity data

---

## 7. Proposed Flexible Input Contract

### 7.1 Input Payload Design

The fraud detection service should accept an activity payload that is flexible:

```python
class FraudActivityInput(BaseModel):
    """
    Flexible activity input that gracefully handles varying fields.
    Known fields are extracted and normalized.
    Unknown fields are safely ignored.
    Missing optional fields do not cause failure.
    """
    
    # Core identification (required)
    activity_id: str = Field(min_length=1, max_length=100)  # Unique activity ID
    activity_type: str = Field(default="referral", min_length=1, max_length=50)  # "referral", "affiliate", etc.
    
    # User/Account context (optional)
    user_id: str | None = Field(default=None, min_length=1, max_length=100)
    account_id: str | None = Field(default=None, min_length=1, max_length=100)
    
    # Referral context (optional)
    referrer_id: str | None = Field(default=None, min_length=1, max_length=100)
    referred_user_id: str | None = Field(default=None, min_length=1, max_length=100)
    
    # Affiliate context (optional)
    affiliate_id: str | None = Field(default=None, min_length=1, max_length=100)
    campaign_id: str | None = Field(default=None, min_length=1, max_length=100)
    
    # Conversion/Activity signals (optional)
    clicks: int | None = Field(default=None, ge=0)
    conversions: int | None = Field(default=None, ge=0)
    conversion_status: str | None = Field(default=None, min_length=1, max_length=50)  # "pending", "completed", "failed"
    
    # Temporal (optional)
    activity_date: str | None = Field(default=None)  # ISO date
    timestamp: str | None = Field(default=None)  # ISO datetime
    
    # Behavioral/Device (optional - only if provided)
    device_type: str | None = Field(default=None, min_length=1, max_length=50)  # "mobile", "desktop", etc.
    country: str | None = Field(default=None, min_length=2, max_length=2)  # ISO 2-letter code
    
    # Transaction/Activity amount (optional)
    transaction_amount: float | None = Field(default=None, ge=0)
    
    # Custom metadata (optional - stored but not analyzed by default)
    metadata: dict[str, Any] = Field(default_factory=dict, max_length=100)
    
    model_config = ConfigDict(
        extra="allow",  # Allow unknown fields (will be ignored safely)
        use_enum_values=True,
    )
    
    @field_validator("activity_date", mode="before")
    @classmethod
    def validate_activity_date(cls, v: str | None) -> str | None:
        if v is None:
            return None
        # Validate ISO date format
        from datetime import datetime
        try:
            datetime.fromisoformat(v.replace("Z", "+00:00"))
            return v
        except ValueError:
            raise ValueError("activity_date must be ISO format")
        return v
    
    @field_validator("timestamp", mode="before")
    @classmethod
    def validate_timestamp(cls, v: str | None) -> str | None:
        if v is None:
            return None
        from datetime import datetime
        try:
            datetime.fromisoformat(v.replace("Z", "+00:00"))
            return v
        except ValueError:
            raise ValueError("timestamp must be ISO format")
        return v
```

### 7.2 What the Input Provides

**This contract supports**:
- Activity with all fields populated
- Activity with some fields missing
- Activity with unknown fields (safely ignored)
- Varying types of activity (referral, affiliate, hybrid)
- Flexible metadata

**This contract does NOT**:
- Require a fixed schema from the main backend
- Assume which fields exist
- Break if new fields are added later
- Expose database technology

### 7.3 Flexible Data Extraction

The service extracts and normalizes what's available:

```python
@dataclass
class NormalizedActivity:
    """What we extracted and will analyze"""
    activity_id: str
    activity_type: str
    
    # Optional fields that may or may not be present
    user_id: str | None
    referrer_id: str | None
    affiliate_id: str | None
    
    # Signals (present only if input provided them)
    clicks: int | None
    conversions: int | None
    conversion_rate: float | None  # Calculated from conversions/clicks if both available
    
    timestamp: datetime | None  # Parsed from input
    
    # Metadata about what was available
    available_signals: set[str]  # ["clicks", "conversions", "timestamp", ...]
    missing_signals: set[str]    # ["device_type", "country", ...]
```

---

## 8. Proposed Fraud Assessment Output Contract

### 8.1 Risk Assessment Response

```python
@dataclass(frozen=True)
class SignalAnalysis:
    """Result from one independent signal analyzer"""
    signal_name: str                     # e.g., "high_conversion_rate"
    signal_value: object                 # The computed signal value
    risk_contribution: float             # Contribution to overall score (0.0-100.0)
    explanation: str                     # Why this signal matters
    data_used: dict[str, object]         # What input fields were used

@dataclass(frozen=True)
class FraudAssessment:
    """Complete fraud risk assessment for an activity"""
    
    # Identification
    id: str                              # UUID for this assessment
    activity_id: str                     # Reference to assessed activity
    
    # Risk scoring
    risk_score: float                    # 0.0 (definitely legitimate) to 100.0 (definitely suspicious)
    risk_level: Literal["low", "medium", "high"]  # Bucketed from score
    
    # Indicators and explanation
    indicators: list[SignalAnalysis]     # Which signals triggered
    explanation: str                     # Summary for investigation
    
    # Methodology
    signals_available: dict[str, bool]   # Which signals we had data for
    signals_used: list[str]              # Which we actually analyzed
    signals_unavailable: list[str]       # Which we could NOT analyze
    
    # Metadata
    analysis_method: str                 # e.g., "deterministic_v1"
    confidence: float                    # 0.0 to 1.0 (how confident is the score?)
    analysis_date: str                   # ISO timestamp
    
    # Investigation workflow
    investigation_status: Literal["flagged", "under_review", "confirmed", "dismissed"] = "flagged"
    reviewed_at: str | None = None       # ISO timestamp
    reviewed_by: str | None = None       # Admin who reviewed
    review_notes: str | None = None      # Why dismissed/confirmed
    
    # Explainability
    @property
    def summary(self) -> str:
        """Machine-readable summary for API"""
        return {
            "activity_id": self.activity_id,
            "risk_level": self.risk_level,
            "risk_score": self.risk_score,
            "flagged": self.risk_level in ["medium", "high"],
            "indicators_count": len(self.indicators),
            "investigation_status": self.investigation_status,
        }
```

### 8.2 Example Assessment Output

```json
{
  "id": "assessment-12345",
  "activity_id": "activity-abc",
  "risk_level": "high",
  "risk_score": 78.5,
  
  "indicators": [
    {
      "signal_name": "unusual_conversion_rate",
      "signal_value": 0.95,
      "risk_contribution": 45.0,
      "explanation": "Conversion rate of 95% is significantly higher than baseline (expected ~8%)",
      "data_used": {
        "clicks": 20,
        "conversions": 19,
        "baseline_rate": 0.08
      }
    },
    {
      "signal_name": "referral_velocity_spike",
      "signal_value": 15,
      "risk_contribution": 33.5,
      "explanation": "This referrer has generated 15 referrals in the last 6 hours (baseline ~2/day)",
      "data_used": {
        "referral_count_6h": 15,
        "baseline_velocity": "~2 per day",
        "time_window": "6h"
      }
    }
  ],
  
  "explanation": "Activity shows two independent concerning patterns: an unusually high conversion rate and abnormal referral velocity. This combination warrants investigation.",
  
  "signals_available": {
    "conversions": true,
    "clicks": true,
    "timestamp": true,
    "referrer_id": true,
    "device_type": false,
    "geo_location": false,
    "ip_address": false
  },
  
  "signals_used": ["conversions", "clicks", "timestamp", "referrer_id"],
  "signals_unavailable": ["device_type", "geo_location", "ip_address"],
  
  "analysis_method": "deterministic_v1",
  "confidence": 0.82,
  "analysis_date": "2026-08-31T14:30:00Z",
  
  "investigation_status": "flagged",
  "reviewed_at": null,
  "reviewed_by": null,
  "review_notes": null
}
```

### 8.3 Why This Design

**Explainability**:
- Each signal clearly shows why it matters
- Each signal shows what data was used
- Explanation is human-readable (for admins)
- Confidence is explicit (not guaranteed)

**Traceability**:
- Signals available/used/unavailable clearly marked
- No false claim about analyzing data that wasn't present
- Auditable reasoning

**Actionability**:
- Admin can see why it was flagged
- Admin can drill into specific signals
- Admin can make an informed investigation decision

**Extensibility**:
- New signals can be added without breaking output format
- Signals are independent (can be tested separately)
- Analysis method is versioned

---

## 9. Proposed Risk Indicators (Signals)

### 9.1 Deterministic Signal Analyzers

These are rule-based, explainable signals. None alone proves fraud; together they provide risk assessment.

#### Conversion Rate Anomaly
```
Name: "high_conversion_rate"
Available if: clicks AND conversions
Baseline: Historical average conversion rate per referrer/affiliate
Signal: If conversion_rate > baseline * 2.0, signal fires
Example: 95% conversion when baseline is 8%
Risk contribution: 40 points
```

#### Referral Velocity Spike
```
Name: "referral_velocity_spike"
Available if: referrer_id AND timestamp (lookback window)
Baseline: Average referrals per referrer per day
Signal: If referrals_in_6h > baseline * 3.0, signal fires
Example: 15 referrals in 6 hours when baseline is 2/day
Risk contribution: 35 points
```

#### Temporal Clustering
```
Name: "unusual_timing_pattern"
Available if: clicks/conversions AND timestamp
Baseline: Normal distribution of activity across hours/days
Signal: If activity is extremely clustered (all in 1 hour), signal fires
Example: All 20 clicks + 19 conversions in a single hour
Risk contribution: 25 points
```

#### Low Activity Volume
```
Name: "insufficient_data"
Available if: clicks OR conversions
Baseline: Minimum meaningful sample size (e.g., 10 conversions)
Signal: If activity volume is too low, confidence is reduced (not risk increased)
Example: Only 1 click, 1 conversion (cannot draw meaningful conclusions)
Risk contribution: Reduces confidence, not a risk driver
```

#### Repeated Device/IP Patterns (If Available)
```
Name: "device_clustering"
Available if: device_type data provided
Baseline: Expected distribution of devices per referrer
Signal: If all referrals come from same device type
Example: All 20 referrals from identical device model
Risk contribution: 20 points (if data available)
```

#### Geographic Concentration (If Available)
```
Name: "geo_clustering"
Available if: country/geo data provided
Baseline: Expected geographic distribution
Signal: If all referrals from same country/region that's unusual
Example: All conversions from same country when referrer is global
Risk contribution: 15 points (if data available)
```

### 9.2 Signal Composition

**Base Risk Score Formula**:
```
total_risk = sum(signal.risk_contribution for each_fired_signal)
risk_level = "high" if total_risk > 60
           = "medium" if total_risk > 30
           = "low" otherwise
confidence = 1.0 - (0.1 * count_of_unavailable_signals / total_possible_signals)
```

**Key Properties**:
- Signals are independent (can analyze each separately)
- Signals combined additively (no single signal is verdict)
- Missing signals reduce confidence but don't trigger false alarms
- New signals can be added without breaking existing logic

### 9.3 What Should NOT Be Signals

❌ **Single High Conversion Rate** - Not fraud by itself (legitimate campaigns exist)  
❌ **Large Transaction Amount** - Not fraud by itself (legitimate sales exist)  
❌ **Referrer is New** - Not fraud by itself (growth requires new referrers)  
❌ **User is New** - Not fraud by itself (all users are new once)  
❌ **IP is From Datacenter** - Not fraud by itself (legitimate use of cloud services)  

✅ These become signals only when **combined with other anomalies** or when they exhibit **unusual patterns for that specific referrer/affiliate**.

---

## 10. Proposed Investigation Workflow

### 10.1 Admin Workflow States

```
                    ┌─────────────┐
                    │   flagged   │
                    │ (initial)   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │under_review │
                    │  (optional) │
                    └──────┬──────┘
                           │
                ┌──────────┴──────────┐
                │                    │
         ┌──────▼──────┐      ┌──────▼──────┐
         │ confirmed   │      │  dismissed  │
         │(fraud found)│      │(false +ve) │
         └─────────────┘      └─────────────┘
```

### 10.2 Workflow Operations

**API Operations**:

1. **Analyze Activity** (FraudDetectionService)
   - Input: FraudActivityInput
   - Output: FraudAssessment
   - Storage: Persisted via repository

2. **Get Assessment** (Query)
   - Input: assessment_id
   - Output: FraudAssessment
   - Purpose: Admin viewing details

3. **List Flagged** (Query)
   - Input: (none - returns all flagged)
   - Output: list[FraudAssessment] (status="flagged")
   - Purpose: Admin dashboard

4. **Update Investigation Status** (Admin Action)
   - Input: assessment_id, new_status (dismissed|confirmed|under_review)
   - Input: review_notes (optional)
   - Output: Updated FraudAssessment
   - Audit: Records status change

5. **Query by Activity** (Query)
   - Input: activity_id
   - Output: list[FraudAssessment] for that activity
   - Purpose: See all assessments for a specific activity

---

## 11. Proposed False-Positive Workflow

### 11.1 Admin Can Dismiss

When an admin reviews a flagged assessment and determines it's legitimate:

```python
service.update_assessment_status(
    assessment_id="assessment-12345",
    new_status="dismissed",
    review_notes="Campaign XYZ is legitimate partner promotion. High conversion rate expected.",
    reviewed_by="admin-user-id"
)
```

**What happens**:
- Assessment status changes to "dismissed"
- reviewed_at, reviewed_by, review_notes populated
- Audit event recorded: action="dismiss", resource="fraud_assessment"

### 11.2 Learning from False Positives (Future)

The data can be used to refine baselines:
- "This referrer normally has 90% conversion rate" (override baseline for future)
- "This campaign type triggers velocity spike legitimately" (add context to signal)

**NOT implemented in AI-002 v1** but possible later:
- Feedback loop to adjust per-referrer baselines
- Campaign-type-specific signal thresholds
- ML model trained on dismissed + confirmed assessments

---

## 12. Proposed Repository Interface

### 12.1 Protocol Definition

```python
@dataclass(frozen=True)
class FraudAssessment:
    """Core fraud assessment entity (as described in section 8)"""
    id: str
    activity_id: str
    risk_score: float
    risk_level: Literal["low", "medium", "high"]
    indicators: list[SignalAnalysis]
    explanation: str
    signals_available: dict[str, bool]
    signals_used: list[str]
    signals_unavailable: list[str]
    analysis_method: str
    confidence: float
    analysis_date: str
    investigation_status: Literal["flagged", "under_review", "confirmed", "dismissed"]
    reviewed_at: str | None
    reviewed_by: str | None
    review_notes: str | None

class FraudRepository(Protocol):
    """Database-neutral boundary for fraud assessment persistence"""
    
    def create_assessment(self, assessment: FraudAssessment) -> FraudAssessment:
        """Persist a new assessment. Repository assigns ID if not provided."""
        ...
    
    def get_assessment(self, assessment_id: str) -> FraudAssessment:
        """Retrieve a single assessment by ID. Raises ValueError if not found."""
        ...
    
    def update_assessment(self, assessment: FraudAssessment) -> FraudAssessment:
        """Update assessment status/notes. Raises ValueError if not found."""
        ...
    
    def list_assessments(
        self,
        activity_id: str | None = None,
        status: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[FraudAssessment]:
        """Query assessments with optional filters. Returns paginated results."""
        ...
    
    def list_flagged_assessments(self, limit: int = 100) -> list[FraudAssessment]:
        """Convenience query for investigation dashboard. Returns assessments with status='flagged'."""
        ...
```

### 12.2 Development Implementation

```python
class InMemoryFraudRepository:
    """Development & testing implementation"""
    
    def __init__(self) -> None:
        self._assessments: dict[str, FraudAssessment] = {}
        self._next_id: int = 1
    
    def create_assessment(self, assessment: FraudAssessment) -> FraudAssessment:
        if not assessment.id or assessment.id.startswith("temp-"):
            assessment.id = f"assessment-{self._next_id}"
            self._next_id += 1
        self._assessments[assessment.id] = assessment
        return assessment
    
    def get_assessment(self, assessment_id: str) -> FraudAssessment:
        if assessment_id not in self._assessments:
            raise ValueError(f"Assessment {assessment_id} not found")
        return self._assessments[assessment_id]
    
    def update_assessment(self, assessment: FraudAssessment) -> FraudAssessment:
        if assessment.id not in self._assessments:
            raise ValueError(f"Assessment {assessment.id} not found")
        self._assessments[assessment.id] = assessment
        return assessment
    
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
        return results[offset:offset+limit]
    
    def list_flagged_assessments(self, limit: int = 100) -> list[FraudAssessment]:
        flagged = [a for a in self._assessments.values() if a.investigation_status == "flagged"]
        return sorted(flagged, key=lambda x: x.analysis_date, reverse=True)[:limit]
```

### 12.3 Production Pattern

The main Superbae backend provides the implementation:

```python
# In main backend (NOT in AI layer)
class MongoDBFraudRepository:
    """Implemented by main backend team"""
    def __init__(self, db_connection):
        self.db = db_connection["fraud"]
    
    def create_assessment(self, assessment: FraudAssessment) -> FraudAssessment:
        # Insert into MongoDB
        # Handle ID generation
        # Return persisted assessment
        ...
    
    # ... implement protocol
```

The AI layer receives it via dependency injection:
```python
# In AI layer
service = FraudDetectionService(
    repository=MongoDBFraudRepository(...),  # Provided by main backend
    audit_sink=production_audit_sink,
)
```

---

## 13. Proposed API Endpoints

### 13.1 Endpoint Design (FastAPI)

**Endpoint 1: Analyze Activity**
```
POST /ai/fraud/analyze

Request:
{
  "activity_id": "ref-123",
  "activity_type": "referral",
  "clicks": 20,
  "conversions": 19,
  "timestamp": "2026-08-31T14:30:00Z",
  "referrer_id": "user-456",
  ...
}

Response: 200
{
  "id": "assessment-789",
  "activity_id": "ref-123",
  "risk_level": "high",
  "risk_score": 78.5,
  "investigation_status": "flagged",
  "indicators": [...],
  "explanation": "...",
  ...
}

Error: 400 (invalid input)
Error: 502 (analysis failed)
```

**Endpoint 2: Get Assessment**
```
GET /ai/fraud/assessments/{assessment_id}

Response: 200
{...full assessment...}

Error: 404 (not found)
```

**Endpoint 3: List Flagged Assessments**
```
GET /ai/fraud/assessments?status=flagged&limit=50

Response: 200
{
  "assessments": [...],
  "total": 247,
  "limit": 50,
  "offset": 0
}
```

**Endpoint 4: Query by Activity**
```
GET /ai/fraud/assessments?activity_id=ref-123

Response: 200
{
  "assessments": [...all assessments for that activity...],
  "total": 3
}
```

**Endpoint 5: Update Investigation Status**
```
PUT /ai/fraud/assessments/{assessment_id}

Request:
{
  "investigation_status": "dismissed",
  "review_notes": "Campaign XYZ is legitimate partner promotion."
}

Response: 200
{...updated assessment...}

Error: 400 (invalid status)
Error: 404 (not found)
```

### 13.2 Admin Authorization

Fraud analysis endpoints require admin key (like AI-001):

```python
@app.post("/ai/fraud/analyze", dependencies=[Depends(require_ai_admin)])
def analyze_activity(request: FraudActivityInput) -> dict:
    ...

@app.get("/ai/fraud/assessments", dependencies=[Depends(require_ai_admin)])
def list_assessments(...) -> dict:
    ...

@app.put("/ai/fraud/assessments/{assessment_id}", dependencies=[Depends(require_ai_admin)])
def update_assessment(...) -> dict:
    ...
```

### 13.3 Public `/chat` Endpoint

**The public chatbot is NOT affected**:
- `/chat` remains unchanged
- Fraud analysis is admin-only
- No fraud data exposed to chat users
- Fraud signals do NOT affect chat routing

---

## 14. Proposed Testing Strategy

### 14.1 Unit Tests

**Test File**: `backend/tests/test_fraud_detection.py`

**Test Classes**:

1. **FraudActivityInputTests**
   - Test valid input with all fields
   - Test valid input with partial fields
   - Test valid input with unknown fields (safely ignored)
   - Test invalid input (malformed timestamps)
   - Test field normalization
   - Test field validation

2. **SignalAnalyzerTests**
   - Test ConversionRateAnalyzer with normal rate
   - Test ConversionRateAnalyzer with spike
   - Test ConversionRateAnalyzer with missing data
   - Test ReferralVelocityAnalyzer with normal velocity
   - Test ReferralVelocityAnalyzer with spike
   - Test TemporalAnomalyAnalyzer with clustered activity
   - Test TemporalAnomalyAnalyzer with spread activity
   - Test each analyzer independently

3. **RiskScorerTests**
   - Test no signals = low risk
   - Test one signal = moderate risk
   - Test multiple signals = high risk
   - Test confidence calculation
   - Test risk level bucketing

4. **FraudAssessmentTests**
   - Test assessment creation
   - Test assessment serialization
   - Test assessment with missing signals
   - Test assessment explanation generation
   - Test assessment explainability

5. **FraudDetectionServiceTests**
   - Test normal activity analysis
   - Test suspicious activity analysis
   - Test activity with all optional fields
   - Test activity with no optional fields
   - Test analysis with repository injection
   - Test analysis with audit sink injection

6. **InvestigationWorkflowTests**
   - Test dismiss assessment (update status)
   - Test confirm assessment (update status)
   - Test update review notes
   - Test query by status
   - Test query by activity_id

7. **RepositoryTests**
   - Test create assessment (repository stores it)
   - Test get assessment (repository retrieves)
   - Test update assessment (repository updates)
   - Test list assessments (repository filters)
   - Test list flagged (repository filters by status)

8. **AuditTests**
   - Test dismiss action recorded
   - Test confirm action recorded
   - Test audit contains no secrets
   - Test audit contains timestamp and actor

### 14.2 Integration Tests

**Test File**: `backend/tests/test_fraud_integration.py`

1. **End-to-End Analysis**
   - Input: FraudActivityInput
   - Through: FraudDetectionService
   - To: Repository
   - Verify: Assessment persisted and retrievable

2. **API Endpoint Tests** (FastAPI TestClient)
   - Test `POST /ai/fraud/analyze` with valid input
   - Test `POST /ai/fraud/analyze` with missing fields
   - Test `GET /ai/fraud/assessments/{id}`
   - Test `GET /ai/fraud/assessments?status=flagged`
   - Test `PUT /ai/fraud/assessments/{id}` (update status)
   - Test unauthorized access (no admin key)

3. **Workflow Tests**
   - Analyze activity → flagged
   - Query flagged → get assessment
   - Dismiss → status changed
   - Audit events recorded

### 14.3 Data-Driven Tests

Use parameterized tests for signal detection:

```python
@pytest.mark.parametrize("clicks,conversions,expected_signal", [
    (100, 2, False),      # 2% - normal
    (100, 8, False),      # 8% - normal
    (100, 16, True),      # 16% - spike (2x baseline)
    (10, 9, True),        # 90% - high
    (1, 1, False),        # 100% but low volume (n/a)
])
def test_conversion_rate_analyzer(clicks, conversions, expected_signal):
    analyzer = ConversionRateAnalyzer(baseline=0.08)
    signal = analyzer.analyze(clicks=clicks, conversions=conversions)
    assert signal.triggered == expected_signal
```

### 14.4 What Tests Should NOT Do

❌ **Do NOT require MongoDB** - Use InMemoryFraudRepository  
❌ **Do NOT call external APIs** - Mock or skip  
❌ **Do NOT make real network calls** - Use mocks  
❌ **Do NOT test ML/LLM** - Fraud detection v1 is deterministic  
❌ **Do NOT test the chatbot** - Separate concern  

### 14.5 Test Fixtures

```python
@pytest.fixture
def fraud_service():
    repository = InMemoryFraudRepository()
    audit_sink = InMemoryAuditSink()
    return FraudDetectionService(repository=repository, audit_sink=audit_sink)

@pytest.fixture
def normal_activity():
    return FraudActivityInput(
        activity_id="test-1",
        clicks=100,
        conversions=8,
        referrer_id="ref-1",
        timestamp="2026-08-31T10:00:00Z",
    )

@pytest.fixture
def suspicious_activity():
    return FraudActivityInput(
        activity_id="test-2",
        clicks=20,
        conversions=19,
        referrer_id="ref-2",
        timestamp="2026-08-31T14:30:00Z",
    )
```

---

## 15. Data From Main Backend (Will Provide)

The main Superbae backend will provide:

1. **Referral/Affiliate Activity Records**
   - activity_id
   - referrer_id
   - referred_user_id
   - clicks
   - conversions
   - conversion_status
   - timestamps
   - Any other signals available

2. **User Context** (if available)
   - user_id
   - account_id
   - affiliate_id
   - campaign_id

3. **Behavioral Signals** (if available)
   - device_type
   - country/geo
   - IP-related data (anonymized)
   - transaction_amount

4. **Production FraudRepository Implementation**
   - Implements the repository protocol
   - Handles MongoDB (or whatever database)
   - Manages persistence, schema, indexes
   - Provided via dependency injection

5. **Production AuditSink Implementation**
   - Reuses AI-001's audit pattern
   - Forwards to central audit system
   - Manages retention, compliance

---

## 16. Configuration-Based Data (AI Layer Owns)

The AI layer configures:

1. **Signal Baselines**
   - Default conversion rate baseline (e.g., 8%)
   - Default referral velocity baseline (e.g., 2/day)
   - Temporal clustering threshold (e.g., 1 hour)
   - Sample size threshold (e.g., 10 conversions min)

2. **Risk Scoring Weights**
   - Conversion rate anomaly weight: 40 points
   - Referral velocity weight: 35 points
   - Temporal clustering weight: 25 points
   - Device clustering weight: 20 points (if available)
   - Geo clustering weight: 15 points (if available)

3. **Risk Level Thresholds**
   - Low risk: score < 30
   - Medium risk: 30 ≤ score < 60
   - High risk: score ≥ 60

4. **Environment Variables** (`.env`)
   ```
   FRAUD_ANALYSIS_ENABLED=true
   FRAUD_DEFAULT_CONVERSION_BASELINE=0.08
   FRAUD_DEFAULT_REFERRAL_VELOCITY=2.0
   FRAUD_CONVERSION_WEIGHT=40
   FRAUD_VELOCITY_WEIGHT=35
   FRAUD_TEMPORAL_WEIGHT=25
   ```

---

## 17. Security Considerations

### 17.1 Data Protection

✅ **DO**:
- Accept activity data that lacks personally identifiable information
- Never store raw user identity in fraud assessments (only IDs)
- Encrypt sensitive fields at rest (main backend responsibility)
- Log administrative actions to audit sink
- Validate all input

❌ **DON'T**:
- Store passwords, API keys, tokens
- Log raw activity payloads
- Expose user personal data in API responses
- Cache raw credentials
- Include secrets in assessment explanations

### 17.2 Access Control

- Fraud analysis endpoints require `X-AI-Admin-Key` (like AI-001)
- Investigation/review endpoints require admin authorization
- Public `/chat` endpoint is unaffected
- No fraud data visible to chat users

### 17.3 Data Retention

- Fraud assessments should be deletable by main backend
- Repository interface allows for archive/purge operations
- Audit events follow existing retention policy

### 17.4 Explainability for Regulation

The structured output supports regulatory inquiries:
- "Why was this activity flagged?" → assessment.explanation
- "What signals were considered?" → assessment.signals_used
- "What data was not available?" → assessment.signals_unavailable
- "Who reviewed it?" → assessment.reviewed_by, reviewed_at

---

## 18. What Should NOT Be Implemented in AI Layer

❌ **Do NOT**:
1. Create a separate database (main backend provides persistence)
2. Hard-code MongoDB schema or connection strings
3. Directly call user authentication system
4. Store user personal information beyond IDs
5. Create a separate audit system (reuse AI-001's AuditSink)
6. Build a fraud rules engine that requires ML/LLM
7. Implement geolocation lookup (too domain-specific)
8. Make external API calls to fraud detection services
9. Store API secrets in fraud assessment records
10. Create competing persistence layers
11. Implement feature engineering for ML (too early)
12. Create user-facing admin dashboard (frontend owns this)

✅ **Instead**:
1. Define flexible input contracts
2. Implement deterministic signal analysis
3. Provide structured risk assessments
4. Enable investigation workflows
5. Rely on main backend for persistence
6. Support audit trail for compliance
7. Leave room for future ML/LLM (but don't require it)

---

## 19. Assumptions & Ambiguities Requiring Confirmation

### 19.1 Data Questions

**Q1**: Will the main backend provide historical activity data for baseline calculation?
- **Assumption**: AI-002 v1 uses fixed baselines from environment variables
- **Future**: v2 could use provided historical data
- **Confirm**: Who owns baseline calculation/updates?

**Q2**: What fields will be consistently available?
- **Assumption**: activity_id, activity_type, timestamp always present
- **Assumption**: conversions/clicks often present but not guaranteed
- **Confirm**: What's the minimum viable data set?

**Q3**: Will the AI layer need to accept streaming event data or batch activity?
- **Assumption**: Batch requests (analysis on-demand or periodic)
- **Future**: Stream processing possible but not v1
- **Confirm**: What's the expected analysis frequency?

### 19.2 Workflow Questions

**Q4**: Should flagged assessments auto-escalate after N days?
- **Assumption**: No automatic escalation in v1
- **Future**: Admin can add workflow automation
- **Confirm**: What SLA should be tracked?

**Q5**: Should dismissed assessments be used to refine baselines?
- **Assumption**: No feedback loop in v1
- **Future**: v2 could learn from dismissed cases
- **Confirm**: Is per-referrer baseline personalization desired?

**Q6**: Should the system track false-positive rate?
- **Assumption**: Admin reviews dismissed assessments to find patterns
- **Future**: Metrics could drive signal tuning
- **Confirm**: Who monitors model performance?

### 19.3 Integration Questions

**Q7**: When should analysis occur?
- **Assumption**: On-demand via API (admin triggers it)
- **Alternative**: Background job (main backend calls regularly)
- **Alternative**: Real-time stream (event happens → analyze)
- **Confirm**: Who owns the analysis trigger?

**Q8**: Will there be a separate fraud admin dashboard?
- **Assumption**: Yes (frontend team owns this)
- **Assumption**: AI layer provides REST API, frontend consumes it
- **Confirm**: What's the admin UX for investigation?

**Q9**: Should fraud analysis affect chat/customer experience?
- **Assumption**: No (fraud detection is internal admin workflow)
- **Confirm**: Is fraud determination a customer-facing event?

---

## 20. Recommended Implementation Order

### Phase 1: Foundation (2-3 days)

1. **Define data contracts**
   - FraudActivityInput (Pydantic model)
   - FraudAssessment (data class)
   - SignalAnalysis (data class)

2. **Create repository protocol**
   - FraudRepository (Protocol)
   - InMemoryFraudRepository (implementation)
   - Integration with existing audit sink

3. **Implement basic input adapter**
   - Flexible payload handling
   - Field normalization
   - Track available vs. missing signals

4. **Create minimal test suite**
   - Input validation tests
   - Repository tests
   - Basic service tests

**Deliverable**: 
- Data models defined
- Repository protocol defined
- 40+ passing tests
- No signals implemented yet (placeholder)

### Phase 2: Signal Analysis (3-4 days)

5. **Implement signal analyzers** (independently)
   - ConversionRateAnalyzer
   - ReferralVelocityAnalyzer
   - TemporalAnomalyAnalyzer
   - Each with comprehensive tests

6. **Implement risk scorer**
   - Combine signals → risk score
   - Produce risk level
   - Generate explanation

7. **Implement FraudDetectionService**
   - Orchestrate input → analysis → storage
   - Inject repository & audit sink
   - Handle errors gracefully

**Deliverable**:
- 80+ tests passing
- 3+ independent signal detectors
- Risk scoring working
- Assessment persistence working

### Phase 3: Admin Workflows (2-3 days)

8. **Implement investigation workflow**
   - Status transitions (flagged → dismissed/confirmed)
   - Review notes
   - Audit recording

9. **Create API endpoints**
   - POST /ai/fraud/analyze
   - GET /ai/fraud/assessments
   - PUT /ai/fraud/assessments/{id}
   - List and query endpoints

10. **API tests**
    - Endpoint tests
    - Authorization tests
    - Error handling tests

**Deliverable**:
- 120+ tests passing
- 5 working API endpoints
- Investigation workflow complete
- Admin can dismiss/confirm assessments

### Phase 4: Integration & Documentation (2-3 days)

11. **Integration with existing systems**
    - Verify chat not affected
    - Verify AI-001 not affected
    - Verify audit sink compatibility

12. **Documentation**
    - API docs (endpoint signatures)
    - Admin workflow guide
    - Integration guide for main backend
    - Testing guide

13. **Final testing**
    - End-to-end tests
    - Performance tests
    - Security review
    - Regression tests

**Deliverable**:
- 150+ tests passing
- Full API documentation
- Integration guide
- Ready for main backend integration

### Implementation Milestones

**Milestone 1 (EOD Friday)**: Foundation - Data models, repository, basic tests  
**Milestone 2 (EOD Monday)**: Signals - All analyzers working, risk scoring  
**Milestone 3 (EOD Tuesday)**: Workflows - Investigation, admin actions, API  
**Milestone 4 (EOD Wednesday)**: Integration - All tests passing, docs complete  

---

## 21. Success Criteria

### Functional Criteria

✅ Fraud detection can analyze activity with varying fields  
✅ Missing fields don't cause analysis to fail  
✅ Unknown fields are safely ignored  
✅ Risk assessment is explainable (shows which signals fired)  
✅ Admins can query flagged assessments  
✅ Admins can dismiss false positives  
✅ Admins can confirm suspicious activity  
✅ Audit trail records all administrative actions  
✅ Public `/chat` endpoint unaffected  
✅ AI-001 administration unaffected  

### Quality Criteria

✅ 150+ unit tests (85%+ coverage)  
✅ All tests pass without MongoDB  
✅ No secrets in assessments or audit  
✅ No external API dependencies  
✅ Deterministic analysis (same input → same output)  
✅ Extensible signal architecture  
✅ Clear separation of concerns  

### Integration Criteria

✅ Main backend can provide FraudRepository implementation  
✅ Admin can query assessments via REST API  
✅ Audit events compatible with AI-001 pattern  
✅ Error responses follow FastAPI conventions  
✅ Admin authorization uses existing X-AI-Admin-Key pattern  

---

## 22. Conclusion

AI-002 (Fraud Detection Intelligence) is designed to be:

1. **Database-Neutral**: Accepts flexible activity data, doesn't assume database schema
2. **Explainable**: Every flagged activity shows why (which signals fired)
3. **Deterministic**: Rule-based analysis, not blackbox LLM
4. **Extensible**: New signals can be added without breaking existing ones
5. **Integrated**: Follows AI-001 patterns for repository, audit, API
6. **Testable**: All logic testable without database or external APIs
7. **Admin-Friendly**: Supports investigation workflows and false-positive handling

**Ready for implementation** pending answers to ambiguities in section 19.

---

## Appendix: File Structure (Proposed)

```
backend/
├── services/
│   ├── ai_admin_service.py (existing - unchanged)
│   ├── ai_service.py (existing - unchanged)
│   └── fraud_detection_service.py (NEW)
│       ├── FraudActivityInput
│       ├── FraudAssessment
│       ├── SignalAnalysis
│       ├── FraudRepository (Protocol)
│       ├── InMemoryFraudRepository
│       ├── FraudDetectionService
│       ├── ConversionRateAnalyzer
│       ├── ReferralVelocityAnalyzer
│       ├── TemporalAnomalyAnalyzer
│       └── RiskScorer
│
├── main.py (modified)
│   └── Add /ai/fraud/analyze endpoint
│   └── Add /ai/fraud/assessments endpoints
│   └── Add admin authorization
│
└── tests/
    ├── test_ai_admin.py (existing - unchanged)
    ├── test_fraud_detection.py (NEW)
    │   ├── FraudActivityInputTests
    │   ├── SignalAnalyzerTests
    │   ├── RiskScorerTests
    │   ├── FraudAssessmentTests
    │   ├── FraudDetectionServiceTests
    │   ├── InvestigationWorkflowTests
    │   ├── RepositoryTests
    │   └── AuditTests
    │
    └── test_fraud_integration.py (NEW)
        ├── EndToEndAnalysisTests
        ├── APIEndpointTests
        └── WorkflowTests
```

---

**END OF DESIGN REPORT**

This report provides the architecture, patterns, and detailed design without any implementation code or file modifications. It is ready for review before implementation begins.
