#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$APP_DIR/../.." && pwd)"
AGENT_DIR="$(cd "$APP_DIR" && pwd)/.agent"
OLLAMA_MODEL="${OLLAMA_MODEL:-mxbai-embed-large}"

cd "$REPO_ROOT"
pnpm install
pnpm --filter @somnicortex/ipc build
pnpm --filter @somnicortex/ipc run generate:python
pnpm --filter @somnicortex/runtime build

if command -v ollama >/dev/null 2>&1; then
  echo "Pulling Ollama model: ${OLLAMA_MODEL}"
  ollama pull "${OLLAMA_MODEL}"
else
  echo "ollama not found; skipping model pull (set up Ollama separately)"
fi

node "apps/somni/scripts/create-default-agent.mjs" --agent-dir "$AGENT_DIR"
echo "Somni setup complete."
