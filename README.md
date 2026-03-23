# SomniCortex

SomniCortex monorepo with:

- `packages/runtime-ts`: TypeScript coordination runtime.
- `packages/ipc`: canonical cross-process contract package (TS + JSON Schema + fixtures).
- `packages/kernel-py`: Python memory kernel daemon.

## Quick start

```bash
pnpm install
pnpm --filter @somnicortex/ipc build
pnpm --filter @somnicortex/runtime build
uv sync --project packages/kernel-py
```
