"""Seed refund policies + sample requests. Run: python seed.py"""
from app.database import Base, SessionLocal, engine
from app.models import RefundPolicy, RefundRequest, RefundStatus

Base.metadata.create_all(bind=engine)
db = SessionLocal()

if not db.query(RefundPolicy).count():
    db.add_all([
        RefundPolicy(name="Product Defect", issue_type="product_defect",
                     conditions="Full refund within 30 days with photo/video evidence",
                     refund_percentage=100),
        RefundPolicy(name="Not Received", issue_type="not_received",
                     conditions="Full refund after carrier confirms loss",
                     refund_percentage=100),
        RefundPolicy(name="Changed Mind (sealed)", issue_type="changed_mind",
                     conditions="100% only if unopened and within 14 days; opened = no refund",
                     refund_percentage=100),
        RefundPolicy(name="Partial Damage", issue_type="partial_damage",
                     conditions="Partial refund 20-50% depending on severity",
                     refund_percentage=30),
    ])

if not db.query(RefundRequest).count():
    db.add_all([
        RefundRequest(order_id="PP-12345", amount=79.99, customer_name="Alice Chen",
                      customer_email="alice@example.com",
                      raw_conversation="Headphones arrived last week, left ear has no sound. "
                                       "Order PP-12345, $79.99. Packaging intact, product defective. I have photos.",
                      status=RefundStatus.pending),
        RefundRequest(order_id="PP-22210", amount=45.00, customer_name="Bob Li",
                      raw_conversation="Want to return blender PP-22210 $45.00, never used — "
                                       "photo shows it unboxed on my counter. Changed my mind.",
                      status=RefundStatus.pending),
        RefundRequest(order_id="PP-30007", amount=120.50, customer_name="Carol Wang",
                      raw_conversation="Package never arrived. PP-30007 $120.50 shipped 3 weeks ago. "
                                       "Tracking says delivered but I got nothing.",
                      status=RefundStatus.pending),
    ])

db.commit()
print(f"seeded: {db.query(RefundPolicy).count()} policies, {db.query(RefundRequest).count()} requests")
