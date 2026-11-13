# TiCrafter Cognitive Architecture

Status: milestone 15 behavior realism and milestone 16 progression core implemented. Working memory, focus,
interruption, project focus, tactical Laya revision guards, tactical profile
policy, strategic intent, planner integration, agency goal tie-break, reflection,
failure reporting, checkpoint retry, progress watchdog, per-kind deadlines,
minimum dwell, per-need decay, humanized pace, gaze, look-before-interact,
short-lived view-cone sightings, delayed chat, initial idle life, behavior
traces, and first oddity detectors are implemented. The progression plan,
planner, recipe port, multi-block gather, and milestone goals are implemented;
full early-game acceptance remains open. Plot ownership and farm permission resolution are implemented in world-model
policy, coordinator persistence, transport, village scanning, bot-side
permission flow, live farm-plot discovery, and preauthorization. Milestone 17
acceptance scenarios and the full behavior harness remain planned.

This document defines the boundary between reflex safety, local agency, tactical
Laya decisions, working memory, and the optional cloud planner. It is the
detailed companion to `main.md`; `main.md` remains the normative summary and the
source for architecture graph references.

`docs/architecture/graph.json` tracks the implemented module paths.
`check-component-paths` requires every graph component to resolve to a real
source file.

## 1. Purpose

The bot should remember what it was trying to do, understand what happened, and
decide whether it still wants to do it.

The goal is not to make Laya a smaller planner. The goal is a clean split:

- the guardian keeps the bot alive;
- agency owns intention and commitment;
- working memory gives continuity;
- Laya makes tactical choices;
- the cloud planner provides optional strategic direction;
- skills execute deterministic game mechanics.

## 2. Cognitive layers

| Layer          | Responsibility                                           | Authority                |
| -------------- | -------------------------------------------------------- | ------------------------ |
| Guardian       | Immediate deterministic safety reactions                 | Final veto               |
| Agency         | Needs, goals, intention, commitments, routine            | Owns intention lifecycle |
| Working memory | Focus, interruptions, commitments, recent experience     | Continuity only          |
| Laya           | Continue, interrupt, switch, recover among legal options | Advisory                 |
| Cloud planner  | Strategic goals, constraints, priorities                 | Optional advisory        |
| Skills         | Pathfinding, inventory, crafting, building, movement     | Deterministic execution  |
| Behavior       | Pacing, gaze, pauses, movement segmentation              | Advisory execution only  |
| Perception     | World and self observations                              | Observation only         |

Rules:

- Exactly one active focus exists at a time: agency goal, project, or job task.
- Laya never invents goals, writes SIP, claims, or grants, or calls skills.
- The cloud planner never writes blocks or bypasses validation.
- The guardian remains the safety authority. Laya cannot authorize danger.
- Behavior realism may pace non-urgent actions but never delays a guardian veto,
  threat reaction, hunger reaction, or emergency stop.
- A bot must remain functional with the cloud planner disabled.

## 3. Ownership boundaries

### Guardian

The guardian is the true instinct layer. It runs deterministically, at high
frequency, and can veto any action. Laya does not replace it and does not receive
authority over danger decisions.

### Agency

Agency owns:

- needs and personality;
- goal generation and scoring;
- intention lifecycle;
- commitments and interruption policy;
- project focus;
- job acceptance policy;
- reflection and bounded personality updates;
- episode recording.

Agency may ask Laya for advice, but agency decides when advice is applicable.
Agency remains the owner of the active intention.

### Working memory

Working memory is a bounded, bot-local state used by agency, Laya, and task
execution. It is persisted inside `agent_state` and restored on session resume.
It is not a separate goal manager and does not make decisions.

### Laya

Laya is a stateless inference engine. Each call receives the current state,
relevant working memory, and a bounded set of legal options. It returns a
choice, confidence, and continuation signal. The bot applies the result only
when the focus and revision still match.

### Cloud planner

The cloud planner is optional. It receives summarized fleet, bot, agency, and
episode context and returns structured strategic intent. It does not receive
raw event history and does not issue free-form instructions.

### Skills

Skills execute selected intentions. Laya and the cloud planner never call
skills, pathfinding, or mineflayer directly.

## 4. Working memory

Shape:

```ts
interface WorkingMemory {
    revision: number;
    focus: {
        kind: 'agency' | 'project' | 'task';
        id: string;
        label: string;
        startedAt: string;
    } | null;
    commitments: {
        id: string;
        description: string;
        priority: number;
        createdAt: string;
        expiresAt: string | null;
    }[];
    interruption: {
        reason: string;
        resumeCondition: string;
        interruptedFocusId: string;
        at: string;
    } | null;
    recentExperiences: {
        event: string;
        outcome: string;
        at: string;
    }[];
    lastTacticalDecision: {
        choiceId: string;
        source: 'laya' | 'fallback' | 'deterministic';
        at: string;
        revision: number;
    } | null;
    plan?: ProgressionPlan | null;
    lastDecisionAt: string | null;
    lastSwitchAt: string | null;
    lastGazeAt: string | null;
    strategicIntent?: StrategicIntent | null;
}
```

Bounds:

- maximum 4 commitments;
- maximum 8 recent experiences;
- one active interruption at a time;
- one active progression plan with a bounded milestone count;
- no full episode history is sent to Laya.

Working memory stores interpretations and outcomes, not world observations.
World state remains owned by perception and the coordinator.

Implementation:

- `packages/agency/src/working-memory.ts` owns the bounded model and revision.
- `agent_state` stores working memory as an optional JSON field. Missing fields
  restore to an empty memory; malformed fields fail closed.
- `strategicIntent` is optional in persisted JSON for backward compatibility;
  missing or null restores to null.
- The revision increments on every focus, commitment, interruption, experience,
  strategic-intent, plan, and tactical-decision change.
- Project focus survives project sub-work tasks. Survival and other interruption
  goals may temporarily take focus; completing or abandoning them restores the
  project focus.
- Tactical decisions record their source, choice, and working-memory revision.
  Stale results are dropped and recorded as recent experiences.
- `plan` is optional in persisted JSON. Old snapshots restore to an empty plan.
- `lastDecisionAt`, `lastSwitchAt`, and `lastGazeAt` support dwell, reaction
  latency, and humanization policy without adding another goal manager.

### Focus

Exactly one focus is active:

- `agency`: a self-generated goal;
- `project`: a long-lived personal project such as a home or storage area;
- `task`: an accepted job task.

Project focus is agency focus. Build tasks associated with the project are
sub-work and do not replace the project focus.

### Commitments

Commitments prevent rapid switching and goal oscillation. Examples:

- finish the current task step before exploring;
- return home before nightfall;
- avoid caves without sufficient equipment;
- complete a project phase before optional social activity.

Switching requires both a better option and enough urgency to overcome the
commitment cost.

### Interruption and resume

An interruption temporarily suspends the current focus without abandoning it.

Examples:

- eat because hunger is critical;
- flee a hostile;
- seek shelter at night;
- recover from a failed path.

While a task is interrupted:

- the task lease is preserved and renewed;
- the agency intention or project remains active;
- the interruption reason and resume condition are recorded;
- the same focus resumes when the interruption clears.

No new goal is selected solely because the interruption ended.

### Revision guard

Every change to focus, commitments, or interruption increments the working
memory revision. A tactical decision request carries the revision it was based
on. A result is applied only if the revision and focus still match. Stale
results are recorded and discarded.

## 5. Tactical Laya

Laya decides only at real choice points where multiple legal options exist.

Decision points:

- task start with more than one legal affordance;
- progress stall;
- hazard change;
- inventory full;
- skill failure;
- lease near expiry;
- completion boundary;
- agency goal tie-break, only when the evaluation gate has enabled it and the
  top scores are close.

Fast paths:

- one legal option: skip Laya;
- deterministic score margin is large: skip Laya;
- confidence below gate: continue the current commitment;
- stale revision: discard the result;
- service error or timeout: deterministic fallback.

### Questions

The first version asks:

- `nextAction: choice` over legal affordances;
- `shouldContinue: noul` only when an active skill is running and stall
  evaluation is needed.

`danger` is not an input to Laya decisions. The guardian owns danger detection
and safety. Laya may see hazards in the state digest and may choose a survival
affordance, but it cannot override the guardian.

### Context

The decision digest should stay within the configured token budget. Proposed
content:

- health, food, position, time, hazards;
- compact inventory summary;
- needs vector;
- personality traits;
- current focus;
- intention label, step, age, attempts;
- commitments;
- recent 3-5 experiences;
- interruption;
- strategic goal and constraints;
- legal affordances;
- working memory revision.

If the digest exceeds the budget, drop recent experiences first, then
commitments, then optional strategic context. The revision and legal affordances
must never be dropped.

### Profile policy

**`home-full`**

- Tactical Laya is enabled by default.
- Use a blocking decision at safe boundaries with a short deadline.
- If the deadline expires, continue with the deterministic fallback.
- WebGPU is preferred when it meets the latency and stability gates.

**`home-min`**

- Tactical Laya is enabled with strict limits.
- Use background advisory only.
- Never block guardian, agency tick, skill execution, or task start.
- Start inference while work continues.
- Apply the result only at the next safe boundary if the revision and focus
  still match and the result has not expired.
- Limit to one in-flight decision per bot.
- Enforce a minimum interval between requests and a circuit breaker after
  repeated timeouts or low-confidence results.
- A background result never cancels an active skill.

### Implementation

- `config.decision.tactical` selects enabling, mode, deadline, minimum interval,
  per-minute cap, single-affordance skipping, and circuit-breaker threshold.
- `packages/brains/src/tactical-policy.ts` enforces those limits per bot.
- `packages/brains/src/laya-client.ts` runs blocking decisions or background
  advisory. Background results apply only at a later safe decision boundary.
- Decision digests carry focus, revision, commitments, recent experiences,
  interruption, and strategic intent. Optional context is dropped before the
  revision or legal affordances.
- Task execution compares the request focus and revision after the await and
  falls back deterministically when either changed.
- Agency goal tie-break sends only close candidate goals to Laya. It runs only
  when `agency.goalTieBreak.enabled` is true. `home-min` background mode keeps
  the deterministic winner and never blocks the agency tick; `home-full`
  blocking mode may wait for the short tactical deadline.
- Goal and task decisions are tagged with a decision kind, so a background
  advisory from one path cannot apply to the other.
- A goal tie-break result is applied only when its revision and focus still
  match; otherwise the deterministic arbiter winner is used and the drop is
  recorded as a recent experience.

### Commitment behavior

Laya does not choose the highest-scoring action on every call. It chooses among:

- continue the current focus;
- interrupt for a higher-priority need;
- switch focus at a safe boundary;
- recover from a failed action.

A switch must overcome commitment cost, minimum dwell time, and interruption
threshold. This is the main defense against behavioral thrash.

## 6. Strategic intent

The cloud planner emits structured strategic intent, not natural-language
instructions.

Schema:

```ts
interface StrategicIntent {
    planId: string;
    primaryGoal: {
        kind: GoalKind;
        weight: number;
        projectKind?: 'home' | 'storage' | 'build';
        blueprintRef?: string;
    };
    secondaryGoals: {
        kind: GoalKind;
        weight: number;
        projectKind?: 'home' | 'storage' | 'build';
        blueprintRef?: string;
    }[];
    constraints: string[];
    perBot: {
        botId: string;
        priorityModifiers: Partial<Record<GoalKind, number>>;
        constraints: string[];
    }[];
}
```

Rules:

- fleet intent is the default;
- per-bot overrides merge after fleet intent;
- bot IDs must exist;
- goal kinds must map to supported agency goals;
- project kinds must be `home`, `storage`, or `build`;
- blueprint references must resolve through the building catalog;
- priority modifiers are bounded;
- constraints are allowlisted;
- invalid intent is rejected and the last validated intent is retained.

### Intent delivery

- The current intent is delivered on session resume.
- A planner commit publishes a structured update event.
- Bots store the latest intent in working memory.
- A new intent applies at the next goal boundary.
- A new intent does not interrupt an active intention by default.
- If the planner is disabled or unavailable, bots use the last validated intent,
  then deterministic local defaults.

### Implementation

- `packages/core/src/schemas/strategic-intent.ts` owns the shared schema, goal
  kinds, project kinds, constraint allowlist, and update event.
- `packages/planning/src/semantic-validator.ts` validates bot IDs, goal kinds,
  project kinds, blueprint references, modifiers, constraints, and override
  caps.
- `packages/planning/src/strategic-intent-store.ts` keeps the latest validated
  intent beside the cached planner plan, merges per-bot overrides, and restores
  the last good intent on startup.
- `packages/agency/src/strategic-intent.ts` applies bounded priority bias and
  exposes constraints to the tactical digest.
- Bots persist the latest intent in working memory and apply it at the next goal
  boundary.

## 7. Routine and night preparation

Routine is a prior, not a script. Evening opens a preparation window; the bot
returns home, secures shelter, checks food, and readies gear before night.

Night readiness reports concrete gaps:

- missing or distant home;
- missing shelter;
- missing bed;
- missing or low food;
- missing weapon or armor;
- low health;
- nearby hostiles.

Shelter strategy is:

- `keep` when the bot is sheltered;
- `build` when there is enough material and daylight;
- `dig-in` when a safe dig site exists;
- `none` otherwise.

A first shelter is built around the home anchor, or around the current position
when no home exists. Bed preparation gathers wool, crafts a bed, and places it
at home or at the current position. Combat preparation crafts and equips the
best available gear.

`rest` is the default night intent. `hunt` is allowed only when a concrete need
or active task requires mob drops. Night readiness is re-assessed each agency
tick and recorded as an episode when it changes.

Routine is a daily prior, not a fixed script:

- morning: eat, check needs, then resume the progression plan, project, or a job;
- day: gather, build, farm, explore, or socialize;
- evening: return home, deposit surplus, craft, check stations, chat;
- night: shelter, sleep when a bed exists, or work cautiously;
- dusk: return home early enough to secure shelter, food, bed, and gear.

Idle time is purposeful and bounded. Allowed idle behaviors include storage
organization, chest sorting, base inspection, patrol, resource scanning, eating,
and resting. An empty leisure loop is not idle life.

## 8. Build and project goals

Build projects are agency focus. They are not a separate goal manager.

Flow:

1. Strategic intent or local initiative selects a project goal.
2. Agency proposes a personal project through the coordinator.
3. The coordinator composes and stores the blueprint and construction plan.
4. The coordinator creates the project, structure claim family, and SIP packages.
5. The coordinator seeds one construction task per package plus cleanup.
6. The task is offered through the job market; private projects stay owner-only.
7. Invite and open projects expose helper tasks and auto-issue scoped grants.
8. The bot accepts the matching task while retaining project focus.
9. The construction skill executes the exact stored plan package.
10. Progress reconciliation updates structure and project state.
11. The project completes when every package task and cleanup complete.

Project proposal alone is not enough. Without task seeding, a project remains
claimed but unbuilt.

Agency receives project summaries for goal generation. The bot process does not
open the coordinator database; project state arrives through session resume,
project responses, and structured update events.

Implemented project-focus behavior:

- an active project sets the working-memory `project` focus;
- while project focus is active, agency goal generation allows survival, eating,
  rest, shelter, and night prep, plus provisioning goals such as gather, craft,
  and deposit;
- provisioning goals supply the project; they do not replace project focus or
  bypass project claims;
- a home brief includes a bed, chest, crafting table, furnace, and lighting where
  materials allow;
- a project task accepted from the job market carries `projectId` and does not
  replace project focus;
- project focus is restored from session resume and is cleared when its project
  is no longer active;
- a normal job task does not create or clear project focus by itself.

## 9. Persistence and resume

Working memory is persisted in `agent_state` through the existing JSON state
snapshot. Old snapshots without working memory restore to an empty memory.

Strategic intent is persisted with the planner plan or an equivalent validated
store. Mission state is restored before agency resumes.

Session resume restores:

- needs and traits;
- intention;
- working memory;
- interruption and resume condition;
- project focus;
- active task and lease;
- current strategic intent;
- skill checkpoint.

After restore, agency reconciles the focus with the observed world before
executing a step. Stale blocks or tasks are handled by existing reconciliation
rules.

## 10. Safety and guardrails

- Guardian remains the only safety authority.
- No model directly calls mineflayer.
- No model writes SIP, claims, grants, or block changes.
- No cloud output is applied without schema and semantic validation.
- No Laya result is applied after a focus or revision change.
- No task lease is released merely because of a tactical interruption.
- No background advisory blocks task start or agency tick.
- No project task may edit outside its claim, grant, and fencing token.
- All destructive actions remain reversible and audited.

## 11. Configuration

Tactical, working-memory, goal tie-break, reflection, and strategic-intent keys
are implemented.

- `decision.tactical.enabled`
- `decision.tactical.mode`: `background` or `blocking`
- `decision.tactical.deadlineMilliseconds`
- `decision.tactical.minimumIntervalMilliseconds`
- `decision.tactical.maxDecisionsPerMinute`
- `decision.tactical.skipSingleAffordance`
- `decision.tactical.circuitBreakerFailureCount`
- `agency.workingMemory.maxCommitments` (default 4)
- `agency.workingMemory.maxExperiences` (default 8)
- `agency.goalTieBreak.enabled` (default false)
- `agency.goalTieBreak.closeScore` (default 0.12)
- `agency.reflection.enabled` (default true)
- `agency.reflection.maxTraitDelta` (default 0.01)
- `agency.progression.enabled` (default true)
- `agency.progression.milestoneCadenceMilliseconds`
- `agency.progression.maxStepAttempts`
- `agency.progression.pivotThreshold`
- `behavior.movement.*` — walk, sprint, pause, scan, final approach
- `behavior.gaze.*` — yaw rate, pitch rate, scan sweep, idle saccades
- `behavior.rhythm.*` — reaction latency, dwell, switch threshold, action gap
- `behavior.perception.*` — view cone, line of sight, memory radius
- `behavior.social.*` — reply delay, rate, greeting cooldown
- `behavior.idle.*` — idle duration and micro-behavior weights
- `behavior.village.*` — ownership radius, allowed regions, player base links,
  confidence threshold, inquiry cooldown, permission TTL
- `planner.strategicIntent.enabled`
- `planner.strategicIntent.maxBotOverrides`
- `training.traceEnabled`

Profile defaults:

- `home-min`: background advisory, strict interval and circuit breaker;
- `home-full`: blocking tactical at safe boundaries with a short deadline;
- both profiles: goal tie-break remains off until the behavioral evaluation gate
  passes; reflection is local and deterministic.

## 12. Evaluation gates

Behavior:

- interruption and resume survive restart;
- stale Laya results never overwrite newer focus;
- close goal tie-break falls back deterministically when disabled, stale, or
  below the confidence gate;
- task lease is preserved through interruption;
- no goal oscillation beyond the configured switch rate;
- project focus survives while project tasks run;
- project proposal produces a task and completes;
- planner disabled still yields autonomous behavior;
- cloud unavailable uses last-good intent or local defaults;
- reflection changes mood and bounded traits without blocking goal completion;
- the early-game progression reaches stone tools, crafting table, furnace,
  chest, and bed from an empty inventory without a planner or seed jobs;
- a blocked progression step pivots to an alternate source instead of abandoning
  the plan;
- pathfinding never places scaffold or bridge blocks and never digs for
  navigation;
- every break, place, use, attack, and container open is preceded by a look at
  the target;
- new targets respect the view cone and line of sight, or a remembered sighting;
- non-urgent goal dwell and switch rates stay inside the configured ranges;
- chat replies are delayed, varied, and rate-limited;
- idle time is purposeful and bounded;
- guardian, threat, hunger, fall, lava, and emergency stop bypass all
  humanization delays.

Performance:

- `home-min` background advisory never blocks agency, task start, or guardian;
- `home-full` tactical p95 stays within the configured budget;
- token count stays within `decision.maxInputTokens`;
- fallback rate and reason are visible in metrics and traces.

Behavioral value:

- Laya must beat deterministic policy on at least one behavioral metric without
  regressing others before agency tie-break is enabled.
- Humanization must reduce oddity-detector counts without regressing task
  success or increasing abandonment beyond the configured gate.
- The progression plan must reach the first base milestone within the scenario
  deadline with the planner disabled and no seed jobs.

## 13. Migration and compatibility

- `agent_state` stores JSON; optional working memory fields need no schema
  migration.
- Old snapshots restore with empty working memory and an empty progression plan.
- Strategic intent changes to the planner plan require schema validation updates.
- Project task metadata requires task and job-offer schema updates.
- Behavior traces are additive telemetry; they do not require state migration.
- Progression plan fields are optional and bounded; malformed plans fail closed
  to an empty plan.
- `player_confidence` is an additive coordinator-owned table keyed by player
  UUID; missing rows start at the initial confidence.
- Architecture graph update happens only when planned modules exist.
- Generated architecture Markdown is never edited by hand.

## 14. Documentation sequence

Each implementation phase follows:

1. Update design docs.
2. Implement.
3. Update `docs/architecture/graph.json` when module paths exist.
4. Run graph validation and regeneration.
5. Run tests and behavior validation.

Phase 0 documentation:

- this document;
- `main.md` design sections;
- `docs/building-system.md` project integration.

Phase 1 documentation:

- tactical Laya profile behavior;
- decision trace fields;
- planned config keys.

Phase 2 documentation:

- strategic intent schema;
- intent delivery;
- project task seeding;
- project completion.

Phase 3 documentation:

- agency tie-break;
- reflection and bounded personality updates.

Behavior-realism phases:

- execution stability and failure reporting;
- progression plan and finishing skills;
- movement, gaze, decision rhythm, and perception realism;
- village and farm behavior;
- behavior traces, oddity detectors, and player-likeness gates.

See [`behavior-roadmap.md`](behavior-roadmap.md) for the implementation order,
deliverables, and exit criteria.

## 15. Reflection and bounded personality updates

Reflection is local and deterministic. It runs after a goal completes or is
abandoned, never during guardian reactions, and never calls a model.

Reflection outputs:

- a mood string;
- bounded personality trait deltas;
- a short outcome summary.

Rules:

- completion produces a positive mood and a small increase in the trait
  associated with the goal kind;
- unsafe abandonment increases caution and produces a wary mood;
- infeasible abandonment produces frustration and a bounded patience change;
- preemption, expiry, claim conflict, and social rejection map to their own mood
  and bounded trait change;
- every trait stays within `0..1`;
- each reflection applies at most `agency.reflection.maxTraitDelta`;
- reflection failure is logged and never blocks goal completion or abandonment.

The outcome episode records the reflection payload. Working memory also records
the reflection as a recent experience so the tactical digest can use it.
Reflection does not override the guardian, intention safety, commitments,
strategic intent validation, or task leases.

Implementation:

- `packages/agency/src/reflection.ts` owns the deterministic reflection policy.
- `packages/agency/src/personality-model.ts` applies bounded trait adjustments.
- `apps/bot/src/agency-runtime.ts` runs reflection on completion, abandonment,
  and restored-intention abandonment.

## 16. Progression plan

The progression plan gives the bot a persistent, player-like early-game arc. It
is owned by agency and persisted inside working memory. It is not a second goal
manager and does not bypass the intention lifecycle.

Shape:

```ts
interface ProgressionPlan {
    id: string;
    version: number;
    revision: number;
    milestoneIndex: number;
    milestones: {
        id: string;
        kind: string;
        label: string;
        attempts: number;
        blocked: boolean;
        completedAt: string | null;
    }[];
    updatedAt: string;
}
```

Rules:

- milestones are ordered: forage, crafting table, wooden tools, stone, furnace
  and chest, base provisioning, farm, night routine;
- the plan expands a milestone into existing goal kinds and skills using a
  recipe port;
- the plan is immutable; transitions return a new plan and increment the
  working-memory revision;
- completed or already-satisfied milestones are skipped;
- partial counts carry over across goals and restarts;
- unknown plan versions restore to an empty plan and emit a `plan-migrated`
  trace;
- a failed step records an attempt, respects a cooldown, and pivots to an
  alternate source or target;
- the plan never overrides survival, eating, night preparation, project tasks,
  commitments, or the guardian;
- when the planner is disabled, the progression plan is the primary source of
  self-initiated goals;
- if the planner is enabled, strategic intent may bias milestone priority but
  cannot invalidate the plan.

The recipe port is injected at the composition root. The bot adapter reads live
Mineflayer recipes and stations; simulation and unit tests use a static table.
A missing recipe or station becomes a prerequisite milestone, not a failure
loop.

## 17. Decision rhythm and bounded imperfection

Human-like decisions need pacing, not randomness for its own sake.

Rules:

- non-urgent decisions wait for a bounded reaction delay;
- a new goal must overcome commitment cost and a minimum dwell;
- close candidates are selected with seeded satisficing, not a fixed argmax;
- a switch re-checks the snapshot after the delay; if conditions changed, the
  current commitment continues;
- failed steps cool down before retry and prefer an alternate target or source;
- occasional hesitation, scanning, and short detours are allowed;
- identical action and target sequences are rate-limited to avoid visible
  looping;
- guardian, threat, hunger, fall, lava, and emergency stop bypass every delay.

The policy is deterministic per seed. Live bots use one seed per session; tests
use a fixed seed so behavior assertions remain stable.

## 18. Movement and gaze realism

Movement realism is an execution policy under skills.

- Pathfinding never places scaffold or bridge blocks and never digs for
  navigation.
- Travel is split into short segments. The follower may pause, scan, and resume
  between segments.
- Walk by default. Sprint only on long, open, straight stretches. Never sprint
  indoors, inside a base, near hazards, or while eating.
- The bot looks toward the next waypoint with rate-limited yaw and pitch. It does
  not reverse direction instantly.
- Before breaking, placing, using, attacking, or opening a container, the bot
  stops, looks at the target, and pauses briefly.
- Explicit bridge, clear, and dig steps remain available when the plan chooses
  them. They are never a pathfinder side effect.
- Gaze and movement actions are recorded in the behavior trace.

## 19. Perception realism

Agency and skills must not act on information a player could not have.

- New targets require a view cone and line of sight, or a remembered sighting.
- The bot remembers discovered trees, stone, stations, farms, villages, water,
  and containers.
- Depleted resources are tracked and not re-targeted until a cooldown expires or
  a new sighting occurs.
- Container contents are known only after opening the container.
- Village detection uses clustered villagers, beds, doors, workstations, and
  farmland. It is a candidate, not an omniscient map.
- Farm ownership resolves from an active `farm_plot` claim first, then the
  nearest `house` landmark and its claim owners or linked players. Zero,
  multiple, or conflicting owners resolve to unknown or ambiguous; the bot never
  guesses.
- `PlayerConfidenceStore` is coordinator-owned and keyed by player UUID. It
  stores confidence, base links, interactions, and the last interaction time.
- Perception failures fail closed to the last known sighting or to survey
  behavior; they do not fall back to through-wall scanning.
- The guardian keeps its immediate safety scan. Safety perception is not subject
  to view-cone realism.

## 20. Social presence and idle life

Chat and body language are visible proof that the bot is present.

- Wire the chat adapter to incoming bot chat events.
- Reply after roughly 0.8–3 seconds, with personality-styled and varied
  templates.
- Look at the speaker and pause briefly during a greeting.
- Rate limit per bot and per conversation; operator mute always wins.
- Status messages are occasional and milestone-based, not a running commentary.
- Farm permission asks are one per plot per cooldown, delayed, and rate-limited.
  Silence is denial. Replies from unlinked players are ignored.
- Player confidence starts at `0.5`. Positive chat, gifts, help, and kept
  permission promises raise it; crop theft, claim violation, and unsafe base
  behavior lower it. It decays toward `0.5` with a 30-day half-life.
- A player must be linked to the nearby base and reach `0.6` confidence before
  an affirmative farm-permission reply is trusted. A known different owner
  always wins.
- Idle life includes storage organization, chest sorting, base inspection,
  patrol, resource scanning, eating, and resting.
- Idle behavior is bounded. It never replaces survival, night preparation, the
  progression plan, or an active project task.
- A late planner or Laya result cannot be applied to a newer focus while a social
  or idle action is running.

## 21. Open questions

- Whether project tasks should be seeded by the project service or by a separate
  project task seeder.
- When to enable agency goal tie-break beyond the first evaluation.
- Whether the progression plan should expose intermediate milestones after
  stone tools or jump directly to base provisioning.
- Whether village beds may be used for sleep by default or only when no personal
  bed exists.
- How much seeded variation is desirable before it becomes visible repetition.
