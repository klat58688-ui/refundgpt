"""PayPal Refund API client (Sandbox). OAuth2 + execute refund + status query + retry."""
import asyncio
import logging
import time
from typing import Optional

import httpx

from ..config import settings

log = logging.getLogger(__name__)


class PayPalError(Exception):
    def __init__(self, message: str, status_code: Optional[int] = None, detail: Optional[dict] = None):
        super().__init__(message)
        self.status_code = status_code
        self.detail = detail or {}


class PayPalRefundClient:
    def __init__(self):
        self.base = settings.paypal_base_url.rstrip("/")
        self.client_id = settings.paypal_client_id
        self.client_secret = settings.paypal_client_secret
        self._token: Optional[str] = None
        self._token_expiry: float = 0.0

    def _ensure_config(self):
        if not self.client_id or not self.client_secret:
            raise PayPalError("PayPal credentials not configured — set PAYPAL_CLIENT_ID/SECRET in .env")

    async def _get_token(self, client: httpx.AsyncClient) -> str:
        self._ensure_config()
        if self._token and time.time() < self._token_expiry - 60:
            return self._token
        resp = await client.post(
            f"{self.base}/v1/oauth2/token",
            data={"grant_type": "client_credentials"},
            auth=(self.client_id, self.client_secret),
            headers={"Accept": "application/json"},
        )
        if resp.status_code != 200:
            raise PayPalError("PayPal auth failed", resp.status_code, resp.json())
        body = resp.json()
        self._token = body["access_token"]
        self._token_expiry = time.time() + body.get("expires_in", 3000)
        return self._token

    async def _request(self, method: str, path: str, headers_extra: Optional[dict] = None, **kwargs) -> dict:
        """Authenticated request with exponential-backoff retry on 429/5xx."""
        delay = 1.0
        async with httpx.AsyncClient(timeout=30) as client:
            token = await self._get_token(client)
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            headers.update(headers_extra or {})
            for attempt in range(4):
                resp = await client.request(method, f"{self.base}{path}", headers=headers, **kwargs)
                if resp.status_code in (429, 500, 502, 503) and attempt < 3:
                    log.warning("PayPal %s %s -> %d, retry in %.1fs", method, path, resp.status_code, delay)
                    await asyncio.sleep(delay)
                    delay *= 2
                    continue
                if resp.status_code >= 400:
                    raise PayPalError(f"PayPal {method} {path} failed: {resp.text[:300]}",
                                      resp.status_code, resp.json() if resp.text else {})
                return resp.json() if resp.text else {}
        raise PayPalError("PayPal request failed after retries")

    async def execute_refund(self, capture_id: str, amount: Optional[float] = None,
                             currency: str = "USD", note: str = "",
                             idempotency_key: Optional[str] = None) -> dict:
        """Refund a captured payment. amount=None -> full refund.
        Idempotent when idempotency_key is provided (PayPal-Request-Id)."""
        body: dict = {}
        if amount is not None:
            body["amount"] = {"value": f"{amount:.2f}", "currency_code": currency}
        if note:
            body["note_to_payer"] = note[:255]
        headers = {"PayPal-Request-Id": idempotency_key} if idempotency_key else {}
        result = await self._request("POST", f"/v2/payments/captures/{capture_id}/refund",
                                     json=body, headers_extra=headers)
        log.info("PayPal refund executed: id=%s status=%s", result.get("id"), result.get("status"))
        return result

    async def get_refund_status(self, refund_id: str) -> dict:
        return await self._request("GET", f"/v2/payments/refunds/{refund_id}")

    async def get_capture(self, capture_id: str) -> dict:
        return await self._request("GET", f"/v2/payments/captures/{capture_id}")


paypal_client = PayPalRefundClient()
