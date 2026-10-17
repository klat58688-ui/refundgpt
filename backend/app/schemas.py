from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class AnalyzeIn(BaseModel):
    raw_conversation: str = Field(min_length=5, max_length=20000)
    order_id: Optional[str] = None
    paypal_capture_id: Optional[str] = None
    amount: Optional[float] = None
    currency: str = "USD"
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None


class PolicyMatch(BaseModel):
    eligible: bool
    refund_percentage: int
    reason: str


class Recommendation(BaseModel):
    action: Literal["full_refund", "partial_refund", "reject"]
    amount: float
    confidence: float
    reasoning: str


class AIAnalysis(BaseModel):
    order_id: Optional[str] = None
    amount: Optional[float] = None
    issue_type: str
    customer_claims: list[str] = []
    evidence_mentioned: list[str] = []
    contradictions: list[str] = []
    policy_match: PolicyMatch
    recommendation: Recommendation
    next_steps: list[str] = []


class DecisionIn(BaseModel):
    action: Literal["full_refund", "partial_refund", "reject"]
    amount: Optional[float] = Field(None, gt=0)  # required for partial_refund
    note: str = ""
    override_threshold: bool = False  # must be true when amount > AUTO_REFUND_THRESHOLD


class RefundRequestOut(BaseModel):
    id: int
    order_id: Optional[str]
    paypal_capture_id: Optional[str]
    amount: Optional[float]
    currency: str
    customer_name: Optional[str]
    customer_email: Optional[str]
    raw_conversation: str
    ai_analysis: Optional[dict[str, Any]]
    status: str
    merchant_decision: Optional[dict[str, Any]]
    paypal_refund_id: Optional[str]
    analysis_error: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StatsOut(BaseModel):
    today_processed: int
    avg_processing_seconds: float
    total_refunded: float
    pending_count: int
