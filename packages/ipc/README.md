# @somnicortex/ipc

Canonical cross-process contract package.

- Defines Zod schemas and TypeScript types.
- Emits JSON Schemas in `schemas/`.
- Generates Python Pydantic models for `packages/kernel-py` via `datamodel-code-generator`.
- Ships deterministic fixture set in `fixtures/` consumed by TS and Python mock providers.
