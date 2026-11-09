# TiCrafter Relation Catalog

> Generated from `docs/architecture/graph.json`. Edit the graph, then run `node tools/architecture/render-graphs.mjs`.


**Relations:** 473  
**State owners:** 20  
**Allowed cycles:** 0

## Relation types

| Type | Semantics |
|---|---|
| `depends_on` | Source requires the target to function; synchronous failure propagates unless a documented fallback exists. |
| `controls` | Source has authority to command, veto, stop, or otherwise constrain the target. |
| `reads` | Source reads state owned by the target through the target interface. |
| `writes` | Source writes state owned by the target; the target is the state owner and the source must be a declared writer. |
| `proposes_to` | Source produces an untrusted proposal; target validates and commits or rejects it. |
| `validates` | Source validates or vetoes the target before the target may act. |
| `publishes` | Source publishes an event to the target or event stream. |
| `subscribes` | Source subscribes to events produced by the target. |
| `persists_to` | Source persists state through the target repository or storage boundary. |
| `observes` | Source emits telemetry or reads observability data without owning target state. |
| `delegates_to` | Source hands a job to the target while retaining responsibility for the outcome. |

## Relation counts

| Type | Count |
|---|---:|
| `controls` | 21 |
| `delegates_to` | 17 |
| `depends_on` | 318 |
| `observes` | 8 |
| `proposes_to` | 6 |
| `publishes` | 11 |
| `reads` | 55 |
| `subscribes` | 5 |
| `validates` | 2 |
| `writes` | 30 |

## State ownership

Every `writes` edge must target a declared state owner and originate from a declared writer.

| State | Owner | Writers | Readers |
|---|---|---|---|
| `sip.revisions` | `sip.revision-manager` | `sip.revision-manager` | `grants.design-revision-guard`, `world.plan-tagging` |
| `sip.zones` | `sip.zone-store` | `sip.transactional-committer` | `sip.spatial-overlap-validator`, `planner.context-builder` |
| `sip.structures` | `sip.structure-store` | `sip.transactional-committer` | `grants.compatibility-checker`, `world.plan-tagging`, `planner.context-builder` |
| `sip.roads` | `sip.road-store` | `sip.transactional-committer` | `sip.dependency-validator`, `planner.context-builder` |
| `sip.farms` | `sip.farm-store` | `sip.transactional-committer` | `skills.harvest-farm`, `skills.plant-farm`, `planner.context-builder` |
| `sip.containers` | `sip.container-registry` | `sip.transactional-committer` | `world.container-memory`, `planner.context-builder` |
| `sip.pathGraph` | `sip.path-graph-store` | `sip.transactional-committer` | `world.spatial-query-engine`, `skills.follow-path` |
| `sip.rules` | `sip.rules-store` | `sip.transactional-committer` | `grants.compatibility-checker`, `safety.safety-policy-engine`, `planner.semantic-validator` |
| `tasks` | `tasks.task-repository` | `tasks.atomic-task-claimer`, `tasks.task-state-machine`, `tasks.retry-manager`, `tasks.dead-letter-manager` | `planner.context-builder`, `ops.status-aggregator`, `bots.delta-sync-planner` |
| `claims` | `claims.claim-repository` | `claims.atomic-acquirer`, `claims.lease-heartbeat`, `claims.lease-reaper`, `claims.claim-releaser` | `grants.compatibility-checker`, `safety.safety-policy-engine`, `ops.status-aggregator` |
| `edit_grants` | `grants.grant-repository` | `grants.grant-issuer`, `grants.grant-revoker`, `grants.grant-expiry` | `grants.compatibility-checker`, `bots.delta-sync-planner` |
| `bots` | `bots.profile-store` | `bots.identity-authenticator`, `bots.role-manager`, `bots.behavior-profile-manager`, `bots.relationship-store`, `bots.name-pool-allocator` | `planner.context-builder`, `ops.status-aggregator` |
| `chunks` | `world.chunk-version-store` | `world.observation-ingestor`, `world.merge-conflict-resolver` | `world.occupancy-grid` |
| `landmarks` | `world.landmark-registry` | `world.detector-result-integrator`, `world.confidence-decay` | `world.spatial-query-engine`, `world.world-reconciler` |
| `containers` | `world.container-memory` | `building.container-refill-adapter` | `skills.deposit`, `skills.withdraw`, `building.material-preflight` |
| `event_log` | `memory.event-log-writer` | `memory.event-log-writer`, `safety.incident-journal` | `ops.audit-viewer`, `eval.replay-engine`, `training.trace-exporter` |
| `block_changelog` | `memory.block-changelog-writer` | `building.rollback-journal` | `ops.audit-viewer`, `eval.replay-engine` |
| `metrics` | `ops.metrics-registry` | `decision.latency-metrics` | `ops.status-aggregator`, `ops.health-readiness`, `eval.metrics-reporter` |
| `skill_checkpoints` | `skill-runtime.checkpoint-manager` | `skill-runtime.checkpoint-manager` | `bots.resume-orchestrator`, `skill-runtime.restore-validator` |
| `planner.planCache` | `planner.plan-cache` | `planner.plan-cache` | `planner.keep-last-good-fallback` |

## Cross-system summary

| From system | To system | Relations | Types |
|---|---|---:|---|
| `Coordinator Runtime` | `Bot Registry and Profiles` | 3 | depends_on×2, publishes×1 |
| `Coordinator Runtime` | `Claims and Leases` | 4 | controls×2, delegates_to×2 |
| `Coordinator Runtime` | `Config and Profiles` | 3 | depends_on×3 |
| `Coordinator Runtime` | `Edit Grants and Collaboration` | 2 | controls×1, delegates_to×1 |
| `Coordinator Runtime` | `Memory and Persistence` | 4 | depends_on×3, delegates_to×1 |
| `Coordinator Runtime` | `Cloud Planner` | 1 | delegates_to×1 |
| `Coordinator Runtime` | `Shared Infrastructure Plan` | 3 | controls×1, delegates_to×1, depends_on×1 |
| `Coordinator Runtime` | `Task Board` | 1 | controls×1 |
| `Coordinator Runtime` | `Transport and Protocol` | 4 | depends_on×4 |
| `Transport and Protocol` | `Bot Registry and Profiles` | 1 | depends_on×1 |
| `Transport and Protocol` | `Config and Profiles` | 1 | depends_on×1 |
| `Transport and Protocol` | `World Model and Landmarks` | 1 | publishes×1 |
| `Shared Infrastructure Plan` | `Edit Grants and Collaboration` | 1 | publishes×1 |
| `Shared Infrastructure Plan` | `Memory and Persistence` | 9 | depends_on×9 |
| `Shared Infrastructure Plan` | `World Model and Landmarks` | 4 | depends_on×2, reads×1, publishes×1 |
| `Task Board` | `Bot Registry and Profiles` | 1 | reads×1 |
| `Task Board` | `Memory and Persistence` | 3 | depends_on×3 |
| `Task Board` | `World Model and Landmarks` | 1 | reads×1 |
| `Claims and Leases` | `Coordinator Runtime` | 1 | depends_on×1 |
| `Claims and Leases` | `Memory and Persistence` | 3 | depends_on×3 |
| `Claims and Leases` | `Ops and Observability` | 1 | observes×1 |
| `Claims and Leases` | `Shared Infrastructure Plan` | 1 | depends_on×1 |
| `Claims and Leases` | `Task Board` | 2 | depends_on×2 |
| `Edit Grants and Collaboration` | `Bot Registry and Profiles` | 2 | reads×2 |
| `Edit Grants and Collaboration` | `Claims and Leases` | 2 | reads×1, depends_on×1 |
| `Edit Grants and Collaboration` | `Memory and Persistence` | 1 | depends_on×1 |
| `Edit Grants and Collaboration` | `Shared Infrastructure Plan` | 4 | depends_on×3, reads×1 |
| `Edit Grants and Collaboration` | `Transport and Protocol` | 1 | publishes×1 |
| `Bot Registry and Profiles` | `Claims and Leases` | 1 | delegates_to×1 |
| `Bot Registry and Profiles` | `Config and Profiles` | 2 | depends_on×2 |
| `Bot Registry and Profiles` | `Edit Grants and Collaboration` | 1 | reads×1 |
| `Bot Registry and Profiles` | `Memory and Persistence` | 1 | depends_on×1 |
| `Bot Registry and Profiles` | `Shared Infrastructure Plan` | 2 | reads×1, delegates_to×1 |
| `Bot Registry and Profiles` | `Skill Runtime` | 1 | reads×1 |
| `Bot Registry and Profiles` | `Task Board` | 1 | reads×1 |
| `World Model and Landmarks` | `Memory and Persistence` | 2 | depends_on×2 |
| `World Model and Landmarks` | `Shared Infrastructure Plan` | 2 | reads×2 |
| `World Model and Landmarks` | `Transport and Protocol` | 2 | subscribes×1, reads×1 |
| `Perception` | `Config and Profiles` | 1 | depends_on×1 |
| `Perception` | `Transport and Protocol` | 1 | publishes×1 |
| `Laya Decision Service` | `Bot Runtime and Mineflayer Adapter` | 1 | proposes_to×1 |
| `Laya Decision Service` | `Config and Profiles` | 4 | depends_on×4 |
| `Laya Decision Service` | `Ops and Observability` | 3 | observes×2, writes×1 |
| `Laya Decision Service` | `Transport and Protocol` | 3 | depends_on×1, publishes×1, subscribes×1 |
| `Cloud Planner` | `Bot Registry and Profiles` | 1 | reads×1 |
| `Cloud Planner` | `Config and Profiles` | 2 | depends_on×2 |
| `Cloud Planner` | `Edit Grants and Collaboration` | 2 | reads×1, proposes_to×1 |
| `Cloud Planner` | `Memory and Persistence` | 1 | depends_on×1 |
| `Cloud Planner` | `Ops and Observability` | 2 | observes×2 |
| `Cloud Planner` | `Shared Infrastructure Plan` | 6 | reads×4, depends_on×1, proposes_to×1 |
| `Cloud Planner` | `Skill Runtime` | 1 | reads×1 |
| `Cloud Planner` | `Task Board` | 3 | reads×2, proposes_to×1 |
| `Cloud Planner` | `Transport and Protocol` | 1 | subscribes×1 |
| `Cloud Planner` | `World Model and Landmarks` | 2 | reads×2 |
| `Skill Runtime` | `Bot Runtime and Mineflayer Adapter` | 1 | reads×1 |
| `Skill Runtime` | `Memory and Persistence` | 1 | depends_on×1 |
| `Skill Runtime` | `Ops and Observability` | 1 | observes×1 |
| `Skill Runtime` | `Autonomy and Safety` | 2 | reads×2 |
| `Skill Runtime` | `Shared Infrastructure Plan` | 1 | reads×1 |
| `Skill Runtime` | `Transport and Protocol` | 2 | publishes×2 |
| `Skill Runtime` | `World Model and Landmarks` | 2 | reads×1, depends_on×1 |
| `Skill Library` | `Bot Runtime and Mineflayer Adapter` | 12 | depends_on×12 |
| `Skill Library` | `Building` | 8 | depends_on×8 |
| `Skill Library` | `Autonomy and Safety` | 2 | depends_on×2 |
| `Skill Library` | `Shared Infrastructure Plan` | 3 | depends_on×3 |
| `Skill Library` | `Skill Runtime` | 4 | depends_on×4 |
| `Skill Library` | `World Model and Landmarks` | 4 | depends_on×4 |
| `Building` | `Bot Runtime and Mineflayer Adapter` | 3 | depends_on×2, reads×1 |
| `Building` | `Memory and Persistence` | 1 | writes×1 |
| `Building` | `Autonomy and Safety` | 1 | depends_on×1 |
| `Building` | `Shared Infrastructure Plan` | 3 | depends_on×1, reads×2 |
| `Building` | `Skill Runtime` | 1 | reads×1 |
| `Building` | `Transport and Protocol` | 1 | subscribes×1 |
| `Building` | `World Model and Landmarks` | 5 | reads×4, writes×1 |
| `Bot Runtime and Mineflayer Adapter` | `Bot Registry and Profiles` | 2 | reads×1, delegates_to×1 |
| `Bot Runtime and Mineflayer Adapter` | `Config and Profiles` | 3 | depends_on×3 |
| `Bot Runtime and Mineflayer Adapter` | `Perception` | 4 | delegates_to×2, depends_on×2 |
| `Bot Runtime and Mineflayer Adapter` | `Autonomy and Safety` | 4 | depends_on×4 |
| `Bot Runtime and Mineflayer Adapter` | `Skill Runtime` | 4 | depends_on×3, delegates_to×1 |
| `Bot Runtime and Mineflayer Adapter` | `Transport and Protocol` | 3 | subscribes×1, depends_on×1, publishes×1 |
| `Autonomy and Safety` | `Bot Runtime and Mineflayer Adapter` | 2 | validates×1, controls×1 |
| `Autonomy and Safety` | `Building` | 1 | validates×1 |
| `Autonomy and Safety` | `Claims and Leases` | 4 | reads×4 |
| `Autonomy and Safety` | `Coordinator Runtime` | 2 | controls×1, proposes_to×1 |
| `Autonomy and Safety` | `Memory and Persistence` | 1 | writes×1 |
| `Autonomy and Safety` | `Cloud Planner` | 1 | proposes_to×1 |
| `Autonomy and Safety` | `Shared Infrastructure Plan` | 2 | reads×2 |
| `Autonomy and Safety` | `Transport and Protocol` | 2 | depends_on×2 |
| `Autonomy and Safety` | `World Model and Landmarks` | 2 | reads×2 |
| `Ops and Observability` | `Bot Runtime and Mineflayer Adapter` | 1 | controls×1 |
| `Ops and Observability` | `Bot Registry and Profiles` | 2 | depends_on×2 |
| `Ops and Observability` | `Claims and Leases` | 1 | reads×1 |
| `Ops and Observability` | `Laya Decision Service` | 1 | depends_on×1 |
| `Ops and Observability` | `Memory and Persistence` | 3 | reads×2, depends_on×1 |
| `Ops and Observability` | `Autonomy and Safety` | 1 | controls×1 |
| `Ops and Observability` | `Shared Infrastructure Plan` | 2 | depends_on×1, reads×1 |
| `Ops and Observability` | `Task Board` | 1 | reads×1 |
| `Ops and Observability` | `Transport and Protocol` | 3 | depends_on×3 |
| `Testing and Evaluation` | `Claims and Leases` | 1 | depends_on×1 |
| `Testing and Evaluation` | `Laya Decision Service` | 2 | depends_on×2 |
| `Testing and Evaluation` | `Memory and Persistence` | 1 | depends_on×1 |
| `Testing and Evaluation` | `Ops and Observability` | 1 | observes×1 |
| `Testing and Evaluation` | `Perception` | 1 | depends_on×1 |
| `Testing and Evaluation` | `Task Board` | 1 | depends_on×1 |
| `Laya Training` | `Laya Decision Service` | 1 | reads×1 |
| `Laya Training` | `Testing and Evaluation` | 1 | depends_on×1 |
| `Laya Training` | `Memory and Persistence` | 1 | reads×1 |

## Allowed dependency cycles

None.

## Forbidden edges

| Rule | From pattern | To pattern | Types | Reason |
|---|---|---|---|---|
| `fe.model-action` | `decision.*` | `bot-runtime.action-executor` | `*` | No model calls mineflayer directly. |
| `fe.planner-action` | `planner.*` | `bot-runtime.action-executor` | `*` | Planner emits plans and tasks only. |
| `fe.planner-sip-write` | `planner.*` | `sip.*` | `writes` | Planner cannot write SIP state; it proposes mutations. |
| `fe.bot-sqlite` | `bot-runtime.*` | `memory.sqlite-runtime` | `*` | Bot processes use coordinator transport, not SQLite. |
| `fe.perception-sip-write` | `perception.*` | `sip.*` | `writes` | Perception emits observations; it cannot write SIP state. |
| `fe.skills-sip-write` | `skills.*` | `sip.*` | `writes` | Skills emit effects; coordinator owns SIP writes. |
| `fe.decision-sip-write` | `decision.*` | `sip.*` | `writes` | Decision service is advisory only. |
| `fe.training-runtime` | `training.*` | `bot-runtime.*` | `depends_on`, `controls`, `writes` | Training is dev-only and not imported by runtime. |

## Coordinator Runtime relations

| ID | From | Type | To | Protocol | Sync | Criticality | Payload | Failure behavior | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `rel.0111` | `core.backpressure-controller` | `depends_on` | `transport.flow-control` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0112` | `core.command-router` | `controls` | `claims.atomic-acquirer` | `in-process` | sync | hard | claim request | Caller aborts the operation or uses its documented fallback. | Resource claims are routed through the authority. |
| `rel.0113` | `core.command-router` | `controls` | `grants.grant-issuer` | `in-process` | sync | hard | edit request | Caller aborts the operation or uses its documented fallback. | Grant issuance is centralized. |
| `rel.0114` | `core.command-router` | `controls` | `sip.transactional-committer` | `in-process` | sync | hard | commit command | Caller aborts the operation or uses its documented fallback. | Only validated commands reach the SIP committer. |
| `rel.0115` | `core.command-router` | `controls` | `tasks.atomic-task-claimer` | `in-process` | sync | hard | claim command | Caller aborts the operation or uses its documented fallback. | Bot task claims are routed through the authority. |
| `rel.0116` | `core.command-router` | `depends_on` | `transport.message-schema-registry` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0117` | `core.coordinator-epoch` | `controls` | `claims.fencing-token-authority` | `in-process` | sync | hard | coordinator epoch | Caller aborts the operation or uses its documented fallback. | Fencing tokens include the epoch. |
| `rel.0118` | `core.coordinator-epoch` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0119` | `core.global-scheduler` | `delegates_to` | `claims.lease-reaper` | `in-process` | sync | hard | lease expiry tick | Caller aborts the operation or uses its documented fallback. | Lease expiry is a scheduled job. |
| `rel.0120` | `core.global-scheduler` | `depends_on` | `core.coordinator-epoch` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0121` | `core.global-scheduler` | `delegates_to` | `memory.retention-pruner` | `in-process` | sync | hard | retention tick | Caller aborts the operation or uses its documented fallback. | Retention runs on a schedule. |
| `rel.0122` | `core.global-scheduler` | `delegates_to` | `planner.trigger-evaluator` | `in-process` | sync | hard | planner trigger tick | Caller aborts the operation or uses its documented fallback. | Planner triggers are scheduled. |
| `rel.0123` | `core.global-scheduler` | `delegates_to` | `sip.reconciliation-engine` | `in-process` | sync | hard | reconciliation tick | Caller aborts the operation or uses its documented fallback. | Reconciliation is a scheduled job. |
| `rel.0124` | `core.process-bootstrap` | `depends_on` | `config.config-schema-validator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0125` | `core.process-bootstrap` | `depends_on` | `config.env-parser` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0126` | `core.process-bootstrap` | `depends_on` | `core.restart-recovery` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0127` | `core.process-bootstrap` | `depends_on` | `core.service-composition` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0128` | `core.process-bootstrap` | `depends_on` | `memory.migration-runner` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0129` | `core.process-bootstrap` | `depends_on` | `transport.ws-codec` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0130` | `core.restart-recovery` | `depends_on` | `bots.resume-orchestrator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0131` | `core.restart-recovery` | `delegates_to` | `claims.lease-reaper` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0132` | `core.restart-recovery` | `delegates_to` | `grants.grant-expiry` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0133` | `core.restart-recovery` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0134` | `core.restart-recovery` | `depends_on` | `sip.reconciliation-engine` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0135` | `core.service-composition` | `depends_on` | `config.profile-resolver` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0136` | `core.service-composition` | `depends_on` | `core.global-scheduler` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0137` | `core.session-manager` | `depends_on` | `bots.identity-authenticator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0138` | `core.session-manager` | `publishes` | `bots.presence-tracker` | `in-process` | async | hard | session state | Caller aborts the operation or uses its documented fallback. | Presence is updated from authenticated sessions. |
| `rel.0139` | `core.session-manager` | `depends_on` | `transport.ws-codec` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |

## Transport and Protocol relations

| ID | From | Type | To | Protocol | Sync | Criticality | Payload | Failure behavior | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `rel.0445` | `transport.auth` | `depends_on` | `bots.identity-authenticator` | `in-process` | sync | hard | identity assertion | Caller aborts the operation or uses its documented fallback. | Transport authentication delegates identity validation. |
| `rel.0446` | `transport.auth` | `depends_on` | `config.secrets-loader` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0447` | `transport.delta-sync` | `depends_on` | `transport.message-schema-registry` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0448` | `transport.event-stream` | `depends_on` | `transport.ws-codec` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0449` | `transport.event-stream` | `publishes` | `world.observation-ingestor` | `in-process` | async | hard | observation event | Caller aborts the operation or uses its documented fallback. | Observations flow over the event stream. |
| `rel.0450` | `transport.flow-control` | `depends_on` | `transport.request-correlator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0451` | `transport.reconnect` | `depends_on` | `transport.ws-codec` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0452` | `transport.request-correlator` | `depends_on` | `transport.ws-codec` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0453` | `transport.ws-codec` | `depends_on` | `transport.message-schema-registry` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |

## Shared Infrastructure Plan relations

| ID | From | Type | To | Protocol | Sync | Criticality | Payload | Failure behavior | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `rel.0316` | `sip.container-registry` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0317` | `sip.container-registry` | `depends_on` | `world.container-memory` | `in-process` | sync | hard | container snapshots | Caller aborts the operation or uses its documented fallback. | SIP seeds container state from observed containers. |
| `rel.0318` | `sip.dependency-validator` | `depends_on` | `sip.container-registry` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0319` | `sip.dependency-validator` | `depends_on` | `sip.farm-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0320` | `sip.dependency-validator` | `depends_on` | `sip.path-graph-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0321` | `sip.dependency-validator` | `depends_on` | `sip.road-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0322` | `sip.dependency-validator` | `depends_on` | `sip.structure-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0323` | `sip.dependency-validator` | `reads` | `world.spatial-query-engine` | `in-process` | sync | hard | observed geometry | Caller aborts the operation or uses its documented fallback. | Dependency checks read observed geometry. |
| `rel.0324` | `sip.farm-store` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0325` | `sip.mutation-proposer` | `depends_on` | `sip.dependency-validator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0326` | `sip.mutation-proposer` | `depends_on` | `sip.revision-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0327` | `sip.mutation-proposer` | `depends_on` | `sip.spatial-overlap-validator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0328` | `sip.path-graph-store` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0329` | `sip.reconciliation-engine` | `depends_on` | `sip.farm-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0330` | `sip.reconciliation-engine` | `depends_on` | `sip.road-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0331` | `sip.reconciliation-engine` | `depends_on` | `sip.structure-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0332` | `sip.reconciliation-engine` | `depends_on` | `sip.transactional-committer` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0333` | `sip.reconciliation-engine` | `depends_on` | `world.world-reconciler` | `in-process` | sync | hard | deviation findings | Caller aborts the operation or uses its documented fallback. | SIP reconciliation consumes world deviations. |
| `rel.0334` | `sip.revision-manager` | `publishes` | `grants.design-revision-guard` | `in-process` | async | hard | SIP revision changed | Caller aborts the operation or uses its documented fallback. | Revision changes invalidate grants. |
| `rel.0335` | `sip.revision-manager` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0336` | `sip.revision-manager` | `writes` | `sip.revision-manager` | `in-process` | sync | hard | revision | Caller aborts the operation or uses its documented fallback. | Revision allocation is serialized. |
| `rel.0337` | `sip.revision-manager` | `depends_on` | `sip.rules-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0338` | `sip.revision-manager` | `publishes` | `world.plan-tagging` | `in-process` | async | hard | active plan tags | Caller aborts the operation or uses its documented fallback. | World tags active builds without depending on SIP. |
| `rel.0339` | `sip.road-store` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0340` | `sip.rules-store` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0341` | `sip.spatial-overlap-validator` | `reads` | `sip.rules-store` | `in-process` | sync | hard | protected bboxes | Caller aborts the operation or uses its documented fallback. | Overlap checks read protected bboxes. |
| `rel.0342` | `sip.spatial-overlap-validator` | `depends_on` | `sip.structure-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0343` | `sip.spatial-overlap-validator` | `depends_on` | `sip.zone-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0344` | `sip.structure-store` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0345` | `sip.transactional-committer` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0346` | `sip.transactional-committer` | `writes` | `sip.container-registry` | `in-process` | sync | hard | containers | Caller aborts the operation or uses its documented fallback. | All container registry writes pass through the committer. |
| `rel.0347` | `sip.transactional-committer` | `writes` | `sip.farm-store` | `in-process` | sync | hard | farms | Caller aborts the operation or uses its documented fallback. | All farm writes pass through the committer. |
| `rel.0348` | `sip.transactional-committer` | `writes` | `sip.path-graph-store` | `in-process` | sync | hard | path graph | Caller aborts the operation or uses its documented fallback. | All path graph writes pass through the committer. |
| `rel.0349` | `sip.transactional-committer` | `depends_on` | `sip.revision-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0350` | `sip.transactional-committer` | `writes` | `sip.road-store` | `in-process` | sync | hard | roads | Caller aborts the operation or uses its documented fallback. | All road writes pass through the committer. |
| `rel.0351` | `sip.transactional-committer` | `writes` | `sip.rules-store` | `in-process` | sync | hard | rules | Caller aborts the operation or uses its documented fallback. | All rules writes pass through the committer. |
| `rel.0352` | `sip.transactional-committer` | `writes` | `sip.structure-store` | `in-process` | sync | hard | structures | Caller aborts the operation or uses its documented fallback. | All structure writes pass through the committer. |
| `rel.0353` | `sip.transactional-committer` | `writes` | `sip.zone-store` | `in-process` | sync | hard | zones | Caller aborts the operation or uses its documented fallback. | All zone writes pass through the committer. |
| `rel.0354` | `sip.zone-store` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |

## Task Board relations

| ID | From | Type | To | Protocol | Sync | Criticality | Payload | Failure behavior | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `rel.0419` | `tasks.atomic-task-claimer` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0420` | `tasks.atomic-task-claimer` | `depends_on` | `tasks.priority-scheduler` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0421` | `tasks.atomic-task-claimer` | `writes` | `tasks.task-repository` | `in-process` | sync | hard | task claim | Caller aborts the operation or uses its documented fallback. | Claiming mutates the task board transactionally. |
| `rel.0422` | `tasks.dag-resolver` | `depends_on` | `tasks.task-repository` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0423` | `tasks.dead-letter-manager` | `writes` | `tasks.task-repository` | `in-process` | sync | hard | dead-letter state | Caller aborts the operation or uses its documented fallback. | Dead-lettering mutates the task board. |
| `rel.0424` | `tasks.precondition-evaluator` | `depends_on` | `tasks.task-repository` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0425` | `tasks.precondition-evaluator` | `reads` | `world.spatial-query-engine` | `in-process` | sync | hard | world queries | Caller aborts the operation or uses its documented fallback. | Preconditions read observed world state. |
| `rel.0426` | `tasks.priority-scheduler` | `reads` | `bots.profile-store` | `in-process` | sync | hard | roles and behavior | Caller aborts the operation or uses its documented fallback. | Priority considers role fit. |
| `rel.0427` | `tasks.priority-scheduler` | `depends_on` | `tasks.dag-resolver` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0428` | `tasks.priority-scheduler` | `depends_on` | `tasks.precondition-evaluator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0429` | `tasks.retry-manager` | `writes` | `tasks.task-repository` | `in-process` | sync | hard | retry state | Caller aborts the operation or uses its documented fallback. | Retries mutate the task board. |
| `rel.0430` | `tasks.retry-manager` | `depends_on` | `tasks.task-state-machine` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0431` | `tasks.task-repository` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0432` | `tasks.task-state-machine` | `depends_on` | `memory.event-log-writer` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0433` | `tasks.task-state-machine` | `writes` | `tasks.task-repository` | `in-process` | sync | hard | task transition | Caller aborts the operation or uses its documented fallback. | State transitions are persisted. |

## Claims and Leases relations

| ID | From | Type | To | Protocol | Sync | Criticality | Payload | Failure behavior | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `rel.0087` | `claims.atomic-acquirer` | `writes` | `claims.claim-repository` | `in-process` | sync | hard | claim | Caller aborts the operation or uses its documented fallback. | Acquisition is transactional. |
| `rel.0088` | `claims.atomic-acquirer` | `depends_on` | `claims.overlap-margin-checker` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0089` | `claims.atomic-acquirer` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0090` | `claims.claim-releaser` | `writes` | `claims.claim-repository` | `in-process` | sync | hard | claim release | Caller aborts the operation or uses its documented fallback. | Release returns the resource. |
| `rel.0091` | `claims.claim-releaser` | `depends_on` | `tasks.task-state-machine` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0092` | `claims.claim-repository` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0093` | `claims.contention-metrics` | `depends_on` | `claims.claim-repository` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0094` | `claims.contention-metrics` | `observes` | `ops.metrics-registry` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0095` | `claims.fencing-token-authority` | `depends_on` | `core.coordinator-epoch` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0096` | `claims.fencing-token-authority` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0097` | `claims.lease-heartbeat` | `writes` | `claims.claim-repository` | `in-process` | sync | hard | lease renewal | Caller aborts the operation or uses its documented fallback. | Heartbeat extends the lease. |
| `rel.0098` | `claims.lease-reaper` | `writes` | `claims.claim-repository` | `in-process` | sync | hard | lease expiry | Caller aborts the operation or uses its documented fallback. | Reaper releases expired leases. |
| `rel.0099` | `claims.lease-reaper` | `depends_on` | `tasks.task-state-machine` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0100` | `claims.overlap-margin-checker` | `depends_on` | `claims.claim-repository` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0101` | `claims.overlap-margin-checker` | `depends_on` | `sip.spatial-overlap-validator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |

## Edit Grants and Collaboration relations

| ID | From | Type | To | Protocol | Sync | Criticality | Payload | Failure behavior | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `rel.0182` | `grants.arbitration-adapter` | `depends_on` | `grants.compatibility-checker` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0183` | `grants.arbitration-adapter` | `publishes` | `transport.event-stream` | `in-process` | async | hard | arbitration request | Caller aborts the operation or uses its documented fallback. | Ambiguous grants are escalated without direct planner dependency. |
| `rel.0184` | `grants.compatibility-checker` | `reads` | `claims.claim-repository` | `in-process` | sync | hard | claimed work packages | Caller aborts the operation or uses its documented fallback. | Compatibility avoids collisions. |
| `rel.0185` | `grants.compatibility-checker` | `depends_on` | `grants.grant-repository` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0186` | `grants.compatibility-checker` | `depends_on` | `sip.rules-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0187` | `grants.compatibility-checker` | `depends_on` | `sip.structure-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0188` | `grants.design-revision-guard` | `depends_on` | `grants.grant-repository` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0189` | `grants.design-revision-guard` | `controls` | `grants.grant-revoker` | `in-process` | sync | hard | revoke stale grants | Caller aborts the operation or uses its documented fallback. | Revision guard triggers revocation. |
| `rel.0190` | `grants.design-revision-guard` | `reads` | `sip.revision-manager` | `in-process` | sync | hard | current revision | Caller aborts the operation or uses its documented fallback. | Grants bind to the current revision. |
| `rel.0191` | `grants.grant-expiry` | `writes` | `grants.grant-repository` | `in-process` | sync | hard | grant expiry | Caller aborts the operation or uses its documented fallback. | Expiry invalidates grants. |
| `rel.0192` | `grants.grant-issuer` | `depends_on` | `grants.compatibility-checker` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0193` | `grants.grant-issuer` | `depends_on` | `grants.design-revision-guard` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0194` | `grants.grant-issuer` | `writes` | `grants.grant-repository` | `in-process` | sync | hard | edit grant | Caller aborts the operation or uses its documented fallback. | Issuance is transactional. |
| `rel.0195` | `grants.grant-issuer` | `depends_on` | `grants.policy-evaluator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0196` | `grants.grant-repository` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0197` | `grants.grant-revoker` | `depends_on` | `claims.fencing-token-authority` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0198` | `grants.grant-revoker` | `writes` | `grants.grant-repository` | `in-process` | sync | hard | grant revocation | Caller aborts the operation or uses its documented fallback. | Revocation bumps fencing token. |
| `rel.0199` | `grants.owner-offline-policy` | `reads` | `bots.presence-tracker` | `in-process` | sync | hard | owner presence | Caller aborts the operation or uses its documented fallback. | Offline policy checks presence. |
| `rel.0200` | `grants.owner-offline-policy` | `reads` | `bots.profile-store` | `in-process` | sync | hard | autoAcceptCompatibleHelpers | Caller aborts the operation or uses its documented fallback. | Offline policy reads persisted policy. |
| `rel.0201` | `grants.owner-offline-policy` | `depends_on` | `grants.compatibility-checker` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0202` | `grants.policy-evaluator` | `depends_on` | `grants.grant-repository` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0203` | `grants.policy-evaluator` | `depends_on` | `sip.structure-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |

## Bot Registry and Profiles relations

| ID | From | Type | To | Protocol | Sync | Criticality | Payload | Failure behavior | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `rel.0033` | `bots.behavior-profile-manager` | `depends_on` | `bots.profile-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0034` | `bots.delta-sync-planner` | `depends_on` | `bots.profile-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0035` | `bots.delta-sync-planner` | `reads` | `grants.grant-repository` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0036` | `bots.delta-sync-planner` | `reads` | `sip.revision-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0037` | `bots.delta-sync-planner` | `reads` | `tasks.task-repository` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0038` | `bots.identity-authenticator` | `depends_on` | `bots.profile-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0039` | `bots.identity-authenticator` | `depends_on` | `config.secrets-loader` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0040` | `bots.name-pool-allocator` | `depends_on` | `bots.profile-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0041` | `bots.name-pool-allocator` | `depends_on` | `config.name-pool-validator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0042` | `bots.presence-tracker` | `depends_on` | `bots.profile-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0043` | `bots.profile-store` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0044` | `bots.relationship-store` | `depends_on` | `bots.profile-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0045` | `bots.resume-orchestrator` | `depends_on` | `bots.delta-sync-planner` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0046` | `bots.resume-orchestrator` | `depends_on` | `bots.profile-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0047` | `bots.resume-orchestrator` | `delegates_to` | `claims.claim-releaser` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0048` | `bots.resume-orchestrator` | `delegates_to` | `sip.reconciliation-engine` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0049` | `bots.resume-orchestrator` | `reads` | `skill-runtime.checkpoint-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0050` | `bots.role-manager` | `depends_on` | `bots.profile-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |

## World Model and Landmarks relations

| ID | From | Type | To | Protocol | Sync | Criticality | Payload | Failure behavior | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `rel.0454` | `world.chunk-version-store` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0455` | `world.confidence-decay` | `depends_on` | `world.chunk-version-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0456` | `world.confidence-decay` | `writes` | `world.landmark-registry` | `in-process` | sync | hard | confidence update | Caller aborts the operation or uses its documented fallback. | Decay updates landmark confidence. |
| `rel.0457` | `world.container-memory` | `reads` | `sip.container-registry` | `in-process` | sync | hard | container registry | Caller aborts the operation or uses its documented fallback. | Container memory reconciles observed containers with SIP intent. |
| `rel.0458` | `world.container-memory` | `depends_on` | `world.landmark-registry` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0459` | `world.detector-result-integrator` | `writes` | `world.landmark-registry` | `in-process` | sync | hard | landmark | Caller aborts the operation or uses its documented fallback. | Detector results become landmarks. |
| `rel.0460` | `world.detector-result-integrator` | `depends_on` | `world.merge-conflict-resolver` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0461` | `world.landmark-registry` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0462` | `world.merge-conflict-resolver` | `writes` | `world.chunk-version-store` | `in-process` | sync | hard | merged observation | Caller aborts the operation or uses its documented fallback. | Merge resolves conflicts. |
| `rel.0463` | `world.merge-conflict-resolver` | `depends_on` | `world.confidence-decay` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0464` | `world.observation-ingestor` | `subscribes` | `transport.event-stream` | `in-process` | async | hard | observation event | Caller aborts the operation or uses its documented fallback. | World model consumes observation events. |
| `rel.0465` | `world.observation-ingestor` | `reads` | `transport.message-schema-registry` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0466` | `world.observation-ingestor` | `writes` | `world.chunk-version-store` | `in-process` | sync | hard | chunk snapshot | Caller aborts the operation or uses its documented fallback. | Observation ingestion writes chunk versions. |
| `rel.0467` | `world.occupancy-grid` | `depends_on` | `world.chunk-version-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0468` | `world.plan-tagging` | `depends_on` | `world.landmark-registry` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0469` | `world.spatial-query-engine` | `reads` | `sip.path-graph-store` | `in-process` | sync | hard | path graph | Caller aborts the operation or uses its documented fallback. | Routing queries read the SIP path graph. |
| `rel.0470` | `world.spatial-query-engine` | `depends_on` | `world.landmark-registry` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0471` | `world.spatial-query-engine` | `depends_on` | `world.occupancy-grid` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0472` | `world.world-reconciler` | `depends_on` | `world.landmark-registry` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0473` | `world.world-reconciler` | `depends_on` | `world.spatial-query-engine` | `in-process` | sync | hard | spatial query | Caller aborts the operation or uses its documented fallback. | Reconciliation queries observed geometry. |

## Perception relations

| ID | From | Type | To | Protocol | Sync | Criticality | Payload | Failure behavior | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `rel.0234` | `perception.chunk-snapshot-encoder` | `depends_on` | `perception.ring-sampler` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0235` | `perception.detector-pipeline` | `depends_on` | `perception.chunk-snapshot-encoder` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0236` | `perception.detector-pipeline` | `depends_on` | `perception.farm-detector` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0237` | `perception.detector-pipeline` | `depends_on` | `perception.house-detector` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0238` | `perception.detector-pipeline` | `depends_on` | `perception.linear-structure-detector` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0239` | `perception.detector-pipeline` | `depends_on` | `perception.path-detector` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0240` | `perception.detector-pipeline` | `depends_on` | `perception.storage-workstation-detector` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0241` | `perception.farm-detector` | `depends_on` | `perception.chunk-snapshot-encoder` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0242` | `perception.house-detector` | `depends_on` | `perception.chunk-snapshot-encoder` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0243` | `perception.landmark-candidate-emitter` | `depends_on` | `perception.detector-pipeline` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0244` | `perception.landmark-candidate-emitter` | `publishes` | `transport.event-stream` | `in-process` | async | hard | landmark candidate | Caller aborts the operation or uses its documented fallback. | Perception emits candidates, never world writes. |
| `rel.0245` | `perception.linear-structure-detector` | `depends_on` | `perception.chunk-snapshot-encoder` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0246` | `perception.path-detector` | `depends_on` | `perception.chunk-snapshot-encoder` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0247` | `perception.perception-rate-limiter` | `depends_on` | `config.profile-resolver` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0248` | `perception.ring-sampler` | `depends_on` | `perception.perception-rate-limiter` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0249` | `perception.storage-workstation-detector` | `depends_on` | `perception.chunk-snapshot-encoder` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |

## Laya Decision Service relations

| ID | From | Type | To | Protocol | Sync | Criticality | Payload | Failure behavior | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `rel.0140` | `decision.batch-runner` | `depends_on` | `decision.digest-cache` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0141` | `decision.batch-runner` | `depends_on` | `decision.model-loader` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0142` | `decision.batch-runner` | `depends_on` | `decision.queue` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0143` | `decision.confidence-calibrator` | `proposes_to` | `bot-runtime.deterministic-policy` | `in-process` | sync | hard | confidence result | Caller aborts the operation or uses its documented fallback. | Low confidence falls back to deterministic policy. |
| `rel.0144` | `decision.confidence-calibrator` | `depends_on` | `config.config-schema-validator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0145` | `decision.confidence-calibrator` | `depends_on` | `decision.output-parser` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0146` | `decision.digest-assembler` | `depends_on` | `transport.message-schema-registry` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0147` | `decision.digest-cache` | `depends_on` | `decision.queue` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0148` | `decision.execution-provider-selector` | `depends_on` | `config.hardware-probe` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0149` | `decision.execution-provider-selector` | `controls` | `decision.model-loader` | `in-process` | sync | hard | provider selection | Caller aborts the operation or uses its documented fallback. | Provider is selected before session start. |
| `rel.0150` | `decision.execution-provider-selector` | `observes` | `ops.structured-logger` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0151` | `decision.latency-metrics` | `observes` | `ops.metrics-registry` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0152` | `decision.latency-metrics` | `writes` | `ops.metrics-registry` | `in-process` | sync | hard | latency metrics | Caller aborts the operation or uses its documented fallback. | Model latency is observable. |
| `rel.0153` | `decision.model-loader` | `depends_on` | `config.laya-runtime-resolver` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0154` | `decision.model-loader` | `depends_on` | `ext.onnx-runtime` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0155` | `decision.output-parser` | `depends_on` | `decision.batch-runner` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0156` | `decision.output-parser` | `publishes` | `transport.event-stream` | `in-process` | async | hard | decision response | Caller aborts the operation or uses its documented fallback. | Decision responses travel over transport. |
| `rel.0157` | `decision.queue` | `subscribes` | `transport.event-stream` | `in-process` | async | hard | decision request | Caller aborts the operation or uses its documented fallback. | Decision service consumes requests. |
| `rel.0158` | `decision.rate-limiter` | `depends_on` | `config.profile-resolver` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0159` | `decision.rate-limiter` | `depends_on` | `decision.queue` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0160` | `decision.single-inflight-guard` | `controls` | `decision.batch-runner` | `in-process` | sync | hard | inference permit | Caller aborts the operation or uses its documented fallback. | One forward pass at a time. |
| `rel.0161` | `decision.timeout-fallback` | `controls` | `decision.output-parser` | `in-process` | sync | hard | timeout | Caller aborts the operation or uses its documented fallback. | Timeout aborts the inference and falls back. |
| `rel.0162` | `decision.timeout-fallback` | `depends_on` | `decision.queue` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |

## Cloud Planner relations

| ID | From | Type | To | Protocol | Sync | Criticality | Payload | Failure behavior | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `rel.0250` | `planner.arbitration-handler` | `reads` | `grants.compatibility-checker` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0251` | `planner.arbitration-handler` | `proposes_to` | `grants.grant-issuer` | `in-process` | sync | hard | arbitration result | Caller aborts the operation or uses its documented fallback. | Arbitration result still requires grant issuance. |
| `rel.0252` | `planner.arbitration-handler` | `subscribes` | `transport.event-stream` | `in-process` | async | hard | arbitration request | Caller aborts the operation or uses its documented fallback. | Planner arbitration is event-driven. |
| `rel.0253` | `planner.budget-limiter` | `observes` | `ops.metrics-registry` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0254` | `planner.budget-limiter` | `controls` | `planner.openai-client` | `in-process` | sync | hard | call budget | Caller aborts the operation or uses its documented fallback. | Budget limits calls and tokens. |
| `rel.0255` | `planner.context-builder` | `reads` | `bots.profile-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0256` | `planner.context-builder` | `reads` | `sip.revision-manager` | `in-process` | sync | hard | SIP revision | Caller aborts the operation or uses its documented fallback. | Planner context is revision-bound. |
| `rel.0257` | `planner.context-builder` | `reads` | `tasks.task-repository` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0258` | `planner.context-builder` | `reads` | `world.spatial-query-engine` | `in-process` | sync | hard | world queries | Caller aborts the operation or uses its documented fallback. | Planner context uses world queries. |
| `rel.0259` | `planner.keep-last-good-fallback` | `depends_on` | `planner.plan-cache` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0260` | `planner.keep-last-good-fallback` | `reads` | `sip.revision-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0261` | `planner.openai-client` | `depends_on` | `config.config-schema-validator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0262` | `planner.openai-client` | `depends_on` | `config.secrets-loader` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0263` | `planner.openai-client` | `depends_on` | `ext.planner-endpoint` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0264` | `planner.openai-client` | `delegates_to` | `planner.arbitration-handler` | `in-process` | sync | hard | arbitration request | Caller aborts the operation or uses its documented fallback. | Planner client handles arbitration calls. |
| `rel.0265` | `planner.plan-cache` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0266` | `planner.plan-cache` | `writes` | `planner.plan-cache` | `in-process` | sync | hard | plan cache entry | Caller aborts the operation or uses its documented fallback. | Validated plan cache. |
| `rel.0267` | `planner.repair-loop` | `controls` | `planner.keep-last-good-fallback` | `in-process` | sync | hard | fallback | Caller aborts the operation or uses its documented fallback. | Invalid output keeps the last good plan. |
| `rel.0268` | `planner.repair-loop` | `depends_on` | `planner.openai-client` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0269` | `planner.repair-loop` | `depends_on` | `planner.schema-validator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0270` | `planner.repair-loop` | `depends_on` | `planner.semantic-validator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0271` | `planner.schema-validator` | `controls` | `planner.repair-loop` | `in-process` | sync | hard | validation failure | Caller aborts the operation or uses its documented fallback. | Schema failures enter repair. |
| `rel.0272` | `planner.semantic-validator` | `controls` | `planner.repair-loop` | `in-process` | sync | hard | validation failure | Caller aborts the operation or uses its documented fallback. | Semantic failures enter repair. |
| `rel.0273` | `planner.semantic-validator` | `depends_on` | `planner.schema-validator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0274` | `planner.semantic-validator` | `depends_on` | `sip.dependency-validator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0275` | `planner.semantic-validator` | `reads` | `sip.rules-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0276` | `planner.semantic-validator` | `reads` | `skill-runtime.skill-registry` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0277` | `planner.semantic-validator` | `reads` | `world.spatial-query-engine` | `in-process` | sync | hard | distance and zone queries | Caller aborts the operation or uses its documented fallback. | Semantic validation checks distances and zones. |
| `rel.0278` | `planner.sip-mutation-translator` | `depends_on` | `planner.repair-loop` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0279` | `planner.sip-mutation-translator` | `proposes_to` | `sip.mutation-proposer` | `in-process` | sync | hard | SIP mutation | Caller aborts the operation or uses its documented fallback. | Planner proposes; coordinator validates and commits. |
| `rel.0280` | `planner.task-dag-translator` | `depends_on` | `planner.repair-loop` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0281` | `planner.task-dag-translator` | `proposes_to` | `tasks.task-repository` | `in-process` | sync | hard | task DAG | Caller aborts the operation or uses its documented fallback. | Planner proposes tasks; task board commits. |
| `rel.0282` | `planner.trigger-evaluator` | `observes` | `ops.metrics-registry` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0283` | `planner.trigger-evaluator` | `delegates_to` | `planner.context-builder` | `in-process` | sync | hard | planning trigger | Caller aborts the operation or uses its documented fallback. | Triggers start a planning request. |
| `rel.0284` | `planner.trigger-evaluator` | `reads` | `sip.revision-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0285` | `planner.trigger-evaluator` | `reads` | `tasks.dead-letter-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |

## Skill Runtime relations

| ID | From | Type | To | Protocol | Sync | Criticality | Payload | Failure behavior | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `rel.0355` | `skill-runtime.checkpoint-manager` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0356` | `skill-runtime.checkpoint-manager` | `writes` | `skill-runtime.checkpoint-manager` | `in-process` | sync | hard | skill checkpoint | Caller aborts the operation or uses its documented fallback. | Checkpoint persistence. |
| `rel.0357` | `skill-runtime.context-builder` | `reads` | `bot-runtime.world-cache-adapter` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0358` | `skill-runtime.context-builder` | `reads` | `sip.revision-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0359` | `skill-runtime.context-builder` | `depends_on` | `skill-runtime.checkpoint-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0360` | `skill-runtime.context-builder` | `reads` | `world.spatial-query-engine` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0361` | `skill-runtime.effects-emitter` | `publishes` | `transport.event-stream` | `in-process` | async | hard | typed effect | Caller aborts the operation or uses its documented fallback. | Effects are journaled and forwarded. |
| `rel.0362` | `skill-runtime.lifecycle-executor` | `depends_on` | `skill-runtime.context-builder` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0363` | `skill-runtime.lifecycle-executor` | `depends_on` | `skill-runtime.effects-emitter` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0364` | `skill-runtime.lifecycle-executor` | `depends_on` | `skill-runtime.skill-contract` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0365` | `skill-runtime.lifecycle-executor` | `depends_on` | `skill-runtime.skill-registry` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0366` | `skill-runtime.preemption-handler` | `reads` | `safety.action-veto-gate` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0367` | `skill-runtime.preemption-handler` | `depends_on` | `skill-runtime.lifecycle-executor` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0368` | `skill-runtime.progress-reporter` | `observes` | `ops.metrics-registry` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0369` | `skill-runtime.progress-reporter` | `publishes` | `transport.event-stream` | `in-process` | async | hard | skill progress | Caller aborts the operation or uses its documented fallback. | Progress is event-driven. |
| `rel.0370` | `skill-runtime.restore-validator` | `depends_on` | `skill-runtime.checkpoint-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0371` | `skill-runtime.restore-validator` | `depends_on` | `world.spatial-query-engine` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0372` | `skill-runtime.skill-registry` | `depends_on` | `skill-runtime.skill-contract` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0373` | `skill-runtime.tick-scheduler` | `reads` | `safety.guardian-loop` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0374` | `skill-runtime.tick-scheduler` | `depends_on` | `skill-runtime.lifecycle-executor` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |

## Skill Library relations

| ID | From | Type | To | Protocol | Sync | Criticality | Payload | Failure behavior | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `rel.0375` | `skills.bridge` | `depends_on` | `building.block-executor` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0376` | `skills.bridge` | `depends_on` | `skills.navigate` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0377` | `skills.clear` | `depends_on` | `building.block-executor` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0378` | `skills.clear` | `depends_on` | `safety.action-veto-gate` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0379` | `skills.collect` | `depends_on` | `bot-runtime.action-executor` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0380` | `skills.collect` | `depends_on` | `skills.mine` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0381` | `skills.collect` | `depends_on` | `skills.navigate` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0382` | `skills.craft` | `depends_on` | `bot-runtime.action-executor` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0383` | `skills.craft` | `depends_on` | `skill-runtime.context-builder` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0384` | `skills.deposit` | `depends_on` | `bot-runtime.action-executor` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0385` | `skills.deposit` | `depends_on` | `world.container-memory` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0386` | `skills.eat` | `depends_on` | `bot-runtime.action-executor` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0387` | `skills.explore` | `depends_on` | `skills.navigate` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0388` | `skills.explore` | `depends_on` | `world.spatial-query-engine` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0389` | `skills.flee-defend` | `depends_on` | `bot-runtime.action-executor` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0390` | `skills.flee-defend` | `depends_on` | `safety.mob-threat-evaluator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0391` | `skills.flee-defend` | `depends_on` | `skills.navigate` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0392` | `skills.follow-path` | `depends_on` | `sip.path-graph-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0393` | `skills.follow-path` | `depends_on` | `skills.navigate` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0394` | `skills.harvest-farm` | `depends_on` | `bot-runtime.action-executor` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0395` | `skills.harvest-farm` | `depends_on` | `sip.farm-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0396` | `skills.harvest-farm` | `depends_on` | `skills.navigate` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0397` | `skills.mine` | `depends_on` | `bot-runtime.action-executor` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0398` | `skills.mine` | `depends_on` | `skills.navigate` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0399` | `skills.navigate` | `depends_on` | `bot-runtime.action-executor` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0400` | `skills.navigate` | `depends_on` | `skill-runtime.skill-contract` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0401` | `skills.place-build` | `depends_on` | `building.block-executor` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0402` | `skills.place-build` | `depends_on` | `skill-runtime.context-builder` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0403` | `skills.plant-farm` | `depends_on` | `bot-runtime.action-executor` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0404` | `skills.plant-farm` | `depends_on` | `sip.farm-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0405` | `skills.plant-farm` | `depends_on` | `skills.navigate` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0406` | `skills.repair` | `depends_on` | `building.block-executor` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0407` | `skills.repair` | `depends_on` | `building.schematic-diff` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0408` | `skills.schematic-build` | `depends_on` | `building.block-executor` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0409` | `skills.schematic-build` | `depends_on` | `building.build-order-planner` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0410` | `skills.schematic-build` | `depends_on` | `building.work-package-partitioner` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0411` | `skills.shared-utilities` | `depends_on` | `skill-runtime.context-builder` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0412` | `skills.shared-utilities` | `depends_on` | `world.spatial-query-engine` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0413` | `skills.sleep` | `depends_on` | `bot-runtime.action-executor` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0414` | `skills.sleep` | `depends_on` | `skills.navigate` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0415` | `skills.smelt` | `depends_on` | `bot-runtime.action-executor` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0416` | `skills.smelt` | `depends_on` | `skills.navigate` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0417` | `skills.withdraw` | `depends_on` | `bot-runtime.action-executor` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0418` | `skills.withdraw` | `depends_on` | `world.container-memory` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |

## Building relations

| ID | From | Type | To | Protocol | Sync | Criticality | Payload | Failure behavior | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `rel.0051` | `building.block-executor` | `depends_on` | `bot-runtime.action-executor` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0052` | `building.block-executor` | `depends_on` | `building.block-verifier` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0053` | `building.block-executor` | `depends_on` | `building.rollback-journal` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0054` | `building.block-executor` | `depends_on` | `safety.action-veto-gate` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0055` | `building.block-verifier` | `depends_on` | `building.blueprint-ir` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0056` | `building.block-verifier` | `reads` | `world.spatial-query-engine` | `in-process` | sync | hard | target block state | Caller aborts the operation or uses its documented fallback. | Verification reads observed block state. |
| `rel.0057` | `building.blueprint-validator` | `depends_on` | `building.blueprint-ir` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0058` | `building.blueprint-validator` | `depends_on` | `sip.rules-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0059` | `building.build-order-planner` | `depends_on` | `building.blueprint-ir` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0060` | `building.build-order-planner` | `depends_on` | `building.work-package-partitioner` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0061` | `building.container-refill-adapter` | `depends_on` | `bot-runtime.action-executor` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0062` | `building.container-refill-adapter` | `writes` | `world.container-memory` | `in-process` | sync | hard | container snapshot | Caller aborts the operation or uses its documented fallback. | Refill updates observed container contents. |
| `rel.0063` | `building.material-preflight` | `depends_on` | `building.blueprint-ir` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0064` | `building.material-preflight` | `reads` | `skill-runtime.context-builder` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0065` | `building.material-preflight` | `reads` | `world.container-memory` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0066` | `building.reachability-scaffold-planner` | `reads` | `bot-runtime.world-cache-adapter` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0067` | `building.reachability-scaffold-planner` | `depends_on` | `building.build-order-planner` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0068` | `building.reachability-scaffold-planner` | `reads` | `world.spatial-query-engine` | `in-process` | sync | hard | reachability geometry | Caller aborts the operation or uses its documented fallback. | Reachability uses world geometry. |
| `rel.0069` | `building.rollback-journal` | `writes` | `memory.block-changelog-writer` | `in-process` | sync | hard | block before/after image | Caller aborts the operation or uses its documented fallback. | Every destructive change is reversible. |
| `rel.0070` | `building.rollback-journal` | `reads` | `sip.structure-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0071` | `building.rollback-journal` | `subscribes` | `transport.event-stream` | `in-process` | async | hard | block change | Caller aborts the operation or uses its documented fallback. | Every destructive change is journaled. |
| `rel.0072` | `building.schematic-diff` | `depends_on` | `building.blueprint-ir` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0073` | `building.schematic-diff` | `reads` | `world.spatial-query-engine` | `in-process` | sync | hard | world blocks | Caller aborts the operation or uses its documented fallback. | Diff reads observed blocks. |
| `rel.0074` | `building.schematic-parser` | `depends_on` | `building.blueprint-ir` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0075` | `building.template-bridge` | `depends_on` | `building.blueprint-ir` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0076` | `building.template-farm` | `depends_on` | `building.blueprint-ir` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0077` | `building.template-house` | `depends_on` | `building.blueprint-ir` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0078` | `building.template-instantiator` | `depends_on` | `building.blueprint-validator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0079` | `building.template-instantiator` | `depends_on` | `building.template-registry` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0080` | `building.template-registry` | `depends_on` | `building.blueprint-ir` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0081` | `building.template-road` | `depends_on` | `building.blueprint-ir` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0082` | `building.template-storage` | `depends_on` | `building.blueprint-ir` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0083` | `building.template-wall` | `depends_on` | `building.blueprint-ir` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0084` | `building.template-watchtower` | `depends_on` | `building.blueprint-ir` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0085` | `building.work-package-partitioner` | `depends_on` | `building.blueprint-ir` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0086` | `building.work-package-partitioner` | `reads` | `sip.structure-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |

## Bot Runtime and Mineflayer Adapter relations

| ID | From | Type | To | Protocol | Sync | Criticality | Payload | Failure behavior | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `rel.0001` | `bot-runtime.action-executor` | `depends_on` | `bot-runtime.connection-lifecycle` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0002` | `bot-runtime.action-executor` | `depends_on` | `bot-runtime.reach-rate-guard` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0003` | `bot-runtime.action-executor` | `depends_on` | `safety.action-veto-gate` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0004` | `bot-runtime.affordance-enumerator` | `depends_on` | `bot-runtime.world-cache-adapter` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0005` | `bot-runtime.affordance-enumerator` | `depends_on` | `safety.guardian-loop` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0006` | `bot-runtime.affordance-enumerator` | `depends_on` | `skill-runtime.skill-registry` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0007` | `bot-runtime.connection-lifecycle` | `depends_on` | `config.config-schema-validator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0008` | `bot-runtime.connection-lifecycle` | `depends_on` | `ext.minecraft-server` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0009` | `bot-runtime.deterministic-policy` | `depends_on` | `bot-runtime.affordance-enumerator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0010` | `bot-runtime.deterministic-policy` | `depends_on` | `bot-runtime.state-digest-collector` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0011` | `bot-runtime.deterministic-policy` | `reads` | `bots.behavior-profile-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0012` | `bot-runtime.deterministic-policy` | `subscribes` | `transport.event-stream` | `in-process` | async | hard | decision response | Caller aborts the operation or uses its documented fallback. | Bot consumes decisions and applies fallback. |
| `rel.0013` | `bot-runtime.event-bridge` | `depends_on` | `bot-runtime.connection-lifecycle` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0014` | `bot-runtime.event-bridge` | `delegates_to` | `perception.block-update-listener` | `in-process` | async | hard | block update | Caller aborts the operation or uses its documented fallback. | Bot runtime forwards block updates through the perception port. |
| `rel.0015` | `bot-runtime.guardian-hook` | `depends_on` | `safety.action-veto-gate` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0016` | `bot-runtime.guardian-hook` | `depends_on` | `safety.guardian-loop` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0017` | `bot-runtime.join-auth` | `depends_on` | `bot-runtime.connection-lifecycle` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0018` | `bot-runtime.join-auth` | `depends_on` | `config.profile-resolver` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0019` | `bot-runtime.perception-host` | `depends_on` | `perception.detector-pipeline` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0020` | `bot-runtime.perception-host` | `depends_on` | `perception.ring-sampler` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0021` | `bot-runtime.reach-rate-guard` | `depends_on` | `config.config-schema-validator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0022` | `bot-runtime.reconnect-supervisor` | `depends_on` | `bot-runtime.connection-lifecycle` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0023` | `bot-runtime.reconnect-supervisor` | `delegates_to` | `bots.delta-sync-planner` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0024` | `bot-runtime.reconnect-supervisor` | `depends_on` | `transport.reconnect` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0025` | `bot-runtime.skill-host` | `depends_on` | `skill-runtime.lifecycle-executor` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0026` | `bot-runtime.skill-host` | `depends_on` | `skill-runtime.tick-scheduler` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0027` | `bot-runtime.state-digest-collector` | `depends_on` | `bot-runtime.connection-lifecycle` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0028` | `bot-runtime.state-digest-collector` | `depends_on` | `bot-runtime.world-cache-adapter` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0029` | `bot-runtime.state-digest-collector` | `publishes` | `transport.event-stream` | `in-process` | async | hard | decision request | Caller aborts the operation or uses its documented fallback. | Decision requests travel over transport. |
| `rel.0030` | `bot-runtime.world-cache-adapter` | `depends_on` | `bot-runtime.event-bridge` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0031` | `bot-runtime.world-cache-adapter` | `delegates_to` | `perception.ring-sampler` | `in-process` | sync | hard | local world snapshot | Caller aborts the operation or uses its documented fallback. | Bot runtime supplies the world view port; perception does not import the bot process. |
| `rel.0032` | `bot-runtime.world-cache-adapter` | `delegates_to` | `skill-runtime.context-builder` | `in-process` | sync | hard | world view | Caller aborts the operation or uses its documented fallback. | Bot runtime supplies the world view port; skill runtime does not import the bot process. |

## Autonomy and Safety relations

| ID | From | Type | To | Protocol | Sync | Criticality | Payload | Failure behavior | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `rel.0286` | `safety.action-veto-gate` | `validates` | `bot-runtime.action-executor` | `in-process` | sync | hard | action approval | Caller aborts the operation or uses its documented fallback. | No action executes without approval. |
| `rel.0287` | `safety.action-veto-gate` | `validates` | `building.block-executor` | `in-process` | sync | hard | block change approval | Caller aborts the operation or uses its documented fallback. | Destructive block changes require safety approval. |
| `rel.0288` | `safety.action-veto-gate` | `depends_on` | `safety.guardian-loop` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0289` | `safety.action-veto-gate` | `depends_on` | `safety.safety-policy-engine` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0290` | `safety.active-bot-support-rule` | `reads` | `claims.claim-repository` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0291` | `safety.active-bot-support-rule` | `reads` | `world.spatial-query-engine` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0292` | `safety.claim-loss-evaluator` | `reads` | `claims.claim-repository` | `in-process` | sync | hard | claim lease state | Caller aborts the operation or uses its documented fallback. | Guardian checks claim validity. |
| `rel.0293` | `safety.emergency-stop-controller` | `controls` | `bot-runtime.action-executor` | `in-process` | sync | hard | stop | Caller aborts the operation or uses its documented fallback. | Emergency stop halts actions. |
| `rel.0294` | `safety.emergency-stop-controller` | `controls` | `core.command-router` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0295` | `safety.emergency-stop-controller` | `depends_on` | `transport.event-stream` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0296` | `safety.guardian-loop` | `controls` | `safety.action-veto-gate` | `in-process` | sync | hard | veto signal | Caller aborts the operation or uses its documented fallback. | Guardian has final veto. |
| `rel.0297` | `safety.guardian-loop` | `depends_on` | `safety.claim-loss-evaluator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0298` | `safety.guardian-loop` | `depends_on` | `safety.hazard-evaluator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0299` | `safety.guardian-loop` | `depends_on` | `safety.hunger-evaluator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0300` | `safety.guardian-loop` | `depends_on` | `safety.inventory-evaluator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0301` | `safety.guardian-loop` | `depends_on` | `safety.mob-threat-evaluator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0302` | `safety.guardian-loop` | `depends_on` | `safety.stuck-timeout-evaluator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0303` | `safety.incident-journal` | `writes` | `memory.event-log-writer` | `in-process` | sync | hard | incident | Caller aborts the operation or uses its documented fallback. | Safety incidents are persisted. |
| `rel.0304` | `safety.protected-bbox-rule` | `reads` | `claims.claim-repository` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0305` | `safety.protected-bbox-rule` | `reads` | `sip.rules-store` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0306` | `safety.recovery-ladder` | `proposes_to` | `core.command-router` | `in-process` | sync | hard | replan request | Caller aborts the operation or uses its documented fallback. | Recovery escalates to planner through the coordinator. |
| `rel.0307` | `safety.recovery-ladder` | `proposes_to` | `planner.trigger-evaluator` | `in-process` | sync | hard | replan trigger | Caller aborts the operation or uses its documented fallback. | Recovery can request planner review. |
| `rel.0308` | `safety.recovery-ladder` | `controls` | `safety.emergency-stop-controller` | `in-process` | sync | hard | safe mode | Caller aborts the operation or uses its documented fallback. | Final recovery step is a safe stop. |
| `rel.0309` | `safety.recovery-ladder` | `depends_on` | `transport.event-stream` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0310` | `safety.safety-policy-engine` | `reads` | `claims.claim-repository` | `in-process` | sync | hard | active claims | Caller aborts the operation or uses its documented fallback. | Safety policy excludes active bot work. |
| `rel.0311` | `safety.safety-policy-engine` | `depends_on` | `safety.active-bot-support-rule` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0312` | `safety.safety-policy-engine` | `depends_on` | `safety.material-ban-rule` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0313` | `safety.safety-policy-engine` | `depends_on` | `safety.protected-bbox-rule` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0314` | `safety.safety-policy-engine` | `reads` | `sip.rules-store` | `in-process` | sync | hard | protected bboxes | Caller aborts the operation or uses its documented fallback. | Safety policy reads protected bboxes. |
| `rel.0315` | `safety.safety-policy-engine` | `reads` | `world.spatial-query-engine` | `in-process` | sync | hard | protected and support queries | Caller aborts the operation or uses its documented fallback. | Safety checks read world geometry. |

## Memory and Persistence relations

| ID | From | Type | To | Protocol | Sync | Criticality | Payload | Failure behavior | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `rel.0204` | `memory.block-changelog-writer` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0205` | `memory.event-log-writer` | `writes` | `memory.event-log-writer` | `in-process` | sync | hard | domain event | Caller aborts the operation or uses its documented fallback. | Append-only event log. |
| `rel.0206` | `memory.event-log-writer` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0207` | `memory.migration-runner` | `depends_on` | `memory.sqlite-runtime` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0208` | `memory.retention-pruner` | `depends_on` | `memory.block-changelog-writer` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0209` | `memory.retention-pruner` | `depends_on` | `memory.event-log-writer` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0210` | `memory.retention-pruner` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0211` | `memory.schema-version-registry` | `depends_on` | `memory.migration-runner` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0212` | `memory.snapshot-export` | `depends_on` | `memory.transaction-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0213` | `memory.transaction-manager` | `depends_on` | `memory.sqlite-runtime` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |

## Ops and Observability relations

| ID | From | Type | To | Protocol | Sync | Criticality | Payload | Failure behavior | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `rel.0214` | `ops.audit-viewer` | `reads` | `memory.block-changelog-writer` | `in-process` | sync | hard | block changelog | Caller aborts the operation or uses its documented fallback. | Audit reads append-only changelog. |
| `rel.0215` | `ops.audit-viewer` | `reads` | `memory.event-log-writer` | `in-process` | sync | hard | event log | Caller aborts the operation or uses its documented fallback. | Audit reads append-only logs. |
| `rel.0216` | `ops.fleet-emergency-stop` | `controls` | `safety.emergency-stop-controller` | `in-process` | sync | hard | emergency stop | Caller aborts the operation or uses its documented fallback. | Ops cannot bypass safety. |
| `rel.0217` | `ops.fleet-emergency-stop` | `depends_on` | `transport.event-stream` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0218` | `ops.health-readiness` | `depends_on` | `decision.model-loader` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0219` | `ops.health-readiness` | `depends_on` | `memory.sqlite-runtime` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0220` | `ops.health-readiness` | `depends_on` | `ops.status-aggregator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0221` | `ops.ops-api` | `depends_on` | `ops.fleet-emergency-stop` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0222` | `ops.ops-api` | `depends_on` | `ops.pause-resume-controller` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0223` | `ops.ops-api` | `depends_on` | `ops.status-aggregator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0224` | `ops.ops-api` | `depends_on` | `transport.message-schema-registry` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0225` | `ops.pause-resume-controller` | `controls` | `bot-runtime.skill-host` | `in-process` | async | hard | pause or resume | Caller aborts the operation or uses its documented fallback. | Pause stops new skill steps. |
| `rel.0226` | `ops.pause-resume-controller` | `depends_on` | `bots.presence-tracker` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0227` | `ops.pause-resume-controller` | `depends_on` | `transport.event-stream` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0228` | `ops.sip-dump` | `depends_on` | `sip.revision-manager` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0229` | `ops.status-aggregator` | `depends_on` | `bots.presence-tracker` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0230` | `ops.status-aggregator` | `reads` | `claims.claim-repository` | `in-process` | sync | hard | claim status | Caller aborts the operation or uses its documented fallback. | Status is read-only. |
| `rel.0231` | `ops.status-aggregator` | `observes` | `ops.metrics-registry` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0232` | `ops.status-aggregator` | `reads` | `sip.revision-manager` | `in-process` | sync | hard | SIP revision | Caller aborts the operation or uses its documented fallback. | Status is read-only. |
| `rel.0233` | `ops.status-aggregator` | `reads` | `tasks.task-repository` | `in-process` | sync | hard | task status | Caller aborts the operation or uses its documented fallback. | Status is read-only. |

## Config and Profiles relations

| ID | From | Type | To | Protocol | Sync | Criticality | Payload | Failure behavior | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `rel.0102` | `config.config-schema-validator` | `depends_on` | `config.env-parser` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0103` | `config.fail-fast-handler` | `depends_on` | `config.config-schema-validator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0104` | `config.hardware-probe` | `depends_on` | `config.profile-resolver` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0105` | `config.hardware-probe` | `depends_on` | `ext.host-hardware` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0106` | `config.laya-runtime-resolver` | `depends_on` | `config.hardware-probe` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0107` | `config.laya-runtime-resolver` | `depends_on` | `config.profile-resolver` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0108` | `config.name-pool-validator` | `depends_on` | `config.config-schema-validator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0109` | `config.profile-resolver` | `depends_on` | `config.config-schema-validator` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0110` | `config.secrets-loader` | `depends_on` | `config.env-parser` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |

## Testing and Evaluation relations

| ID | From | Type | To | Protocol | Sync | Criticality | Payload | Failure behavior | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `rel.0163` | `eval.architecture-guard-tests` | `depends_on` | `eval.unit-fixtures` | `in-process` | sync | hard | architecture fixture | Caller aborts the operation or uses its documented fallback. | Guard tests validate the graph. |
| `rel.0164` | `eval.contention-harness` | `depends_on` | `claims.claim-repository` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0165` | `eval.contention-harness` | `delegates_to` | `eval.scenario-runner` | `in-process` | sync | hard | contention scenario | Caller aborts the operation or uses its documented fallback. | Contention tests reuse scenario runner. |
| `rel.0166` | `eval.contention-harness` | `depends_on` | `tasks.task-repository` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0167` | `eval.detector-fixtures` | `depends_on` | `eval.unit-fixtures` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0168` | `eval.detector-fixtures` | `depends_on` | `perception.detector-pipeline` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0169` | `eval.docker-server-harness` | `depends_on` | `eval.unit-fixtures` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0170` | `eval.docker-server-harness` | `depends_on` | `ext.minecraft-server` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0171` | `eval.laya-benchmark-harness` | `depends_on` | `decision.latency-metrics` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0172` | `eval.laya-benchmark-harness` | `depends_on` | `decision.model-loader` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0173` | `eval.laya-benchmark-harness` | `delegates_to` | `eval.scenario-runner` | `in-process` | sync | hard | benchmark scenario | Caller aborts the operation or uses its documented fallback. | Benchmarks reuse scenario runner. |
| `rel.0174` | `eval.metrics-reporter` | `observes` | `ops.metrics-registry` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0175` | `eval.replay-engine` | `depends_on` | `eval.scenario-runner` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0176` | `eval.replay-engine` | `depends_on` | `memory.event-log-writer` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0177` | `eval.scenario-runner` | `controls` | `eval.docker-server-harness` | `in-process` | sync | hard | server lifecycle | Caller aborts the operation or uses its documented fallback. | Scenarios own disposable servers. |
| `rel.0178` | `eval.scenario-runner` | `publishes` | `eval.metrics-reporter` | `in-process` | async | hard | scenario result | Caller aborts the operation or uses its documented fallback. | Results are reported. |
| `rel.0179` | `eval.soak-runner` | `depends_on` | `eval.metrics-reporter` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0180` | `eval.soak-runner` | `delegates_to` | `eval.scenario-runner` | `in-process` | sync | hard | soak scenario | Caller aborts the operation or uses its documented fallback. | Soak tests reuse scenario runner. |

## Laya Training relations

| ID | From | Type | To | Protocol | Sync | Criticality | Payload | Failure behavior | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `rel.0434` | `training.calibration-fitter` | `reads` | `decision.confidence-calibrator` | `in-process` | sync | hard | calibration config | Caller aborts the operation or uses its documented fallback. | Calibration fits the runtime gate. |
| `rel.0435` | `training.calibration-fitter` | `depends_on` | `training.trace-exporter` | `in-process` | sync | hard | interface call | Caller aborts the operation or uses its documented fallback. | Interface call. |
| `rel.0436` | `training.fine-tune-runner` | `depends_on` | `training.labeling-pipeline` | `in-process` | sync | hard | labels | Caller aborts the operation or uses its documented fallback. | Fine-tuning consumes labels. |
| `rel.0437` | `training.fine-tune-runner` | `depends_on` | `training.reward-computer` | `in-process` | sync | hard | rewards | Caller aborts the operation or uses its documented fallback. | Fine-tuning consumes rewards. |
| `rel.0438` | `training.labeling-pipeline` | `depends_on` | `training.trace-exporter` | `in-process` | sync | hard | traces | Caller aborts the operation or uses its documented fallback. | Labeling consumes exported traces. |
| `rel.0439` | `training.onnx-exporter` | `depends_on` | `training.fine-tune-runner` | `in-process` | sync | hard | fine-tuned model | Caller aborts the operation or uses its documented fallback. | Export follows fine-tuning. |
| `rel.0440` | `training.promotion-gate` | `depends_on` | `eval.laya-benchmark-harness` | `in-process` | sync | hard | benchmark result | Caller aborts the operation or uses its documented fallback. | Promotion requires benchmark gates. |
| `rel.0441` | `training.promotion-gate` | `depends_on` | `training.calibration-fitter` | `in-process` | sync | hard | calibration result | Caller aborts the operation or uses its documented fallback. | Promotion requires calibration. |
| `rel.0442` | `training.promotion-gate` | `depends_on` | `training.onnx-exporter` | `in-process` | sync | hard | ONNX bundle | Caller aborts the operation or uses its documented fallback. | Promotion requires an export. |
| `rel.0443` | `training.reward-computer` | `depends_on` | `training.trace-exporter` | `in-process` | sync | hard | traces | Caller aborts the operation or uses its documented fallback. | Reward computation consumes traces. |
| `rel.0444` | `training.trace-exporter` | `reads` | `memory.event-log-writer` | `in-process` | sync | hard | traces | Caller aborts the operation or uses its documented fallback. | Dev-only export reads logs. |
