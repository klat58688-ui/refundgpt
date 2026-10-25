# Demo Video Script — RefundGPT (target 2:20, hard cap 3:00)

Format: 1600×900 screen recording, no music required (hackathon forbids unlicensed music). Recorded raw file: `refundgpt-demo.webm` (silent). Add voiceover + trimmed cut before uploading to YouTube.

## Cut list (what to trim from the raw recording)

| Segment in raw file | Action |
|---|---|
| First ~10s: dashboard loads, cursor idle | Keep 3s only |
| AI analysis wait (~55–65s, spinner) | **Cut** — hard cut to the analysis panel; mention "in production this is ~3 seconds" in voiceover |
| Decision + confirm + execute | Keep in full (the money moment) |
| AG Grid tour | Trim to ~20s |
| Dashboard stats finale | Keep 5s |

## Shot-by-shot

### 0:00–0:12 — The problem
**On screen:** Refund queue full of unresolved requests (dashboard, pending filter).
**Voiceover:** "Every small e-commerce team drowns in refund requests. Someone reads the message, checks the order, guesses whether the story adds up, checks the policy, then goes to PayPal and clicks refund. Twenty times a day. Inconsistently."

### 0:12–0:25 — The product
**On screen:** Paste a customer message into the box, click *Analyze Refund Request*.
**Voiceover:** "This is RefundGPT. Paste the conversation — or the text from a screenshot — and it does the reading, the policy check, and the PayPal work. You stay the decision-maker."

### 0:25–0:55 — Structured analysis
**On screen:** Three-panel analysis view: conversation | AI analysis (issue type, confidence, policy match, claims, evidence, reasoning) | decision panel.
**Voiceover:** "No wall of text. It extracts the order, the amount, the issue type, the claims, and the evidence offered. It matches your refund policy and gives a recommendation with a confidence score — plus the reasoning, so you can disagree with it."
**Zoom:** policy match card, reasoning paragraph.

### 0:55–1:15 — Contradiction detection (the differentiator)
**On screen:** Open the seeded "changed mind" case: claim "never used" while the photo shows an opened box. Red contradiction banner.
**Voiceover:** "This is the case that matters. The customer says never used — but their own photo shows an opened box. RefundGPT flags the contradiction and recommends rejecting under the opened-item policy. A human reviewer would need to notice that. The model does it every time."

### 1:15–1:50 — Decision → real PayPal refund
**On screen:** Approve Full Refund → confirm modal (order, amount, type) → *Execute via PayPal* → green receipt `Refunded ✓ PayPal refund: 8US06443KN305825J`.
**Voiceover:** "You approve — or change the amount, or reject. Before anything moves, RefundGPT verifies the PayPal capture and checks the amount against it. Then it refunds through the PayPal Refund API with an idempotency key, so a double click can never refund twice. This is a real sandbox refund, executed live."
**Zoom:** the refund ID.

### 1:50–2:10 — Operations view (AG Grid)
**On screen:** `/requests` grid: filter, quick search, CSV export, row click back into a case.
**Voiceover:** "Every case lands in an AG Grid operations view — sortable, filterable, exportable. And every analysis, approval and execution is in the audit log, because refunds are money and money needs receipts."

### 2:10–2:20 — Close
**On screen:** Dashboard stats: processed today, average handling time, total refunded.
**Voiceover:** "RefundGPT — the AI does the reading, the policy check and the PayPal call. You keep the judgment. Built with FastAPI, React, AG Grid and the PayPal REST API."

## On-screen captions (for silent viewing)

1. "Refund requests: read, check, decide, refund — 20× a day"
2. "Paste the conversation"
3. "Facts · policy · recommendation · confidence"
4. "It caught the contradiction: 'never used' vs opened box"
5. "Merchant approves — capture verified — PayPal refund"
6. "Real sandbox refund: 8US06443KN305825J"
7. "AG Grid operations view + audit log"
8. "RefundGPT — agentic commerce for refunds"

## Recording checklist

- [ ] Backend on 8001, frontend built or dev server on 5173; browser at 1600×900, 100% zoom
- [ ] Seed data present (`python seed.py`), including the contradiction case
- [ ] A fresh sandbox capture prepared for the refund demo (see README: Orders API with test card `5424180279791732`)
- [ ] Close notifications, hide bookmarks bar, mute system sounds
- [ ] Trim the AI wait; total runtime ≤ 3:00
- [ ] Upload to YouTube as **Public** (not unlisted) — judges must be able to open it
- [ ] Title: "RefundGPT — AI refund analyst for PayPal (Hackathon demo)"
