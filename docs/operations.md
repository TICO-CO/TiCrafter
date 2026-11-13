# Operations Runbook

Runtime state lives in `DATA_DIR` (default `./data`). The coordinator owns SQLite
state; bot processes only use it for local skill checkpoints.

## Ops API

Default endpoint: `http://127.0.0.1:8787`.

| Method | Path                           | Purpose                          |
| ------ | ------------------------------ | -------------------------------- |
| GET    | `/health`                      | Readiness and liveness checks    |
| GET    | `/status`                      | Fleet, task, claim, and SIP view |
| GET    | `/metrics`                     | In-process metrics snapshot      |
| GET    | `/sip`                         | Current SIP snapshot             |
| GET    | `/agency`                      | Fleet needs, goals, and routines |
| GET    | `/bots/:botId/agency`          | One bot's agency state           |
| GET    | `/bots/:botId/episodes`        | Recent agency episodes           |
| POST   | `/bots/:botId/goal/cancel`     | Cancel one bot's active goal     |
| GET    | `/audit/events?limit=N`        | Recent coordinator events        |
| GET    | `/audit/blocks?limit=N&botId=` | Recent block changes             |
| GET    | `/audit/episodes?limit=N`      | Recent decision episodes         |
| POST   | `/fleet/pause`                 | Pause every connected bot        |
| POST   | `/fleet/resume`                | Resume every connected bot       |
| POST   | `/bots/:botId/pause`           | Pause one bot                    |
| POST   | `/bots/:botId/resume`          | Resume one bot                   |
| POST   | `/fleet/emergency-stop`        | Stop autonomy and safety actions |

Control requests accept an optional JSON body:

```json
{ "reason": "maintenance" }
```

## Pause and emergency stop

`pause` sends `bot.autonomy.pause`, suspends the bot profile, cancels the
active skill, and stops goal deliberation. The active intention is retained but
not advanced. `resume` clears the pause, clears any guardian emergency stop, and
lets the bot resume its intention or accept work again.

`emergency-stop` sends `bot.safety.stop` to every connected bot and suspends all
profiles. It cancels jobs, personal goals, and social actions. A bot stays
stopped until `resume` clears the guardian state. Both operations append an audit
event.

## Restart recovery

On coordinator start:

- expired claims and grants are closed;
- grants issued under an older coordinator epoch are revoked and fail
  authorization with `STALE_EPOCH`;
- bots marked online are reset to offline;
- tasks whose lease or claim expired are requeued;
- valid leases remain recoverable while the bot reconnects;
- SIP reconciliation runs before the scheduler starts and before bot processes are spawned.

If recovery or startup reconciliation fails, the coordinator closes instead of accepting work.
The scheduler then runs SIP reconciliation every 60 seconds and retention pruning daily.

On bot reconnect, the session response carries the prior agency state, intention,
home, relationships, job lease, checkpoint, and SIP revision. The bot restores
needs and intention, reconciles the goal with the observed world, then resumes
the skill checkpoint or abandons the goal with a typed reason before asking for
new work.

## Startup task seeds

`config/seed-tasks.json` is optional. When present, the coordinator creates its
jobs before startup. Existing task IDs are skipped, so restarts do not duplicate
work. The default file seeds four `collect` jobs with an eight-block radius.

Seed jobs are not required for autonomy. With an empty seed file and the planner
disabled, bots start from needs and generate personal goals.

## Planner application

When `planner.enabled` is true, each successful planner cycle commits its SIP
proposal first and then creates its job proposals through the task board.
Existing task IDs are treated as no-ops. SIP commit failures leave the cycle
unapplied for the next planner trigger.

Planner jobs are offers. Bots may accept, defer, or decline them based on needs,
safety, distance, role fit, and personality. A decline never changes job state.
The planner remains an advisor even when enabled.

## Autonomy operations

Inspect `GET /agency` or `GET /bots/:botId/agency` for current needs, active
goal, routine phase, home, and last deliberation time. `GET /bots/:botId/episodes`
shows recent goal outcomes and abandonment reasons.

Cancel one active goal with `POST /bots/:botId/goal/cancel`. This releases the
associated claims and records an abandonment episode. It does not stop survival
reflexes or the guardian.

Chat rate, goal cadence, need decay, idle threshold, and job acceptance
thresholds come from the `agency` config block. Lower chat rate or disable social
output through config when running unattended demos.

## Behavior realism

Behavior pacing is configured under `behavior`. Movement controls sprint
distance, waypoint pause chance and duration, scan chance, and final approach.
Gaze controls yaw rate, pitch rate, update frequency, and scan sweep. Rhythm
controls reaction latency, minimum dwell, switch threshold, progress watchdog
timeout, and action gap. Perception controls visibility refresh, raycasts per
tick, sighting TTL, focus radius, and view half angle. Social controls reply
delay and greeting cooldown. Idle controls the bounded idle window.

`behavior.perception.visibilityRefreshHz`, `maxRaycastsPerTick`, and
`viewHalfAngleRadians` gate target selection. A target must be inside the view
cone and line of sight, or remembered from a recent sighting. Interaction
actions look at the target first unless the guardian is reacting.

The early-game progression plan is persisted in working memory and advances
through forage, crafting table, wooden tools, stone tools, furnace and chest,
and base provisioning. Progress is checkpointed per milestone. Unknown plan
versions restore to an empty plan and emit `plan-migrated`.

The agency progress watchdog defaults to `behavior.rhythm.progressTimeoutMilliseconds`
and preempts a stalled skill before retry. Goal deadlines are per-kind and can
be overridden with `agency.goalDeadlines`. Deadline expiry abandons with reason
`deadline`; one extension is allowed when progress advanced.

The planner client sends `x-opencode-session` and a TiCrafter user agent. For
OpenCode Go, set `PLANNER_BASE_URL=https://opencode.ai/inference/go/openai/v1`
and `PLANNER_MODEL=muse-spark-1.3-contributor`.

## SIP reconciliation

Reconciliation compares observed landmarks with SIP structure work packages.
It updates progress only when observed coverage is higher than the stored value.
It never lowers progress from a missing observation and never changes structure
lifecycle status. Findings and progress changes are recorded as `sip.reconciliation`
audit events.

## Backpressure

The coordinator samples decision p95 latency every scheduler tick. After two
consecutive samples above `250ms`, fleet decision rate is throttled to 50%.
It returns to normal after three consecutive samples below 80% of the budget.
Backpressure changes are recorded as `core.backpressure` audit events. The
confidence gate is unchanged.

## Reach and action rate

Bots reject physical actions outside `safety.interactionReach` and actions that
exceed `safety.actionsPerSecond`. Both values come from config; defaults are
`4.5` blocks and `10` actions per second.

## Building execution

Bots fetch blueprint documents by exact id and revision with
`bot.blueprint.get`; the coordinator replies with `bot.blueprint.response`.
Missing revisions fail closed and are never replaced with the latest revision.

The coordinator owns site, foundation, dependency, work-package, and scaffold
planning. Bots fetch the exact construction plan revision, execute the
`procurement` task for each material-bearing package, then execute block changes
through the building execution service. Procurement withdraws from nearby
containers, crafts when recipes and ingredients are available, and gathers raw
materials from resource blocks. Mismatched blocks are broken before placement,
scaffolds are removed after their targets complete, and unresolved material
shortages fail as `missing-item` before the first package block change.
Construction and procurement checkpoints store plan id, revision, package id,
and grant metadata; restore re-diffs and re-plans before resuming.

Task lease heartbeats also renew the package claim, including helper tasks whose
claims remain owned by the project owner. Session resume and task assignments
carry the active task claim, helper grant regions, and other projects' active
claim regions; the bot safety gate vetoes destructive actions inside another
project's claim unless the bot owns the claim or holds a matching grant
operation. SIP protected and no-build zones stay coordinator-side. The
coordinator still verifies attributed edits after the update; rejected edits are
audited, the task is requeued, and the bot receives a safety stop.

## Soak testing

Short smoke:

```sh
bun tools/eval/run.mjs soak house-build --duration 600000 --interval 30000
```

Hardware validation uses the full two-hour duration:

```sh
bun tools/eval/run.mjs soak house-build --duration 7200000 --interval 30000
```

The soak report fails on RSS growth above 256 MiB, claim-count drift, missing
heartbeat evidence, or a coordinator that does not stay up for the full run.
Run the 4-bot profile on `home-min` and the 8-bot profile on `home-full`.

Autonomy soaks:

```sh
bun tools/eval/run.mjs soak autonomy-no-tasks --duration 600000 --interval 30000
bun tools/eval/run.mjs soak personal-homes --duration 600000 --interval 30000
bun tools/eval/run.mjs soak social-village --duration 600000 --interval 30000
bun tools/eval/run.mjs soak night-routine --duration 600000 --interval 30000
```

Autonomy soak fails on long idle drift above 20%, goal churn above the configured
limit, missing need-satisfaction evidence, claim conflicts between personal
homes, or a bot that stops pursuing goals before the run ends.

## Behavior validation (milestone 19)

The behavior validation harness is the final milestone. It runs after the
implementation milestones and exists to validate them; it does not change
runtime behavior. One scenario definition drives both a simulated run and a live
run.

```sh
bun tools/eval/run.mjs scenario personal-homes --mode simulate
bun tools/eval/run.mjs scenario personal-homes --mode live --accept-eula
bun tools/eval/run.mjs scenario early-game-bootstrap --mode simulate
bun tools/eval/run.mjs scenario human-signature --mode simulate
bun tools/eval/run.mjs scenario human-movement --mode live --accept-eula
bun tools/eval/run.mjs inspect data/eval/personal-homes --bot bot.tibot1
bun tools/eval/run.mjs check data/eval/personal-homes --scenario personal-homes
```

`scenario --mode simulate` uses a fake world, inventory, and clock while running
the real agency, planning, skill, building, progression, and humanization code.
It does not start a Minecraft server or connect mineflayer bots. `--mode live`
reuses the same scenario and assertions against the repo-provisioned server.

`inspect` prints a per-bot decision timeline instead of raw events. It shows goal
choices, plan milestones, planner or Laya advice, skill outcomes, gaze and pause
events, movement segments, chat, building progress, claim conflicts, idle
periods, and need trends. Filters include `--bot`, `--since`, `--type`, and
`--json`.

`check` applies the scenario assertions to an existing data directory and exits
non-zero on failure. Reports fail on assertion failures, duplicate block writes,
missing goal or need evidence, missing plan progress, behavior-realism violations,
build mismatches, or missing expected decision events.

## Behavior realism operations

Behavior realism is a pacing layer, not a safety layer. The guardian, threat,
hunger, fall, lava, and emergency-stop paths bypass every humanization delay.

Config groups:

- `behavior.movement.*` — walk, sprint, pause, scan, final approach;
- `behavior.gaze.*` — yaw rate, pitch rate, scan sweep, idle saccades;
- `behavior.rhythm.*` — reaction latency, dwell, switch threshold, action gap;
- `behavior.perception.*` — view cone, line of sight, memory radius;
- `behavior.social.*` — reply delay, rate, greeting cooldown;
- `behavior.idle.*` — idle duration and micro-behavior weights;
- `behavior.village.*` — ownership radius, allowed regions, player base links,
  confidence threshold, inquiry cooldown, and permission TTL.

Village defaults:

- `ownershipRadius` — 32 blocks;
- `allowedPlotRegions` — empty;
- `playerBaseLinks` — operator-only player-to-base mappings;
- `playerConfidenceInitial` — 0.5;
- `playerConfidenceThreshold` — 0.6;
- `permissionAskCooldownMs` — 300000;
- `permissionTimeoutMs` — 60000;
- `permissionGrantTtlMs` — 600000.

Player confidence is coordinator-owned. Bots report nearby players through
`bot.player-sighting` and granted permissions through `bot.permission-outcome`.
The coordinator maps sightings to the nearest house, updates confidence from
operator links and repeated proximity, and records kept permission outcomes.
Bots receive confidence snapshots through ownership responses and never compute
trust from chat text alone. Unknown farmland without a claim, nearby claimed
house, linked player, or `allowedPlotRegions` entry is denied. No village
permission path opens containers or trades.

- `agency.progression.*` — progression plan cadence, attempts, pivot threshold,
  plan version.

Debugging:

- disable `agency.progression.enabled` to retain legacy goal generation during
  migration;
- disable individual behavior groups to isolate a movement or timing problem;
- keep safety groups enabled; they do not have a humanization toggle;
- inspect `trace.jsonl` for `decision`, `movement`, `gaze`, `pause`, `action`,
  `chat`, `permission`, and `progression` events;
- check player confidence and base links before changing village permission
  settings; lower confidence never widens access;
- replay a failed run with the recorded seed before changing configuration.

Alerts:

- `auto-scaffold` above zero;
- `zero-look-interact` above zero;
- `teleport-step` or `instant-turn` above zero;
- `switch-storm` or `same-target-retry` above threshold;
- `unpermitted-farm-harvest` above zero;
- permission grants from unlinked or below-threshold players above zero;
- chat duplicate replies above zero;
- progression milestones stalled beyond the configured attempt budget.

A behavior-realism alert blocks promotion. A safety alert always takes priority
over a behavior alert.

## Failure classes

Skill failures map to task retry classes:

| Skill failure                                           | Task class     |
| ------------------------------------------------------- | -------------- |
| `invalid-input`, `unsupported`                          | `invalid`      |
| `missing-item`, `missing-tool`                          | `precondition` |
| `no-path`, `target-missing`                             | `blocked`      |
| `unsafe`                                                | `fatal`        |
| `timeout`, `preempted`, `cancelled`, `execution-failed` | `transient`    |

`transient`, `precondition`, and `blocked` retry with backoff. `invalid` and
`fatal` go straight to dead letter.

Agency goals abandon with a typed reason instead of retrying forever:

| Reason             | Meaning                                           |
| ------------------ | ------------------------------------------------- |
| `unsafe`           | Guardian or hazard evaluator rejected the goal.   |
| `infeasible`       | Required resource, tool, or path does not exist.  |
| `preempted`        | Urgent survival need or emergency stop took over. |
| `expired`          | Goal deadline passed or opportunity disappeared.  |
| `claim_conflict`   | Personal project overlapped another active claim. |
| `social_rejection` | Requested help or sharing was declined.           |

Every abandonment is appended to `agent_episodes` and appears in
`GET /bots/:botId/episodes`.
