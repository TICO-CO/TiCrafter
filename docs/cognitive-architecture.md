# TiCrafter Cognitive Architecture

Status: design proposal. No implementation exists yet.

This document defines the boundary between reflex safety, local agency, tactical
Laya decisions, working memory, and the optional cloud planner. It is the
detailed companion to `main.md`; `main.md` remains the normative summary and the
source for architecture graph references.

`docs/architecture/graph.json` is intentionally unchanged until the planned
modules exist. `check-component-paths` requires every graph component to resolve
to a real source file.

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
| Perception     | World and self observations                              | Observation only         |

Rules:

- Exactly one active focus exists at a time: agency goal, project, or job task.
- Laya never invents goals, writes SIP, claims, or grants, or calls skills.
- The cloud planner never writes blocks or bypasses validation.
- The guardian remains the safety authority. Laya cannot authorize danger.
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

Proposed shape:

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
}
```

Bounds:

- maximum 4 commitments;
- maximum 8 recent experiences;
- one active interruption at a time;
- no full episode history is sent to Laya.

Working memory stores interpretations and outcomes, not world observations.
World state remains owned by perception and the coordinator.

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
- agency goal tie-break, after evaluation is enabled.

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

Proposed schema:

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

## 8. Build and project goals

Build projects are agency focus. They are not a separate goal manager.

Flow:

1. Strategic intent or local initiative selects a project goal.
2. Agency proposes a personal project through the coordinator.
3. The coordinator creates the project, claims, and SIP structure.
4. The coordinator seeds a construction task for the project work package.
5. The task is offered through the job market.
6. The bot accepts the matching task while retaining project focus.
7. The construction or schematic-build skill executes the task.
8. Progress reconciliation updates structure and project state.
9. The project completes when the work package and final diff complete.

Project proposal alone is not enough. Without task seeding, a project remains
claimed but unbuilt.

Agency receives project summaries for goal generation. The bot process does not
open the coordinator database; project state arrives through session resume,
project responses, and structured update events.

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

## 11. Planned configuration

These keys are planned, not implemented.

- `decision.tactical.enabled`
- `decision.tactical.mode`: `background` or `blocking`
- `decision.tactical.deadlineMilliseconds`
- `decision.tactical.minimumIntervalMilliseconds`
- `decision.tactical.maxDecisionsPerMinute`
- `decision.tactical.skipSingleAffordance`
- `decision.tactical.circuitBreakerFailureCount`
- `agency.workingMemory.maxCommitments`
- `agency.workingMemory.maxExperiences`
- `planner.strategicIntent.enabled`
- `planner.strategicIntent.maxBotOverrides`
- `training.traceEnabled`

Profile defaults:

- `home-min`: background advisory, strict interval and circuit breaker;
- `home-full`: blocking tactical at safe boundaries with a short deadline.

## 12. Evaluation gates

Behavior:

- interruption and resume survive restart;
- stale Laya results never overwrite newer focus;
- task lease is preserved through interruption;
- no goal oscillation beyond the configured switch rate;
- project focus survives while project tasks run;
- project proposal produces a task and completes;
- planner disabled still yields autonomous behavior;
- cloud unavailable uses last-good intent or local defaults.

Performance:

- `home-min` background advisory never blocks agency, task start, or guardian;
- `home-full` tactical p95 stays within the configured budget;
- token count stays within `decision.maxInputTokens`;
- fallback rate and reason are visible in metrics and traces.

Behavioral value:

- Laya must beat deterministic policy on at least one behavioral metric without
  regressing others before agency tie-break is enabled.

## 13. Migration and compatibility

- `agent_state` stores JSON; optional working memory fields need no schema
  migration.
- Old snapshots restore with empty working memory.
- Strategic intent changes to the planner plan require schema validation updates.
- Project task metadata requires task and job-offer schema updates.
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

## 15. Open questions

- Exact minimum interval and deadline values for `home-min`.
- Whether the first strategic intent version exposes constraints as a fixed
  allowlist or a small policy language.
- Whether project tasks should be seeded by the project service or by a separate
  project task seeder.
- How much recent experience Laya can use before token cost outweighs benefit.
- When to enable agency goal tie-break beyond the first evaluation.
- Whether reflection can change mood only, or also bounded priority modifiers.
