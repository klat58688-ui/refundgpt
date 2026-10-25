# Devpost Submission Copy — RefundGPT

Ready to paste into the PayPal AI Hackathon 2026 submission form.

- **Project name:** RefundGPT
- **Tagline:** AI refund analyst for e-commerce merchants — reads the conversation, detects contradictions, matches your policy, and refunds through PayPal.
- **Repo:** https://github.com/klat58688-ui/refundgpt
- **Demo video:** (upload `refundgpt-demo.webm` to YouTube, paste link here)
- **Live demo:** local-first (see README Quick Start). Hosted URL optional.
- **Built with:** FastAPI, React 18 + TypeScript, Tailwind CSS, AG Grid Community, SQLite/PostgreSQL, OpenAI-compatible LLM, PayPal REST API v2 (Sandbox), Docker, Render Blueprint

---

## Inspiration

Refund requests are the most emotional, most manual work in e-commerce support. A merchant reads a messy message, hunts for the order, guesses whether the story adds up, checks policy, then clicks through PayPal. Small teams do this dozens of times a day — slow for the buyer, expensive for the seller, and inconsistent, because two agents read the same message differently.

We wanted the boring part automated and the judgment part *auditable*: let AI read the conversation and argue its case, let the merchant approve, let PayPal move the money.

## What it does

Paste a customer conversation (or the text extracted from a screenshot). RefundGPT:

1. **Extracts the facts** — order ID, amount, issue type, customer claims, evidence mentioned.
2. **Hunts contradictions** — e.g. "never used" while the attached photo shows an opened box. Contradictions are surfaced in red, not buried.
3. **Matches your refund policy** — a rule table (defect / not received / changed mind / partial damage) decides eligibility and percentage.
4. **Recommends an action** — full refund, partial refund, or reject, with a confidence score and written reasoning.
5. **Executes through PayPal** — the merchant approves, then the app verifies the capture with PayPal and issues a real (sandbox) refund.
6. **Keeps the receipts** — every analysis, decision and execution is written to an audit log; an AG Grid dashboard tracks the queue and totals.

Money-safety is part of the product: partial refunds require an explicit amount, amounts above a configurable threshold need a second confirmation, executions are idempotent (`PayPal-Request-Id`), and a `failed` refund can be retried instead of silently disappearing.

## How we built it

- **Backend:** FastAPI, async, SQLAlchemy models for `RefundRequest` / `RefundPolicy` / `AuditLog`. The refund API is a strict state machine (`pending → analyzed → approved → executing → executed`, with `rejected` / `failed` branches) and uses an atomic `approved → executing` transition so two clicks can never refund twice.
- **AI layer:** a prompt chain — system prompt, three few-shot cases (defect / contradiction / non-receipt), chain-of-thought instruction, and hard JSON validation with Pydantic. If the model returns garbage, the request is not lost: it stays `pending` with the error attached and can be re-analyzed.
- **PayPal integration:** OAuth2 client with token caching, exponential-backoff retries on 429/5xx, `GET /v2/payments/captures/{id}` verification before refunding, `POST /v2/payments/captures/{id}/refund` with an idempotency key, and refund status lookups. Test captures were created through the Orders API with sandbox test cards, so the demo moves real (sandbox) money end to end.
- **Frontend:** React + TypeScript + Tailwind, three-panel analysis view (conversation / AI analysis with contradiction highlighting / decision + confirmation modal), Zustand for state, AG Grid for the operations table (sortable, filterable, quick search, CSV export, row click into the case).
- **Deployment:** multi-stage Dockerfile builds the SPA and lets FastAPI serve both `/api/*` and the static frontend on one port; `render.yaml` Blueprint provisions the service plus PostgreSQL.

## Challenges we ran into

- **Provider quirks:** our LLM gateway's `kimi-k3` only accepts `temperature=1.0` and is a reasoning model, so the JSON sometimes arrived with reasoning tokens eating the budget. Fix: strip code fences, validate strictly, and retry once on transient gateway errors.
- **Set Filter is Enterprise:** our first AG Grid build logged `error #200` because `agSetColumnFilter` is not in the Community edition. Switched to a text filter — a small reminder that "free" features are not always the ones in the docs' examples.
- **Money without drama:** the naive version silently upgraded an empty partial-refund amount to a full refund. Fixing it properly meant validating on both ends, capping at the original amount *and* the capture amount, and making the threshold override explicit.
- **Free hosting is not free:** Render and Hugging Face both now require payment or a PRO plan for this kind of service, so the shipped demo runs locally with a one-command Docker path and a scripted setup — the repo is the demo.

## Accomplishments that we're proud of

- A complete, working loop: pasted text → strict structured analysis → merchant decision → **real PayPal sandbox refund** (`8US06443KN305825J`, `5KF48496AF9891917`) → status read-back.
- Contradiction detection that actually changes the outcome: the "never used" blender case returns `reject` with the photo inconsistency cited.
- Money-safety rails that most hackathon demos skip: idempotency, atomic state transition, capture verification, threshold override, audit log.
- A demo that fits in under three minutes because the AI answer is structured, not a wall of text.

## What we learned

- Refund decisions are a policy problem before they are an AI problem; the model's job is evidence extraction and argument, not final authority.
- The hard part of agentic commerce is not the model call — it's the guarantees around it: retries, idempotency, and knowing when a human must confirm.
- Prompt design is data design. Once the schema was strict, everything downstream (UI, audit, validation) got simpler.

## What's next for RefundGPT

- **Inbox integrations** — Zendesk, Gorgias, Shopify, email: pull conversations instead of pasting them.
- **Learning loop** — use merchant overrides as feedback to tune the policy table and confidence calibration.
- **More payment rails** — a payments abstraction (Stripe, Adyen) behind the same state machine.
- **Photo evidence analysis** — vision model on the attached images to verify claims directly, not just the text.
- **Multi-seat review** — approvals routed by amount, with role-based permissions and a weekly savings report.

## Built With

`fastapi` · `python` · `sqlalchemy` · `pydantic` · `react` · `typescript` · `tailwindcss` · `zustand` · `ag-grid` · `vite` · `sqlite` · `postgresql` · `docker` · `paypal-rest-api` · `openai-compatible-llm` · `render`

## Tools used (hackathon requirement)

| Tool | How it is used |
|---|---|
| **PayPal REST API v2 (Sandbox)** | OAuth2 auth; Orders API to create/capture test payments; Payments Refund API to refund a capture with `PayPal-Request-Id` idempotency; capture + refund status lookups. |
| **AI LLM (OpenAI-compatible)** | Prompt chain (system + 3 few-shot + CoT) turning a refund conversation into a validated JSON analysis: facts, contradictions, policy match, recommendation, confidence. |
| **AG Grid (Community)** | Requests operations table: PayPal-branded theme, floating filters, quick search, pagination, CSV export, row click into the analysis flow. |
| **Render (Blueprint)** | `render.yaml` defines the Docker web service + managed PostgreSQL, with secrets injected as env vars. Configured and ready to deploy. |
| **Docker** | Multi-stage build: Vite SPA compiled, then served by FastAPI on one port. |

## Try it (judges)

```bash
git clone https://github.com/klat58688-ui/refundgpt && cd refundgpt
cp backend/.env.example backend/.env   # add LLM key + PayPal sandbox credentials
cd backend && pip install -r requirements.txt && python seed.py
uvicorn app.main:app --port 8001
cd ../frontend && npm install && npm run dev   # http://localhost:5173
```

Seed data includes the contradiction case, so the AI's value is visible in one click.
