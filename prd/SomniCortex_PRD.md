# SomniCortex — Product Requirements Document

**Version:** 1.0  
**Status:** Ready for implementation  
**Deliverable:** Open-source Python codebase, MIT licensed, suitable for public GitHub repository  
**Target implementer:** AI coding agent or engineering team  

---

## Table of Contents

1. Project overview and goals
2. Repository structure and open-source setup
3. Core design principles
4. Agent instantiation and personality ("birth")
5. Human interaction patterns
6. Memory substrate
7. Memory Kernel (local SLM)
8. Activation dynamics
9. Sleep engine and FSM
10. Structured context packet and wake rhythm
11. Values and identity store
12. Default Mode Simulator
13. Tool policy enforcement
14. External API
15. Approval transport
16. Database configuration
17. Kernel bootstrap and cold start
18. Citation tracking and Kernel feedback loop
19. Identity log compaction
20. Directory layout
21. Schema definitions
22. Technology stack
23. Build order
24. Testing requirements
25. Out of scope

---

## 1. Project overview and goals

SomniCortex is an open-source, single-agent framework built around a biologically inspired memory architecture. It is designed to be a durable, long-lived agent primitive: an agent that accumulates experience, consolidates it into knowledge, manages its own cognitive housekeeping during sleep, and maintains a verifiable identity over months of operation.

The project name: **SomniCortex**. "Somni" signals that sleep is a first-class compute mode. "Cortex" signals that the agent is built from cooperating subsystems rather than a monolithic prompt.

**Primary goals:**

- A single agent that works well solo, with no fleet infrastructure required
- Memory that behaves like an economy — active, decaying, consolidating — not a static document store
- A local SLM (Memory Kernel) that handles all memory bookkeeping, keeping the expensive remote LLM focused on reasoning
- A sleep engine that consolidates, prunes, and evolves knowledge offline
- A cryptographically verifiable identity store with human-gated governance
- Clean external interfaces composable into multi-agent systems later without redesign

**Non-goals for this version:**

- Fleet orchestration or multi-agent coordination
- Multi-modal memory (images, audio)
- Real-time streaming task execution
- A graphical UI (CLI and file-based interaction is sufficient)

---

## 2. Repository structure and open-source setup

### Repository

- **Name:** `somnircortex` (GitHub public repository)
- **License:** MIT
- **Language:** Python 3.11+
- **Package manager:** `uv` (preferred) or `pip`

### Top-level layout

```
somnicortex/
├── README.md
├── LICENSE                        # MIT
├── pyproject.toml                 # package definition, dependencies
├── .github/
│   └── workflows/
│       ├── test.yml               # CI: run pytest on push
│       └── lint.yml               # CI: ruff + mypy
├── somnicortex/                   # main package
│   ├── __init__.py
│   ├── agent.py                   # Agent class — top-level entry point
│   ├── api.py                     # External API surface
│   ├── birth.py                   # Instantiation and birth spec handling
│   ├── kernel/                    # Memory Kernel subsystem
│   │   ├── __init__.py
│   │   ├── classification.py      # ModernBERT-large wrapper
│   │   ├── generative.py          # Ollama/local LLM wrapper
│   │   ├── operations.py          # All Kernel operation implementations
│   │   └── rpc.py                 # JSON-RPC daemon interface
│   ├── memory/                    # Memory substrate
│   │   ├── __init__.py
│   │   ├── episodic.py            # Episodic ledger
│   │   ├── semantic.py            # Semantic knowledge graph
│   │   ├── procedural.py          # Procedural and policy store
│   │   ├── prospective.py         # Prospective intentions
│   │   ├── working.py             # Volatile scratchpad
│   │   └── activation.py          # Activation weight computation
│   ├── sleep/                     # Sleep engine
│   │   ├── __init__.py
│   │   ├── fsm.py                 # Sleep state machine
│   │   ├── scheduler.py           # Sleep queue management
│   │   ├── consolidation.py       # NREM-like consolidation pipeline
│   │   ├── cleanup.py             # Glymphatic cleanup
│   │   └── simulator.py           # Default Mode Simulator
│   ├── identity/                  # Values and identity store
│   │   ├── __init__.py
│   │   ├── log.py                 # Append-only content-addressed log
│   │   └── governance.py          # Write permission enforcement
│   ├── tools/                     # Tool policy enforcement
│   │   ├── __init__.py
│   │   └── policy.py              # Tool policy checker
│   ├── context.py                 # Structured context packet assembly
│   ├── approval.py                # Approval transport (file-based)
│   └── instrumentation.py         # Citation tracking and step scoring
├── archetypes/                    # Birth spec templates
│   ├── README.md
│   ├── base.yaml                  # Minimal archetype all others extend
│   ├── researcher.yaml
│   ├── executor.yaml
│   └── reviewer.yaml
├── scripts/
│   ├── create_agent.py            # CLI: instantiate a new agent
│   ├── send_task.py               # CLI: send a task to an agent
│   ├── inspect_agent.py           # CLI: inspect agent memory/state
│   ├── approve.py                 # CLI: review and approve pending approvals
│   └── bootstrap_kernel.py        # CLI: generate synthetic training data and fine-tune
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
└── docs/
    ├── architecture.md
    ├── birth_spec.md
    ├── kernel_finetuning.md
    └── deployment.md
```

---

## 3. Core design principles

These are non-negotiable architectural constraints. Every implementation decision should be consistent with them.

**Memory is an economy, not a storage cabinet.** Memories have activation weights that decay with time and strengthen with use and salience. The agent recalls the most *available* thing given the current context, not the most syntactically similar.

**Sleep is compute, not downtime.** Consolidation, pruning, skill compilation, and identity management happen offline during sleep cycles. Sleep is scheduled, not incidental.

**A local SLM handles memory operations.** The execution LLM reasons. The Memory Kernel classifies, scores, extracts, and consolidates. These are different cognitive jobs that should not share the same model.

**The filesystem is the agent.** All persistent state lives in a well-defined directory tree. The agent can be inspected, backed up, migrated, and debugged with standard tools. No opaque embedding stores.

**Identity changes require external approval.** The agent can propose changes to its constitution and personality but cannot enact them unilaterally. This is enforced structurally, not by policy.

**Tool calls are governed.** Every tool call is checked against `tool_policies.yaml` before execution. Blocked calls raise errors. Approval-required calls pause execution and invoke the approval transport.

---

## 4. Agent instantiation and personality ("birth")

Every agent is created from a **birth spec** — a structured document that defines its initial identity, personality, cognitive priors, and domain knowledge. An agent born without a birth spec must be refused at instantiation time with a clear error.

### Birth spec structure

```yaml
# birth_spec.yaml — provided by human operator at instantiation time

identity:
  name: "Aria"                        # human-readable name
  role: "Research assistant"          # what this agent is for
  archetype: "researcher"             # base archetype to extend (see archetypes/)

constitution:                         # hard rules — never overridden by experience
  - "Never fabricate citations or facts"
  - "Always surface uncertainty when confidence is low"
  - "Escalate via request_approval when task exceeds authority tier"

personality:
  communication_style: "concise and direct"
  risk_disposition: "cautious"        # cautious | balanced | aggressive
  verbosity: "low"                    # low | medium | high
  ambiguity_handling: "ask"           # ask | infer | escalate

cognitive_priors:
  domain: "academic research"
  trusted_tools: ["web_search", "arxiv"]
  skepticism_level: "high"            # how much evidence needed before promoting a belief
  preferred_reasoning_style: "systematic"

authority_tier: 1                     # 0 = highest authority, higher = more restricted

initial_semantic_beliefs:            # optional: seed the semantic graph at birth
  - "Peer-reviewed sources are more reliable than preprints"
  - "Methodology sections must be read before trusting results"

initial_skills:                      # optional: seed the procedural store at birth
  - name: "literature_review"
    file: "skills/literature_review.yaml"
```

### Archetype system

Archetypes live in `archetypes/` as YAML templates. A birth spec's `archetype` field names a base template. The birth spec's fields override archetype defaults. `base.yaml` defines the minimum valid archetype that all others extend.

Provided archetypes at launch:

- `base` — minimal constitution, neutral personality, no domain priors
- `researcher` — cautious, high skepticism, prefers systematic reasoning
- `executor` — action-oriented, lower skepticism, prefers tool use over deliberation
- `reviewer` — critical disposition, flags inconsistencies, high verbosity

### Instantiation process (`scripts/create_agent.py`)

```
create_agent --birth-spec path/to/birth_spec.yaml --agent-dir path/to/new/agent/
```

This script:

1. Validates the birth spec against schema
2. Creates the agent directory tree
3. Writes the birth record as the first entry in `identity_log.jsonl` with `change_type: "initial"`, `author: "human_operator"`, signed with a timestamp
4. Seeds the semantic graph with `initial_semantic_beliefs` if provided
5. Seeds the procedural store with `initial_skills` if provided
6. Writes `snapshot_hash` from the initial log head
7. Downloads or links the Memory Kernel model weights into `memory/kernel/model_weights/`
8. Initializes all SQLite databases with WAL mode enabled
9. Writes `agent.yaml` with ID, role, archetype, and authority tier
10. Prints the agent ID and confirms readiness

The agent ID is a UUID generated at instantiation. It is immutable.

---

## 5. Human interaction patterns

Humans interact with SomniCortex agents through four primary patterns:

### Pattern 1: Task assignment

```
scripts/send_task.py --agent-dir ./my_agent --task "Summarize the attached paper" --urgency normal --attach paper.pdf
```

Calls `receive_task()`. Urgency levels: `low | normal | high | critical`. `high` and `critical` can interrupt FULL_SLEEP (see Section 9).

### Pattern 2: Checking status

```
scripts/inspect_agent.py --agent-dir ./my_agent --show state
scripts/inspect_agent.py --agent-dir ./my_agent --show sleep-queue
scripts/inspect_agent.py --agent-dir ./my_agent --show identity
scripts/inspect_agent.py --agent-dir ./my_agent --show memory --query "tool failures last week"
```

Calls `get_sleep_state()`, `get_sleep_queue()`, `get_identity_snapshot()`, `recall()`.

### Pattern 3: Approvals

Pending approvals appear in `audit/pending_approvals/` as JSON files. The human reviews them and approves or rejects via:

```
scripts/approve.py --agent-dir ./my_agent --list
scripts/approve.py --agent-dir ./my_agent --approve <approval_id>
scripts/approve.py --agent-dir ./my_agent --reject <approval_id> --reason "..."
```

### Pattern 4: Receiving reports

Reports from the agent are written to `audit/reports/` as timestamped JSON files, and optionally printed to stdout if the agent runtime is running in interactive mode. The `report()` call is fire-and-forget from the agent's perspective — it does not block.

### Programmatic access

All patterns above are also accessible via the Python API directly (see Section 14).

---

## 6. Memory substrate

Three coordinated stores replace a monolithic vector database. All stores use SQLite with WAL mode enabled (see Section 16). All stores are located under `memory/` in the agent directory.

### 6.1 Episodic ledger (`memory/episodic/ledger.db`)

Append-only event records. Never modified after write — corrections are new entries with a `corrects_episode_id` field.

**Schema:**

```sql
CREATE TABLE episodes (
    id                  TEXT PRIMARY KEY,    -- UUID
    timestamp           TEXT NOT NULL,       -- ISO8601
    goal_context        TEXT,                -- current goal when episode occurred
    goal_tag            TEXT,                -- categorical goal label for filtering
    action_type         TEXT,                -- 'tool_call' | 'reasoning' | 'output' | 'error'
    action_detail       TEXT,                -- JSON: tool name, args, etc.
    outcome             TEXT,                -- 'success' | 'failure' | 'partial' | 'unknown'
    outcome_detail      TEXT,                -- free text
    salience_score      REAL DEFAULT 0.5,    -- 0.0–1.0, set by Kernel on write
    activation_weight   REAL DEFAULT 0.5,    -- updated by sleep
    summary             TEXT,                -- compact human-readable summary
    summary_embedding   BLOB,                -- dense vector of summary (fallback retrieval)
    corrects_episode_id TEXT,                -- if this corrects a prior episode
    derived_belief_ids  TEXT,                -- JSON array: semantic node IDs derived from this
    injected_into_steps TEXT,                -- JSON array: step IDs where injected into context
    citation_count      INTEGER DEFAULT 0,
    citation_rate       REAL,                -- computed during sleep
    last_cited_at       TEXT,
    last_accessed_at    TEXT,
    access_count        INTEGER DEFAULT 0
);

CREATE VIRTUAL TABLE episodes_fts USING fts5(
    id UNINDEXED,
    goal_context,
    summary,
    outcome_detail,
    content='episodes',
    content_rowid='rowid'
);
```

### 6.2 Semantic knowledge graph (`memory/semantic/graph.db`)

Property graph stored in SQLite. Nodes are concepts/entities/constraints. Edges are typed relationships.

**Schema:**

```sql
CREATE TABLE nodes (
    id                  TEXT PRIMARY KEY,    -- UUID
    node_type           TEXT NOT NULL,       -- 'concept' | 'entity' | 'constraint' | 'rule'
    label               TEXT NOT NULL,
    confidence          REAL DEFAULT 0.7,    -- 0.0–1.0
    activation_weight   REAL DEFAULT 0.5,
    consistency_status  TEXT DEFAULT 'clean', -- 'clean' | 'pending_review'
    provenance_ids      TEXT,                -- JSON array: episode IDs this was derived from
    version             INTEGER DEFAULT 1,
    superseded_by       TEXT,                -- node ID if this version is superseded
    created_at          TEXT NOT NULL,
    last_accessed_at    TEXT,
    access_count        INTEGER DEFAULT 0,
    citation_count      INTEGER DEFAULT 0,
    citation_rate       REAL,
    authority_tier      INTEGER DEFAULT 1    -- lower = more authoritative
);

CREATE TABLE edges (
    id                  TEXT PRIMARY KEY,
    source_id           TEXT NOT NULL REFERENCES nodes(id),
    target_id           TEXT NOT NULL REFERENCES nodes(id),
    edge_type           TEXT NOT NULL,       -- 'relates_to' | 'derived_from' | 'superseded_by'
                                             -- 'contradicts' | 'apparent_contradiction'
                                             -- 'supports' | 'depends_on'
    confidence          REAL DEFAULT 0.7,
    provenance_ids      TEXT,                -- JSON array: episode IDs
    created_at          TEXT NOT NULL
);

-- Dense vectors for deduplication only
CREATE TABLE node_embeddings (
    node_id             TEXT PRIMARY KEY REFERENCES nodes(id),
    embedding           BLOB NOT NULL        -- float32 array, serialized
);
```

### 6.3 Procedural and policy store (`memory/procedural/`)

**Skills (`skills.db`):**

```sql
CREATE TABLE skills (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    goal_type           TEXT,                -- what kind of goal this applies to
    preconditions       TEXT,                -- JSON array of condition strings
    steps               TEXT NOT NULL,       -- JSON array of step objects
    tool_requirements   TEXT,                -- JSON array of tool names
    success_criteria    TEXT,
    confidence          REAL DEFAULT 0.7,
    activation_weight   REAL DEFAULT 0.5,
    authority_tier      INTEGER DEFAULT 1,
    provenance_ids      TEXT,                -- JSON array: episode IDs
    created_at          TEXT NOT NULL,
    last_used_at        TEXT,
    use_count           INTEGER DEFAULT 0,
    citation_rate       REAL
);
```

**Policies (`policies.db`):**

```sql
CREATE TABLE policies (
    id                  TEXT PRIMARY KEY,
    condition           TEXT NOT NULL,       -- natural language or structured condition
    action              TEXT NOT NULL,       -- tool name, approach label, or escalation
    priority            INTEGER DEFAULT 5,   -- lower = higher priority
    confidence          REAL DEFAULT 0.7,
    activation_weight   REAL DEFAULT 0.6,
    authority_tier      INTEGER DEFAULT 1,
    provenance_ids      TEXT,
    created_at          TEXT NOT NULL,
    last_applied_at     TEXT,
    apply_count         INTEGER DEFAULT 0
);
```

### 6.4 Prospective intentions (`memory/prospective.db`)

```sql
CREATE TABLE intentions (
    id                  TEXT PRIMARY KEY,
    cue_type            TEXT NOT NULL,       -- 'time' | 'event' | 'dependency'
    cue_description     TEXT NOT NULL,       -- what triggers this intention
    action_description  TEXT NOT NULL,       -- what to do when cue fires
    status              TEXT DEFAULT 'pending', -- 'pending' | 'completed' | 'expired' | 'stale'
    priority            INTEGER DEFAULT 5,
    boost_multiplier    REAL DEFAULT 1.3,
    linked_memory_ids   TEXT,                -- JSON array of memory object IDs (episodic + semantic)
    linked_at           TEXT,
    created_at          TEXT NOT NULL,
    due_at              TEXT,                -- optional deadline
    completed_at        TEXT,
    stale_flagged_at    TEXT
);
```

### 6.5 Working memory (`memory/working/`)

Volatile scratchpad. Stored as plain JSON files in the `working/` directory. Wiped at every sleep boundary. Never read back after sleep — contents are considered gone. No schema required; structure is defined per task by the execution LLM.

---

## 7. Memory Kernel

The Memory Kernel is a local SLM running as a persistent JSON-RPC daemon. It handles all memory operations that do not require the reasoning depth of the execution LLM.

### 7.1 Architecture

**Split Kernel — two models:**


| Model                 | Role                      | Size                       | Runtime        |
| --------------------- | ------------------------- | -------------------------- | -------------- |
| ModernBERT-large      | Classification operations | 149M params, ~3.35 GB VRAM | CPU or GPU     |
| Llama 3.2 3B (Q4_K_M) | Generative operations     | ~2 GB RAM                  | CPU via Ollama |


Both models run as subprocesses managed by the agent runtime. They communicate with the main process over a local Unix socket (JSON-RPC 2.0). The execution LLM never loads their weights or communicates with them directly.

### 7.2 Daemon interface

The Kernel daemon listens on a Unix socket at `memory/kernel/kernel.sock`. The agent runtime sends requests as JSON-RPC 2.0 messages. All calls are synchronous from the caller's perspective; the daemon handles internal async as needed.

```python
# Example call
{"jsonrpc": "2.0", "method": "classify_store", "params": {"text": "...", "context": "..."}, "id": 1}
# Response
{"jsonrpc": "2.0", "result": {"store": "semantic", "confidence": 0.91}, "id": 1}
```

### 7.3 Complete operations list

**On-write operations (inline):**


| Operation                        | Model          | Input                              | Output                                                 | Latency target      |
| -------------------------------- | -------------- | ---------------------------------- | ------------------------------------------------------ | ------------------- |
| `classify_store`                 | Classification | text, context                      | `{store, confidence}`                                  | <10ms               |
| `score_salience`                 | Classification | text, context                      | `{score: float}`                                       | <10ms               |
| `detect_conflict`                | Classification | new_belief, existing_belief        | `{conflict: bool, confidence: float}`                  | <10ms               |
| `check_neighborhood_consistency` | Classification | new_belief, neighborhood_triples[] | `{score: float, conflict_cluster: ids[], action: str}` | <30ms               |
| `deduplicate`                    | Classification | new_belief, candidates[]           | `{duplicate_id: str                                    | null, action: str}` |
| `extract_atomic_facts`           | Generative     | episode_text                       | `{facts: str[]}`                                       | <500ms              |
| `link_intention_to_memories`     | Classification | intention                          | `{linked_memory_ids: str[]}`                           | <50ms               |


**On-read operations (inline):**


| Operation                  | Model          | Input                      | Output                                               | Latency target |
| -------------------------- | -------------- | -------------------------- | ---------------------------------------------------- | -------------- |
| `generate_retrieval_query` | Generative     | goal, context              | `{episodic_query, semantic_query, procedural_query}` | <300ms         |
| `rerank`                   | Classification | candidates[], goal_context | `{ranked: [{id, score}]}`                            | <50ms          |
| `reject_low_confidence`    | Classification | candidates[], threshold    | `{accepted: ids[], rejected: ids[]}`                 | <10ms          |


**Sleep operations (batch):**


| Operation                   | Model          | Input                          | Output                                        | Latency target  |
| --------------------------- | -------------- | ------------------------------ | --------------------------------------------- | --------------- |
| `consolidate_cluster`       | Generative     | episodes[]                     | `{semantic_statements[], skill_candidates[]}` | <2s per cluster |
| `update_activation_weights` | Classification | store_snapshot                 | `{updates: [{id, new_weight}]}`               | <5s             |
| `update_citation_rates`     | Classification | memory_ids[], step_scores[]    | `{updates: [{id, rate}]}`                     | <1s             |
| `generate_simulation_seeds` | Generative     | semantic_graph, prospective_db | `{seeds: []}`                                 | <2s             |
| `score_promotion`           | Classification | dream_output                   | `{score: float, promote: bool}`               | <10ms           |
| `resolve_conflict`          | Generative     | conflict_cluster               | `{resolution: str, actions: []}`              | <2s             |


### 7.4 Cold start and bootstrap

**The problem:** On first instantiation, the Memory Kernel models have not been fine-tuned for SomniCortex operations. They will work adequately out of the box (the base models have strong language understanding) but will be suboptimal for memory-specific tasks.

**Bootstrap strategy:**

The system deploys in two phases:

**Phase 1 — Vanilla deployment (day 0):** Use the base models without fine-tuning. Classification operations fall back to zero-shot prompting for ModernBERT-large, and the generative model handles extraction and consolidation with a structured system prompt. Performance is acceptable but not optimized. This phase begins immediately — do not block deployment waiting for fine-tuning.

**Phase 2 — Fine-tuned deployment (after ~2 weeks of operation or manual trigger):**

`scripts/bootstrap_kernel.py` does the following:

1. Reads the agent's episodic ledger and semantic graph to check if sufficient real data exists (minimum: 200 episodes, 50 semantic nodes)
2. If insufficient real data: generates synthetic training data using a remote frontier LLM as teacher (see below)
3. Runs LoRA fine-tuning on ModernBERT-large for classification tasks
4. Runs QLoRA fine-tuning on the generative model for extraction and consolidation tasks
5. Validates the fine-tuned models against a held-out test set (minimum F1 > 0.75 for classification tasks)
6. Replaces the running Kernel models with the fine-tuned versions (hot-swap via daemon restart)

**Synthetic data generation (when real data is insufficient):**

```
bootstrap_kernel.py --agent-dir ./my_agent --synthetic --count 500 --frontier-model claude-sonnet-4-6
```

This calls the frontier LLM to generate:

- 200 `(episode_text → atomic_facts[])` pairs
- 150 `(new_belief + graph_context → conflict: bool)` pairs
- 100 `(episode_cluster → semantic_statements[], skill_candidates[])` pairs
- 50 `(candidates + goal_context → ranked_candidates[])` pairs

Generated data is written to `memory/kernel/training_data/` and used for fine-tuning.

**Minimum quality gate:** If the fine-tuned model fails to exceed F1 > 0.75 on the held-out test, the bootstrap script logs a warning, retains the vanilla model, and suggests generating more training data.

---

## 8. Activation dynamics

Every memory object in every store has an `activation_weight` (float in [0.0, 1.0]) updated during sleep. Retrieval uses a two-stage pipeline.

### 8.1 Activation formula

```
activation_weight =
  base_weight
  × recency_factor(time_since_last_access, decay_constant)
  × frequency_factor(access_count, saturation_threshold)
  × authority_factor(trust_tier) × (1 + citation_rate_bonus)
  × intention_boost(linked_by_open_intentions)
```

**recency_factor:** Power-law decay: `max(0.1, (1 / (1 + days_since_access)) ^ decay_exponent)`

Decay exponents by store type:

- Episodic: `0.5` (faster decay)
- Semantic: `0.2` (slower decay)
- Procedural: `0.1` (very slow decay — skills are durable)
- Prospective: no decay while status is `pending`

**frequency_factor:** `min(1.0, 0.5 + (access_count / saturation_threshold) × 0.5)` — saturates at 1.0 above `saturation_threshold` (default: 20 accesses).

**authority_factor:** Lookup by `authority_tier`: tier 0 → 1.5, tier 1 → 1.2, tier 2 → 1.0, tier 3+ → 0.9. Supervisor-approved items get an additional +0.1.

**citation_rate_bonus:** `min(0.2, citation_rate × 0.25)` — capped at +20%.

**intention_boost:** Multiplier of `1.3` if memory ID appears in any open intention's `linked_memory_ids`. Capped at `1.6` regardless of how many open intentions link to it.

### 8.2 Two-stage retrieval pipeline

**Stage 1 — Pre-filter (deterministic, no model):**

1. Load all memory objects from target stores
2. Compute `activation_weight` for each using the formula above
3. Apply `consistency_status` filter: exclude `pending_review` nodes from semantic slot injection
4. Return top-N by activation weight (default N=20)

**Stage 2 — Re-rank (Memory Kernel):**

1. Pass pre-filter candidates + current goal context to `rerank()`
2. Apply `reject_low_confidence()` — default threshold: 0.4
3. Return ranked, filtered list for context packet assembly

### 8.3 Sleep downscaling

During every sleep cycle, `update_activation_weights()` runs:

1. Globally multiply all activation weights by `downscale_factor` (default: 0.85)
2. Selectively re-upweight:
  - Items accessed since last sleep: ×1.1
  - Items linked to open prospective intentions: ×1.15
  - High-salience items (salience_score > 0.8): ×1.1
  - Supervisor-approved items: ×1.1
3. Clamp all weights to [0.05, 1.0] — nothing fully disappears, nothing exceeds maximum

---

## 9. Sleep engine and FSM

### 9.1 State machine

The agent is always in exactly one of four states. State is stored in `agent.yaml` under `sleep_state` and updated atomically on every transition.

```
States: WAKE | MICRO_SLEEP | FULL_SLEEP | SUPERVISED_PAUSE

Transitions:

WAKE → MICRO_SLEEP
  triggers: idle_timeout (configurable, default 5min) |
            task_completed |
            sleep_queue_depth > 50

WAKE → FULL_SLEEP
  triggers: scheduled_window (configurable, default: nightly) |
            manual trigger_sleep() call |
            sleep_queue_depth > 200

WAKE → SUPERVISED_PAUSE
  triggers: identity_update_proposed |
            high_risk_tool_call_requires_approval |
            snapshot_hash_mismatch_on_wake

MICRO_SLEEP → WAKE
  triggers: sleep_complete |
            receive_task(urgency >= 'normal') |
            interrupt signal

FULL_SLEEP → WAKE
  triggers: sleep_complete |
            receive_task(urgency >= 'high') |
            interrupt signal

FULL_SLEEP → MICRO_SLEEP
  triggers: receive_task(urgency == 'normal')
  note: saves FULL_SLEEP progress, handles task as MICRO_SLEEP, then resumes FULL_SLEEP

SUPERVISED_PAUSE → WAKE
  triggers: approval received via request_approval() |
            rejection received (agent logs rejection and resumes without the proposed change)
```

**Interruption behavior:**

- `urgency: low` — queued, does not interrupt any sleep
- `urgency: normal` — interrupts MICRO_SLEEP; queued during FULL_SLEEP (FULL_SLEEP enters brief MICRO_SLEEP to handle it)
- `urgency: high` — interrupts MICRO_SLEEP and FULL_SLEEP
- `urgency: critical` — interrupts everything including SUPERVISED_PAUSE (logs the interruption)

**FULL_SLEEP progress tracking:** When FULL_SLEEP is interrupted, the current pipeline stage is saved to `sleep/progress.json`. On resume, the sleep pipeline continues from the saved stage rather than restarting.

### 9.2 Sleep queue

Jobs are written as individual JSON files to `sleep/queue/`. Each job file is named `{timestamp}_{job_type}_{id}.json`. The queue is processed in FIFO order during sleep.

**Job types:**

```json
{"type": "consolidate", "cluster_id": "...", "episode_ids": [...]}
{"type": "downscale_activation", "scope": "all"}
{"type": "update_semantic", "belief": {...}, "provenance": [...]}
{"type": "promote_skill", "candidate": {...}}
{"type": "cleanup", "scope": "episodic|semantic|procedural|all"}
{"type": "simulate", "seed": {...}}
{"type": "resolve_conflict", "conflict_cluster": {...}}
{"type": "update_citation_rates", "step_scores": [...]}
```

**Queue depth limits:**

- Soft limit (50): triggers unscheduled MICRO_SLEEP
- Hard limit (200): triggers FULL_SLEEP, logs warning
- If queue depth exceeds 500: logs critical warning, processes queue immediately regardless of sleep schedule

### 9.3 MICRO_SLEEP pipeline

Duration: 30 seconds to 5 minutes (configurable per agent). Steps run in order:

1. Serialize and clear working memory scratchpad
2. Flush any pending episodic write buffer
3. Update prospective intentions (mark completed, flag stale)
4. Process up to 10 items from sleep queue (prioritizing `update_citation_rates` and `downscale_activation`)
5. Light activation weight update (no full downscale — just intention boost recalculation)
6. Re-initialize context packet for next WAKE

### 9.4 FULL_SLEEP pipeline

Duration: configurable, default 15–30 minutes. Steps saved to `sleep/progress.json` for interrupt recovery:

```
Stage 1: serialize_working_memory
Stage 2: flush_episodic_buffer
Stage 3: update_prospective_intentions
Stage 4: cluster_episodes          — group recent episodes by goal/topic
Stage 5: consolidate_clusters      — Kernel extracts semantic + skill candidates
Stage 6: conflict_resolution       — process pending_review nodes
Stage 7: semantic_integration      — insert validated beliefs into graph
Stage 8: skill_compilation         — promote validated skill candidates
Stage 9: simulation                — Default Mode Simulator (gap analysis, plan sketching, counterfactual)
Stage 10: glymphatic_cleanup       — compress, deduplicate, expire, rotate secrets
Stage 11: activation_rebalancing   — full downscale + re-upweighting
Stage 12: citation_rate_update     — batch update citation rates from accumulated step scores
Stage 13: snapshot_hash_update     — recompute and write identity log snapshot hash
Stage 14: clear_queue              — remove processed jobs from sleep/queue/
```

### 9.5 Wake initialization

On every transition to WAKE:

1. Load `snapshot_hash` from `memory/values/snapshot_hash`
2. Compute `sha256(tail of identity_log.jsonl)`
3. If mismatch → immediately enter SUPERVISED_PAUSE, write approval request
4. If match → re-initialize structured context packet
5. Set `sleep_state: WAKE` in `agent.yaml`

---

## 10. Structured context packet and wake rhythm

### 10.1 Context packet

The execution LLM receives a structured context packet on each action step. Assembled by the context module from the memory stores.

```yaml
context_packet:
  total_budget_tokens: 8000    # configurable; scale with execution LLM context window

  slots:
    task_focus:
      budget: 1500
      content: "current goal text, constraints, success criteria, step number"
      eviction: never

    prospective:
      budget: 500
      content: "open intentions with matching cues, ordered by priority"
      eviction: after action step if cue no longer matches

    episodic_recall:
      budget: 2000
      content: "1–3 retrieved episode summaries with IDs and activation weights"
      eviction: after each action step (re-fetched if still relevant)

    semantic:
      budget: 1500
      content: "top belief nodes with confidence scores (clean status only)"
      eviction: at sleep boundary

    policy:
      budget: 500
      content: "active routing rules and tool-choice heuristics"
      eviction: rarely — updated only by sleep consolidation

    safety_values:
      budget: 700
      content: "constitution lines (compact) + identity snapshot hash"
      eviction: never
```

**Eviction order under budget pressure** (least → most protected):
`episodic_recall → semantic → prospective → policy → task_focus → safety_values`

If the packet cannot fit after evicting all episodic and semantic content, the agent calls `report()` with an error payload rather than silently truncating the constitution.

### 10.2 Four-beat wake rhythm

Each action step follows this sequence exactly:

**Beat 1 — Focus:**
Inject `task_focus` + `safety_values` + `policy` into context. No recalled content yet. This anchors the agent in its current goal and values before any memory is loaded.

**Beat 2 — Cue:**
Call `generate_retrieval_query(goal, context)`. Also load all open prospective intentions and append their `linked_memory_ids` to the candidate set. This gives two parallel retrieval paths: goal-derived and intention-linked.

**Beat 3 — Recall burst:**
Run two-stage retrieval (pre-filter → Kernel re-rank → confidence reject). Load top results into `episodic_recall` and `semantic` slots. Apply `consistency_status` filter — no `pending_review` beliefs in the semantic slot.

**Beat 4 — Act:**
Execute LLM call with full context packet. The system prompt includes the `<used_context>` instruction (see Section 18). Process tool calls through policy checker (Section 13). Write episodic event to ledger. Update `prospective` slot. Queue any sleep jobs triggered by this step.

---

## 11. Values and identity store

### 11.1 Append-only content-addressed log (`memory/values/identity_log.jsonl`)

Each line is a JSON object:

```json
{
  "entry_id": "<sha256 of: previous_entry_id + content_json + timestamp>",
  "timestamp": "2026-03-22T14:30:00Z",
  "author": "human_operator | agent:<agent_id>",
  "change_type": "initial | update | rollback",
  "scope": "constitution | personality | moral_weight | identity_metadata",
  "content": {},
  "approval_chain": [
    {"approver_id": "human_operator", "timestamp": "...", "approval_id": "..."}
  ],
  "previous_entry_id": "<sha256> | null",
  "simulation_provenance_id": "<dream_id> | null"
}
```

The file is opened in append mode only. No line is ever modified or deleted. Current state is computed by replaying the log.

### 11.2 Write permissions by scope


| Scope               | Author                | Approval required               | Notes                         |
| ------------------- | --------------------- | ------------------------------- | ----------------------------- |
| `constitution`      | `human_operator` only | Always (human signature)        | Hard rules, never relaxed     |
| `moral_weight`      | `human_operator` only | Always (human signature)        |                               |
| `personality`       | `agent`               | Yes — triggers SUPERVISED_PAUSE | Requires `request_approval()` |
| `identity_metadata` | `agent`               | No                              | Name, style preferences       |


The agent runtime enforces these permissions before every write. Attempts to write outside permitted scope raise a `GovernanceViolation` exception.

Personality updates proposed by the Default Mode Simulator must include the simulation ID in `simulation_provenance_id`. This makes dream-driven personality changes auditable.

### 11.3 Snapshot verification

`memory/values/snapshot_hash` contains the sha256 of the last line of `identity_log.jsonl`. Updated at the end of every FULL_SLEEP (Stage 13) and after every identity log write.

Verified on every WAKE transition (Step 2 of wake initialization). Mismatch → SUPERVISED_PAUSE.

### 11.4 Log compaction

To prevent unbounded growth, the log supports periodic compaction. Compaction does not delete history — it creates a signed checkpoint entry:

```json
{
  "entry_id": "...",
  "change_type": "checkpoint",
  "scope": "all",
  "content": {
    "checkpoint_covers_entries": 0,
    "checkpoint_covers_through": "<entry_id>",
    "state_snapshot": { ... }   // complete current state as of checkpoint
  },
  "approval_chain": [{ "approver_id": "human_operator", ... }]
}
```

After a checkpoint, `snapshot_hash` points to the checkpoint entry. The agent loads the checkpoint state on wake rather than replaying from the beginning. The full historical log remains in `identity_log.jsonl` for audit purposes.

Compaction is triggered manually (`scripts/approve.py --compact`) or automatically when the log exceeds 10,000 entries. Automatic compaction requires human approval (queued as a standard approval request).

---

## 12. Default Mode Simulator

Runs during FULL_SLEEP Stage 9. Uses the generative Memory Kernel model and (for plan sketching) a bounded execution LLM call.

### Job 1: Gap analysis

Kernel's `generate_simulation_seeds()` scans for:

- Semantic nodes frequently co-retrieved with no explicit relationship edge → candidate new edge
- Prospective intentions pending > `stale_intention_days` (default: 3) → decomposition seed
- Tool call patterns in episodic ledger not matching any procedural store entry → skill compilation seed

### Job 2: Plan sketching

For each gap-analysis seed, a bounded execution LLM call with system prompt prefixed `[SIMULATION MODE — output is hypothetical and will not be executed]`. Output written to `sleep/dreams/<timestamp>_<seed_id>.json` with fields `confidence: tentative, source: simulation`.

### Job 3: Counterfactual replay

For episodes with `outcome: failure` and `salience_score > 0.7`: brief "given current knowledge, what would have been better?" generation. Produces policy cache update candidates.

### Promotion protocol

1. Kernel `score_promotion()` must return `promote: true`
2. Promoting to semantic or procedural → standard sleep job with full conflict detection
3. Promoting to values/identity → **blocked entirely**. Any attempt raises `GovernanceViolation`.
4. Dream outputs not promoted within 7 days are automatically expired from `sleep/dreams/`

---

## 13. Tool policy enforcement

`tools/tool_policies.yaml` is read before every tool call. The policy checker runs synchronously in the WAKE loop between Beat 4's tool call decision and actual tool execution.

### Policy file format

```yaml
# tools/tool_policies.yaml

defaults:
  unknown_tool: block            # 'block' | 'allow' | 'require_approval'
  rate_limit_window_seconds: 60

tools:
  web_search:
    status: allow
    rate_limit: 10               # max calls per rate_limit_window_seconds
    
  file_write:
    status: require_approval
    approval_scope: "tool_call"
    
  shell_exec:
    status: block
    
  arxiv:
    status: allow
    rate_limit: 5
```

### Enforcement logic

```
For each tool call in the Act step:
  1. Look up tool in tool_policies.yaml
  2. If status == 'block': raise ToolBlockedError, write to audit/decisions.log
  3. If status == 'require_approval': call request_approval(scope='tool_call', payload={tool, args})
     → enter SUPERVISED_PAUSE until approval received
     → on approval: execute tool, write to audit/approvals.log
     → on rejection: skip tool call, write reasoning trace noting rejection
  4. If status == 'allow': check rate limit
     → if rate limit exceeded: queue task for retry after window, enter MICRO_SLEEP
     → if within limit: execute tool
  5. Unknown tool → apply defaults.unknown_tool policy
```

---

## 14. External API

All public methods of the `Agent` class. These are the only interfaces external systems should use.

```python
class Agent:
    
    # Work intake and output
    def receive_task(self, task_spec: TaskSpec) -> None:
        """
        Accepts a task for execution. Non-blocking — queues the task internally.
        If agent is in MICRO_SLEEP and urgency >= 'normal': interrupts sleep.
        If agent is in FULL_SLEEP and urgency >= 'high': interrupts sleep.
        If agent is in SUPERVISED_PAUSE and urgency == 'critical': logs interruption, processes task.
        
        TaskSpec fields:
          task_id: str (UUID, generated by caller)
          description: str
          urgency: 'low' | 'normal' | 'high' | 'critical'
          attachments: list[Attachment] (optional)
          context: dict (optional — additional context for this task)
          report_to: str (optional — identifier for where report() output should go)
        """

    def report(self, payload: ReportPayload) -> None:
        """
        Surfaces output, status updates, or errors to external recipient.
        Fire-and-forget — does not block.
        Writes to audit/reports/<timestamp>_<task_id>.json.
        If agent was started with stdout reporting enabled: also prints to stdout.
        
        ReportPayload fields:
          task_id: str
          report_type: 'result' | 'status' | 'error' | 'question'
          content: str | dict
          confidence: float (optional)
          sources: list[str] (optional — memory IDs cited)
        """
    
    # Governance
    def request_approval(self, scope: ApprovalScope, payload: dict) -> ApprovalResult:
        """
        Blocks execution until approval or rejection received via approval transport.
        Writes pending approval to audit/pending_approvals/<id>.json.
        Enters SUPERVISED_PAUSE.
        Returns ApprovalResult on resolution.
        
        ApprovalScope: 'identity_update' | 'tool_call' | 'high_risk_action' | 'compaction'
        ApprovalResult: {approved: bool, approver_id: str, timestamp: str, notes: str}
        """
    
    # Capability advertisement
    def expose_capabilities(self) -> CapabilityManifest:
        """
        Returns current capability profile.
        
        CapabilityManifest fields:
          agent_id: str
          name: str
          role: str
          archetype: str
          authority_tier: int
          sleep_state: SleepState
          available_tools: list[str]
          skill_count: int
          semantic_node_count: int
          episode_count: int
          kernel_version: str
          kernel_fine_tuned: bool
        """
    
    # Sleep management
    def get_sleep_state(self) -> SleepState:
        """Returns current FSM state."""

    def trigger_sleep(self, mode: SleepMode, budget_seconds: int = None) -> SleepResult:
        """
        Manually triggers sleep. Non-blocking — initiates sleep and returns immediately.
        mode: 'micro' | 'full'
        budget_seconds: overrides default duration if provided
        Returns SleepResult: {started_at, estimated_duration, queue_depth}
        """
    
    def get_sleep_queue(self) -> list[SleepJob]:
        """Returns current pending sleep jobs with types and timestamps."""
    
    # Inspection
    def recall(self, query: RecallQuery) -> MemoryBundle:
        """
        Direct memory retrieval. Bypasses context packet assembly.
        Useful for debugging and inspection.
        
        RecallQuery fields:
          text: str (natural language query)
          stores: list['episodic'|'semantic'|'procedural'] (default: all)
          limit: int (default: 10)
          min_activation: float (default: 0.0)
          time_range: tuple[str, str] (optional — ISO8601 start/end)
        
        MemoryBundle: list of {id, store, content, activation_weight, confidence,
                                provenance_ids, citation_rate}
        """
    
    def get_identity_snapshot(self) -> IdentitySnapshot:
        """
        Returns current identity state by replaying identity_log.jsonl.
        IdentitySnapshot fields:
          agent_id, name, role, archetype,
          constitution: list[str],
          personality: dict,
          snapshot_hash: str,
          log_entry_count: int,
          last_updated: str
        """
```

---

## 15. Approval transport

Approvals use a **file-based polling transport**. This is the simplest viable transport and is human-readable without special tooling.

### Pending approval format

Written to `audit/pending_approvals/<approval_id>.json`:

```json
{
  "approval_id": "uuid",
  "requested_at": "ISO8601",
  "scope": "identity_update | tool_call | high_risk_action | compaction",
  "payload": {},
  "status": "pending",
  "agent_id": "uuid",
  "context": "Brief description of why approval is needed"
}
```

### Resolution format

After human runs `scripts/approve.py --approve <id>` or `--reject <id>`:

```json
{
  "approval_id": "uuid",
  "requested_at": "ISO8601",
  "resolved_at": "ISO8601",
  "scope": "...",
  "payload": {},
  "status": "approved | rejected",
  "approver_id": "human_operator",
  "notes": "optional human notes",
  "agent_id": "uuid"
}
```

### Polling

The agent runtime polls `audit/pending_approvals/` every 5 seconds (configurable) while in SUPERVISED_PAUSE. When it finds a file with `status: approved` or `status: rejected`, it reads the result, moves the file to `audit/approvals.log` (appended), and transitions out of SUPERVISED_PAUSE.

**Timeout:** If no approval is received within `approval_timeout_hours` (default: 24), the agent logs a timeout warning, rejects the proposed change automatically, and resumes WAKE. This prevents the agent from being permanently blocked by a missed approval.

---

## 16. Database configuration

All SQLite databases must be initialized with the following PRAGMA settings:

```sql
PRAGMA journal_mode = WAL;        -- write-ahead logging for concurrent read/write
PRAGMA synchronous = NORMAL;      -- good durability/performance balance
PRAGMA foreign_keys = ON;
PRAGMA cache_size = -64000;       -- 64MB cache
PRAGMA temp_store = MEMORY;
```

These must be set on every database connection, not just at creation time, because SQLite PRAGMAs are per-connection.

WAL mode is critical for SomniCortex because the agent writes to episodic during WAKE while sleep jobs read from the same databases. Without WAL, you will encounter locking errors during MICRO_SLEEP transitions.

---

## 17. Semantic graph — neighborhood consistency

On every semantic graph write, check the new belief against its 2-hop neighborhood before finalizing.

### Process

1. Extract entities referenced in the new belief's `label` field
2. Query graph for all nodes reachable within 2 edges of those entities (SQLite recursive CTE or iterative query)
3. Serialize the neighborhood as a list of `(source_label, edge_type, target_label, confidence)` triples
4. Call Kernel `check_neighborhood_consistency(new_belief, neighborhood_triples)`
5. Handle result by `action` field:
  - `insert_clean`: insert node with `consistency_status: 'clean'`
  - `flag_pending`: insert with `consistency_status: 'pending_review'`, queue `resolve_conflict` sleep job
  - `immediate_block`: do not insert, write to `audit/decisions.log`, return error to caller

`pending_review` nodes are excluded from the semantic slot of the context packet. They are visible via `recall()` for debugging but never injected into the agent's active reasoning until resolved.

---

## 18. Citation tracking and Kernel feedback loop

### System prompt instruction

The execution LLM's system prompt must include the following instruction verbatim:

```
At the end of every response, append a <used_context> block:
<used_context>
  <memory_ids>comma-separated list of memory IDs you drew on, or NONE</memory_ids>
  <relevance>high | medium | low | none</relevance>
</used_context>
This block is internal instrumentation and will be stripped before your output is shared.
```

### Extraction

After every Act step, the instrumentation module:

1. Finds the `<used_context>` block in the raw LLM output
2. Strips it from the output before passing to `report()`
3. Parses `memory_ids` and `relevance`
4. If the block is malformed or absent: logs as `unscored` (not negative)

### Step scoring

```python
def score_step(memory_ids: list[str], relevance: str, injected_ids: list[str]) -> float:
    if not memory_ids or relevance == 'none':
        return 0.0
    relevance_weight = {'high': 1.0, 'medium': 0.7, 'low': 0.3}[relevance]
    cited = len(set(memory_ids) & set(injected_ids))
    total_injected = len(injected_ids)
    if total_injected == 0:
        return 0.0
    return (cited / total_injected) * relevance_weight
```

Step scores are accumulated in memory during WAKE and flushed to a `update_citation_rates` sleep job during MICRO_SLEEP.

### Citation rate

Updated during MICRO_SLEEP by `update_citation_rates()`:

```
citation_rate = exponential_moving_average(
    previous_rate,
    new_score,
    alpha=0.1    # slow-moving average — don't overfit to recent steps
)
```

Citation rate feeds into `authority_factor` in the activation formula and into Kernel fine-tuning as described in Section 7.4.

### Coverage monitoring

The instrumentation module tracks `citation_coverage` — the fraction of Act steps where the `<used_context>` block was successfully parsed over a rolling 7-day window. If `citation_coverage` drops below 0.70, the system:

1. Logs a warning to `audit/decisions.log`
2. Pauses Kernel fine-tuning updates (but continues collecting data)
3. Reports the coverage issue via `report()` to the human operator

---

## 19. Technology stack


| Component            | Technology                                  | Notes                                         |
| -------------------- | ------------------------------------------- | --------------------------------------------- |
| Language             | Python 3.11+                                |                                               |
| Package management   | `uv` preferred, `pip` supported             |                                               |
| SQLite interface     | `sqlite3` (stdlib) + `aiosqlite` for async  | WAL mode required                             |
| Kernel IPC           | `jsonrpc` over Unix socket                  | `jsonrpcserver` library                       |
| Classification model | ModernBERT-large via `transformers`         | HuggingFace                                   |
| Generative model     | Llama 3.2 3B via `ollama` Python client     | Must be installed separately                  |
| Embeddings           | `sentence-transformers` (lightweight model) | For episodic summary vectors only             |
| LoRA fine-tuning     | `peft` + `transformers` + `bitsandbytes`    | QLoRA for generative, LoRA for classification |
| Config parsing       | `pyyaml`                                    |                                               |
| Schema validation    | `pydantic` v2                               | Birth spec and API types                      |
| CLI                  | `click`                                     |                                               |
| Logging              | `structlog`                                 | JSON-structured logs                          |
| Testing              | `pytest` + `pytest-asyncio`                 |                                               |
| Linting              | `ruff`                                      |                                               |
| Type checking        | `mypy`                                      |                                               |
| Hashing              | `hashlib` (stdlib)                          | sha256 for identity log                       |
| Remote LLM           | `anthropic` Python SDK                      | Default execution LLM: claude-sonnet-4-6      |


**Runtime dependencies the user must install separately:**

- Ollama ([https://ollama.com](https://ollama.com)) — for the generative Kernel model
- `ollama pull llama3.2:3b` — download the base model

---

## 20. Build order

Implement in this order. Each phase is independently testable before the next begins.

### Phase 1 — Memory substrate (Week 1–2)

- SQLite schema initialization with WAL mode
- Episodic ledger: write, FTS retrieval, append-only enforcement
- Semantic graph: node/edge CRUD, 2-hop neighborhood query
- Procedural and policy stores: read/write
- Prospective intentions: write with `linked_memory_ids` field
- Identity log: append-only write, hash chain verification, snapshot_hash
- Working memory: write/clear
- All schemas include V4 fields from day one (citation fields, consistency_status, linked_memory_ids)
- Tests: unit tests for each store, WAL concurrency test

### Phase 2 — Sleep FSM (Week 2–3)

- FSM state machine with all four states
- Sleep queue: write, read, FIFO processing, depth limits
- MICRO_SLEEP pipeline (stages 1–6)
- FULL_SLEEP pipeline skeleton with progress.json checkpointing
- Glymphatic cleanup job (most concrete sleep job — implement first)
- Wake initialization with snapshot hash verification
- Interruptible sleep: urgency-based interrupt handling
- Tests: FSM transition tests, interrupt tests, queue depth limit tests

### Phase 3 — Kernel daemon (Week 3–4)

- Unix socket JSON-RPC server skeleton
- ModernBERT-large wrapper (zero-shot prompting, no fine-tuning yet)
- Ollama generative wrapper (prompt-based, no fine-tuning yet)
- All Kernel operations implemented (vanilla, pre-fine-tuning behavior)
- Daemon lifecycle: start, stop, restart, hot-swap
- Tests: Kernel operation unit tests with mock models, IPC tests

### Phase 4 — Activation dynamics and retrieval (Week 4–5)

- Activation formula implementation
- Pre-filter retrieval (deterministic, no Kernel)
- Two-stage retrieval pipeline (pre-filter + Kernel re-rank)
- Intention boost: `link_intention_to_memories`, boost multiplier application
- Neighborhood consistency check wired into semantic write path
- Tests: activation decay tests, retrieval pipeline tests, consistency check tests

### Phase 5 — Wake rhythm and context packet (Week 5–6)

- Four-beat wake rhythm implementation
- Context packet assembly with token budget enforcement and eviction ordering
- Tool policy enforcement wired into Beat 4
- `<used_context>` extraction and step scoring
- Citation accumulation and flush to sleep queue
- Execution LLM integration (Anthropic SDK, default to claude-sonnet-4-6)
- Tests: context packet assembly tests, budget eviction tests, citation extraction tests

### Phase 6 — Identity governance and approval transport (Week 6–7)

- Approval file writing and polling
- `request_approval()` blocking behavior and SUPERVISED_PAUSE integration
- Identity log write permission enforcement
- Compaction logic
- `scripts/approve.py` CLI
- Tests: governance violation tests, approval transport tests, compaction tests

### Phase 7 — Birth and instantiation (Week 7–8)

- Birth spec schema and validation
- Archetype templates (base, researcher, executor, reviewer)
- `scripts/create_agent.py` — full instantiation flow
- Agent class public API (`receive_task`, `report`, `expose_capabilities`, etc.)
- Tests: instantiation tests for each archetype, birth spec validation tests

### Phase 8 — Default Mode Simulator and FULL_SLEEP completion (Week 8–9)

- Gap analysis (generate_simulation_seeds)
- Plan sketching (bounded execution LLM call, hypothetical framing)
- Counterfactual replay
- Dream promotion protocol
- FULL_SLEEP pipeline completion (all 14 stages)
- Tests: simulator output tests, promotion protocol tests, full sleep pipeline integration test

### Phase 9 — Kernel fine-tuning and bootstrap (Week 9–10)

- Synthetic data generation script (frontier LLM teacher)
- LoRA fine-tuning pipeline for ModernBERT-large
- QLoRA fine-tuning pipeline for generative model
- Model validation and quality gate (F1 > 0.75)
- Hot-swap daemon restart
- `scripts/bootstrap_kernel.py` CLI
- Tests: fine-tuning pipeline tests (with tiny synthetic dataset), quality gate tests

### Phase 10 — Integration, CLI polish, documentation (Week 10–11)

- `scripts/send_task.py`, `scripts/inspect_agent.py` CLIs
- End-to-end integration tests (full wake-sleep-wake cycle)
- README, architecture docs, deployment guide
- GitHub Actions CI (test + lint)
- PyPI package setup

---

## 21. Testing requirements

### Unit tests (each module)

- All SQLite schema operations
- Activation formula computation (parametric — test each factor independently)
- FSM state transitions (all valid and invalid transitions)
- Hash chain verification (valid chain, tampered chain)
- Tool policy enforcement (allow, block, require_approval, unknown)
- Context packet assembly under budget pressure
- Citation extraction (valid block, malformed block, absent block)

### Integration tests

- Full wake cycle: receive_task → four-beat rhythm → report
- Full MICRO_SLEEP cycle: trigger → pipeline → resume WAKE
- Full FULL_SLEEP cycle: trigger → all 14 stages → resume WAKE
- SUPERVISED_PAUSE: trigger → approval pending → approve → resume
- SUPERVISED_PAUSE: trigger → approval pending → timeout → auto-reject → resume
- Kernel operations: all operations with mock Kernel responses
- Neighborhood consistency: clean insert, flag_pending insert, immediate_block
- Intention boost: verify activation weights increase for linked memories
- Sleep interrupt: task arrives during FULL_SLEEP at various urgency levels
- Hash mismatch: corrupt snapshot_hash, verify SUPERVISED_PAUSE triggered

### Performance tests

- Pre-filter retrieval: <1ms on 10,000 memory objects
- Kernel re-rank: <50ms on 20 candidates
- Full `recall()` roundtrip: <200ms
- MICRO_SLEEP duration: <5min on 50-job queue
- WAL concurrency: simultaneous read (WAKE) and write (sleep) without locking error

---

## 22. Out of scope for this version

The following are explicitly not implemented. The architecture does not preclude them but they are V2+ work:

- **Fleet orchestration** — no multi-agent coordination, no SleepOrchestrator
- **Cross-agent semantic synchronization** — no consensus protocol for shared beliefs
- **Multi-modal memory** — text only; no image or audio embeddings
- **Kernel continual learning** — fine-tuning is manual/triggered, not online
- **Streaming task execution** — tasks are processed sequentially, not streamed
- **Graphical UI** — all interaction is CLI and file-based
- **Remote agent deployment** — agent directory is local; no networked agent hosting
- **Authentication/authorization** — no access control beyond file system permissions
- **Encryption at rest** — identity log and memory stores are plaintext

---

## Appendix A: Configuration reference (`agent.yaml`)

```yaml
agent_id: "uuid"
name: "Aria"
role: "Research assistant"
archetype: "researcher"
authority_tier: 1
sleep_state: "WAKE"                    # runtime state — do not edit manually
created_at: "ISO8601"

sleep_schedule:
  full_sleep_cron: "0 2 * * *"        # nightly at 2am
  idle_timeout_seconds: 300
  micro_sleep_budget_seconds: 120
  full_sleep_budget_seconds: 1800
  queue_soft_limit: 50
  queue_hard_limit: 200

context:
  total_budget_tokens: 8000

memory:
  activation:
    downscale_factor: 0.85
    episodic_decay_exponent: 0.5
    semantic_decay_exponent: 0.2
    procedural_decay_exponent: 0.1
    saturation_threshold: 20
    intention_boost_multiplier: 1.3
    intention_boost_max: 1.6
    citation_rate_ema_alpha: 0.1

retrieval:
  prefilter_top_n: 20
  rerank_confidence_threshold: 0.4

intentions:
  stale_intention_days: 3

kernel:
  classification_model: "ModernBERT-large"
  generative_model: "llama3.2:3b"
  fine_tuned: false
  socket_path: "memory/kernel/kernel.sock"

execution_llm:
  provider: "anthropic"
  model: "claude-sonnet-4-6"
  max_tokens: 4096

approval:
  timeout_hours: 24
  poll_interval_seconds: 5

instrumentation:
  citation_tracking_enabled: true
  citation_coverage_min_threshold: 0.70
  coverage_window_days: 7

identity:
  compaction_trigger_entry_count: 10000
```

---

## Appendix B: `tool_policies.yaml` default

```yaml
defaults:
  unknown_tool: block
  rate_limit_window_seconds: 60

tools:
  web_search:
    status: allow
    rate_limit: 10
  file_read:
    status: allow
    rate_limit: 50
  file_write:
    status: require_approval
    approval_scope: tool_call
  shell_exec:
    status: block
  arxiv:
    status: allow
    rate_limit: 5
```

---

## Appendix C: Archetype — `base.yaml`

```yaml
name: "base"
description: "Minimal archetype. All other archetypes extend this."

constitution:
  - "Do not fabricate information"
  - "Surface uncertainty explicitly"
  - "Escalate decisions that exceed authority tier via request_approval"
  - "Never modify the identity log outside permitted scopes"

personality:
  communication_style: "neutral"
  risk_disposition: "balanced"
  verbosity: "medium"
  ambiguity_handling: "ask"

cognitive_priors:
  domain: "general"
  trusted_tools: []
  skepticism_level: "medium"
  preferred_reasoning_style: "balanced"

authority_tier: 1
```

