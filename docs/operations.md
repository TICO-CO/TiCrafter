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
- valid leases remain recoverable while the bot reconnects.

On bot reconnect, the session response carries the prior task, lease token,
checkpoint, and SIP revision. The bot restores the task and resumes the skill
checkpoint before claiming new work.

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
