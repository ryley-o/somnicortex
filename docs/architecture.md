# SomniCortex Architecture

This document explains the current architecture in this repository, without requiring the PRD.

## Design Intent

SomniCortex is a single-agent framework inspired by biological metaphors:
- wake cycles for active reasoning and task execution
- sleep cycles for deferred maintenance/consolidation work
- durable identity with explicit governance

The practical implementation is local-first and file-based: an agent lives in a directory tree with SQLite memory stores, logs, and queue files.

## Runtime + Kernel Split

The system is split into two cooperating runtimes:

- `packages/runtime-ts` (TypeScript runtime coordinator)
  - owns task intake, policy checks, sleep transitions, identity governance, and local persistence
- `packages/kernel-py` (Python Memory Kernel RPC process)
  - serves memory-oriented operations over JSON-RPC

Communication happens through a kernel address (`tcp` in `apps/somni` by default; unix socket is also supported).

## Biological Inspiration Mapped to Code

### Wake rhythm (four-beat loop)

Current wake processing (`runFourBeatCycle`) follows:
1. focus (`task.title` + `task.body`)
2. cue generation via kernel op (`generate_retrieval_query`)
3. recall/rerank
4. act with tool policy gate + report write

Outputs are written to:
- `audit/reports/cycle.log`
- `memory/working/scratch.json`
- `memory/episodic/ledger.db` (task record)

### Sleep FSM

Sleep states are tracked in `sleep/state.json` and mirrored into `agent.yaml` `sleep_state`.

States currently used:
- `WAKE`
- `MICRO_SLEEP`
- `FULL_SLEEP`
- `SUPERVISED_PAUSE`

Implemented behaviors:
- `MICRO_SLEEP`: queue processing + working-memory reset
- `FULL_SLEEP`: staged queue jobs + dream generation + identity snapshot compaction
- `SUPERVISED_PAUSE`: entered for approval-required governance actions

## Three-Tier Memory (Current)

The repo currently persists memory in:

- `memory/working/`
  - volatile scratch artifacts for current cycle
- `memory/episodic/ledger.db`
  - event/task content log with salience metadata
- `memory/semantic/graph.db`
  - schema exists and migrations run; semantic graph workflows are still minimal
- `memory/procedural/skills.db` and `memory/procedural/policies.db`
  - schema exists; advanced compilation/policy evolution is limited
- `memory/values/identity_log.jsonl` + `snapshot_hash`
  - hash-chained identity history + current digest

Note: the conceptual "three-tier" framing is working/episodic/semantic. Procedural and values stores are additional durable systems.

## Identity Governance

Identity changes are append-only log events with hash chaining.

Current behavior:
- `personality` changes can require explicit approval flow
- governance proposal writes a pending approval file in `audit/pending_approvals/`
- approval action can apply change and return state to `WAKE`

Human-only scopes and strict governance checks are enforced in identity logic.

## Agent Directory as System Boundary

Every agent is inspectable on disk (example: `apps/somni/.agent`):
- runtime control (`runtime/`)
- memory (`memory/`)
- sleep state and queue (`sleep/`)
- audit and approvals (`audit/`)
- tool policies and MCP server config (`tools/`)
- skills metadata (`skills/`)

This directory is the operational unit for backup, migration, debugging, and audits.

## What Is Planned (Not Yet Implemented)

Planned but partial/incomplete today:
- real model-backed Memory Kernel operations (current default path uses fixtures/mocks)
- production-grade semantic/procedural consolidation pipelines
- full PRD-level policy enforcement features (for example richer rate-limit enforcement)
- kernel fine-tuning pipeline beyond bootstrap connectivity checks
