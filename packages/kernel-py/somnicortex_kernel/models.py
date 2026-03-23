from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

try:
    # Canonical path: generated from packages/ipc/schemas via datamodel-code-generator.
    from .generated.operationrequest import OperationRequest  # type: ignore
except Exception:
    class OperationRequest(BaseModel):
        operation: str
        payload: dict[str, Any] = Field(default_factory=dict)
        fixture: str | None = None

try:
    # Canonical path: generated from packages/ipc/schemas via datamodel-code-generator.
    from .generated.operationresponse import OperationResponse  # type: ignore
except Exception:
    class OperationResponse(BaseModel):
        operation: str
        ok: bool
        result: dict[str, Any] = Field(default_factory=dict)
        error: dict[str, Any] | None = None
        protocolVersion: str = "1.0.0"
