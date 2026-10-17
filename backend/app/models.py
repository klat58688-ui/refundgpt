import enum
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.types import JSON

from .database import Base


def utc_now() -> datetime:
    """Naive UTC timestamp (SQLite-friendly, no deprecated utcnow)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class RefundStatus(str, enum.Enum):
    pending = "pending"          # awaiting AI analysis or merchant review
    analyzed = "analyzed"        # AI suggestion ready
    approved = "approved"        # merchant approved, awaiting execution
    executing = "executing"      # PayPal call in flight (crash-safe intermediate state)
    executed = "executed"        # PayPal refund completed
    rejected = "rejected"        # merchant / AI rejected
    failed = "failed"            # PayPal execution failed (retryable)


class RefundRequest(Base):
    __tablename__ = "refund_requests"

    id = Column(Integer, primary_key=True)
    order_id = Column(String(64), index=True, nullable=True)
    paypal_capture_id = Column(String(64), nullable=True)
    amount = Column(Float, nullable=True)
    currency = Column(String(8), default="USD")
    customer_name = Column(String(128), nullable=True)
    customer_email = Column(String(128), nullable=True)

    raw_conversation = Column(Text, nullable=False)   # pasted text / OCR result
    ai_analysis = Column(JSON, nullable=True)         # structured AI output

    status = Column(Enum(RefundStatus), default=RefundStatus.pending, index=True)
    merchant_decision = Column(JSON, nullable=True)   # final action, amount, note
    paypal_refund_id = Column(String(64), nullable=True)
    analysis_error = Column(Text, nullable=True)      # last AI failure message (request is kept)

    created_at = Column(DateTime, default=utc_now, index=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


class RefundPolicy(Base):
    __tablename__ = "refund_policies"

    id = Column(Integer, primary_key=True)
    name = Column(String(128), nullable=False)
    issue_type = Column(String(64), index=True)       # product_defect / not_received / changed_mind ...
    conditions = Column(Text, nullable=False)         # human-readable rule
    refund_percentage = Column(Integer, nullable=False)
    active = Column(Integer, default=1)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    refund_request_id = Column(Integer, ForeignKey("refund_requests.id"), index=True)
    action = Column(String(64), nullable=False)       # analyze / approve / reject / execute
    actor = Column(String(64), default="merchant")
    detail = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utc_now)
