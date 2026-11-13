# TiCrafter Behavior Roadmap

Status: planned. This document is the implementation roadmap for human-like
movement, human-like decisions, early-game progression, farm ownership, and the
validation that proves them. `main.md` remains the normative summary; this file
owns the detailed behavior design and delivery plan.

Milestones 15-17 deliver runtime behavior. Milestone 18 gates it on the phase-1
behavior harness described in `docs/behavior-validation-harness.md`. Milestone
19 finalizes that harness; it does not gate Milestone 18.

## 1. Purpose

The current agency loop can start goals, but it does not yet behave like a
player. It picks single-step goals, abandons partially completed work, lets the
pathfinder place its own scaffold blocks, targets blocks it cannot see, and
shows no gaze, pause, or social presence. It also has no rule for deciding
whether a farm belongs to another player or bot.

The target is not a smaller planner. The target is a bot that:

- commits to a goal long enough to finish it;
- follows a recognizable early-game progression;
- moves, looks, and pauses like a player;
- knows only what it has seen or remembered;
- recovers from failure by changing approach, not by repeating it;
- keeps a bounded, low-rate social presence;
- asks before using an unknown farm and trusts only linked, high-confidence
  players;
- remains safe and responsive when the guardian intervenes.

## 2. Scope

In scope:

- movement, gaze, and interaction pacing;
- decision dwell, reaction latency, and bounded imperfection;
- persistent early-game progression planning;
- multi-block gathering, station provisioning, wool, shelter, and deposit;
- view-cone and line-of-sight target selection;
- farm ownership resolution, player confidence, and chat permission;
- village and farm interaction limited to harvest and replant;
- purposeful idle behavior and local chat presence;
- behavior traces, oddity detectors, and simulated/live validation.

Out of scope for this roadmap:

- villager trading;
- taking items from village chests;
- a general-purpose HTN or recipe planner;
- replacing the guardian or safety authority;
- reimplementing vanilla physics or Minecraft protocol internals.

## 3. Current behavior gaps

| Gap                           | Evidence                                                                              | Effect                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Single-step goals             | `packages/agency/src/goal-catalog.ts:163-172`                                         | One log is "gather wood"; no tech progression                          |
| Disabled goals                | `packages/agency/src/goal-generator.ts:87-102`                                        | `deposit`, `social`, bed, wool, food, gear never self-initiate         |
| No commitment                 | `apps/bot/src/agent-loop.ts:124-129`                                                  | Arbiter receives `intention: null`, so commitment bonus never applies  |
| No deadlines                  | `packages/agency/src/goal-generator.ts:174-186`                                       | Intention expiry is unreachable                                        |
| Silent skill aborts           | `packages/skills/src/lifecycle-executor.ts:182-199`                                   | Guardian or dispatch failure clears the skill without a failure event  |
| Retry restarts work           | `apps/bot/src/agency-runtime.ts:555-570`                                              | Agency retry discards progress although the task host can resume it    |
| Pathfinder tactically decides | `apps/bot/src/mineflayer-action-executor.ts:97-107`                                   | `allow1by1towers` and `allowDigging` stay enabled; bridge loops appear |
| Omniscient targeting          | `apps/bot/src/world-cache.ts:68-78`, `apps/bot/src/agency-snapshot-source.ts:110-120` | Targets are chosen through walls, with no view cone or memory          |
| No gaze                       | `apps/bot/src/mineflayer-action-executor.ts:392-394`                                  | Only placement yaw is set; interaction targets are not looked at first |
| Chat is unwired               | `apps/bot/src/chat/chat-adapter.ts`                                                   | Social engine exists but receives no incoming messages                 |
| No farm ownership             | `apps/coordinator/src/world-model.ts:118-122`                                         | Ownership port is not wired, so farm skills cannot check plot owners   |

### 3.1 Existing foundations

Reuse these modules; add new components only where no equivalent exists.

- `packages/perception` already owns farm detection, storage and workstation
  detection, landmark candidates, and the perception rate limiter.
- `packages/worldmodel` already owns `LandmarkRegistry`, `ContainerMemory`,
  confidence decay, and the `OwnershipQueryPort` contract.
- `packages/skills` already owns `harvest-farm`, `plant-farm`, `CheckpointManager`,
  and `LifecycleExecutor.resume`.
- `apps/bot/src/skill-host.ts:97-100` already loads and resumes checkpoints on
  task-host restart.
- `apps/coordinator/src/bots/relationship-store.ts` owns bot-to-bot trust.
  Player confidence is separate and keyed by player UUID.
- `apps/coordinator/src/claims/claim-service.ts:184` lists active claims; the
  `farm_plot` claim type already exists.

## 4. Target player loop

The default early-game loop is fixed and deterministic, then expanded against
the live recipe registry:

1. Forage wood and nearby food.
2. Craft a crafting table and place it.
3. Craft wooden pickaxe and wooden sword.
4. Mine cobblestone in batches.
5. Craft stone tools, a furnace, and a chest.
6. Establish or improve a home; secure wool, shelter, bed, crafting table,
   furnace, and chest.
7. Harvest mature crops and replant them when a farm is known and its ownership
   permits access.
8. Return home before dusk, eat, store surplus, and sleep.
9. Scout for a village or the next resource site; maintain the base.

The plan is a prior, not a script. Survival, eating, and night preparation
interrupt it. Once the interruption clears, the plan resumes at the current
milestone.

## 5. Architecture additions

### 5.1 Behavior realism

Behavior realism is an execution-layer policy. It never owns goals and never
overrides the guardian.

- `HumanizationPolicy` — personality-driven pacing: walk speed, pause chance and
  duration, scan chance, reaction latency, switch threshold, chat delay.
- `HumanMover` — segmented travel on top of pathfinder: walk by default, sprint
  only on long open stretches, pause and scan at waypoints, stop and look before
  the final interaction.
- `GazeController` — rate-limited yaw and pitch toward the next node or target,
  saccades while idle, no instant reversals.
- `DeliberationPolicy` — minimum dwell, switch hysteresis, non-urgent reaction
  latency, satisficing among close candidates, seeded variation.
- `PerceptionFilter` — view cone, line of sight, short-lived visibility cache,
  and remembered sightings for wood, stone, and containers.
- `SocialPresence` — incoming chat handling, delayed replies, look at speaker,
  and bounded ownership inquiries.
- `IdleLife` — base organization, chest sorting, patrol, inspect, sit and eat.

Look-before-interact is action middleware in `mineflayer-action-executor`, not
an optional goal step. Every normal break, place, use, attack, and container open
passes through it. Guardian emergency actions are exempt and traced. `look-at`
remains an explicit action for skills that need to look without interacting.

### 5.2 Progression plan

- `ProgressionPlan` — ordered milestones, attempts, blocked steps, and plan
  revision; persisted inside working memory with a `version` field.
- `ProgressionPlanner` — expands a milestone into concrete agency goals from
  inventory, snapshot, and recipe knowledge.
- `RecipePort` — live mineflayer recipe adapter in the bot process and a static
  table in tests and simulation.

The plan is idempotent: satisfied milestones are skipped, partial counts carry
over, and a blocked step pivots to an alternate source instead of abandoning the
whole plan. Unknown plan versions restore to an empty plan and emit a
`plan-migrated` trace.

### 5.3 Finishing skills

- `gather-resource` — mine N matching blocks, collect drops, select the next
  target, and checkpoint progress.
- Station provisioning — craft or place a crafting table and furnace before
  crafting and smelting when one is not nearby.
- Wool and shelter provisioning — gather wool from sheep, repair or place a
  small shelter, and place a bed.
- Explicit `bridge` and `clear` skills. Pathfinder navigation never places
  scaffold or bridge blocks and never digs for navigation.
- `deposit` — enabled when a chest exists and inventory is in surplus.
- Retry resume — agency retries load a valid checkpoint through
  `LifecycleExecutor.resume` where the skill supports it. Stale checkpoints are
  traced, not silently discarded.

### 5.4 Perception realism and farm ownership

- View cone and line of sight for target selection.
- Short-lived sightings for wood, stone, containers, and nearby targets.
- Persistent memory of discovered trees, stone, stations, farms, villages, and
  containers, reusing `packages/worldmodel`.
- Depletion tracking and target cooldowns.
- Container contents known only after opening.
- Village detection from clustered villagers, beds, doors, workstations, and
  farmland.
- `PlotOwnershipResolver` runs before harvest or replant. It prefers an active
  `farm_plot` claim, then the nearest `house` landmark within
  `behavior.village.ownershipRadius`, then claim owners and linked players for
  that base. Zero, multiple, or conflicting owners resolve to unknown or
  ambiguous.
- `PlayerConfidenceStore` persists per-player confidence and base links. A player
  is linked to a base through an operator mapping or repeated proximity
  sightings. Confidence changes only from recorded social events: positive
  chats, gifts, help, and kept farm-permission promises raise it; crop theft,
  claim violation, or unsafe base behavior lower it.
- `FarmPermissionPolicy` allows self-owned plots, operator allowlisted regions,
  or a valid grant from a base-linked player at or above
  `behavior.village.playerConfidenceThreshold`. Other-owned plots are skipped.
  Unknown plots trigger one chat inquiry. Replies from unlinked players are
  ignored. Linked low-confidence replies are denied.
- A known different owner overrides every chat reply. Permission grants are
  single-cycle and expire. Silence is denial. No permission path unlocks
  containers or trading.

Visibility refresh is capped by `packages/perception/src/perception-rate-limiter.ts`.
The starting budget is 4 Hz target refresh, at most 8 raycasts per tick, and a
64-block focus radius.

### 5.5 Validation

- `BehaviorTrace` events for decisions, plans, actions, gaze, pauses, chat,
  permission, and ownership.
- Oddity detectors and human-likeness metrics.
- `human-signature`, early-game, and farm-permission scenarios in the behavior
  validation harness.
- Simulated movement timing plus live replay and video review.

## 6. Roadmap

### Milestone 15 — Execution stability and behavior realism

Goal: remove visible oddities and establish player-like execution. Scope is
wood, stone, and containers; persistent landmark memory and village/farm
ownership arrive in Milestone 17.

Deliverables:

- disable `allow1by1towers`, `allowDigging`, and automatic scaffold blocks in
  pathfinder `Movements`; add explicit `bridge` and `clear` skills; keep
  regression tests for construction and station provisioning;
- report skill failures instead of clearing silently;
- progress watchdog and checkpoint resume; agency retry loads a valid checkpoint
  through `LifecycleExecutor.resume` and always increments attempts;
- real intention passed to arbitration, minimum dwell, per-kind deadlines;
- per-need need decay;
- `HumanMover`, `GazeController`, `DeliberationPolicy`, `PerceptionFilter`
  (short-lived sightings only);
- look-before-interact action middleware and explicit `look-at` action;
- chat adapter wired to bot chat events, including sender identity;
- initial idle behaviors;
- `BehaviorTrace` recording and the first oddity detectors;
- reuse `perception-rate-limiter`; no second rate limiter.

Deadline rule: deadlines are checked only at decision boundaries. Extend once
when the checkpoint advanced since the last boundary; otherwise abandon with
reason `deadline`. Guardian and urgent survival bypass both dwell and deadline.

Exit criteria:

- no unplanned scaffold or bridge placement;
- construction and station provisioning still pass with navigation digging and
  towering disabled;
- no zero-look block interaction; all normal break, place, use, attack, and
  container-open actions have a prior gaze entry;
- no silent restart without an attempt increment; valid checkpoints are loaded,
  stale checkpoints emit a trace;
- no teleport-step or instant-turn beyond physical limits;
- deadline abandonment carries reason `deadline` and never fires mid-step;
- chat replies are delayed and rate-limited.

### Milestone 16 — Progression plan and finishing skills

Goal: make the early-game loop recognizable and self-sustaining.

Deliverables:

- `ProgressionPlan`, `ProgressionPlanner`, `RecipePort`, persistence, restore,
  and version migration;
- milestone catalog from wood through base provisioning, including wool,
  shelter, and bed;
- `gather-resource` skill with checkpointing;
- station provisioning for crafting table and furnace;
- bounded wool acquisition from sheep and bed placement in a shelter;
- enabled `deposit` with chest;
- enabled `gather-wool` and `secure-bed` goals when progression requires them;
- expanded project-focus allowed goals for provisioning;
- standard bootstrap world fixture with trees, stone, sheep, and a flat shelter
  site.

Exit criteria:

- from an empty inventory in the standard bootstrap world, a simulated bot
  reaches stone tools, crafting table, furnace, chest, and a bed placed in a
  shelter without a planner or seed jobs;
- multi-block gather completes in one intention;
- a failed step pivots to an alternate target or source;
- partial progress survives retry;
- an unknown plan version restores to an empty plan and emits `plan-migrated`.

### Milestone 17 — Perception realism, villages, and farming

Goal: replace omniscient selection with remembered observations and add
village/farm behavior with ownership-aware permission.

Deliverables:

- snapshot fields for stations, wood clusters, farm plots, village candidates,
  and water sources;
- reuse `farm-detector`, `storage-workstation-detector`,
  `landmark-candidate-emitter`, `landmark-registry`, and `container-memory`;
- `VillageScanner` for village clustering only;
- `SkillFarmPlotSource` wired to detected plots and existing farm detection;
- add `ClaimService.ownersIn(bbox)`;
- wire `OwnershipQueryPort` into `CoordinatorWorldModel`; it is currently omitted
  at `apps/coordinator/src/coordinator-composition.ts:154`, while `ClaimService`
  is created at `:223`;
- add `PlayerConfidenceStore` and the `player_confidence` migration keyed by
  player UUID;
- add `BOT_PLOT_OWNERSHIP_REQUEST` and response in
  `packages/core/src/transport/messages.ts`;
- `PlotOwnershipResolver` and `FarmPermissionPolicy`;
- `OwnershipInquiry` in `SocialPresence` with delayed, rate-limited outgoing
  chat;
- sender-aware chat handling in `ChatAdapter`;
- permission reply parsing in the bot chat layer, not inside `SocialEngine`;
- harvest and replant goals;
- project provisioning and storage milestones;
- village policy: harvest and replant only, no chest theft, no trading.

Plot resolution order:

1. Active `farm_plot` claim overlapping the plot: owner is the claim owner.
2. Otherwise, nearest `house` landmark inside the ownership radius: collect
   claim owners for that base.
3. Claim owner is self: allow.
4. Claim owner is another bot: deny.
5. No claim owner: collect linked players for that base.
6. Linked player at or above threshold: candidate grantor, never automatic
   permission.
7. Zero linked players or conflicting links: unknown, with no candidate grantor.
8. Allowlisted region: allow.
9. Otherwise ask in chat; allow only an affirmative reply from a candidate
   grantor at or above threshold.

Permission rules:

- affirmative from a player linked to the nearby base and confidence at or above
  `behavior.village.playerConfidenceThreshold` grants one harvest/replant cycle;
- affirmative from an unlinked player is ignored;
- affirmative from a linked player below threshold is denied and traced as
  `low-player-confidence`;
- a known different owner denies regardless of any reply;
- denial or timeout skips the plot;
- grant TTL is 10 minutes;
- ask cooldown is 5 minutes per plot;
- inquiry timeout is 60 seconds;
- permission never unlocks containers, trading, or protected blocks.

Exit criteria:

- selected targets are visible or previously discovered;
- self-owned plot is harvested and replanted;
- other-owned plot is skipped;
- unknown plot with an allowlisted region is harvested;
- unknown plot with a linked high-confidence player affirmative is harvested;
- unknown plot with a linked low-confidence player affirmative is skipped;
- unknown plot with an unlinked player affirmative is skipped;
- ambiguous nearby bases trigger an inquiry, never a guess;
- the bot finds a village or farm, harvests mature crops, replants, and stores
  surplus;
- the bot returns home, eats, and sleeps when night falls;
- no village chest is opened and no trading occurs;
- no harvest occurs when `unpermitted-farm-harvest` would fire.

### Milestone 18 — Player-like and behavior-realism validation

Goal: make behavior realism part of the v2 acceptance gate using the phase-1
behavior harness.

Deliverables:

- extend the phase-1 runtime from `docs/behavior-validation-harness.md`; do not
  wait for the final harness in Milestone 19;
- behavior trace assertions and oddity detectors in CI;
- simulated movement timing, action latency, and gaze events;
- live replay and video review rubric;
- A/B comparison with humanization on and off;
- farm-permission subcases in `village-farm`;
- expanded v2 acceptance and metrics.

Exit criteria:

- all behavior gates pass in simulated mode;
- live mode passes the same scenarios;
- task-time regression from humanization is at most 10%;
- required scenarios and metrics from `main.md` §22 pass;
- simulated runs use 5 fixed seeds per scenario; hard gates pass every seed;
- statistical gates use pooled medians across seeds.

### Milestone 19 — Behavior validation harness

Goal: deliver the final offline/live validation harness.

Deliverables:

- offline simulator for agency, planning, building, progression, and
  humanization;
- shared simulate/live scenario specification;
- declarative behavior assertions and trace inspector;
- CI run without a Minecraft server;
- human-likeness report and failure evidence;
- expanded coverage and evidence packaging; do not duplicate the Milestone 18
  gates.

Exit criteria:

- behavior scenarios pass without a server;
- live mode runs the same scenario definitions and assertions;
- failed checks produce readable evidence;
- the trace inspector explains goals, plans, skills, gaze, permission, and
  building decisions without manual log reading.

## 7. Contracts and ports

```ts
interface RandomSource {
    next(): number;
}

interface SprintContext {
    distance: number;
    indoor: boolean;
    nearHazard: boolean;
    surface: 'open' | 'confined';
}

interface HumanizationPolicy {
    reactionLatency(): number;
    pauseChance(): number;
    pauseDuration(): number;
    scanChance(): number;
    chatDelay(): number;
    sprintAllowed(input: SprintContext): boolean;
    switchThreshold(): number;
}

interface BehaviorTraceEntry {
    at: string;
    botId: string;
    kind: 'decision' | 'plan' | 'action' | 'gaze' | 'pause' | 'chat' | 'permission' | 'perception';
    subject: string;
    detail: Readonly<Record<string, unknown>>;
}

interface MaterialNeed {
    item: string;
    count: number;
}

interface RecipePort {
    canCraft(item: string, inventory: readonly InventoryItem[]): boolean;
    ingredients(item: string): readonly MaterialNeed[];
    station(item: string): 'none' | 'crafting_table' | 'furnace';
}

interface ProgressionPlannerPort {
    nextGoal(plan: ProgressionPlan, snapshot: AgencySnapshot): Result<Goal | null, string>;
    observe(plan: ProgressionPlan, outcome: GoalOutcome): ProgressionPlan;
}

interface Region {
    id: string;
    bbox: BoundingBox;
}

interface PlayerConfidence {
    playerId: string;
    username: string;
    score: number;
    linkedBaseIds: readonly string[];
    lastInteractionAt: string | null;
}

type PlotOwnership =
    | { kind: 'self'; ownerId: string }
    | { kind: 'other'; ownerId: string }
    | {
          kind: 'ambiguous';
          ownerIds: readonly string[];
          nearbyBaseId: string | null;
      }
    | {
          kind: 'unknown';
          nearbyBaseId: string | null;
          linkedPlayers: readonly PlayerConfidence[];
      };

interface PlotOwnershipPort {
    resolve(plot: BoundingBox): Result<PlotOwnership, string>;
}

interface FarmPermissionPort {
    decide(input: {
        ownership: PlotOwnership;
        reply: { player: PlayerConfidence; affirmative: boolean } | null;
        allowedRegions: readonly Region[];
    }): { decision: 'allow' | 'deny' | 'ask'; reason: string };
}
```

Rules:

- Behavior realism is advisory for pacing only. The guardian remains final.
- `RecipePort` is injected at the composition root, never reached for inside
  domain code.
- `ProgressionPlan` is immutable; transitions return a new plan.
- Seeded randomness is injected so simulated runs remain deterministic.
- `PlayerConfidenceStore` is coordinator-owned. Bots receive confidence
  snapshots through the ownership response; bots never compute trust from chat
  text alone.
- A known different owner always overrides chat permission.

## 8. Configuration

New keys are documented in `main.md` and `docs/operations.md`:

- `behavior.movement.*` — walk, sprint, pause, scan, final approach.
- `behavior.gaze.*` — yaw rate, pitch rate, scan sweep, idle saccades.
- `behavior.rhythm.*` — reaction latency, dwell, switch threshold, action gap.
- `behavior.perception.*` — view cone, line of sight, memory radius.
- `behavior.social.*` — reply delay, rate, greeting cooldown.
- `behavior.idle.*` — idle duration, micro-behavior weights.
- `behavior.village.*` — ownership, player confidence, and permission.
- `agency.progression.*` — enabled, milestone cadence, max attempts, pivot
  threshold, plan version.

Behavior and perception defaults:

- `behavior.perception.visibilityRefreshHz` — 4.
- `behavior.perception.maxRaycastsPerTick` — 8.
- `behavior.perception.sightingTtlMs` — 60000.
- `behavior.gaze.updateHz` — 10.

Village defaults:

- `behavior.village.ownershipRadius` — 32.
- `behavior.village.allowedPlotRegions` — empty.
- `behavior.village.allowUnknownOwnership` — false.
- `behavior.village.playerBaseLinks` — empty.
- `behavior.village.playerConfidenceInitial` — 0.5.
- `behavior.village.playerConfidenceThreshold` — 0.6.
- `behavior.village.playerConfidenceHalfLifeDays` — 30.
- `behavior.village.playerLinkRadius` — 32.
- `behavior.village.playerLinkMinSightings` — 3.
- `behavior.village.playerLinkWindowMs` — 600000.
- `behavior.village.permissionAskCooldownMs` — 300000.
- `behavior.village.permissionTimeoutMs` — 60000.
- `behavior.village.permissionGrantTtlMs` — 600000.

Progression defaults:

- `agency.progression.planVersion` — 1.
- `agency.progression.deadlinePolicy` — `extend-once`.

Other defaults for this roadmap:

- no automatic scaffold, bridge, or navigation digging;
- view cone and line of sight required for new targets;
- bounded imperfection: pauses, scans, short detours, occasional re-check;
- village interaction: harvest and replant only;
- safety reactions bypass all pacing delays.

## 9. Metrics and oddity detectors

| Detector                   | Fails when                                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `auto-scaffold`            | a block is placed by navigation rather than a plan or skill                                                     |
| `teleport-step`            | displacement exceeds the physical movement limit                                                                |
| `instant-turn`             | yaw change exceeds the gaze limit                                                                               |
| `zero-look-interact`       | break, place, use, or attack without a prior look                                                               |
| `same-target-retry`        | identical target and action repeat without progress                                                             |
| `switch-storm`             | goal switches exceed the rate limit or dwell is too short                                                       |
| `sprint-indoor`            | sprinting inside a base or near hazards                                                                         |
| `xray-target`              | selected target is outside the view cone and line of sight                                                      |
| `instant-chat`             | reply latency is below the configured floor                                                                     |
| `no-idle`                  | zero non-action time while awake                                                                                |
| `incomplete-action`        | skill starts and ends without success or failure evidence                                                       |
| `unpermitted-farm-harvest` | harvest or replant on a plot that is not self-owned, not allowlisted, or not granted by a linked trusted player |

Target ranges:

- dwell median at least 30 seconds;
- non-urgent switches at most 2 per 10 minutes;
- action-start jitter 50–250 milliseconds;
- at least one pause per 30–60 seconds of travel;
- chat reply latency 0.8–3 seconds;
- idle fraction 5–20% while awake;
- no unplanned scaffold placements;
- no zero-look interactions;
- no permission grant from an unlinked player;
- no permission grant from a player below `0.6` confidence.

Sampling protocol:

- simulated: 5 fixed seeds per scenario, 30 virtual minutes per seed;
- hard gates must pass every seed;
- statistical gates use pooled medians across seeds;
- live: 3 runs of 15 minutes; statistical gates are pooled;
- CI target is under 10 minutes for the simulated suite.

Additional metrics:

- ownership verdicts: self, other, unknown, ambiguous;
- base links by source: operator, observed;
- player confidence distribution and low-confidence replies;
- inquiries, affirmatives, denials, and timeouts;
- farm skips by reason, duplicate inquiries per plot, and grant expiries;
- deadline expiries and pivot success rate;
- valid-checkpoint resume rate and stale-checkpoint count;
- p95 tick overhead versus humanization off, gated at 10%.

## 10. Validation plan

### Simulated

- Extend the fake action dispatcher with travel time, action latency, and gaze
  events.
- Add a fake movement model that records pauses, scans, and final approach.
- Add `early-game-bootstrap`, `human-signature`, `human-movement`,
  `village-farm`, `idle-life`, `social-chat`, and `no-oscillation` scenarios.
- `village-farm` covers self-owned, other-owned, unknown-allowlisted,
  linked-high-confidence, linked-low-confidence, unlinked-affirmative, denial,
  timeout, and ambiguous-base cases.
- Assert ranges, not wall-clock values; one seed drives all variation.

### Live

- Run 10–15 minutes per bot with the planner disabled and no seed jobs.
- Record `BehaviorTrace` and replay/video.
- Review against the manual rubric: movement, gaze, pacing, decision quality,
  social presence, recovery, farm permission, and no odd artifacts.
- Sign off in live mode only after simulated gates pass.

### A/B

- Run the same scenario with humanization off and on, using the same seeds.
- Oddity counts must drop.
- Task completion time may regress by at most 10%.
- Goal success and abandonment rates must not regress.
- Permission correctness must not regress.

## 11. Safety

- Guardian, threat, hunger, fall, lava, and emergency stop bypass pacing.
- No humanization delay may postpone a veto or emergency recovery.
- Bounded imperfection never includes harmful mistakes, destructive actions, or
  unsafe exploration.
- Unknown farm ownership is unsafe to touch.
- Village rules are behavior policy, not guardian authority; the guardian still
  wins.
- No model calls mineflayer; no model writes SIP, claims, grants, or blocks.
- All movement and placement remain subject to reach, rate, and safety guards.

## 12. Rollout and rollback

- Feature flags gate each behavior-realism component.
- Progression plan can be disabled; legacy goal generation remains available
  during migration.
- Any oddity-detector regression blocks promotion.
- Rollback is configuration-only for tracing and behavior flags.
- Persisted plan fields are versioned and optional; unknown versions restore to
  an empty plan with `plan-migrated`.
- `player_confidence` is additive and coordinator-owned; disabling village
  permission skips farm use rather than guessing ownership.
- Acceptance must state whether it starts fresh or restores a plan.

## 13. Documentation and architecture graph

- `main.md` is the normative summary.
- This document is the detailed behavior roadmap.
- `docs/cognitive-architecture.md` owns agency, progression, decision, player
  confidence, and ownership semantics.
- `docs/behavior-validation-harness.md` owns validation.
- `docs/operations.md` owns operator controls.
- Planned modules enter `docs/architecture/graph.json` only when their source
  paths exist. Generated architecture Markdown is never edited by hand.

## 14. Deferred

- villager trading and professions;
- village chest access;
- a generic dependency or HTN planner;
- multi-bot coordinated foraging and farming;
- learned movement policies;
- richer natural-language conversation.
