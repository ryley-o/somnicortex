from pathlib import Path

from somnicortex_kernel.models import OperationRequest
from somnicortex_kernel.operations import KernelOperations


def test_happy_fixture_lookup() -> None:
    fixture = (
        Path(__file__).resolve().parents[3]
        / "packages"
        / "ipc"
        / "fixtures"
        / "kernel-operations.json"
    )
    ops = KernelOperations(fixture)
    response = ops.execute(OperationRequest(operation="score_salience", payload={}))
    assert response.ok is True
    assert "salience" in response.result


def test_edge_fixture_lookup() -> None:
    fixture = (
        Path(__file__).resolve().parents[3]
        / "packages"
        / "ipc"
        / "fixtures"
        / "kernel-operations.json"
    )
    ops = KernelOperations(fixture)
    response = ops.execute(
        OperationRequest(operation="check_neighborhood_consistency", payload={}, fixture="pending_review")
    )
    assert response.ok is True
    assert response.result["action"] == "flag_pending"
