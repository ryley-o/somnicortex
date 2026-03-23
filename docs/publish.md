# Publish Flow

SomniCortex publishes two independent artifacts:

1. npm package from `packages/runtime-ts` (`@somnicortex/runtime`).
2. PyPI package from `packages/kernel-py` (`somnicortex-kernel`).

## npm publish

```bash
pnpm --filter @somnicortex/ipc build
pnpm --filter @somnicortex/runtime build
cd packages/runtime-ts
npm publish --access public
```

## PyPI publish

```bash
uv build --project packages/kernel-py
uv publish --project packages/kernel-py
```

## Validation before publish

- `pnpm build`
- `pnpm test`
- `uv run --project packages/kernel-py pytest -q`
