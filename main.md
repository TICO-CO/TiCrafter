# TiCrafter — Fleet of Autonomous Minecraft 1.20.1 Agents

## Locked decisions

- Minecraft **1.20.1**, LAN server, offline auth, no public server.
- **Two hardware profiles, one repo:** `home-min` (i5-7400, 15GB, GT 710) and `home-full` (R7 5700X, 32GB, RX 7600).
- `home-min`: **4 bots default** (8 only as an overload test). `home-full`: **8 bots**.
- **Laya execution provider:** CPU on `home-min`; `["webgpu","cpu"]` on `home-full`, automatic CPU fallback.
- **LAN defaults:** `localhost:25565`, name pool `["TiBot1" … "TiBot8"]`; bot index `i` gets `names[i]`.
- Bots all share **one common infrastructure plan** (SIP) so they do not override each other.
- Bots are **self-motivated agents**, not task workers. Each bot owns needs, personality, goals, intention, routine, home, social memory, and relationships.
- The coordinator coordinates world state, claims, grants, jobs, and persistence. It does not choose every bot action.
- The **task board is an opt-in job market**. Jobs are offers; bots accept, defer, or decline with a reason.
- **Cloud planner:** Muse Spark 1.3 Contributor via an OpenAI-compatible endpoint ("opencode"). The planner is an optional strategic advisor, not a fleet boss.
- The local agency loop runs with the planner disabled and with no seed tasks.
- **Short-term decision model:** Laya (`@receptron/laya`, Node/ONNX). Typed `choice`/`score`/`noul` only, no text.
- **Execution:** mineflayer.
- **Building:** all three layers — procedural templates, schematic import, LLM composition into a Blueprint IR.
- Bots **may modify existing builds/farms**, under coordination, logging, and rollback rules.
- **Active builds are private by default.** A non-owner may edit only through an explicit scoped grant that confirms compatibility with the owner's current plan.
- Bots persist identity, personality, needs, intention, home, relationships, claims, and skill checkpoints; restart resumes last state.
- **Social behavior is local, typed, and rate-limited.** Bots chat, build trust, share, and cooperate without a cloud dependency.
- Dev-only Python allowed for Laya fine-tuning; **runtime stays Bun-only**.
- **Self-contained bootstrap:** missing deps and apps install into repo-local, gitignored paths. No global installs or system package manager.
- Infrastructure recognition: paths, houses, farms, walls, bridges, storage, workstations.

## Capacity profiles

Same codebase, selected by `HARDWARE_PROFILE` (`home-min` | `home-full`).

**`home-min` — measured**

- 4 CPU cores (4C/4T), 15GB RAM, GT 710 (1GB) — GPU unusable.
- Laya fp32 ONNX ≈1.7GB download, ≈2GB RAM, **one forward pass at a time**.
- Tactical budget: one shared Laya instance, ~4 decisions/sec fleet-wide.
- 4 bots ≈0.6–0.8GB for mineflayer processes; coordinator + SQLite <1GB; Laya ≈2GB. Total ≈3.5–4GB, fits — though the host currently has ~9GB already used by other applications.
- Set Laya `intraOpNumThreads=3`; leave 1 core for pathfinding.
- Stagger bot decision heartbeats; each bot mostly runs deterministic skills between decisions.
- Target 4 bots; test at 4 and 8. 8 is an overload test, not the default.

**`home-full` — target (measure before trusting)**

- 8 CPU cores (8C/16T), 32GB DDR4, RX 7600 8GB (RDNA3, `gfx1102`).
- 8 bots ≈1.2–1.6GB; coordinator + SQLite <1GB; Laya ≈2GB. Total ≈5GB of 32GB.
- Laya on CPU: `intraOpNumThreads=8`, still leave headroom for pathfinding.
- Laya on WebGPU: model weights ≈2–3GB VRAM including activations; shared with the desktop.
- Target 8 bots. Raise decision rate only after measuring p50/p95 latency and stability.
- No ROCm path: `onnxruntime-node` ships no ROCm EP. WebGPU on Linux x64 is experimental; CPU is the fallback.

**Both profiles**

- **Do not** run one Laya instance per bot. One model, central decision service.
- Enforce a single in-flight forward pass per coordinator; batch questions from one decision request.
- If WebGPU fails to initialize, crashes, or is slower than CPU at p95, fall back to CPU automatically and log the downgrade.

**Benchmark — measured 2026-11-10**

- fp16 ONNX bundle: 808MB vs 1.6GB fp32. Keep float32 model I/O; convert internal weights only.
- fp16 WebGPU, 577-token compact request with all three questions: p50 137–180ms, p95 140–188ms over 200 requests.
- fp32 WebGPU, same request: p95 ≈613ms. fp16 CPU on `home-full`: p95 ≈1.0s.
- fp16 CPU on `home-min`, 3 threads, same compact request: p50 1828ms, p95 1906ms over 200 requests.
- 908-token prompt: p95 ≈835ms even with fp16. Total input tokens must stay ≤600 for the three-question request.
- WebGPU VRAM delta ≈1GB; process RSS peak <1.2GB.
- WebGPU-to-CPU fallback verified by forcing WebGPU load failure: report keeps `requestedProvider=webgpu`, records `provider=cpu` and the fallback reason.
- 2h WebGPU stability remains a milestone 2 exit criterion.

## Architecture

```
                 ┌────────────────────────────────────────────┐
                 │ Fleet Coordinator (one Bun process)        │
                 │  • Shared Infrastructure Plan (SIP)        │
                 │  • Shared world model + landmark DB        │
                 │  • Task board + atomic claims + leases     │
                 │  • Edit grants + compatibility checks      │
                 │  • Bot profiles, roles, checkpoints        │
                 │  • Agency state and episode persistence    │
                 │  • Job offers and bot-facing claims        │
                 │  • Laya decision service (one model)       │
                 │  • Optional planner advisor (Muse Spark)   │
                 │  • SQLite WAL, event log, metrics          │
                 └───────────────▲────────────────────────────┘
                                 │ localhost WebSocket / IPC
        ┌────────────────────────┼────────────────────────┐
   ┌────▼─────┐            ┌─────▼────┐              ┌────▼─────┐
   │ Bot 1    │            │ Bot 2    │    ...       │ Bot 8    │
   │ mineflayer│           │ mineflayer│             │ mineflayer│
   │ perception│           │ perception│             │ perception│
   │ reflex    │           │ reflex    │             │ reflex    │
   │ needs     │           │ needs     │             │ needs     │
   │ goals     │           │ goals     │             │ goals     │
   │ social    │           │ social    │             │ social    │
   │ skills    │           │ skills    │             │ skills    │
   │ builder   │           │ builder   │             │ builder   │
   └──────────┘            └──────────┘              └──────────┘
```

Logic is four-tier:

1. **Reflex guardian** — deterministic, 20Hz, local to each bot. Final veto always.
2. **Agency** — local needs, personality, goal generation, intention commitment, routine, and social reasoning.
3. **Laya** — shared decision service, ~0.5–2Hz per bot, advises among needs and goal candidates.
4. **Cloud planner** — optional fleet-level advisor, event-driven every 60–300s. Emits strategic goals, SIP revisions, and job proposals only.

Priority: **guardian > urgent needs > agency intention > Laya advice > planner advice**. No model ever calls mineflayer directly.

## 1. Fleet Coordinator

Single process for LAN simplicity; can later split into services. Fleet size, Laya execution provider, and thread counts are profile-driven, not constants.

Responsibilities:

- Own the **SIP** (canonical intended world state).
- Own the **task board**, job offers, claims, leases, fencing tokens, and edit grants.
- Merge perceptual updates from all bots into one world model.
- Persist bot agency state: needs, intention, home, routines, episodes, and relationships.
- Offer jobs to bots and expose bot-facing claims for personal projects.
- Host the single Laya instance and serialize/rate-limit decisions.
- Call the optional cloud planner and apply validated strategic revisions.
- Persist everything to SQLite (WAL) and an append-only event log.
- Expose ops endpoints: status, agency state, pause bot, pause fleet, dump SIP, metrics.

Crash isolation: one coordinator process; each bot runs in its own child process. Bots can reconnect; claims expire by lease.

## 2. Shared Infrastructure Plan (SIP)

The SIP is the contract that prevents bots from overwriting each other. It is separate from observed world state.

```ts
SIP {
  revision: number
  zones: [{ id, name, type: "base"|"farm"|"forest"|"mining"|"road"|"reserve"|"no_build",
            polygon, priority }]
  structures: [{
    id, type, blueprintRef, anchor, rotation,
    status: "planned"|"claimed"|"building"|"complete"|"failed"|"abandoned",
    ownerBotIds: string[],
    designRevision: number,
    collaboration: "private" | "invite" | "open",   // default "private"
    autoAcceptCompatibleHelpers: boolean,           // default false
    progress, materialsNeeded, lease?,
    workPackages: [{ id, bbox, status, claimedBy?, lease? }]
  }]
  roads: [{ id, polyline, width, material, segments, status, ownerBotIds }]
  farms: [{ id, plots: [{ id, bbox, crop, waterSource, growth, assignedBot? }],
            status, ownerBotIds }]
  containers: [{ id, pos, role: "storage"|"food"|"tools"|"fuel",
                 reservedBy?, contentsSnapshot }]
  pathGraph: { nodes, edges }
  rules: { protectedBboxes, allowedEdits, noBreakUnderActiveBot: true }
}
```

Rules:

- **Versioned**: every change increments `revision`.
- **Propose → validate → commit**: planner/bot proposes a mutation; coordinator checks spatial overlap, zone rules, dependencies; commits transactionally.
- **Reconciliation job**: compare world model vs SIP; update structure progress; detect deviations; allow planner to revise because edits are permitted.
- **Change log**: block before/after, actor, planId, grantId, timestamp. Supports rollback of any bot's changes.

## 3. Collaboration on active builds

Active structures are private by default. Help requires an explicit scoped grant.

New table:

```ts
edit_grants {
  id, structureId, designRevision, granteeBotId,
  bbox, allowedOps: ("place"|"break"|"replace")[],
  materialConstraints?, expiresAt, fencingToken,
  grantedBy: "owner" | "coordinator", createdAt
}
```

Rules:

- Grants are scoped to a bbox + operation set + one design revision.
- Any design revision change invalidates outstanding grants.
- Every edit carries the grant id and fencing token; commits without them are rejected.
- Shared infrastructure (roads, farms, storage) uses role-based policies instead of single-owner privacy.

Protocol:

1. Requester observes an active structure and submits `editRequest { structureId, observedDesignRevision, intent, proposedOps, bbox, taskId }`.
2. Coordinator loads the structure policy.
3. **open** → coordinator issues a scoped grant immediately.
4. **invite** → owner bot's deterministic compatibility policy evaluates:
    - design revision matches,
    - proposed ops do not undo completed work or collide with another bot's claimed work package,
    - preserves load-bearing/structural invariants and zone rules,
    - reduces remaining work or repairs damage,
    - materials/requirements feasible.
5. Approved → grant issued. Denied → reason returned; requester may retry with a modified proposal or request a planner-mediated joint task.
6. **Owner offline** → coordinator applies the owner's persisted `autoAcceptCompatibleHelpers` plus the same compatibility check. Default is **deny**.
7. All grants expire; lease heartbeat renews; revocation is immediate via fencing token bump.
8. Every edit is journaled with `grantId`, actor, before/after blocks, and is rollback-capable.

Optional escalation: if compatibility is ambiguous, the cloud planner arbitrates once, but it still cannot bypass safety rules.

## 4. Claims, leases, task board

- Claim resource types: structure, build work package, farm plot, container, road segment, tree/resource area.
- Claim fields: `{id, resourceType, resourceId, bbox, botId, leaseUntil, fencingToken, status}`.
- Acquisition is one SQLite transaction; overlap check includes margin.
- **Fencing token**: executor must present token on every commit; stale token rejected.
- Lease TTL + heartbeat; expired claims reclaimed to `planned`.
- Task board holds dependencies, preconditions, priority, retries, dead-letter state.
- The task board is a **job market**: coordinator offers eligible jobs; a bot accepts, defers, or declines with a reason.
- Declining a job is a normal outcome and never a failure. Deferred jobs stay open for another bot or a later tick.
- Bots may propose **personal projects** and acquire claims for their own bbox through the coordinator.
- Claims still guarantee single-writer execution. No duplicate work by construction.
- Contention metrics: claim wait, reclaimed leases, duplicate attempts, declined jobs, deferred jobs.

## 5. Bot identity, roles, and persistence

Persistent per-bot profile, loaded on connect and saved continuously:

```ts
BotProfile {
  botId, username, uuid, createdAt, lastSeen,
  role: "builder"|"farmer"|"miner"|"scout"|"hauler"|"guard",
  traits: { curiosity, industriousness, caution, sociability,
            ambition, orderliness, patience },
  behavior: { riskTolerance, workRadius, sociability, preferredBaseId },
  currentTaskId?, currentSkill?, currentStructureId?,
  needs: { safety, hunger, rest, materials, tools,
           shelter, social, novelty, achievement },
  intention?: { goalId, label, step, startedAt, deadline },
  routine: { phase, lastMealAt, lastRestAt },
  homeStructureId?, personalStorageId?,
  activeClaimIds: [],
  relationships: { botId, trust, interactions, lastInteractionAt }[],
  permissions: { editGrantIds: [] },
  lastWorldVersion, lastSipRevision
}
```

SQLite tables:

- `bots` — profile, role, traits, behavior, status (`online`/`offline`/`suspended`).
- `agent_state` — current needs, intention, routine, home, mood, last goal tick.
- `agent_episodes` — append-only episodic memory: deaths, discoveries, gifts, chats, goal outcomes.
- `bot_events` — append-only log of decisions, task transitions, grants, failures, social events.
- `skill_checkpoints` — `(botId, taskId, skillId, stateJson, updatedAt)`.
- Claims and edit grants are coordinator-owned; bots reconnect to them by `botId`.

Restart / resume flow:

1. Bot connects; coordinator authenticates by `botId`/`username`.
2. Load profile, traits, behavior weights, needs, intention, routine, home, open claims, current job, skill checkpoint, and relationships.
3. Renew leases; release expired claims and requeue their jobs.
4. Delta sync: chunk versions, SIP revisions, job board, grants since `lastSeen`.
5. Reconcile the intention with the observed world before resuming.
6. Resume the intention and skill checkpoint if still valid; otherwise abandon the goal cleanly, record why, and let the bot choose a new goal.
7. Traits, needs, and relationships are restored, so the bot's choices stay consistent across restarts.

Semantics:

- "Pick up last state" means restore **intent and obligations**, then reconcile with the world — not blindly replay stale block positions.
- Offline bots keep their structures, homes, and policies; their claims expire after a grace period.
- Roles are persisted and influence the bot's work preferences and job fit. Default: fixed roles, with planner allowed to reassign temporarily.
- Personality traits are persisted and modulate need urgency, goal choice, chat style, and risk appetite.
- Usernames come from an ordered pool (`BOT_NAMES`); bot index `i` gets `names[i]`. Pool length must be ≥ `BOT_COUNT`; assignment is stable across restarts.

## 6. Perception → shared world model

Each bot samples loaded chunks on a ring (16–64 blocks configurable) and streams summaries to the coordinator.

- Sparse 3D occupancy grid; per-chunk snapshots; update on `blockUpdate`.
- Detection heuristics:
    - **Paths/roads**: standable-surface graph; corridor width 1–3; length ≥8; material hints.
    - **Houses**: enclosed interior air flood-fill; shell materials; doors, beds, windows, roof.
    - **Farms**: farmland moisture + adjacent water + crop age; cluster into plots.
    - **Storage/workstations**: chest/barrel/furnace/crafting table clusters; container memory.
    - **Walls/bridges/mineshafts**: linear features via PCA/RANSAC; deck-over-air detection.
- Landmarks: `{id, type, bbox, anchors, confidence, lastSeen, evidence, planId?}`.
- Merge rules: newest observation wins; confidence decays; conflicts flagged for re-verification.
- Blocks belonging to an **active planId** are tagged as in-progress, not natural infrastructure.
- Query API: `nearest(type)`, `insideBase(pos)`, `route(a,b)`, `isProtected(pos)`, `containerAt(pos)`, `whoOwns(bbox)`.
- Local agency inputs: nearby resource sites, food sources, shelter sites, danger sites, nearby players and bots, current time, weather, and last known home position.

## 7. Short-term decision service (Laya)

One shared `@receptron/laya` instance inside the coordinator.

Load configuration is profile-driven:

- `executionProviders`: `["cpu"]` on `home-min`; `["webgpu","cpu"]` on `home-full`.
- `sessionOptions.intraOpNumThreads`: 3 on `home-min`; 8 on `home-full` CPU path.
- **No ROCm EP** exists in `onnxruntime-node` for the RX 7600. WebGPU on Linux x64 is experimental, so benchmark it and keep CPU fallback.
- WebGPU uses the fp16 ONNX bundle with float32 I/O; fp32 remains the reference bundle.
- Decision-rate targets: ~4/sec fleet-wide on `home-min`; measure `home-full` and raise the cap only if p95 latency stays within budget.
- Latency gate: WebGPU warm-model p95 <250ms per decision request. The measured CPU path is ≈1.0s p95 on `home-full` and ≈1.9s on `home-min`, so CPU profiles need a revised latency target or a smaller model before claiming v1.
- Total request tokens: keep ≤600 for the three-question request. A 908-token prompt measured ≈835ms p95 even with fp16.

Per decision request from a bot:

- State digest ≤512 tokens: health, food, time, biome, y-level, target, 5-line inventory, nearby hazards/mobs, nearby players/bots, needs vector, active goal, goal candidates, current skill and progress, last result.
- Affordances: 8–16 legal goal or action candidates, each ≤12-word label.
- Questions:
    - `nextGoal: choice` over goal or action candidate ids.
    - `danger: noul` ("about to take damage or die?").
    - `shouldContinue: noul` ("current goal or skill still making progress?").
- Return `{choice, probabilities, answer_confidence, danger, latency}`.
- Concurrency: priority queue; per-bot rate limit; digest cache; timeout.
- **Confidence gate**: if `answer_confidence` < calibrated threshold (start 0.60), bot uses its deterministic utility policy.
- Bots always maintain a local deterministic fallback; Laya latency never blocks the 20Hz guardian or the agency tick.

Choice cardinality: keep ≤16. Laya options cap is 192 tokens total and recommends <20.

## 8. Long-term planner (Muse Spark 1.3 Contributor)

- OpenAI-compatible client. Config: `PLANNER_BASE_URL`, `PLANNER_API_KEY`, `PLANNER_MODEL="Muse Spark 1.3 Contributor"`.
- Load `PLANNER_BASE_URL`/`PLANNER_API_KEY` from process env, then gitignored `config/.env`. **No default URL**; the coordinator fails fast if either variable is missing. Commit `config/.env.example` with empty values.
- Optional strategic advisor, not a fleet boss.
- Fleet-level, not per-bot: proposes village/farm/road goals, project blueprints, SIP revisions, and job offers.
- Bots may defer or decline planner jobs when needs, safety, distance, or personality make the job unattractive.
- Triggers: interval, SIP conflict, job failure burst, death cluster, new landmark, chat request.
- Output: strict JSON validated with zod — goal stack, SIP mutations, task DAG, blueprint specs, recovery policy, notes.
- Validation before commit: schema, skill catalog references, material feasibility, distance, zone rules, budget.
- Invalid output: max 2 repair attempts, then keep the last good plan.
- Budget: calls/min cap, token cap, timeout, cancellation, plan cache.
- Planner never writes blocks; it only proposes SIP revisions, strategic goals, and jobs.

## 9. Skills

Interface: `canRun(ctx)`, `plan(ctx)`, `start/step/cancel`, `checkpoint/restore`, typed effects.

v1 skills: Navigate, FollowPath, Mine, Collect, Craft, Smelt, Eat, Deposit, Withdraw, Sleep, Flee/Defend, Explore, Bridge, Clear, PlaceBuild, SchematicBuild, Repair, HarvestFarm, PlantFarm.

Every skill reports progress and failure class for Laya/planner feedback.

## 10. Building (three layers)

Building is a first-class player capability, not template placement. Full design: [docs/building-system.md](docs/building-system.md).

Locked decisions:

- The deterministic composer is the authority. It turns a compact `BuildingBrief` into a valid, functional blueprint.
- The planner emits a brief, template choice, or schematic reference. It does not author raw block lists by default.
- Templates are motifs and quick sources, not the only building vocabulary.
- Single-bot arbitrary construction is the first milestone. Multi-bot construction follows.
- Site adaptation never mutates the canonical blueprint. Preparation and foundation changes belong to the construction plan.

Three layers:

1. **Design generation**: deterministic composer, motif library, style palette, schematic import, and observed-structure capture. Templates remain available as direct sources. Planner output is validated and composed before storage.
2. **Construction planning**: site selection, terrain adaptation, foundation, phased dependency graph, reachability and scaffolding, material procurement, and phase-aware work packages. Work packages are claimable and idempotent: blocks already correct are skipped.
3. **Coordinated execution**: verified block changes through the building executor, claims and grants, fencing tokens, progress reconciliation, completion, repair, renovation, and rollback.

Blueprint IR remains the block-level contract:

```ts
{ id, anchor, rotation, blocks: [{x,y,z,state,priority}],
  materials, constraints, workPackages? }
```

Executor invariants:

- Support-first, bottom-up ordering; reachability planning; scaffold fallback and cleanup.
- Per-block verification, rate limiting, and authoritative block changelog.
- Respect `rules.protectedBboxes`, no-build zones, active-bot exclusion, and never remove load-bearing blocks of occupied structures.
- Non-owner edits require a scoped grant; package execution requires a claim and fencing token.
- Rollback journal for every modification, including scaffolds and site preparation.
- Building goals are part of agency: shelter, personal home, expansion, repair, decoration, and social help.
- Block changes are watched through metrics, progress reconciliation, design revisions, and audit records.

## 11. Autonomy loop and safety

- 20Hz guardian: lava/void/fall/drowning, hostile mobs, hunger, stuck detection, path timeout, inventory full, claim lost.
- 1Hz agency tick: needs decay, opportunity scan, goal generation, routine check.
- 200–500ms skill step.
- Goal deliberation on need threshold, goal completion, failure, danger, social event, or 1Hz heartbeat.
- Laya called when goal scores are close, on repeated failure, or on a slow heartbeat. Agency utility policy is the default.
- Interruption order: guardian veto, urgent survival goal, active intention, accepted job, social or leisure goal, idle behavior.
- Recovery ladder: local retry → agency alternative goal → Laya alternative → planner advisory → safe mode → emergency stop.
- Goal abandonment is explicit: unsafe, infeasible, preempted, expired, conflicting claim, or social rejection. Abandonment is recorded in `agent_episodes`.
- Multi-bot safety even though edits are allowed:
    - non-owner edits to active builds require a valid, unexpired grant/fencing token;
    - never break blocks supporting an online bot;
    - never edit inside another bot's active work-package bbox unless the grant covers it;
    - owner-offline edits default to deny unless explicitly pre-authorized;
    - no fire/lava/TNT unless explicitly enabled;
    - every destructive change journaled and reversible;
    - coordinator restart must not orphan grants: tokens include a coordinator epoch and are revalidated.

## 12. Memory and persistence

SQLite (WAL) tables: `sip`, `sip_revisions`, `claims`, `edit_grants`, `tasks`, `bots`, `agent_state`, `agent_episodes`, `personal_projects`, `bot_events`, `skill_checkpoints`, `chunks`, `landmarks`, `structures`, `containers`, `episodes`, `block_changelog`, `metrics`.

- **Data directory:** `DATA_DIR`, default `./data`; holds the SQLite DB, event log, and block changelog. Gitignored.
- **Retention:** prune event logs and block changelogs after 30 days. Keep SQLite state until manual pruning.

Event log is append-only. Bot processes keep only short-lived local queues; coordinator is source of truth.

## 13. Repo layout

```
apps/coordinator/        SIP, job board, claims, grants, agency persistence,
                         Laya service, planner advisor, SQLite
apps/bot/                mineflayer lifecycle, perception stream, skill runtime,
                         agency loop, chat adapter
packages/core/           types, blackboard, event bus, zod schemas
packages/perception/     voxel sampler, chunk cache, detectors
packages/worldmodel/     world merge, landmark registry, reconciliation
packages/skills/         skill implementations
packages/building/       Blueprint IR, templates, schematic adapter, executor,
                         work packages, scaffold, rollback
packages/agency/         personality, needs, goals, intention, routine, social engine
packages/brains/         reflex, affordances, deterministic policy, Laya client
packages/safety/         deterministic safety evaluators, veto gate, recovery ladder
packages/planning/       planner client, prompt builders, validators, task DAG
packages/memory/         repositories, migrations, changelog
packages/eval/           scenario runner, metrics, replay, contention tests,
                         offline behavior simulator, trace inspector (milestone 16)
tools/bootstrap/         dependency and app provisioning, local server control
tools/architecture/      graph validator, renderers, SVG renderer
tools/laya-train/        dev-only Python: labeling, fine-tune, ONNX export
config/                  default.json, .env.example, scenarios/<id>.json,
                         profiles/home-min.json, profiles/home-full.json
package.json             workspace root, pinned deps, bootstrap scripts
bun.lock        committed lockfile
```

Repo-local, gitignored install roots: `node_modules/`, `.venv/`, `.cache/`, `.toolchain/`, `data/`, `models/`.

Profile selection env: `HARDWARE_PROFILE`, `BOT_COUNT`, `BOT_NAMES` (ordered array, default `["TiBot1" … "TiBot8"]`), `LAYA_EP` (`auto`|`cpu`|`webgpu`), `LAYA_THREADS`, `LAN_HOST=localhost`, `LAN_PORT=25565`, `DATA_DIR=./data`. Secrets: `PLANNER_BASE_URL`/`PLANNER_API_KEY` come from process env or gitignored `config/.env`; `config/.env.example` ships with empty values. Laya pins `onnxruntime-node ^1.22.0`; WebGPU on Linux x64 may require an override to a newer `onnxruntime-node` once validated.

Stack: `mineflayer`, `mineflayer-pathfinder`, `mineflayer-collectblock`, `mineflayer-crafting-util`, `prismarine-block/chunk/world`, `prismarine-schematic`, `@receptron/laya`, `zod`, `bun:sqlite`, `pino`, `ws`, `bun test`, dev-only `@mermaid-js/mermaid-cli`.

## 14. Laya training and calibration (dev-time Python, runtime Bun)

1. Log `(state digest, needs, goal candidates, chosen goal, action, outcome)` from deterministic policy and fleet runs.
2. Label with cloud teacher + outcome rewards: need satisfaction, progress, damage, time, materials, social outcome, goal completion.
3. Fine-tune Laya; export ONNX bundle into `models/`; load via `modelDir`.
4. Dev-time Python may use ROCm PyTorch on `home-full`, but the runtime remains Bun-only and loads only the exported ONNX bundle.
5. Fit per-question-type temperature on held-out traces.
6. Tune confidence gate to target precision (e.g. 0.90) against the deterministic baseline.
7. Promote only if it beats the deterministic policy end-to-end.

## 15. Testing and evaluation

- Unit: detector fixtures, SIP validation, claim transactions, edit grants, blueprint diff, guardian invariants, resume logic.
- Integration: repo-provisioned 1.20.1 server (`bun run server:start`), offline, superflat; bots join via LAN. Docker remains an optional alternative only.
- Hardware matrix: `home-min` runs the 4-bot scenarios; `home-full` runs the 8-bot scenarios. The 8-bot contention test is `home-full` only; 8 bots on `home-min` is an overload test.
- Laya benchmark: warm-model p50/p95 latency for CPU on both profiles and WebGPU on `home-full`. Hard gates: p95 <250ms and 2h with no crash or driver reset; adopt WebGPU only if it also beats CPU p95. Measured 2026-11-10: fp16 WebGPU compact p95 140–188ms; fp16 CPU p95 ≈1.0s on `home-full` and ≈1.9s on `home-min`; 908-token prompts p95 ≈835ms.
- Multi-bot scenarios:
    - 3 bots build one house without duplicate/conflicting blocks.
    - 2 bots race to claim a farm plot; only one proceeds.
    - road built by multiple bots from partitioned segments.
    - shared storage deposit/withdraw with reservations.
    - one bot edits an existing build while another is nearby; safety rules hold.
    - one bot requests a compatible edit grant while the owner is building → allowed and merged without duplicate work.
    - incompatible/undoing edit request → denied with reason.
    - owner offline with `autoAcceptCompatibleHelpers=false` → denied; `true` + compatible → allowed.
    - design revision bump mid-build → outstanding grants invalidated; no stale writes.
    - kill bot mid-build → restart → resumes task, lease, and checkpoint; no duplicate blocks.
    - kill coordinator during multi-bot build → restart → bots reconnect, leases recovered, SIP consistent.
    - 8-bot contention test: claim throughput, decision queue latency, no deadlock.
- Autonomy scenarios:
    - `autonomy-no-tasks`: planner off, seed jobs empty; bots survive, eat, shelter, gather, craft, and explore.
    - `personality-diversity`: different traits produce visibly different routines and choices.
    - `night-routine`: bots eat, shelter, sleep, and resume work.
    - `personal-homes`: bots build distinct homes without overlap or conflicting edits.
    - `social-village`: bots greet, share, cooperate, and update trust.
    - `goal-resume`: kill a bot mid-goal; restart resumes needs, intention, home, and claims.
    - `planner-advisory`: a planner project is accepted or deferred by local utility.
- Metrics: task success, goal success, goal abandonment, time, deaths, blocks/min, claim contention, duplicate work, idle time, self-initiated goals, need satisfaction, social interactions, chat rate, Laya accuracy/ECE, planner calls/tokens/cost.
- Soak test: 2+ hours on both profiles — 4 bots on `home-min`, 8 bots on `home-full`; no memory growth, no deadlocks, claims stable.
- Offline behavior validation (milestone 16, after all implementation milestones):
    - One scenario definition drives both `--mode simulate` and `--mode live`.
    - Simulated mode uses a fake world, inventory, and clock while running the real
      agency, planning, skill, and building code; no Minecraft server or mineflayer
      connection is required.
    - Live mode reuses the same scenario definitions and assertions against the
      repo-provisioned server.
    - Declarative checks cover goal sequence, need satisfaction, idle fraction,
      planner accept/defer/decline, duplicate block writes, build completion, and
      restart resume.
    - Reports render a per-bot decision timeline with goal choices, planner or Laya
      advice, skill outcomes, and building progress instead of raw events.
    - Commands:
      `bun tools/eval/run.mjs scenario <id> --mode simulate`,
      `bun tools/eval/run.mjs scenario <id> --mode live`,
      `bun tools/eval/run.mjs inspect <data-dir>`,
      `bun tools/eval/run.mjs check <data-dir> --scenario <id>`.

## 16. Milestones

1. **Scaffold**: workspace, config, coordinator, one bot joins LAN server, logging, persistence schema.
2. **Hardware profiles + Laya EP benchmark**: `home-min` CPU profile, `home-full` WebGPU/CPU selection, latency and fallback measurement.
3. **Perception + shared world model** for 2 bots; landmark persistence.
4. **Reflex + core skills**: survive, navigate, mine, gather, craft, deposit.
5. **SIP + claims + task board + collaboration grants + bot profiles/roles**.
6. **Building**: templates, schematic executor, work partitioning, rollback.
7. **Infrastructure recognition**: paths, houses, farms, walls, bridges, storage.
8. **Laya decision service**: central instance, affordances, digest, confidence gate, fallback.
9. **Cloud planner**: Muse Spark, schema, SIP revisions, budget guards; plan-revision arbitration for ambiguous edits.
10. **Calibration + fleet eval**: tune, measure, promote; 4 bots on `home-min`, 8 on `home-full`.
11. **Hardening**: restart/resume, soak tests, error taxonomy, ops controls, docs.
12. **Local agency core**: traits, needs, goal catalog, utility arbitration, intention manager, routine, personal goals with no planner and no seed jobs.
13. **Homes and job market**: personal homes, storage, projects, bot-facing claims, opt-in job offers with accept/decline.
14. **Social village**: chat, relationships, sharing, cooperation, body language, social goals.
15. **Player-like validation**: autonomy scenarios, 2-hour soak, Laya goal-choice calibration, v2 acceptance.
16. **Behavior validation harness**: offline simulator for agency, planning, and building; shared simulate/live scenario spec; declarative assertions; trace inspector; CI run without a server. This is intentionally last, after milestones 1–15. It validates those implementations and changes no runtime behavior.

**v1 done when:** 8 bots run unattended on `home-full` for 2 hours (4 bots on `home-min` with the same guarantees), maintain one consistent SIP, build/repair farms/houses/roads cooperatively, detect and reuse existing infrastructure, never overwrite active work without a valid grant, and resume their roles/tasks correctly after stop/restart.

**v2 done when:** bots run with the planner disabled and no seed jobs, pursue self-generated goals, build personal homes, maintain routines, decline unsuitable jobs, chat and cooperate, and resume needs, intentions, homes, and relationships after stop/restart without long idle drift or goal thrash.

**Harness done when:** behavior scenarios pass in simulated mode without a Minecraft server, live mode runs the same scenarios and assertions, failed checks produce readable evidence, and the trace inspector explains goal, planner, skill, and building decisions without manual log reading.

## 17. Risks and mitigations

- **Laya weak zero-shot** → deterministic fallback + fine-tune + confidence gate.
- **Laya throughput** → one instance, profile-specific tactical cadence, queue/rate limit, digest cache, single in-flight forward pass, ONNX threads 3 (`home-min`) / 8 (`home-full`).
- **WebGPU on RX 7600** → experimental on Linux x64; validate Mesa/Vulkan drivers, auto-fallback to CPU, adopt only if faster than CPU p95 and stable for 2h with no crash or driver reset.
- **VRAM contention** → WebGPU shares 8GB with the desktop; cap session memory, monitor, fall back to CPU.
- **home-min CPU bottleneck** → 4 bots default; 8 bots only as an overload test; stagger heartbeats.
- **home-min RAM headroom** → host already has ~9GB used; check free memory before starting the fleet.
- **Fake-world drift** → keep agency, planning, skill, and building code real in the simulation harness; fake only world, inventory, clock, and transport ports. Keep live mode for physics and integration signoff.
- **onnxruntime-node/Laya version mismatch** → Laya pins `^1.22.0`; WebGPU may require a newer validated override.
- **Multi-bot conflicts** → SIP revisions, atomic claims, leases + fencing tokens, idempotent placement, edit grants.
- **Coordinator single point of failure** → restart + lease expiry + SQLite recovery + coordinator epoch; distributed mode deferred.
- **Stale bot state after restart** → delta sync + reconcile with world before resuming.
- **Pathfinding/terrain failures** → bridge/scaffold, replan, region blacklist.
- **Placement physics/reach** → reachability planner, verification, rollback.
- **Cloud cost/latency** → fleet-level event-driven planning, caps, caching, local fallback.
- **Server anti-cheat/rate limits** → configurable action rate, no impossible reach.
- **Goal thrash** → utility hysteresis, minimum commitment time, explicit abandonment reasons.
- **Utility runaway** → need caps, cost and risk terms, guardian veto, deterministic policy audit.
- **Planner-bot disagreement** → jobs are offers; bots decline or defer with a reason.
- **Chat spam or harassment** → per-bot rate limits, typed intents, local moderation, operator mute.
- **Personal project claim deadlock** → lease TTL, release on abandonment, coordinator conflict resolution.
- **Agency state drift after restart** → restore needs and intention, then reconcile with world before resuming.
- **Laya out of distribution on goal choices** → deterministic utility primary, calibrated confidence gate, fine-tune later.

## 18. Resolved defaults

1. **LAN:** `localhost:25565`. Ordered `BOT_NAMES` pool (`TiBot1`–`TiBot8`); bot index `i` gets `names[i]`, stable across restarts. See §5 and §13.
2. **Planner:** `PLANNER_BASE_URL`/`PLANNER_API_KEY` from process env or gitignored `config/.env`; no default URL; fail fast if missing. See §8.
3. **Owner-offline edits:** deny by default; compatibility check only when `autoAcceptCompatibleHelpers=true`. See §3 and §11.
4. **Roles:** fixed and persisted; traits and needs modulate job fit and goal choice; planner may reassign temporarily, then restore the fixed role. See §5 and §20.
5. **Persistence:** `DATA_DIR=./data`; prune event logs and block changelogs after 30 days; keep SQLite state until manual pruning. See §12.
6. **Laya latency:** WebGPU warm-model p95 <250ms per decision request with ≤600 input tokens. The CPU path currently misses this target at ≈1s p95 on `home-full` and ≈1.9s on `home-min`. See §7 and §15.
7. **WebGPU:** default on `home-full` only if faster than CPU p95 and stable for 2h with no crash or driver reset; otherwise CPU. See §15 and §17.
8. **Remaining validation:** 2h WebGPU stability is a milestone 2 exit criterion, not an open design question. `home-min` and `home-full` latency, RAM, and fallback are measured. See §16.
9. **Agency:** local, deterministic-first, always available. Planner and Laya are advisors. See §20.
10. **Jobs:** opt-in offers. Bots accept, defer, or decline with a reason. Declining is never a failure. See §4.
11. **Social:** local typed chat, 2–5 messages/minute per bot, no cloud dependency. See §21.
12. **Agency persistence:** dedicated `agent_state` and `agent_episodes` tables; relationships stay with the bot profile. See §12.

## 19. Self-contained bootstrap

`bun tools/bootstrap/bootstrap.mjs` is the only supported entry point for provisioning. It installs everything into repo-local, gitignored paths and reuses it on later runs.

- **Full by default:** Bun deps, Python training env, local Java 17, and the Minecraft 1.20.1 server jar. Opt out with `--no-python`, `--no-server`, `--no-bun`, or `--no-browser`.
- **Repo-local only:** `node_modules/`, `.venv/`, `.cache/`, `.toolchain/`, `data/`, `models/`. No `bun -g`, `sudo`, or `apt`.
- **Pinned and verified:** `tools/bootstrap/manifest.json` holds download URLs and checksums. Python requirements are pinned; PyTorch follows `PYTORCH_VARIANT` or `HARDWARE_PROFILE` (`cpu` for `home-min`, `rocm` for `home-full`).
- **Install scripts denied:** dependency lifecycle scripts are blocked. Verified prebuilt binaries cover `onnxruntime-node` and `esbuild`. Chromium is never downloaded.
- **Diagram rendering:** Mermaid CLI uses the installed Firefox through `.cache/mermaid/puppeteer.json`. Override with `FIREFOX=/path/to/firefox`. Fenced Mermaid stays the default when Firefox is absent.
- **Minecraft EULA:** accepting it is explicit. `bun run server:start` refuses to start until `data/minecraft/eula.txt` exists. Run `bun run server:start:accept-eula` once to write it and start the server; running that command means accepting the [Minecraft EULA](https://aka.ms/MinecraftEULA). Later starts can use `bun run server:start`.
- **Disk guard:** bootstrap estimates pending install size, prints free space, and aborts before downloading when the full profile cannot fit. `--check` reports without installing; `--clean` forces `bun install --frozen-lockfile`.
- **Low-priority I/O:** `bun install` runs under `nice`/`ionice` when available with a repo-local cache.

Verification: `bun run bootstrap:check`, `bun run validate:graph`, `bun run render:graphs`, `bun run render:svg`, `bun test`.

## 20. Agency and motivation

Bots are self-directed agents. The agency layer runs locally inside each bot process and works with the planner disabled and with no seed jobs.

```ts
AgencyState {
  botId
  traits: { curiosity, industriousness, caution, sociability,
            ambition, orderliness, patience }
  needs: { safety, hunger, rest, materials, tools,
           shelter, social, novelty, achievement }
  intention: { goalId, label, step, createdAt, deadline, attempts } | null
  routine: { phase, lastMealAt, lastRestAt }
  homeStructureId, personalStorageId
  mood
  lastDeliberationAt
}

Goal {
  id, kind, label, priority
  target?: Vec3
  steps: GoalStep[]
  successCriteria
  estimatedCost, estimatedRisk, expectedValue
  deadline?, source: "need"|"job"|"social"|"curiosity"|"routine"
}
```

Needs:

- `safety` — nearby threat, health, light level, lava, void, fall risk.
- `hunger` — food level and available food.
- `rest` — time of day, exhaustion, bed availability.
- `materials` — wood, stone, food stock, building stock.
- `tools` — required tool tiers for current goals.
- `shelter` — home validity, distance from home, night exposure.
- `social` — time since interaction, nearby players/bots, unresolved requests.
- `novelty` — time since exploration, unexplored landmarks, monotony.
- `achievement` — unfinished personal projects, role goals, mastery.

Personality traits are seeded from bot index, persisted, and modulate urgency, cost tolerance, goal diversity, chat style, and risk appetite. Traits never override the guardian.

Goal generation:

- Collect needs, inventory, world model, landmarks, time, nearby entities, home, relationships, active job, and recent episodes.
- Emit 4–12 concrete goal candidates.
- Each candidate maps to existing skills or a local multi-step plan.
- Reject illegal or unsafe candidates before scoring.

Goal arbitration:

- Score `urgency × trait weight × expected value × feasibility − cost − risk`.
- Add commitment hysteresis; an active intention keeps a bonus until completion, abandonment, or preemption.
- Ask Laya only when top scores are close, after repeated failure, or on a slow heartbeat.
- Below the confidence gate, use the deterministic utility policy.

Intention lifecycle:

- `propose → select → execute → complete | abandon | preempt`.
- Abandonment reasons: `unsafe`, `infeasible`, `preempted`, `expired`, `claim_conflict`, `social_rejection`.
- Record every outcome in `agent_episodes`.
- Restart restores the intention, reconciles it with the observed world, then resumes or abandons.

Routine:

- Morning: eat, check needs, resume project or accept a job.
- Day: work, gather, build, farm, explore, socialize.
- Evening: deposit, craft, visit home, chat.
- Night: shelter, sleep if a bed exists, or keep working with caution.
- Routine is a prior, not a script.

Personal homes and projects:

- Each bot may claim a home area, bed, and storage.
- Personal projects request claims and, when needed, SIP structure proposals.
- Shared areas and other bots' active builds still require grants.
- Project abandonment releases claims and leaves a recorded episode.

Persistence:

- `agent_state` stores current needs, intention, routine, home, mood, and last deliberation time.
- `agent_episodes` stores episodic memories: deaths, discoveries, gifts, chats, builds, goal outcomes.
- Relationships stay in the bot profile.

Boundaries:

- Agency never calls mineflayer.
- Agency never writes SIP, claims, or grants.
- Agency emits goal and skill proposals.
- Skills act through the action executor.
- The guardian can veto any agency, Laya, or planner proposal.

## 21. Social behavior

Social behavior is local, typed, and rate-limited. It does not require the cloud planner.

Chat intents:

- `greeting` — first meeting or return after absence.
- `status` — short answer about current goal or needs.
- `request` — ask for help, food, material, or coordination.
- `offer` — share food, tools, materials, or help.
- `danger` — warn nearby bots or players.
- `discovery` — mention a landmark, resource, or build.
- `small_talk` — low-priority idle chatter.

Conversation engine:

- Parse direct messages into typed intents.
- Reply with personality-styled local templates.
- Optional richer text later, but never block the agency loop on a model.
- Ignore malformed or hostile messages. Never echo arbitrary text.
- Rate limit: 2–5 messages/minute per bot, configurable.
- Cooldown per conversation and per intent.
- Operator mute through ops.

Relationships:

- Track trust, interactions, last interaction, gifts, and help given/received.
- Cooperation, gifts, and positive chat raise trust.
- Ignored requests or unsafe behavior lower trust.
- Trust influences goal weight for helping, sharing, and socializing.
- `bots.relationship-store` remains the owner.

Social goals:

- Greet a nearby player or bot once per encounter.
- Check on a friend who has not been seen recently.
- Share food when another bot's hunger need is high.
- Offer help on a friend's active project when compatible.
- Invite help on an own project.
- Warn about danger.
- Explore together or follow for a short time.

Body language:

- Look at nearby players and bots.
- Pause briefly after conversations.
- Inspect held item or nearby block.
- Short wander during idle.
- No fake actions and no impossible reach.

Safety and abuse:

- Social actions never bypass the guardian.
- No fire, lava, TNT, or destructive social actions.
- Chat rate, content type, and recipients are bounded.
- Ops can mute one bot or the fleet.

## 22. Player-like acceptance

v2 acceptance is measured with the planner disabled and `config/seed-tasks.json` empty.

Acceptance scenarios run in `--mode simulate` first for fast feedback. `--mode live` is the final integration signoff; both modes use the same scenario definitions and assertions.

Required behavior:

- Each bot survives at least 30 minutes without operator intervention.
- Each bot eats before starvation, shelters or sleeps at night, and avoids known hazards.
- Each bot completes multiple self-initiated goals covering at least three categories: survival, resources, shelter, exploration, social, or projects.
- Each bot maintains a personal home or shelter with a bed and storage.
- Bots decline or defer unsuitable jobs with a recorded reason.
- Bots greet, reply, share, and cooperate at a bounded chat rate.
- Personal projects acquire claims and never overlap another bot's home or active build.
- Restart restores needs, intention, home, claims, and relationships before new work begins.

Required scenarios:

- `autonomy-no-tasks`
- `personality-diversity`
- `night-routine`
- `personal-homes`
- `social-village`
- `goal-resume`
- `planner-advisory`

Required metrics:

- Idle fraction below 20% while awake.
- Self-initiated goals per bot per 10 minutes.
- Need satisfaction trends.
- Goal completion and abandonment rates.
- Deaths by cause.
- Exploration distance and new landmarks.
- Chat messages per minute and social interactions.
- Claim conflicts and duplicate work.
- Planner jobs accepted, deferred, and declined.

Required soak:

- 2 hours, 4 bots on `home-min`.
- 2 hours, 8 bots on `home-full`.
- No memory growth above the soak gate.
- No deadlocks.
- No unbounded goal churn.
- Claims stable.
- Bots still pursuing goals at the end of the run.
