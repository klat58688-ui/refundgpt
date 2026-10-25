# RefundGPT

AI-powered refund processing assistant for e-commerce merchants.
Paste a customer conversation → AI extracts facts, detects contradictions, matches refund policy → merchant confirms → PayPal executes the refund. Built for the **PayPal AI Hackathon 2026**.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript + Tailwind CSS + Zustand (Vite) |
| Backend | FastAPI (Python 3.10+), async |
| DB | SQLite (dev) / PostgreSQL (prod, swap `DATABASE_URL`) |
| AI | Any OpenAI-compatible LLM endpoint (GPT-4o / Claude proxy / 51kik gateway) |
| Payments | PayPal REST API v2 (Sandbox) |

## Structure

```
refundgpt/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app + CORS
│   │   ├── config.py             # env-based settings
│   │   ├── database.py           # SQLAlchemy session
│   │   ├── models.py             # RefundRequest / RefundPolicy / AuditLog
│   │   ├── schemas.py            # Pydantic models (AI output strictly validated)
│   │   ├── routers/refunds.py    # analyze / decide / execute / stats APIs
│   │   └── services/
│   │       ├── ai_engine.py      # prompt chain: system + 3 few-shot + CoT + JSON validation
│   │       └── paypal_client.py  # OAuth2, refund, status, exponential-backoff retry
│   ├── seed.py                   # 4 policies + 3 sample conversations
│   └── .env.example
└── frontend/
    └── src/
        ├── pages/Dashboard.tsx   # stats cards + request list + new-analysis input
        ├── pages/Analyze.tsx     # 3-panel: conversation | AI analysis | decision + confirm modal
        ├── api.ts / store.ts
```

## Quick Start

```bash
# 1. Backend (port 8001 — the frontend proxies /api here)
cd backend
python -m venv .venv && .venv/Scripts/activate    # Windows
pip install -r requirements.txt                   # pinned versions
cp .env.example .env   # fill in LLM_API_KEY + PayPal sandbox credentials
python seed.py
uvicorn app.main:app --reload --port 8001

# 2. Frontend
cd frontend
npm install
npm run dev            # http://localhost:5173

# 3. Tests (no network needed — LLM/PayPal are mocked)
cd backend && pytest tests/
```

## Configuration (backend/.env)

| Var | Required | Note |
|---|---|---|
| `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | yes | Any OpenAI-compatible endpoint |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | for execution | PayPal Developer → Sandbox app |
| `AUTO_REFUND_THRESHOLD` | no | Amounts above this need `override_threshold=true` (double-confirm in UI) |
| `API_KEY` | no | If set, all `/api/refunds*` endpoints require `X-API-Key` header |

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/refunds/analyze` | conversation → AI structured analysis (request is kept even if AI fails) |
| POST | `/api/refunds/{id}/reanalyze` | retry AI after a failure |
| GET | `/api/refunds?status=` | list / filter (422 on invalid status) |
| POST | `/api/refunds/{id}/decision` | merchant approve / partial / reject (amount validated) |
| POST | `/api/refunds/{id}/execute` | capture-verified, idempotent PayPal refund (retryable from `failed`) |
| GET | `/api/refunds/{id}/paypal-status` | live refund status |
| GET | `/api/stats` | dashboard metrics (SQL aggregates) |

## Safety design (what judges should notice)

- **Money safety**: partial refunds require an explicit positive amount ≤ original; the PayPal capture is verified (`status=COMPLETED`, amount ceiling) before any refund call.
- **Idempotency**: every refund carries `PayPal-Request-Id: refund-{id}`; an atomic `approved → executing` transition blocks double execution.
- **Threshold control**: amounts over `AUTO_REFUND_THRESHOLD` need explicit override.
- **Auditability**: every analyze/decision/execution is written to `audit_logs`.

## Known limitations (demo scope)

- PayPal **Sandbox** only; no production credentials.
- Single-user: no merchant accounts/login (optional shared `API_KEY` gate provided).
- SQLite for dev; switch `DATABASE_URL` to PostgreSQL for production.

## Deploy to Render (Blueprint)

One service, one database — free tier works:

1. Push this repo to GitHub.
2. Render Dashboard → **New → Blueprint** → select the repo (`render.yaml` is auto-detected).
3. Set the `sync: false` secrets in the Render dashboard: `LLM_API_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, (optional) `API_KEY`.
4. Render builds the multi-stage [Dockerfile](Dockerfile): frontend `npm run build` → FastAPI serves both `/api/*` and the SPA on one port. PostgreSQL is wired via `DATABASE_URL` (SQLite fallback locally).
5. Health check: `/api/health`.

Local production-mode check: `cd frontend && npm run build && cp -r dist ../backend/app/static` then `uvicorn app.main:app --port 8001` — SPA and API on the same port.

## AG Grid

`/requests` is an AG Grid (Community) view: PayPal-branded Quartz theme, floating filters, set-filter on status, quick search, multi-row selection, CSV export, row click → analysis panel.

## Tools used (per hackathon rules)

- **PayPal REST API v2** (Sandbox): OAuth2, Orders (test captures), Payments Refund, refund status lookup.
- **AI**: OpenAI-compatible LLM endpoint (tested with GPT-4o-class and kimi-k3 via a compatible gateway) — few-shot + chain-of-thought prompt chain, strict JSON validation with Pydantic.

## License

MIT — see [LICENSE](LICENSE).

## Submission materials

- [Devpost copy](docs/devpost-submission.md) — paste-ready submission text + tools table
- [Demo video script](docs/video-script.md) — shot list, voiceover, trim map
