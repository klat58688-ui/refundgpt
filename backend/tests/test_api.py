"""Smoke tests for the refund API state machine and money-safety rules.
LLM and PayPal are mocked — these tests never touch the network."""
import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mktemp(suffix='.db')}"

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import refunds as refunds_router
from app.schemas import AIAnalysis, PolicyMatch, Recommendation

client = TestClient(app)

FAKE_ANALYSIS = AIAnalysis(
    order_id="PP-T1", amount=50.0, issue_type="product_defect",
    customer_claims=["broken"], evidence_mentioned=["photo"], contradictions=[],
    policy_match=PolicyMatch(eligible=True, refund_percentage=100, reason="defect"),
    recommendation=Recommendation(action="full_refund", amount=50.0, confidence=0.9, reasoning="ok"),
    next_steps=[],
)


def _analyze_ok(text: str, policies: str):
    return FAKE_ANALYSIS


@pytest.fixture(autouse=True)
def mock_llm(monkeypatch):
    """Bypass the real LLM call (async function patched with async stub)."""
    async def stub(conversation, policies_text):
        return FAKE_ANALYSIS
    monkeypatch.setattr(refunds_router, "analyze_conversation", stub)


def _create(amount=50.0):
    r = client.post("/api/refunds/analyze", json={
        "raw_conversation": "item broken, want refund", "order_id": "PP-T1", "amount": amount})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_analyze_creates_analyzed_request():
    rid = _create()
    body = client.get(f"/api/refunds/{rid}").json()
    assert body["status"] == "analyzed"
    assert body["ai_analysis"]["issue_type"] == "product_defect"


def test_partial_refund_requires_amount():
    rid = _create()
    r = client.post(f"/api/refunds/{rid}/decision", json={"action": "partial_refund"})
    assert r.status_code == 422


def test_amount_cannot_exceed_original():
    rid = _create(amount=50.0)
    r = client.post(f"/api/refunds/{rid}/decision",
                    json={"action": "partial_refund", "amount": 60.0})
    assert r.status_code == 422


def test_threshold_requires_override():
    rid = _create(amount=500.0)
    r = client.post(f"/api/refunds/{rid}/decision",
                    json={"action": "full_refund", "amount": 500.0})
    assert r.status_code == 422
    r = client.post(f"/api/refunds/{rid}/decision",
                    json={"action": "full_refund", "amount": 500.0, "override_threshold": True})
    assert r.status_code == 200


def test_execute_requires_capture_id():
    rid = _create()
    client.post(f"/api/refunds/{rid}/decision", json={"action": "full_refund", "amount": 50.0})
    r = client.post(f"/api/refunds/{rid}/execute")
    assert r.status_code == 422
    assert "capture" in r.json()["detail"]


def test_decision_rejected_is_terminal():
    rid = _create()
    client.post(f"/api/refunds/{rid}/decision", json={"action": "reject"})
    r = client.post(f"/api/refunds/{rid}/decision", json={"action": "full_refund", "amount": 50.0})
    assert r.status_code == 409


def test_invalid_status_filter_422():
    assert client.get("/api/refunds?status=bogus").status_code == 422
