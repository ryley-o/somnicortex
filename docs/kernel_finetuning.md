# Kernel Bootstrap and Fine-Tuning

This document describes what is implemented today and what is planned for kernel fine-tuning.

## Current State

Implemented:
- `somnicortex-bootstrap-kernel` CLI exists (`packages/runtime-ts/src/cli/bootstrap-kernel.ts`)
- it boots agent runtime/kernel connectivity and prints capability metadata

Not implemented yet:
- synthetic training data generation pipeline
- quality-gate scoring for generated examples
- training/fine-tune execution loop
- automatic model promotion/rollback

These are **planned — not yet implemented**.

## What `bootstrap-kernel` Does Today

Command:

```bash
npx tsx packages/runtime-ts/src/cli/bootstrap-kernel.ts apps/somni/.agent
```

Behavior:
- creates/opens the agent
- starts kernel via configured command
- checks `kernel.health`
- prints `bootstrapped`, `kernelVersion`, and supported operations

This is a connectivity/bootstrap validation step, not a trainer.

## Practical Use Right Now

Use it when:
- validating deployment health
- confirming kernel process startup and RPC boundary
- confirming operation surface exposed by the kernel

Do not use it expecting:
- data generation
- model adaptation
- checkpoint management

## Planned Fine-Tuning Flow (Roadmap)

Planned high-level sequence:
1. generate synthetic task/memory examples
2. run quality gates and filter low-confidence data
3. train candidate kernel model
4. evaluate regression suite
5. promote or reject candidate

This section is roadmap-only and intentionally not documented as available behavior yet.

## When to Trigger (Current Guidance)

Since fine-tuning is not yet implemented, trigger points are currently operational checks only:
- after environment setup
- after runtime/kernel dependency upgrades
- before releasing deployment changes affecting kernel startup
