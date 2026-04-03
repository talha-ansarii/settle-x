from typing import Any

from pydantic import BaseModel


class CreateProviderOrderRequest(BaseModel):
    amount_paise: int
    provider: str = "DEMO_PAY"
    idempotency_key: str | None = None
    metadata: dict[str, Any] | None = None


class ProviderWebhookRequest(BaseModel):
    provider: str = "DEMO_PAY"
    event_type: str
    event_id: str | None = None
    provider_order_id: str
    provider_payment_id: str | None = None
    status: str
    amount_paise: int
    payload: dict[str, Any] | None = None

