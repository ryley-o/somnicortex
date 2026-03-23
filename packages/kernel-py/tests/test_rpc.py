import json
from pathlib import Path

from somnicortex_kernel.operations import KernelOperations
from somnicortex_kernel.rpc import handle_rpc


def test_health_method() -> None:
    fixture = (
        Path(__file__).resolve().parents[3]
        / "packages"
        / "ipc"
        / "fixtures"
        / "kernel-operations.json"
    )
    ops = KernelOperations(fixture)
    response = handle_rpc(
        json.dumps({"jsonrpc": "2.0", "id": "1", "method": "kernel.health", "params": {}}),
        ops,
    )
    assert response["result"]["version"] == "0.1.0"


def test_operation_method() -> None:
    fixture = (
        Path(__file__).resolve().parents[3]
        / "packages"
        / "ipc"
        / "fixtures"
        / "kernel-operations.json"
    )
    ops = KernelOperations(fixture)
    response = handle_rpc(
        json.dumps(
            {
                "jsonrpc": "2.0",
                "id": "1",
                "method": "kernel.operation",
                "params": {"operation": "rerank", "payload": {}},
            }
        ),
        ops,
    )
    assert response["result"]["ok"] is True
