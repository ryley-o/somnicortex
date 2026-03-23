#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$ROOT_DIR"
pnpm install
pnpm --filter @somnicortex/ipc build
pnpm --filter @somnicortex/ipc run generate:python
pnpm --filter @somnicortex/runtime build
uv sync --project packages/kernel-py --extra dev

echo "SomniCortex runtime + kernel setup complete."
