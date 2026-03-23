from __future__ import annotations

import argparse
import json
import os
import socket
import sys
from pathlib import Path
from typing import Any

from .models import OperationRequest
from .operations import KernelOperations, SUPPORTED_OPERATIONS


def handle_rpc(raw: str, operations: KernelOperations) -> dict[str, Any]:
    payload = json.loads(raw)
    rpc_id = payload.get("id")
    method = payload.get("method")
    params = payload.get("params", {})

    if method == "kernel.health":
        return {
            "jsonrpc": "2.0",
            "id": rpc_id,
            "result": {
                "version": "0.1.0",
                "fineTuned": False,
                "supportedOperations": list(SUPPORTED_OPERATIONS),
            },
        }

    if method == "kernel.operation":
        req = OperationRequest.model_validate(params)
        result = operations.execute(req)
        return {"jsonrpc": "2.0", "id": rpc_id, "result": result.model_dump()}

    return {
        "jsonrpc": "2.0",
        "id": rpc_id,
        "error": {"code": -32601, "message": f"Method not found: {method}"},
    }


def _accept_loop(server: socket.socket, operations: KernelOperations) -> None:
    while True:
        conn, _ = server.accept()
        with conn:
            data = b""
            while True:
                chunk = conn.recv(4096)
                if not chunk:
                    break
                data += chunk
                if b"\n" in data:
                    break
            if not data:
                continue
            try:
                request_line = data.decode("utf-8").strip()
                response = handle_rpc(request_line, operations)
            except Exception as exc:  # pragma: no cover - defensive.
                response = {
                    "jsonrpc": "2.0",
                    "id": None,
                    "error": {"code": -32000, "message": str(exc)},
                }
            conn.sendall((json.dumps(response) + "\n").encode("utf-8"))


def serve(socket_path: Path, fixture_file: Path) -> None:
    socket_path.parent.mkdir(parents=True, exist_ok=True)
    if socket_path.exists():
        socket_path.unlink()

    operations = KernelOperations(fixture_file=fixture_file)
    server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    server.bind(str(socket_path))
    server.listen(20)
    print(f"kernel: listening on unix:{socket_path}", file=sys.stderr, flush=True)
    try:
        _accept_loop(server, operations)
    finally:
        server.close()
        if socket_path.exists():
            socket_path.unlink()


def serve_tcp(port: int, fixture_file: Path) -> None:
    operations = KernelOperations(fixture_file=fixture_file)
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(("127.0.0.1", port))
    server.listen(20)
    actual_port = server.getsockname()[1]
    print(f"kernel: listening on tcp:127.0.0.1:{actual_port}", file=sys.stderr, flush=True)
    try:
        _accept_loop(server, operations)
    finally:
        server.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--socket-path",
        default=os.environ.get(
            "SOMNICORTEX_KERNEL_SOCKET",
            ".somnicortex-agent/memory/kernel/kernel.sock",
        ),
    )
    parser.add_argument(
        "--fixture-file",
        default=os.environ.get(
            "SOMNICORTEX_FIXTURE_FILE",
            "packages/ipc/fixtures/kernel-operations.json",
        ),
    )
    parser.add_argument("--tcp-port", type=int, default=None)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.tcp_port is not None:
        serve_tcp(args.tcp_port, Path(args.fixture_file))
    else:
        serve(Path(args.socket_path), Path(args.fixture_file))


if __name__ == "__main__":
    main()
