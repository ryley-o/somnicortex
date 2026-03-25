# Somni App

User-facing app shell for running a SomniCortex agent with an MCP adapter.

## Quickstart

1. Run setup:

```bash
bash apps/somni/setup.sh
```

2. Edit `apps/somni/birth_spec.yaml` to customize identity/personality.

3. Recreate the default agent after edits:

```bash
make create-agent
```

4. Start MCP server:

```bash
make run
```

## Claude Desktop MCP config

Add a server entry that runs:

```bash
pnpm --filter somni-app run run:mcp
```

Exposed tools:

- `receive_task`
- `report`
- `get_sleep_state`
- `expose_capabilities`
- `recall`
