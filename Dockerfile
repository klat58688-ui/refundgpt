# Multi-stage: build frontend, then run FastAPI serving both API and static SPA.

# ---- Stage 1: frontend build ----
FROM node:22-alpine AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: runtime ----
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt psycopg2-binary

COPY backend/ ./
COPY --from=frontend /fe/dist ./app/static

# DATABASE_URL/LLM_*/PAYPAL_* come from Render env vars
EXPOSE 8000
CMD ["sh", "-c", "python seed.py && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
