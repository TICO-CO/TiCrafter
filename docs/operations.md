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

`pause` sends `bot.autonomy.pause`, suspends the bot profile, and cancels the
active skill. `resume` clears the pause, clears any guardian emergency stop, and
lets the bot claim work again.

`emergency-stop` sends `bot.safety.stop` to every connected bot and suspends all
profiles. A bot stays stopped until `resume` clears the guardian state. Both
operations append an audit event.

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

On bot reconnect, the session response carries the prior task, lease token,
checkpoint, and SIP revision. The bot restores the task and resumes the skill
checkpoint before claiming new work.

## Startup task seeds

`config/seed-tasks.json` is optional. When present, the coordinator creates its
tasks before startup. Existing task IDs are skipped, so restarts do not duplicate
work. The default file seeds four `collect` tasks with an eight-block radius.

## Planner application

When `planner.enabled` is true, each successful planner cycle commits its SIP
proposal first and then creates its task proposals through the task board.
Existing task IDs are treated as no-ops. SIP commit failures leave the cycle
unapplied for the next planner trigger.

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
