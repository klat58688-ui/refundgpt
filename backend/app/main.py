import logging
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import Base, engine
from .routers import refunds

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

Base.metadata.create_all(bind=engine)


def require_api_key(x_api_key: str = Header(default="")):
    """Optional shared-key protection; active only when API_KEY is configured."""
    if settings.api_key and x_api_key != settings.api_key:
        raise HTTPException(401, "invalid or missing X-API-Key")


app = FastAPI(title="RefundGPT", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(refunds.router, dependencies=[Depends(require_api_key)])


@app.get("/api/health")
def health():
    return {"status": "ok", "llm_configured": bool(settings.llm_api_key),
            "paypal_configured": bool(settings.paypal_client_id),
            "auth_enabled": bool(settings.api_key)}


# In production (Docker/Render) the built frontend is served by this same app.
# In dev, Vite on :5173 handles the frontend and this mount simply doesn't exist.
_dist = Path(__file__).resolve().parent / "static"  # backend/app/static (Docker: /app/app/static)
if _dist.is_dir():
    app.mount("/assets", StaticFiles(directory=_dist / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        """SPA fallback — client-side routes (/dashboard, /requests, ...) get index.html."""
        file = _dist / full_path
        return FileResponse(file if full_path and file.is_file() else _dist / "index.html")
