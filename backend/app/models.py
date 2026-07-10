"""Pydantic schemas for PreMortem AI.

These models define the procurement input package, the structured output of
each specialist agent, and the consolidated PreMortem report.
"""
from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


# --------------------------------------------------------------------------- #
# Input
# --------------------------------------------------------------------------- #
class WarrantyStart(str, Enum):
    ON_DELIVERY = "On Delivery"
    ON_COMMISSIONING = "On Commissioning"
    ON_INSTALLATION = "On Installation"


class ApprovalStatus(str, Enum):
    APPROVED = "Approved"
    PENDING = "Pending"
    NOT_STARTED = "Not Started"


class ProcurementInput(BaseModel):
    """Everything a procurement officer enters on Screen 1."""

    procurement_name: str = Field(default="MRI System")
    equipment_type: str = Field(default="MRI Machine")
    contract_value_cr: float = Field(
        default=18.0, description="Contract value in INR Crore"
    )
    advance_payment_pct: float = Field(default=60.0, ge=0, le=100)
    delivery_timeline_months: float = Field(default=4.0, ge=0)
    warranty_start: WarrantyStart = Field(default=WarrantyStart.ON_DELIVERY)
    installation_responsibility: str = Field(default="Buyer")
    training_included: bool = Field(default=False)
    construction_completion_pct: float = Field(default=60.0, ge=0, le=100)
    electrical_readiness: ApprovalStatus = Field(default=ApprovalStatus.PENDING)
    regulatory_approval_status: ApprovalStatus = Field(
        default=ApprovalStatus.PENDING
    )
    technicians_available: int = Field(default=0, ge=0)
    technicians_required: int = Field(default=6, ge=0)
    historical_delays_months: List[float] = Field(
        default_factory=lambda: [8.0, 11.0, 7.0]
    )
    raw_document_text: Optional[str] = Field(
        default=None, description="Optional parsed text from an uploaded document"
    )
    category: str = Field(
        default="general",
        description="Procurement category detected by item research (e.g. aviation, medical_equipment)",
    )
    item_research_context: Optional[str] = Field(
        default=None,
        description="Research summary about the item being procured, used to calibrate agent analysis",
    )
    extra_fields: dict = Field(
        default_factory=dict,
        description="Category-specific additional fields captured during intake",
    )


# --------------------------------------------------------------------------- #
# Agent output
# --------------------------------------------------------------------------- #
class RiskLevel(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AgentResult(BaseModel):
    agent: str
    status: str = "completed"
    risk_score: float = Field(ge=0, le=100)
    risk_level: RiskLevel
    findings: List[str] = Field(default_factory=list)
    evidence: List[str] = Field(default_factory=list)
    reasoning: str = ""
    recommendation: str = ""
    # free-form extras (delay prediction, projected loss, readiness %, etc.)
    metrics: dict = Field(default_factory=dict)


class DebateTurn(BaseModel):
    agent: str
    statements: List[str]


class ScenarioOutcome(BaseModel):
    name: str  # Best / Expected / Worst
    timeline_months: float
    financial_impact_cr: float
    operational_impact: str
    probability_pct: float


class Decision(str, Enum):
    GO = "GO"
    GO_WITH_CONDITIONS = "GO WITH CONDITIONS"
    NO_GO = "NO-GO"


class PreMortemReport(BaseModel):
    procurement_name: str
    equipment_type: str
    contract_value_cr: float

    overall_risk_score: float
    failure_probability_pct: float
    confidence_pct: float
    predicted_delay_months: float
    projected_financial_loss_cr: float

    predicted_failure_mode: str
    supporting_evidence: List[str]
    predicted_outcomes: List[str]
    recommended_decision: Decision
    conditions: List[str]

    agent_results: List[AgentResult]
    debate: List[DebateTurn]
    scenarios: List[ScenarioOutcome]

    generated_at: str
