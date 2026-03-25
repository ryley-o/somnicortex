# Birth Spec Guide

`apps/somni/birth_spec.yaml` defines who your agent is at creation time.

At `make create-agent`, the runtime merges:
1. `apps/somni/archetypes/base.yaml`
2. selected archetype file (`archetype: ...`)
3. your `birth_spec.yaml` overrides

The merged result is written to:
- `apps/somni/.agent/birth_spec_snapshot.json`

## Fields

## `archetype` (string)

Selects the archetype profile used as base behavior.

Example:

```yaml
archetype: "researcher"
```

## `identity` (object)

Human-readable identity metadata for the agent.

Common keys in this repo:
- `name`
- `role`
- `mission`

Example:

```yaml
identity:
  name: "Somni"
  role: "personal_memory_agent"
  mission: "Track context and execute tasks with stable long-term memory."
```

## `constitution` (object)

Hard behavioral principles. In current templates this is expressed as `principles: []`.

Example:

```yaml
constitution:
  principles:
    - "Never fabricate citations."
    - "Escalate risky identity changes for explicit approval."
```

## `personality` (object)

Preference and style knobs used by the current app configuration.

Current examples:
- `skepticism` (number)
- `verbosity` (string)
- `tool_preference` (string)

Example:

```yaml
personality:
  skepticism: 0.6
  verbosity: "medium"
  tool_preference: "balanced"
```

## `authority_tier` (string)

Authority tier label from archetypes (for example `A1`, `A2`).

## `cognitive_priors` (object)

Optional structured prior assumptions; supported by merge logic and stored in snapshot.

## `initial_semantic_beliefs` (array)

Optional initial semantic entries. Currently stored in snapshot; full automatic ingestion into semantic DB is planned.

## `initial_skills` (array)

Optional initial skill definitions. Currently stored in snapshot; full automatic procedural ingestion is planned.

## Archetypes in This Repo

Four archetypes are available in `apps/somni/archetypes/`.

## `base`

- role: generalist
- skepticism: medium (`0.5`)
- verbosity: medium
- use when you want neutral defaults

## `researcher`

- role: researcher
- skepticism: high (`0.85`)
- verbosity: high
- use for analysis, evidence gathering, and careful synthesis

## `executor`

- role: executor
- skepticism: lower (`0.3`)
- verbosity: low
- use for action-oriented, concise task completion

## `reviewer`

- role: reviewer
- skepticism: very high (`0.9`)
- verbosity: high
- use for critique, quality gates, and inconsistency detection

## Choosing an Archetype

- choose `base` if you are unsure and want a stable starting point
- choose `researcher` for knowledge work and cautious conclusions
- choose `executor` for operational workflows and shorter responses
- choose `reviewer` when you mainly want risk/quality scrutiny

## Practical Workflow

1. Edit `apps/somni/birth_spec.yaml`
2. Rebuild agent:

```bash
make create-agent
```

3. Inspect merged snapshot:

```bash
cat apps/somni/.agent/birth_spec_snapshot.json
```
