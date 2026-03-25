# SomniCortex

SomniCortex is a local-first agent framework for durable memory and explicit identity governance.

Instead of treating memory as a thin retrieval layer, SomniCortex organizes memory as a lifecycle with wake execution, sleep maintenance, and inspectable on-disk state.

## What This Repo Contains

- `packages/runtime-ts`: TypeScript runtime coordinator and CLI tools
- `packages/kernel-py`: Python Memory Kernel RPC service
- `packages/ipc`: shared contracts/schemas/fixtures across runtime and kernel
- `apps/somni`: personal-agent app built on the framework

## How It Differs from Typical RAG/Memory Stacks

Compared with RAG-first memory patterns:
- state is durable files/SQLite stores, not only transient retrieval context
- explicit sleep operations are part of the model (micro/full sleep jobs)
- identity changes can flow through governance approvals

Compared with systems focused mainly on memory APIs (for example Mem0/MemOS-style usage):
- this repo includes a full runtime + kernel split with a persistent agent directory
- policy and approval artifacts are first-class filesystem primitives
- operational flow is designed around long-lived local agents, not just memory middleware calls

## Quickstart Paths

- Personal agent in ~10 minutes: `apps/somni/README.md`
- Technical architecture: `docs/architecture.md`
- Birth spec and archetypes: `docs/birth_spec.md`
- Ubuntu deployment: `docs/deployment.md`
- Kernel bootstrap/fine-tuning status: `docs/kernel_finetuning.md`

## Build and Test

```bash
pnpm install
pnpm build
pnpm test
```

Kernel tests:

```bash
pnpm kernel:test
```
