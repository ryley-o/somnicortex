from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from .models import OperationRequest, OperationResponse
from .providers import KernelFixtureProvider, KernelLocalProvider


SUPPORTED_OPERATIONS = (
    "classify_store",
    "score_salience",
    "detect_conflict",
    "check_neighborhood_consistency",
    "deduplicate",
    "extract_atomic_facts",
    "link_intention_to_memories",
    "generate_retrieval_query",
    "rerank",
    "reject_low_confidence",
    "consolidate_cluster",
    "update_activation_weights",
    "update_citation_rates",
    "generate_simulation_seeds",
    "score_promotion",
    "resolve_conflict",
)


class KernelOperations:
    def __init__(self, fixture_file: Path) -> None:
        mode = os.environ.get("SOMNICORTEX_KERNEL_MODE", "mock")
        if mode == "local":
            self.provider = KernelLocalProvider()
        else:
            self.provider = KernelFixtureProvider(fixture_file=fixture_file)

    def execute(self, request: OperationRequest) -> OperationResponse:
        if request.operation not in SUPPORTED_OPERATIONS:
            return OperationResponse(
                operation=request.operation,
                ok=False,
                result={},
                error={"code": "E_UNKNOWN_OPERATION", "message": "Unsupported operation"},
            )
        result: dict[str, Any] = self.provider.get(request.operation, request.fixture)
        return OperationResponse(operation=request.operation, ok=True, result=result)
