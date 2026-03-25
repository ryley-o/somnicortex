# Somni (Personal Agent)

Somni is the personal-agent app built on the SomniCortex framework. It is designed for long-running local use, where the agent keeps a filesystem-backed memory, supports sleep cycles, and enforces explicit governance for identity changes.

What it does today:
- Runs a persistent local runtime daemon.
- Accepts tasks and writes cycle reports + episodic entries.
- Supports manual `MICRO_SLEEP` and `FULL_SLEEP` triggers.
- Supports governance proposals for identity changes with pending approvals.

Why it is different:
- Agent state is inspectable files and SQLite DBs in `apps/somni/.agent`.
- Memory is treated as lifecycle state (wake, sleep, consolidation), not just prompt stuffing.
- Identity changes can be gated by approval before being applied.

For technical internals, see `docs/architecture.md`.

## 10-Minute Setup

Run from repo root:

```bash
bash apps/somni/setup.sh
make start
```

Then, in a second terminal:

```bash
npx tsx packages/runtime-ts/src/cli/send-task.ts \
  --agent-dir apps/somni/.agent \
  --task "What is your name and what are you designed to do?" \
  --urgency normal
```

Check output:

```bash
cat apps/somni/.agent/audit/reports/cycle.log
```

## Common Commands

- `make create-agent`: recreate `apps/somni/.agent` from `birth_spec.yaml`
- `make start`: start persistent runtime daemon
- `make status`: show runtime status and current agent `sleep_state`
- `make stop`: stop runtime daemon
- `make propose-identity SCOPE=personality CHANGE='{"communication_style":"verbose"}'`: create governance approval request
- `make run`: start the MCP adapter (optional)

## Personalization

Edit `apps/somni/birth_spec.yaml`, then recreate the agent:

```bash
make create-agent
```

Available archetypes live in `apps/somni/archetypes/`:
- `base`
- `researcher`
- `executor`
- `reviewer`

See `docs/birth_spec.md` for field-by-field guidance.

## Governance Test Flow

Propose a personality change:

```bash
make propose-identity SCOPE=personality CHANGE='{"communication_style":"verbose"}'
```

Inspect and approve:

```bash
npx tsx packages/runtime-ts/src/cli/approve.ts --agent-dir apps/somni/.agent --list
npx tsx packages/runtime-ts/src/cli/approve.ts --agent-dir apps/somni/.agent --approve <approval_id>
```

Then verify:

```bash
make status
cat apps/somni/.agent/memory/values/identity_log.jsonl
```

## MCP Adapter (Optional)

Start:

```bash
make run
```

Exposed tools:
- `receive_task`
- `report`
- `get_sleep_state`
- `expose_capabilities`
- `recall`
