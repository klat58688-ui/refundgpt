"""Refund request API.

Status machine:
    pending ──analyze ok──> analyzed ──decide(approve)──> approved ──execute──> executing ──> executed
        │                      │                            │                     │
        │                      └──decide(reject)──> rejected│                     └─error──> failed ──execute──> (retry)
        └── AI failure: request KEPT with status=pending + analysis_error; retry via POST /{rid}/reanalyze

Invariants enforced here:
- partial_refund requires a positive amount ≤ original amount (never silently upgrades to full)
- execute is idempotent (PayPal-Request-Id = refund-{rid}) and crash-safe (executing intermediate state)
- execute verifies the PayPal capture (status COMPLETED) before refunding
- amounts above AUTO_REFUND_THRESHOLD require explicit override_threshold=true
"""
import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, update
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import AuditLog, RefundPolicy, RefundRequest, RefundStatus, utc_now
from ..schemas import (AIAnalysis, AnalyzeIn, DecisionIn, RefundRequestOut, StatsOut)
from ..services.ai_engine import analyze_conversation
from ..services.paypal_client import PayPalError, paypal_client

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["refunds"])

TERMINAL_STATES = (RefundStatus.executed, RefundStatus.rejected)
OPEN_STATES = (RefundStatus.pending, RefundStatus.analyzed)


def _policies_text(db: Session) -> str:
    rows = db.query(RefundPolicy).filter(RefundPolicy.active == 1).all()
    return "\n".join(f"- {p.issue_type}: {p.conditions} (refund {p.refund_percentage}%)" for p in rows) \
        or "No policies configured — use general e-commerce best practice."


def _audit(db: Session, rid: int, action: str, detail: dict | None = None):
    db.add(AuditLog(refund_request_id=rid, action=action, detail=detail or {}))


def _get_or_404(db: Session, rid: int) -> RefundRequest:
    req = db.get(RefundRequest, rid)
    if not req:
        raise HTTPException(404, "not found")
    return req


async def _run_analysis(db: Session, req: RefundRequest) -> RefundRequest:
    """Shared by /analyze and /reanalyze. Never deletes the request on AI failure."""
    try:
        analysis: AIAnalysis = await analyze_conversation(req.raw_conversation, _policies_text(db))
    except Exception as e:
        req.analysis_error = str(e)[:500]
        _audit(db, req.id, "analyze_failed", {"error": req.analysis_error})
        db.commit()
        log.exception("AI analysis failed for request %s", req.id)
        raise HTTPException(502, f"AI analysis failed (request #{req.id} kept, retry via reanalyze): {e}")

    req.ai_analysis = analysis.model_dump()
    req.analysis_error = None
    req.status = RefundStatus.analyzed
    if not req.order_id and analysis.order_id:
        req.order_id = analysis.order_id
    if req.amount is None and analysis.amount is not None:
        req.amount = analysis.amount
    _audit(db, req.id, "analyze", analysis.model_dump())
    db.commit()
    db.refresh(req)
    return req


@router.post("/refunds/analyze", response_model=RefundRequestOut)
async def analyze(body: AnalyzeIn, db: Session = Depends(get_db)):
    """Create a refund request and run AI analysis on the conversation."""
    req = RefundRequest(
        order_id=body.order_id, paypal_capture_id=body.paypal_capture_id,
        amount=body.amount, currency=body.currency,
        customer_name=body.customer_name, customer_email=body.customer_email,
        raw_conversation=body.raw_conversation, status=RefundStatus.pending,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return await _run_analysis(db, req)


@router.post("/refunds/{rid}/reanalyze", response_model=RefundRequestOut)
async def reanalyze(rid: int, db: Session = Depends(get_db)):
    """Re-run AI analysis after a previous failure (or to refresh a pending request)."""
    req = _get_or_404(db, rid)
    if req.status not in (RefundStatus.pending, RefundStatus.analyzed):
        raise HTTPException(409, f"cannot reanalyze a {req.status.value} request")
    return await _run_analysis(db, req)


@router.get("/refunds", response_model=list[RefundRequestOut])
def list_refunds(status: str | None = None, limit: int = Query(50, le=200),
                 db: Session = Depends(get_db)):
    q = db.query(RefundRequest).order_by(RefundRequest.created_at.desc())
    if status:
        try:
            q = q.filter(RefundRequest.status == RefundStatus(status))
        except ValueError:
            raise HTTPException(422, f"invalid status '{status}'; "
                                f"valid: {[s.value for s in RefundStatus]}")
    return q.limit(limit).all()


@router.get("/refunds/{rid}", response_model=RefundRequestOut)
def get_refund(rid: int, db: Session = Depends(get_db)):
    return _get_or_404(db, rid)


@router.post("/refunds/{rid}/decision", response_model=RefundRequestOut)
def decide(rid: int, body: DecisionIn, db: Session = Depends(get_db)):
    """Merchant approves / modifies / rejects the AI suggestion."""
    req = _get_or_404(db, rid)
    if req.status not in (RefundStatus.analyzed, RefundStatus.pending):
        raise HTTPException(409, f"request already {req.status.value}")

    if body.action == "partial_refund" and body.amount is None:
        raise HTTPException(422, "partial_refund requires an explicit positive amount")
    if body.amount is not None and req.amount is not None and body.amount > req.amount + 1e-9:
        raise HTTPException(422, f"refund amount {body.amount} exceeds original amount {req.amount}")
    if (body.amount is not None and body.amount > settings.auto_refund_threshold
            and not body.override_threshold):
        raise HTTPException(
            422, f"amount {body.amount} exceeds AUTO_REFUND_THRESHOLD "
                 f"{settings.auto_refund_threshold} — resubmit with override_threshold=true")

    req.merchant_decision = {"action": body.action, "amount": body.amount,
                             "note": body.note, "override_threshold": body.override_threshold}
    req.status = RefundStatus.rejected if body.action == "reject" else RefundStatus.approved
    _audit(db, rid, "decision", req.merchant_decision)
    db.commit()
    db.refresh(req)
    return req


@router.post("/refunds/{rid}/execute", response_model=RefundRequestOut)
async def execute(rid: int, db: Session = Depends(get_db)):
    """Execute the approved refund via PayPal. Retryable from failed."""
    req = _get_or_404(db, rid)
    if req.status not in (RefundStatus.approved, RefundStatus.failed):
        raise HTTPException(409, "refund must be approved before execution")
    if not req.paypal_capture_id:
        raise HTTPException(422, "paypal_capture_id required to execute refund")

    decision = req.merchant_decision or {}
    amount = decision.get("amount") if decision.get("action") == "partial_refund" else (
        decision.get("amount") or req.amount)
    if amount is None:
        raise HTTPException(422, "no refund amount known — decide with an explicit amount")
    if req.amount is not None and amount > req.amount + 1e-9:
        raise HTTPException(422, "refund amount exceeds original amount")

    # Verify the capture with PayPal before touching money
    try:
        capture = await paypal_client.get_capture(req.paypal_capture_id)
    except PayPalError as e:
        raise HTTPException(502, f"cannot verify capture {req.paypal_capture_id}: {e}")
    if capture.get("status") != "COMPLETED":
        raise HTTPException(422, f"capture status is {capture.get('status')}, expected COMPLETED")
    capture_amount = float(capture["amount"]["value"])
    if amount > capture_amount + 1e-9:
        raise HTTPException(422, f"refund {amount} exceeds capture amount {capture_amount}")

    # Atomic status transition prevents double execution on concurrent calls
    claimed = db.execute(
        update(RefundRequest)
        .where(RefundRequest.id == rid,
               RefundRequest.status.in_([RefundStatus.approved, RefundStatus.failed]))
        .values(status=RefundStatus.executing)
    ).rowcount
    db.commit()
    if not claimed:
        raise HTTPException(409, "refund is already being executed")

    try:
        result = await paypal_client.execute_refund(
            capture_id=req.paypal_capture_id, amount=amount, currency=req.currency,
            note=decision.get("note", ""), idempotency_key=f"refund-{rid}",
        )
    except PayPalError as e:
        req = _get_or_404(db, rid)
        req.status = RefundStatus.failed
        _audit(db, rid, "execute_failed", {"error": str(e), "detail": e.detail})
        db.commit()
        raise HTTPException(502, f"PayPal refund failed (request #{rid} retryable): {e}")

    req = _get_or_404(db, rid)
    req.status = RefundStatus.executed
    req.paypal_refund_id = result.get("id")
    _audit(db, rid, "execute", result)
    db.commit()
    db.refresh(req)
    return req


@router.get("/refunds/{rid}/paypal-status")
async def paypal_status(rid: int, db: Session = Depends(get_db)):
    req = _get_or_404(db, rid)
    if not req.paypal_refund_id:
        raise HTTPException(404, "no paypal refund for this request")
    try:
        return await paypal_client.get_refund_status(req.paypal_refund_id)
    except PayPalError as e:
        raise HTTPException(502, str(e))


@router.get("/stats", response_model=StatsOut)
def stats(db: Session = Depends(get_db)):
    cutoff = utc_now() - timedelta(hours=24)
    processed_today = (
        db.query(RefundRequest.created_at, RefundRequest.updated_at)
        .filter(RefundRequest.status.in_(TERMINAL_STATES),
                RefundRequest.updated_at >= cutoff)
        .all()
    )
    durations = [(u - c).total_seconds() for c, u in processed_today]
    total_refunded = (
        db.query(func.coalesce(func.sum(
            func.coalesce(func.json_extract(RefundRequest.merchant_decision, '$.amount'),
                          RefundRequest.amount)), 0.0))
        .filter(RefundRequest.status == RefundStatus.executed)
        .scalar()
    )
    pending_count = (
        db.query(func.count(RefundRequest.id))
        .filter(RefundRequest.status.in_(OPEN_STATES))
        .scalar()
    )
    return StatsOut(
        today_processed=len(processed_today),
        avg_processing_seconds=sum(durations) / len(durations) if durations else 0.0,
        total_refunded=float(total_refunded or 0.0),
        pending_count=int(pending_count or 0),
    )
