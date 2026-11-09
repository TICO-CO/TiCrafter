# TiCrafter — Fleet of Autonomous Minecraft 1.20.1 Agents

## Locked decisions

- Minecraft **1.20.1**, LAN server, offline auth, no public server.
- **Two hardware profiles, one repo:** `home-min` (i5-7400, 15GB, GT 710) and `home-full` (R7 5700X, 32GB, RX 7600).
- `home-min`: **4 bots default** (8 only as an overload test). `home-full`: **8 bots**.
- **Laya execution provider:** CPU on `home-min`; `["webgpu","cpu"]` on `home-full`, automatic CPU fallback.
- **LAN defaults:** `localhost:25565`, name pool `["TiBot1" … "TiBot8"]`; bot index `i` gets `names[i]`.
- Bots all share **one common infrastructure plan** (SIP) so they do not override each other.
- **Cloud planner:** Muse Spark 1.3 Contributor via an OpenAI-compatible endpoint ("opencode").
- **Short-term decision model:** Laya (`@receptron/laya`, Node/ONNX). Typed `choice`/`score`/`noul` only, no text.
- **Execution:** mineflayer.
- **Building:** all three layers — procedural templates, schematic import, LLM composition into a Blueprint IR.
- Bots **may modify existing builds/farms**, under coordination, logging, and rollback rules.
- **Active builds are private by default.** A non-owner may edit only through an explicit scoped grant that confirms compatibility with the owner's current plan.
- Bots persist identity, role, behavior profile, current task, claims, and skill checkpoints; restart resumes last state.
- Dev-only Python allowed for Laya fine-tuning; **runtime stays Node-only**.
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

## Architecture

```
                 ┌────────────────────────────────────────────┐
                 │ Fleet Coordinator (one Node process)       │
                 │  • Shared Infrastructure Plan (SIP)        │
                 │  • Shared world model + landmark DB        │
                 │  • Task board + atomic claims + leases     │
                 │  • Edit grants + compatibility checks      │
                 │  • Bot profiles, roles, checkpoints        │
                 │  • Laya decision service (one model)       │
                 │  • Cloud planner client (Muse Spark)       │
                 │  • SQLite WAL, event log, metrics          │
                 └───────────────▲────────────────────────────┘
                                 │ localhost WebSocket / IPC
        ┌────────────────────────┼────────────────────────┐
   ┌────▼─────┐            ┌─────▼────┐              ┌────▼─────┐
   │ Bot 1    │            │ Bot 2    │    ...       │ Bot 8    │
   │ mineflayer│           │ mineflayer│             │ mineflayer│
   │ perception│           │ perception│             │ perception│
   │ reflex    │           │ reflex    │             │ reflex    │
   │ skills    │           │ skills    │             │ skills    │
   │ builder   │           │ builder   │             │ builder   │
   └──────────┘            └──────────┘              └──────────┘
```

Logic is three-tier:

1. **Reflex guardian** — deterministic, 20Hz, local to each bot. Final veto always.
2. **Laya** — shared decision service, ~0.5–2Hz per bot, proposes next action from enumerated affordances.
3. **Cloud planner** — fleet-level, event-driven every 60–300s. Emits plans/tasks only.

Priority: **guardian > Laya > planner**. No model ever calls mineflayer directly.

## 1. Fleet Coordinator

Single process for LAN simplicity; can later split into services. Fleet size, Laya execution provider, and thread counts are profile-driven, not constants.

Responsibilities:

- Own the **SIP** (canonical intended world state).
- Own the **task board**, claims, leases, fencing tokens, and edit grants.
- Merge perceptual updates from all bots into one world model.
- Host the single Laya instance and serialize/rate-limit decisions.
- Call the cloud planner and apply validated plan revisions.
- Persist everything to SQLite (WAL) and an append-only event log.
- Expose ops endpoints: status, pause bot, pause fleet, dump SIP, metrics.

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
- Bots atomically claim the next eligible task. No duplicate work by construction.
- Contention metrics: claim wait, reclaimed leases, duplicate attempts.

## 5. Bot identity, roles, and persistence

Persistent per-bot profile, loaded on connect and saved continuously:

```ts
BotProfile {
  botId, username, uuid, createdAt, lastSeen,
  role: "builder"|"farmer"|"miner"|"scout"|"hauler"|"guard",
  behavior: { riskTolerance, workRadius, sociability, preferredBaseId },
  currentTaskId?, currentSkill?, currentStructureId?,
  activeClaimIds: [],
  homeStructureId?, relationships: { botId, trust, interactions }[],
  permissions: { editGrantIds: [] },
  lastWorldVersion, lastSipRevision
}
```

SQLite tables:

- `bots` — profile, role, behavior, status (`online`/`offline`/`suspended`).
- `bot_events` — append-only log of decisions, task transitions, grants, failures.
- `skill_checkpoints` — `(botId, taskId, skillId, stateJson, updatedAt)`.
- Claims and edit grants are coordinator-owned; bots reconnect to them by `botId`.

Restart / resume flow:

1. Bot connects; coordinator authenticates by `botId`/`username`.
2. Load profile, role, behavior weights, open claims, current task, skill checkpoint.
3. Renew leases; release expired claims and requeue their tasks.
4. Delta sync: chunk versions, SIP revisions, task board, grants since `lastSeen`.
5. Resume skill from checkpoint if still valid; otherwise cleanly requeue and replan.
6. Role and behavior are restored, so the bot's choices stay consistent across restarts.

Semantics:

- "Pick up last state" means restore **intent and obligations**, then reconcile with the world — not blindly replay stale block positions.
- Offline bots keep their structures and policies; their claims expire after a grace period.
- Roles are persisted and influence planner assignment and Laya state priors. Default: fixed roles, with planner allowed to reassign temporarily.
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

## 7. Short-term decision service (Laya)

One shared `@receptron/laya` instance inside the coordinator.

Load configuration is profile-driven:

- `executionProviders`: `["cpu"]` on `home-min`; `["webgpu","cpu"]` on `home-full`.
- `sessionOptions.intraOpNumThreads`: 3 on `home-min`; 8 on `home-full` CPU path.
- **No ROCm EP** exists in `onnxruntime-node` for the RX 7600. WebGPU on Linux x64 is experimental, so benchmark it and keep CPU fallback.
- Decision-rate targets: ~4/sec fleet-wide on `home-min`; measure `home-full` and raise the cap only if p95 latency stays within budget.
- Latency gate: warm-model p95 <250ms per decision request. Exceed it and reduce the tactical rate before dropping the confidence gate.

Per decision request from a bot:

- State digest ≤512 tokens: health, food, time, biome, y-level, target, 5-line inventory, nearby hazards/mobs, current skill and progress, last result.
- Affordances: 8–16 legal actions, each ≤12-word label.
- Questions:
  - `nextAction: choice` over affordance ids.
  - `danger: noul` ("about to take damage or die?").
  - `shouldContinue: noul` ("current skill still making progress?").
- Return `{choice, probabilities, answer_confidence, danger, latency}`.
- Concurrency: priority queue; per-bot rate limit; digest cache; timeout.
- **Confidence gate**: if `answer_confidence` < calibrated threshold (start 0.60), bot uses its deterministic utility policy.
- Bots always maintain a local deterministic fallback; Laya latency never blocks the 20Hz guardian.

Choice cardinality: keep ≤16. Laya options cap is 192 tokens total and recommends <20.

## 8. Long-term planner (Muse Spark 1.3 Contributor)

- OpenAI-compatible client. Config: `PLANNER_BASE_URL`, `PLANNER_API_KEY`, `PLANNER_MODEL="Muse Spark 1.3 Contributor"`.
- Load `PLANNER_BASE_URL`/`PLANNER_API_KEY` from process env, then gitignored `config/.env`. **No default URL**; the coordinator fails fast if either variable is missing. Commit `config/.env.example` with empty values.
- Fleet-level, not per-bot: plans the village/farm/road system and assigns work.
- Triggers: interval, SIP conflict, task failure burst, death cluster, new landmark, chat request.
- Output: strict JSON validated with zod — goal stack, SIP mutations, task DAG, blueprint specs, recovery policy, notes.
- Validation before commit: schema, skill catalog references, material feasibility, distance, zone rules, budget.
- Invalid output: max 2 repair attempts, then keep the last good plan.
- Budget: calls/min cap, token cap, timeout, cancellation, plan cache.
- Planner never writes blocks; it only proposes SIP revisions and tasks.

## 9. Skills

Interface: `canRun(ctx)`, `plan(ctx)`, `start/step/cancel`, `checkpoint/restore`, typed effects.

v1 skills: Navigate, FollowPath, Mine, Collect, Craft, Smelt, Eat, Deposit, Withdraw, Sleep, Flee/Defend, Explore, Bridge, Clear, PlaceBuild, SchematicBuild, Repair, HarvestFarm, PlantFarm.

Every skill reports progress and failure class for Laya/planner feedback.

## 10. Building (three layers)

1. **Procedural templates**: house (walls, roof, door, windows), path/road, 9x9 farm, wall, bridge, storage room, watchtower. Parameterized by size/material/anchor/rotation.
2. **Schematic executor**: `.schem` via `prismarine-schematic`; optional `.litematic` adapter. Diff blueprint vs world, compute missing/extra blocks, inventory check, container refill.
3. **LLM composition**: planner picks/composes templates and emits only Blueprint IR.

Blueprint IR:

```ts
{ id, anchor, rotation, blocks: [{x,y,z,state,priority}],
  materials, constraints, workPackages? }
```

Executor:

- Support-first, bottom-up ordering; reachability planning; scaffold fallback.
- **Work partitioning** for multi-bot builds: split into packages (layers, perimeter slices, quadrants) stored as claims. Idempotent: skip blocks already correct.
- Per-block verification and rate limiting.
- Respect `rules.protectedBboxes`, active-bot exclusion, and do not remove load-bearing blocks of occupied structures.
- Rollback journal for every modification.

## 11. Autonomy loop and safety

- 20Hz guardian: lava/void/fall/drowning, hostile mobs, hunger, stuck detection, path timeout, inventory full, claim lost.
- 200–500ms skill step.
- Laya called on skill completion, failure, danger, or 1Hz heartbeat.
- Recovery ladder: local retry → Laya alternative → planner replan → safe mode → emergency stop.
- Multi-bot safety even though edits are allowed:
  - non-owner edits to active builds require a valid, unexpired grant/fencing token;
  - never break blocks supporting an online bot;
  - never edit inside another bot's active work-package bbox unless the grant covers it;
  - owner-offline edits default to deny unless explicitly pre-authorized;
  - no fire/lava/TNT unless explicitly enabled;
  - every destructive change journaled and reversible;
  - coordinator restart must not orphan grants: tokens include a coordinator epoch and are revalidated.

## 12. Memory and persistence

SQLite (WAL) tables: `sip`, `sip_revisions`, `claims`, `edit_grants`, `tasks`, `bots`, `bot_events`, `skill_checkpoints`, `chunks`, `landmarks`, `structures`, `containers`, `episodes`, `block_changelog`, `metrics`.

- **Data directory:** `DATA_DIR`, default `./data`; holds the SQLite DB, event log, and block changelog. Gitignored.
- **Retention:** prune event logs and block changelogs after 30 days. Keep SQLite state until manual pruning.

Event log is append-only. Bot processes keep only short-lived local queues; coordinator is source of truth.

## 13. Repo layout

```
apps/coordinator/        SIP, task board, grants, Laya service, planner client, SQLite
apps/bot/                mineflayer lifecycle, perception stream, skill runtime
packages/core/           types, blackboard, event bus, zod schemas
packages/perception/     voxel sampler, chunk cache, detectors
packages/worldmodel/     world merge, landmark registry, reconciliation
packages/skills/         skill implementations
packages/building/       Blueprint IR, templates, schematic adapter, executor,
                         work packages, scaffold, rollback
packages/brains/         reflex, affordances, deterministic policy, Laya client
packages/planning/       planner client, prompt builders, validators, task DAG
packages/memory/         repositories, migrations, changelog
packages/eval/           scenario runner, metrics, replay, contention tests
tools/bootstrap/         dependency and app provisioning, local server control
tools/architecture/      graph validator, renderers, SVG renderer
tools/laya-train/        dev-only Python: labeling, fine-tune, ONNX export
config/                  default.yaml, .env.example,
                         profiles/home-min.yaml, profiles/home-full.yaml
package.json             workspace root, pinned deps, bootstrap scripts
package-lock.json        committed lockfile
```

Repo-local, gitignored install roots: `node_modules/`, `.venv/`, `.cache/`, `.toolchain/`, `data/`, `models/`.

Profile selection env: `HARDWARE_PROFILE`, `BOT_COUNT`, `BOT_NAMES` (ordered array, default `["TiBot1" … "TiBot8"]`), `LAYA_EP` (`auto`|`cpu`|`webgpu`), `LAYA_THREADS`, `LAN_HOST=localhost`, `LAN_PORT=25565`, `DATA_DIR=./data`. Secrets: `PLANNER_BASE_URL`/`PLANNER_API_KEY` come from process env or gitignored `config/.env`; `config/.env.example` ships with empty values. Laya pins `onnxruntime-node ^1.22.0`; WebGPU on Linux x64 may require an override to a newer `onnxruntime-node` once validated.

Stack: `mineflayer`, `mineflayer-pathfinder`, `mineflayer-collectblock`, `mineflayer-crafting-util`, `prismarine-block/chunk/world`, `prismarine-schematic`, `@receptron/laya`, `zod`, `better-sqlite3`, `pino`, `vitest`, `tsx`, dev-only `@mermaid-js/mermaid-cli`.

## 14. Laya training and calibration (dev-time Python, runtime Node)

1. Log `(state digest, affordances, action, outcome)` from deterministic policy and fleet runs.
2. Label with cloud teacher + outcome rewards: progress, damage, time, materials, task completion.
3. Fine-tune Laya; export ONNX bundle into `models/`; load via `modelDir`.
4. Dev-time Python may use ROCm PyTorch on `home-full`, but the runtime remains Node-only and loads only the exported ONNX bundle.
5. Fit per-question-type temperature on held-out traces.
6. Tune confidence gate to target precision (e.g. 0.90) against the deterministic baseline.
7. Promote only if it beats the deterministic policy end-to-end.

## 15. Testing and evaluation

- Unit: detector fixtures, SIP validation, claim transactions, edit grants, blueprint diff, guardian invariants, resume logic.
- Integration: repo-provisioned 1.20.1 server (`npm run server:start`), offline, superflat; bots join via LAN. Docker remains an optional alternative only.
- Hardware matrix: `home-min` runs the 4-bot scenarios; `home-full` runs the 8-bot scenarios. The 8-bot contention test is `home-full` only; 8 bots on `home-min` is an overload test.
- Laya benchmark: warm-model p50/p95 latency for CPU on both profiles and WebGPU on `home-full`. Hard gates: p95 <250ms and 2h with no crash or driver reset; adopt WebGPU only if it also beats CPU p95.
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
- Metrics: task success, time, deaths, blocks/min, claim contention, duplicate work, idle time, Laya accuracy/ECE, planner calls/tokens/cost.
- Soak test: 2+ hours on both profiles — 4 bots on `home-min`, 8 bots on `home-full`; no memory growth, no deadlocks, claims stable.

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

**v1 done when:** 8 bots run unattended on `home-full` for 2 hours (4 bots on `home-min` with the same guarantees), maintain one consistent SIP, build/repair farms/houses/roads cooperatively, detect and reuse existing infrastructure, never overwrite active work without a valid grant, and resume their roles/tasks correctly after stop/restart.

## 17. Risks and mitigations

- **Laya weak zero-shot** → deterministic fallback + fine-tune + confidence gate.
- **Laya throughput** → one instance, profile-specific tactical cadence, queue/rate limit, digest cache, single in-flight forward pass, ONNX threads 3 (`home-min`) / 8 (`home-full`).
- **WebGPU on RX 7600** → experimental on Linux x64; validate Mesa/Vulkan drivers, auto-fallback to CPU, adopt only if faster than CPU p95 and stable for 2h with no crash or driver reset.
- **VRAM contention** → WebGPU shares 8GB with the desktop; cap session memory, monitor, fall back to CPU.
- **home-min CPU bottleneck** → 4 bots default; 8 bots only as an overload test; stagger heartbeats.
- **home-min RAM headroom** → host already has ~9GB used; check free memory before starting the fleet.
- **onnxruntime-node/Laya version mismatch** → Laya pins `^1.22.0`; WebGPU may require a newer validated override.
- **Multi-bot conflicts** → SIP revisions, atomic claims, leases + fencing tokens, idempotent placement, edit grants.
- **Coordinator single point of failure** → restart + lease expiry + SQLite recovery + coordinator epoch; distributed mode deferred.
- **Stale bot state after restart** → delta sync + reconcile with world before resuming.
- **Pathfinding/terrain failures** → bridge/scaffold, replan, region blacklist.
- **Placement physics/reach** → reachability planner, verification, rollback.
- **Cloud cost/latency** → fleet-level event-driven planning, caps, caching, local fallback.
- **Server anti-cheat/rate limits** → configurable action rate, no impossible reach.

## 18. Resolved defaults

1. **LAN:** `localhost:25565`. Ordered `BOT_NAMES` pool (`TiBot1`–`TiBot8`); bot index `i` gets `names[i]`, stable across restarts. See §5 and §13.
2. **Planner:** `PLANNER_BASE_URL`/`PLANNER_API_KEY` from process env or gitignored `config/.env`; no default URL; fail fast if missing. See §8.
3. **Owner-offline edits:** deny by default; compatibility check only when `autoAcceptCompatibleHelpers=true`. See §3 and §11.
4. **Roles:** fixed and persisted; planner may reassign temporarily, then restore the fixed role. See §5.
5. **Persistence:** `DATA_DIR=./data`; prune event logs and block changelogs after 30 days; keep SQLite state until manual pruning. See §12.
6. **Laya latency:** warm-model p95 <250ms per decision request. See §7 and §15.
7. **WebGPU:** default on `home-full` only if faster than CPU p95 and stable for 2h with no crash or driver reset; otherwise CPU. See §15 and §17.
8. **Remaining validation:** `home-full` latency, RAM, and WebGPU stability measurements are milestone 2 exit criteria, not open design questions. See §16.

## 19. Self-contained bootstrap

`node tools/bootstrap/bootstrap.mjs` is the only supported entry point for provisioning. It installs everything into repo-local, gitignored paths and reuses it on later runs.

- **Full by default:** npm deps, Python training env, local Java 17, and the Minecraft 1.20.1 server jar. Opt out with `--no-python`, `--no-server`, `--no-npm`, or `--no-browser`.
- **Repo-local only:** `node_modules/`, `.venv/`, `.cache/`, `.toolchain/`, `data/`, `models/`. No `npm -g`, `sudo`, or `apt`.
- **Pinned and verified:** `tools/bootstrap/manifest.json` holds download URLs and checksums. Python requirements are pinned; PyTorch follows `PYTORCH_VARIANT` or `HARDWARE_PROFILE` (`cpu` for `home-min`, `rocm` for `home-full`).
- **Install scripts denied:** npm 11 blocks dependency lifecycle scripts. Verified prebuilt binaries cover `better-sqlite3`, `onnxruntime-node`, and `esbuild`. Chromium is never downloaded.
- **Diagram rendering:** Mermaid CLI uses the installed Firefox through `.cache/mermaid/puppeteer.json`. Override with `FIREFOX=/path/to/firefox`. Fenced Mermaid stays the default when Firefox is absent.
- **Minecraft EULA:** accepting it is explicit. `npm run server:start` writes `data/minecraft/eula.txt` only with `--accept-eula`.
- **Disk guard:** bootstrap estimates pending install size, prints free space, and aborts before downloading when the full profile cannot fit. `--check` reports without installing; `--clean` forces `npm ci`.
- **Low-priority I/O:** npm runs under `nice`/`ionice` when available, with `--maxsockets=2` and `--prefer-offline`.

Verification: `npm run bootstrap:check`, `npm run validate:graph`, `npm run render:graphs`, `npm run render:svg`, `npm test`.
