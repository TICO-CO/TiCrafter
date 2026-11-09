# TiCrafter — Fleet of Autonomous Minecraft 1.20.1 Agents

## Locked decisions

- Minecraft **1.20.1**, LAN server, offline auth, no public server.
- **8 bots**, all sharing **one common infrastructure plan** (SIP) so they do not override each other.
- **Cloud planner:** Muse Spark 1.3 Contributor via an OpenAI-compatible endpoint ("opencode").
- **Short-term decision model:** Laya (`@receptron/laya`, Node/ONNX). Typed `choice`/`score`/`noul` only, no text.
- **Execution:** mineflayer.
- **Building:** all three layers — procedural templates, schematic import, LLM composition into a Blueprint IR.
- Bots **may modify existing builds/farms**, under coordination, logging, and rollback rules.
- **Active builds are private by default.** A non-owner may edit only through an explicit scoped grant that confirms compatibility with the owner's current plan.
- Bots persist identity, role, behavior profile, current task, claims, and skill checkpoints; restart resumes last state.
- Dev-only Python allowed for Laya fine-tuning; **runtime stays Node-only**.
- Infrastructure recognition: paths, houses, farms, walls, bridges, storage, workstations.

## Capacity constraints (measured)

- 4 CPU cores, 15GB RAM, GT 710 (1GB) — GPU unusable.
- Laya fp32 ONNX ≈1.7GB download, ≈2GB RAM, **one forward pass at a time**.
- Tactical budget: one shared Laya instance, ~4 decisions/sec fleet-wide.
- 8 bots ≈1.2–1.6GB total for mineflayer processes; coordinator + SQLite <1GB. Total ~4–5GB, fits.
- Set Laya `intraOpNumThreads=3`; leave 1 core for pathfinding.
- Stagger bot decision heartbeats; each bot mostly runs deterministic skills between decisions.
- **Do not** run one Laya instance per bot. One model, central decision service.
- Target 8 bots v1; test at 8.

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

Single process for LAN simplicity; can later split into services.

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
tools/laya-train/        dev-only Python: labeling, fine-tune, ONNX export
config/                  default.yaml, .env.example
```

Stack: `mineflayer`, `mineflayer-pathfinder`, `mineflayer-collectblock`, `mineflayer-crafting`, `prismarine-block/chunk/world`, `prismarine-schematic`, `@receptron/laya`, `zod`, `better-sqlite3`, `pino`, `vitest`, `tsx`.

## 14. Laya training and calibration (dev-time Python, runtime Node)

1. Log `(state digest, affordances, action, outcome)` from deterministic policy and fleet runs.
2. Label with cloud teacher + outcome rewards: progress, damage, time, materials, task completion.
3. Fine-tune Laya; export ONNX bundle into `models/`; load via `modelDir`.
4. Fit per-question-type temperature on held-out traces.
5. Tune confidence gate to target precision (e.g. 0.90) against the deterministic baseline.
6. Promote only if it beats the deterministic policy end-to-end.

## 15. Testing and evaluation

- Unit: detector fixtures, SIP validation, claim transactions, edit grants, blueprint diff, guardian invariants, resume logic.
- Integration: Docker `itzg/minecraft-server` 1.20.1, offline, superflat; bots join via LAN.
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
- Soak test: 8 bots run 2+ hours, no memory growth, no deadlocks, claims stable.

## 16. Milestones

1. **Scaffold**: workspace, config, coordinator, one bot joins LAN server, logging, persistence schema.
2. **Perception + shared world model** for 2 bots; landmark persistence.
3. **Reflex + core skills**: survive, navigate, mine, gather, craft, deposit.
4. **SIP + claims + task board + collaboration grants + bot profiles/roles**.
5. **Building**: templates, schematic executor, work partitioning, rollback.
6. **Infrastructure recognition**: paths, houses, farms, walls, bridges, storage.
7. **Laya decision service**: central instance, affordances, digest, confidence gate, fallback.
8. **Cloud planner**: Muse Spark, schema, SIP revisions, budget guards; plan-revision arbitration for ambiguous edits.
9. **Calibration + 8-bot eval**: tune, measure, promote.
10. **Hardening**: restart/resume, soak tests, error taxonomy, ops controls, docs.

**v1 done when:** 8 bots run unattended on LAN for 2 hours, maintain one consistent SIP, build/repair farms/houses/roads cooperatively, detect and reuse existing infrastructure, never overwrite active work without a valid grant, and resume their roles/tasks correctly after stop/restart.

## 17. Risks and mitigations

- **Laya weak zero-shot** → deterministic fallback + fine-tune + confidence gate.
- **Laya throughput** → one instance, 1Hz tactical cadence, queue/rate limit, digest cache, 3 ONNX threads.
- **Multi-bot conflicts** → SIP revisions, atomic claims, leases + fencing tokens, idempotent placement, edit grants.
- **Coordinator single point of failure** → restart + lease expiry + SQLite recovery + coordinator epoch; distributed mode deferred.
- **Stale bot state after restart** → delta sync + reconcile with world before resuming.
- **Pathfinding/terrain failures** → bridge/scaffold, replan, region blacklist.
- **Placement physics/reach** → reachability planner, verification, rollback.
- **Cloud cost/latency** → fleet-level event-driven planning, caps, caching, local fallback.
- **Server anti-cheat/rate limits** → configurable action rate, no impossible reach.

## 18. Open items

1. LAN host/port and bot usernames.
2. Exact `PLANNER_BASE_URL` and key source for Muse Spark.
3. Owner-offline edits default to **deny** unless `autoAcceptCompatibleHelpers` is set; confirm if a different default is wanted.
4. Roles fixed with temporary planner reassignment (default); confirm if roles should be learned/promoted instead.
5. Persistence directory and log/changelog retention window.
