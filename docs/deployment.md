# Deployment

## Prerequisites

- Node.js 22+
- pnpm 10+
- Python 3.11+
- [uv](https://docs.astral.sh/uv/)

## Setup

```bash
./setup.sh
```

## Local run

1. Build IPC + runtime:
   - `pnpm --filter @somnicortex/ipc build`
   - `pnpm --filter @somnicortex/runtime build`
2. Start with CLI:
   - `node packages/runtime-ts/dist/src/cli/create-agent.js .somnicortex-agent`
3. Send a task:
   - `node packages/runtime-ts/dist/src/cli/send-task.js .somnicortex-agent "Task" "Do X"`

## Scope note

`apps/somni` is intentionally a follow-on phase in this repository and is not part of this framework build.
