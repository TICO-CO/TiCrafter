# TiCrafter System Decomposition

> Generated from `docs/architecture/graph.json`. Edit the graph, then run `bun tools/architecture/render-graphs.mjs`.


**Version:** 1.3.0  
**Source:** `main.md`  
**Systems:** 24  
**Components:** 287  
**Relations:** 580  
**Externals:** 5

## Reading this catalog

A component is the smallest owned implementation boundary in this architecture. It has one responsibility, one owning package path, an explicit interface, owned state (if any), invariants, failure modes, tests, and metrics. Components are not individual functions.

## System index

| ID | System | Components | Owner package | Milestone |
|---|---|---:|---|---:|
| `sys.core` | [Coordinator Runtime](#coordinator-runtime) | 9 | `apps/coordinator/src/core` | 1 |
| `sys.transport` | [Transport and Protocol](#transport-and-protocol) | 8 | `packages/core/src/transport` | 1 |
| `sys.sip` | [Shared Infrastructure Plan](#shared-infrastructure-plan) | 13 | `apps/coordinator/src/sip` | 5 |
| `sys.tasks` | [Task Board](#task-board) | 9 | `apps/coordinator/src/tasks` | 5 |
| `sys.claims` | [Claims and Leases](#claims-and-leases) | 9 | `apps/coordinator/src/claims` | 5 |
| `sys.grants` | [Edit Grants and Collaboration](#edit-grants-and-collaboration) | 9 | `apps/coordinator/src/grants` | 5 |
| `sys.bots` | [Bot Registry and Profiles](#bot-registry-and-profiles) | 10 | `apps/coordinator/src/bots` | 5 |
| `sys.world` | [World Model and Landmarks](#world-model-and-landmarks) | 11 | `packages/worldmodel/src` | 3 |
| `sys.perception` | [Perception](#perception) | 11 | `packages/perception/src` | 3 |
| `sys.decision` | [Laya Decision Service](#laya-decision-service) | 12 | `apps/coordinator/src/decision` | 8 |
| `sys.planner` | [Cloud Planner Advisor](#cloud-planner-advisor) | 12 | `packages/planning/src` | 9 |
| `sys.skill-runtime` | [Skill Runtime](#skill-runtime) | 10 | `packages/skills/src` | 4 |
| `sys.skills` | [Skill Library](#skill-library) | 27 | `packages/skills/src` | 4 |
| `sys.building` | [Building](#building) | 35 | `packages/building/src` | 6 |
| `sys.bot-runtime` | [Bot Runtime and Mineflayer Adapter](#bot-runtime-and-mineflayer-adapter) | 18 | `apps/bot/src` | 1 |
| `sys.safety` | [Autonomy and Safety](#autonomy-and-safety) | 14 | `packages/safety/src` | 4 |
| `sys.memory` | [Memory and Persistence](#memory-and-persistence) | 10 | `packages/memory/src` | 1 |
| `sys.ops` | [Ops and Observability](#ops-and-observability) | 10 | `apps/coordinator/src/ops` | 11 |
| `sys.config` | [Config and Profiles](#config-and-profiles) | 8 | `packages/core/src/config` | 1 |
| `sys.eval` | [Testing and Evaluation](#testing-and-evaluation) | 10 | `packages/eval/src` | 10 |
| `sys.training` | [Laya Training](#laya-training) | 7 | `tools/laya-train` | 10 |
| `sys.brains` | [Brains](#brains) | 4 | `packages/brains/src` | 4 |
| `sys.agency` | [Agency](#agency) | 16 | `packages/agency/src` | 12 |
| `sys.toolchain` | [Bootstrap and Toolchain](#bootstrap-and-toolchain) | 5 | `tools` | 1 |

## Coordinator Runtime

- **ID:** `sys.core`
- **Owner package:** `apps/coordinator/src/core`
- **Milestone:** 1
- **Source refs:** `main.md#1-fleet-coordinator`
- **Allowed cross-system dependencies:** `sys.bots`, `sys.config`, `sys.memory`, `sys.sip`, `sys.transport`
- **Forbidden dependencies:** none

**Purpose.** Own the single coordinator process, route commands, schedule work, and recover fleet state after restart.

**System invariants.**
- One coordinator process is the only authority for fleet state commits.
- Every restart revalidates claims, grants, and bot sessions before accepting work.
- Commands are routed through typed handlers; no component bypasses the authority chain.

### Components

| ID | Component | Responsibility | Owner path | Milestone |
|---|---|---|---|---:|
| `core.process-bootstrap` | Process Bootstrap | Load config, open SQLite, run migrations, start transport, and enter a healthy serving state. | `apps/coordinator/src/core/process-bootstrap` | 1 |
| `core.service-composition` | Service Composition | Wire coordinator services through explicit interfaces and reject missing or cyclic runtime dependencies. | `apps/coordinator/src/core/service-composition` | 1 |
| `core.session-manager` | Bot Session Manager | Authenticate bot sessions, track connection state, and notify presence and recovery components. | `apps/coordinator/src/core/session-manager` | 1 |
| `core.command-router` | Command Router | Route validated commands to the owning authority: SIP commit, task claim, claim acquisition, or grant issuance. | `apps/coordinator/src/core/command-router` | 1 |
| `core.coordinator-epoch` | Coordinator Epoch Authority | Issue and persist the coordinator epoch used to invalidate stale leases and grants after restart. | `apps/coordinator/src/core/coordinator-epoch` | 1 |
| `core.global-scheduler` | Global Scheduler | Coordinate periodic reconciliation, lease expiry, planner triggers, and retention jobs without overlapping runs. | `apps/coordinator/src/core/global-scheduler` | 1 |
| `core.restart-recovery` | Restart Recovery Orchestrator | Recover leases, grants, bot profiles, tasks, and SIP consistency before normal work resumes. | `apps/coordinator/src/core/restart-recovery` | 1 |
| `core.backpressure-controller` | Backpressure Controller | Apply fleet-wide queue and action backpressure when decision, transport, or claim latency exceeds budget. | `apps/coordinator/src/core/backpressure-controller` | 1 |
| `core.bot-process-supervisor` | Bot Process Supervisor | Spawn, supervise, and terminate bot child processes and report crashes over IPC. | `apps/coordinator/src/core/bot-process-supervisor` | 1 |

### `core.process-bootstrap` — Process Bootstrap

- **Responsibility:** Load config, open SQLite, run migrations, start transport, and enter a healthy serving state.
- **Owner path:** `apps/coordinator/src/core/process-bootstrap`
- **Provides:** `core.process-bootstrap.interface`
- **Requires:** `config.env-parser`, `config.config-schema-validator`, `core.service-composition`, `core.restart-recovery`, `memory.migration-runner`, `transport.ws-codec`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 1
- **Invariants:**
  - All actions pass through the typed coordinator authority chain; no component bypasses it.
  - Restart never accepts new work before claims, grants, sessions, and SIP revision are revalidated.
- **Failure modes:**
  - Authority dependency unavailable: fail closed, keep serving read-only status, and surface a typed error.
- **Tests:**
  - Authority-boundary contract test proving bypass attempts are rejected.
- **Metrics:**
  - `core_process_bootstrap_errors_total`
  - `core_process_bootstrap_latency_ms`

### `core.service-composition` — Service Composition

- **Responsibility:** Wire coordinator services through explicit interfaces and reject missing or cyclic runtime dependencies.
- **Owner path:** `apps/coordinator/src/core/service-composition`
- **Provides:** `core.service-composition.interface`
- **Requires:** `config.profile-resolver`, `core.global-scheduler`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 1
- **Invariants:**
  - All actions pass through the typed coordinator authority chain; no component bypasses it.
  - Restart never accepts new work before claims, grants, sessions, and SIP revision are revalidated.
- **Failure modes:**
  - Authority dependency unavailable: fail closed, keep serving read-only status, and surface a typed error.
- **Tests:**
  - Authority-boundary contract test proving bypass attempts are rejected.
- **Metrics:**
  - `core_service_composition_errors_total`
  - `core_service_composition_latency_ms`

### `core.session-manager` — Bot Session Manager

- **Responsibility:** Authenticate bot sessions, track connection state, and notify presence and recovery components.
- **Owner path:** `apps/coordinator/src/core/session-manager`
- **Provides:** `core.session-manager.interface`
- **Requires:** `transport.ws-codec`, `bots.identity-authenticator`, `bots.presence-tracker`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 1
- **Invariants:**
  - All actions pass through the typed coordinator authority chain; no component bypasses it.
  - Restart never accepts new work before claims, grants, sessions, and SIP revision are revalidated.
- **Failure modes:**
  - Authority dependency unavailable: fail closed, keep serving read-only status, and surface a typed error.
- **Tests:**
  - Authority-boundary contract test proving bypass attempts are rejected.
- **Metrics:**
  - `core_session_manager_errors_total`
  - `core_session_manager_latency_ms`

### `core.command-router` — Command Router

- **Responsibility:** Route validated commands to the owning authority: SIP commit, task claim, claim acquisition, or grant issuance.
- **Owner path:** `apps/coordinator/src/core/command-router`
- **Provides:** `core.command-router.interface`
- **Requires:** `transport.message-schema-registry`, `sip.transactional-committer`, `tasks.atomic-task-claimer`, `claims.atomic-acquirer`, `grants.grant-issuer`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 1
- **Invariants:**
  - All actions pass through the typed coordinator authority chain; no component bypasses it.
  - Restart never accepts new work before claims, grants, sessions, and SIP revision are revalidated.
- **Failure modes:**
  - Authority dependency unavailable: fail closed, keep serving read-only status, and surface a typed error.
- **Tests:**
  - Authority-boundary contract test proving bypass attempts are rejected.
- **Metrics:**
  - `core_command_router_errors_total`
  - `core_command_router_latency_ms`

### `core.coordinator-epoch` — Coordinator Epoch Authority

- **Responsibility:** Issue and persist the coordinator epoch used to invalidate stale leases and grants after restart.
- **Owner path:** `apps/coordinator/src/core/coordinator-epoch`
- **Provides:** `core.coordinator-epoch.interface`
- **Requires:** `memory.transaction-manager`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 1
- **Invariants:**
  - The coordinator epoch increments exactly once per start and is embedded in every fencing token.
  - Tokens from a previous epoch are rejected after restart.
- **Failure modes:**
  - Authority dependency unavailable: fail closed, keep serving read-only status, and surface a typed error.
- **Tests:**
  - Authority-boundary contract test proving bypass attempts are rejected.
- **Metrics:**
  - `core_coordinator_epoch_errors_total`
  - `core_coordinator_epoch_latency_ms`

### `core.global-scheduler` — Global Scheduler

- **Responsibility:** Coordinate periodic reconciliation, lease expiry, planner triggers, and retention jobs without overlapping runs.
- **Owner path:** `apps/coordinator/src/core/global-scheduler`
- **Provides:** `core.global-scheduler.interface`
- **Requires:** `core.coordinator-epoch`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 1
- **Invariants:**
  - All actions pass through the typed coordinator authority chain; no component bypasses it.
  - Restart never accepts new work before claims, grants, sessions, and SIP revision are revalidated.
- **Failure modes:**
  - Authority dependency unavailable: fail closed, keep serving read-only status, and surface a typed error.
- **Tests:**
  - Authority-boundary contract test proving bypass attempts are rejected.
- **Metrics:**
  - `core_global_scheduler_errors_total`
  - `core_global_scheduler_latency_ms`

### `core.restart-recovery` — Restart Recovery Orchestrator

- **Responsibility:** Recover leases, grants, bot profiles, tasks, and SIP consistency before normal work resumes.
- **Owner path:** `apps/coordinator/src/core/restart-recovery`
- **Provides:** `core.restart-recovery.interface`
- **Requires:** `memory.transaction-manager`, `claims.lease-reaper`, `bots.resume-orchestrator`, `sip.reconciliation-engine`, `grants.grant-expiry`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 1
- **Invariants:**
  - No new work is accepted until leases, grants, bot sessions, tasks, and SIP revision are revalidated.
- **Failure modes:**
  - Authority dependency unavailable: fail closed, keep serving read-only status, and surface a typed error.
- **Tests:**
  - Authority-boundary contract test proving bypass attempts are rejected.
- **Metrics:**
  - `core_restart_recovery_errors_total`
  - `core_restart_recovery_latency_ms`

### `core.backpressure-controller` — Backpressure Controller

- **Responsibility:** Apply fleet-wide queue and action backpressure when decision, transport, or claim latency exceeds budget.
- **Owner path:** `apps/coordinator/src/core/backpressure-controller`
- **Provides:** `core.backpressure-controller.interface`
- **Requires:** `transport.flow-control`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 1
- **Invariants:**
  - When warm-model p95 exceeds 250ms fleet-wide, tactical rate drops before any confidence-gate change.
- **Failure modes:**
  - Authority dependency unavailable: fail closed, keep serving read-only status, and surface a typed error.
- **Tests:**
  - Authority-boundary contract test proving bypass attempts are rejected.
- **Metrics:**
  - `core_backpressure_controller_errors_total`
  - `core_backpressure_controller_latency_ms`

### `core.bot-process-supervisor` — Bot Process Supervisor

- **Responsibility:** Spawn, supervise, and terminate bot child processes and report crashes over IPC.
- **Owner path:** `apps/coordinator/src/core/bot-process-supervisor`
- **Provides:** `core.bot-process-supervisor.interface`
- **Requires:** `core.coordinator-epoch`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 1
- **Invariants:**
  - Each bot runs in its own child process and is supervised over IPC.
  - A crashed bot is restarted or killed and its claims expire by lease; the fleet keeps running.
- **Failure modes:**
  - Spawn or supervision failure: mark the bot offline, release no state directly, and let leases expire.
- **Tests:**
  - Spawn, crash-detect, kill, and restart-isolation tests.
- **Metrics:**
  - `core_bot_process_supervisor_restarts_total`
  - `core_bot_process_supervisor_crashes_total`

---

## Transport and Protocol

- **ID:** `sys.transport`
- **Owner package:** `packages/core/src/transport`
- **Milestone:** 1
- **Source refs:** `main.md#13-repo-layout`
- **Allowed cross-system dependencies:** `sys.bots`, `sys.config`
- **Forbidden dependencies:** none

**Purpose.** Define typed messages and move requests, responses, deltas, and events between coordinator and bots.

**System invariants.**
- Every cross-process message validates against a versioned schema before dispatch.
- Transport carries proposals and commands; it never owns domain state.
- Reconnect and delta sync are idempotent and safe under retry.

### Components

| ID | Component | Responsibility | Owner path | Milestone |
|---|---|---|---|---:|
| `transport.message-schema-registry` | Message Schema Registry | Version and expose zod schemas for coordinator-bot requests, responses, events, and deltas. | `packages/core/src/transport/message-schema-registry` | 1 |
| `transport.ws-codec` | WebSocket Codec | Encode, decode, and validate WebSocket frames against registered message schemas. | `packages/core/src/transport/ws-codec` | 1 |
| `transport.request-correlator` | Request Correlator | Match requests to responses with stable correlation IDs and bounded pending state. | `packages/core/src/transport/request-correlator` | 1 |
| `transport.event-stream` | Event Stream | Publish and deliver ordered domain events with per-consumer cursors and backpressure. | `packages/core/src/transport/event-stream` | 1 |
| `transport.delta-sync` | Delta Sync Protocol | Package and apply state deltas by chunk version, SIP revision, task board revision, and grant revision. | `packages/core/src/transport/delta-sync` | 1 |
| `transport.reconnect` | Reconnect Supervisor | Reconnect with exponential backoff and force delta resync after any gap. | `packages/core/src/transport/reconnect` | 1 |
| `transport.auth` | Transport Authentication | Authenticate bot sessions by identity and reject connections that do not match a known bot profile. | `packages/core/src/transport/auth` | 1 |
| `transport.flow-control` | Flow Control | Bound in-flight requests and queue depth per bot and per message class. | `packages/core/src/transport/flow-control` | 1 |

### `transport.message-schema-registry` — Message Schema Registry

- **Responsibility:** Version and expose zod schemas for coordinator-bot requests, responses, events, and deltas.
- **Owner path:** `packages/core/src/transport/message-schema-registry`
- **Provides:** `transport.message-schema-registry.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#13-repo-layout`
- **Milestone:** 1
- **Invariants:**
  - Every message validates against a versioned zod schema before dispatch.
  - Transport carries proposals and commands; it never owns domain state.
- **Failure modes:**
  - Schema mismatch or framing error: reject the frame, close the connection, and record the protocol error.
- **Tests:**
  - Round-trip encode/decode plus malformed-frame rejection.
- **Metrics:**
  - `transport_message_schema_registry_errors_total`
  - `transport_message_schema_registry_latency_ms`

### `transport.ws-codec` — WebSocket Codec

- **Responsibility:** Encode, decode, and validate WebSocket frames against registered message schemas.
- **Owner path:** `packages/core/src/transport/ws-codec`
- **Provides:** `transport.ws-codec.interface`
- **Requires:** `transport.message-schema-registry`
- **Owns state:** none
- **Source refs:** `main.md#13-repo-layout`
- **Milestone:** 1
- **Invariants:**
  - Every message validates against a versioned zod schema before dispatch.
  - Transport carries proposals and commands; it never owns domain state.
- **Failure modes:**
  - Schema mismatch or framing error: reject the frame, close the connection, and record the protocol error.
- **Tests:**
  - Round-trip encode/decode plus malformed-frame rejection.
- **Metrics:**
  - `transport_ws_codec_errors_total`
  - `transport_ws_codec_latency_ms`

### `transport.request-correlator` — Request Correlator

- **Responsibility:** Match requests to responses with stable correlation IDs and bounded pending state.
- **Owner path:** `packages/core/src/transport/request-correlator`
- **Provides:** `transport.request-correlator.interface`
- **Requires:** `transport.ws-codec`
- **Owns state:** none
- **Source refs:** `main.md#13-repo-layout`
- **Milestone:** 1
- **Invariants:**
  - Every message validates against a versioned zod schema before dispatch.
  - Transport carries proposals and commands; it never owns domain state.
- **Failure modes:**
  - Schema mismatch or framing error: reject the frame, close the connection, and record the protocol error.
- **Tests:**
  - Round-trip encode/decode plus malformed-frame rejection.
- **Metrics:**
  - `transport_request_correlator_errors_total`
  - `transport_request_correlator_latency_ms`

### `transport.event-stream` — Event Stream

- **Responsibility:** Publish and deliver ordered domain events with per-consumer cursors and backpressure.
- **Owner path:** `packages/core/src/transport/event-stream`
- **Provides:** `transport.event-stream.interface`
- **Requires:** `transport.ws-codec`
- **Owns state:** none
- **Source refs:** `main.md#13-repo-layout`
- **Milestone:** 1
- **Invariants:**
  - Every message validates against a versioned zod schema before dispatch.
  - Transport carries proposals and commands; it never owns domain state.
- **Failure modes:**
  - Schema mismatch or framing error: reject the frame, close the connection, and record the protocol error.
- **Tests:**
  - Round-trip encode/decode plus malformed-frame rejection.
- **Metrics:**
  - `transport_event_stream_errors_total`
  - `transport_event_stream_latency_ms`

### `transport.delta-sync` — Delta Sync Protocol

- **Responsibility:** Package and apply state deltas by chunk version, SIP revision, task board revision, and grant revision.
- **Owner path:** `packages/core/src/transport/delta-sync`
- **Provides:** `transport.delta-sync.interface`
- **Requires:** `transport.message-schema-registry`
- **Owns state:** none
- **Source refs:** `main.md#13-repo-layout`
- **Milestone:** 1
- **Invariants:**
  - Delta sync is keyed by chunk version, SIP revision, task revision, and grant revision and is idempotent under retry.
- **Failure modes:**
  - Schema mismatch or framing error: reject the frame, close the connection, and record the protocol error.
- **Tests:**
  - Round-trip encode/decode plus malformed-frame rejection.
- **Metrics:**
  - `transport_delta_sync_errors_total`
  - `transport_delta_sync_latency_ms`

### `transport.reconnect` — Reconnect Supervisor

- **Responsibility:** Reconnect with exponential backoff and force delta resync after any gap.
- **Owner path:** `packages/core/src/transport/reconnect`
- **Provides:** `transport.reconnect.interface`
- **Requires:** `transport.ws-codec`
- **Owns state:** none
- **Source refs:** `main.md#13-repo-layout`
- **Milestone:** 1
- **Invariants:**
  - Every message validates against a versioned zod schema before dispatch.
  - Transport carries proposals and commands; it never owns domain state.
- **Failure modes:**
  - Schema mismatch or framing error: reject the frame, close the connection, and record the protocol error.
- **Tests:**
  - Round-trip encode/decode plus malformed-frame rejection.
- **Metrics:**
  - `transport_reconnect_errors_total`
  - `transport_reconnect_latency_ms`

### `transport.auth` — Transport Authentication

- **Responsibility:** Authenticate bot sessions by identity and reject connections that do not match a known bot profile.
- **Owner path:** `packages/core/src/transport/auth`
- **Provides:** `transport.auth.interface`
- **Requires:** `config.secrets-loader`, `bots.identity-authenticator`
- **Owns state:** none
- **Source refs:** `main.md#13-repo-layout`
- **Milestone:** 1
- **Invariants:**
  - Every message validates against a versioned zod schema before dispatch.
  - Transport carries proposals and commands; it never owns domain state.
- **Failure modes:**
  - Schema mismatch or framing error: reject the frame, close the connection, and record the protocol error.
- **Tests:**
  - Round-trip encode/decode plus malformed-frame rejection.
- **Metrics:**
  - `transport_auth_errors_total`
  - `transport_auth_latency_ms`

### `transport.flow-control` — Flow Control

- **Responsibility:** Bound in-flight requests and queue depth per bot and per message class.
- **Owner path:** `packages/core/src/transport/flow-control`
- **Provides:** `transport.flow-control.interface`
- **Requires:** `transport.request-correlator`
- **Owns state:** none
- **Source refs:** `main.md#13-repo-layout`
- **Milestone:** 1
- **Invariants:**
  - Every message validates against a versioned zod schema before dispatch.
  - Transport carries proposals and commands; it never owns domain state.
- **Failure modes:**
  - Schema mismatch or framing error: reject the frame, close the connection, and record the protocol error.
- **Tests:**
  - Round-trip encode/decode plus malformed-frame rejection.
- **Metrics:**
  - `transport_flow_control_errors_total`
  - `transport_flow_control_latency_ms`

---

## Shared Infrastructure Plan

- **ID:** `sys.sip`
- **Owner package:** `apps/coordinator/src/sip`
- **Milestone:** 5
- **Source refs:** `main.md#2-shared-infrastructure-plan-sip`
- **Allowed cross-system dependencies:** `sys.memory`, `sys.world`
- **Forbidden dependencies:** none

**Purpose.** Maintain the canonical intended world state and commit validated plan revisions atomically.

**System invariants.**
- Every committed change increments the SIP revision exactly once.
- A mutation is proposed, validated, then committed transactionally; no partial SIP writes.
- Active plans are tagged separately from observed natural infrastructure.

### Components

| ID | Component | Responsibility | Owner path | Milestone |
|---|---|---|---|---:|
| `sip.zone-store` | Zone Store | Persist zones, polygons, priorities, and no-build constraints. | `apps/coordinator/src/sip/zone-store` | 5 |
| `sip.structure-store` | Structure Store | Persist structures, design revisions, ownership, status, work packages, and collaboration policy. | `apps/coordinator/src/sip/structure-store` | 5 |
| `sip.road-store` | Road Store | Persist road polylines, widths, materials, segment status, and owners. | `apps/coordinator/src/sip/road-store` | 5 |
| `sip.farm-store` | Farm Store | Persist farm plots, crops, water sources, growth state, and assigned bots. | `apps/coordinator/src/sip/farm-store` | 5 |
| `sip.container-registry` | Container Registry | Persist canonical container roles, reservations, and contents snapshots. | `apps/coordinator/src/sip/container-registry` | 5 |
| `sip.path-graph-store` | Path Graph Store | Persist the SIP path graph nodes and edges used for routing and road planning. | `apps/coordinator/src/sip/path-graph-store` | 5 |
| `sip.rules-store` | Rules Store | Persist protected bounding boxes, allowed edits, and safety constraints. | `apps/coordinator/src/sip/rules-store` | 5 |
| `sip.revision-manager` | SIP Revision Manager | Allocate monotonic revisions, reject stale proposals, and publish revision changes. | `apps/coordinator/src/sip/revision-manager` | 5 |
| `sip.spatial-overlap-validator` | Spatial Overlap Validator | Reject mutations that overlap protected zones, active structures, or disallowed edits. | `apps/coordinator/src/sip/spatial-overlap-validator` | 5 |
| `sip.dependency-validator` | Dependency Validator | Reject mutations that violate structure, road, farm, container, or path-graph dependencies. | `apps/coordinator/src/sip/dependency-validator` | 5 |
| `sip.mutation-proposer` | SIP Mutation Proposer | Accept untrusted mutation proposals and attach actor, plan, grant, and idempotency metadata. | `apps/coordinator/src/sip/mutation-proposer` | 5 |
| `sip.transactional-committer` | SIP Transactional Committer | Validate a proposal and commit all SIP stores in one SQLite transaction with a fencing token. | `apps/coordinator/src/sip/transactional-committer` | 5 |
| `sip.reconciliation-engine` | SIP Reconciliation Engine | Compare observed world against intended SIP state and update progress, deviations, and revisions. | `apps/coordinator/src/sip/reconciliation-engine` | 5 |

### `sip.zone-store` — Zone Store

- **Responsibility:** Persist zones, polygons, priorities, and no-build constraints.
- **Owner path:** `apps/coordinator/src/sip/zone-store`
- **Provides:** `sip.zone-store.interface`
- **Requires:** `memory.transaction-manager`
- **Owns state:** `sip.zones`
- **Source refs:** `main.md#2-shared-infrastructure-plan-sip`
- **Milestone:** 5
- **Invariants:**
  - Writes are transactional and use the coordinator transaction manager.
  - Reads never expose uncommitted state.
- **Failure modes:**
  - Storage failure: abort the transaction, leave prior state intact, and return a typed repository error.
- **Tests:**
  - Repository contract test with rollback, concurrency, and stale-read cases.
- **Metrics:**
  - `sip_zone_store_errors_total`
  - `sip_zone_store_latency_ms`

### `sip.structure-store` — Structure Store

- **Responsibility:** Persist structures, design revisions, ownership, status, work packages, and collaboration policy.
- **Owner path:** `apps/coordinator/src/sip/structure-store`
- **Provides:** `sip.structure-store.interface`
- **Requires:** `memory.transaction-manager`
- **Owns state:** `sip.structures`
- **Source refs:** `main.md#2-shared-infrastructure-plan-sip`
- **Milestone:** 5
- **Invariants:**
  - Writes are transactional and use the coordinator transaction manager.
  - Reads never expose uncommitted state.
- **Failure modes:**
  - Storage failure: abort the transaction, leave prior state intact, and return a typed repository error.
- **Tests:**
  - Repository contract test with rollback, concurrency, and stale-read cases.
- **Metrics:**
  - `sip_structure_store_errors_total`
  - `sip_structure_store_latency_ms`

### `sip.road-store` — Road Store

- **Responsibility:** Persist road polylines, widths, materials, segment status, and owners.
- **Owner path:** `apps/coordinator/src/sip/road-store`
- **Provides:** `sip.road-store.interface`
- **Requires:** `memory.transaction-manager`
- **Owns state:** `sip.roads`
- **Source refs:** `main.md#2-shared-infrastructure-plan-sip`
- **Milestone:** 5
- **Invariants:**
  - Writes are transactional and use the coordinator transaction manager.
  - Reads never expose uncommitted state.
- **Failure modes:**
  - Storage failure: abort the transaction, leave prior state intact, and return a typed repository error.
- **Tests:**
  - Repository contract test with rollback, concurrency, and stale-read cases.
- **Metrics:**
  - `sip_road_store_errors_total`
  - `sip_road_store_latency_ms`

### `sip.farm-store` — Farm Store

- **Responsibility:** Persist farm plots, crops, water sources, growth state, and assigned bots.
- **Owner path:** `apps/coordinator/src/sip/farm-store`
- **Provides:** `sip.farm-store.interface`
- **Requires:** `memory.transaction-manager`
- **Owns state:** `sip.farms`
- **Source refs:** `main.md#2-shared-infrastructure-plan-sip`
- **Milestone:** 5
- **Invariants:**
  - Writes are transactional and use the coordinator transaction manager.
  - Reads never expose uncommitted state.
- **Failure modes:**
  - Storage failure: abort the transaction, leave prior state intact, and return a typed repository error.
- **Tests:**
  - Repository contract test with rollback, concurrency, and stale-read cases.
- **Metrics:**
  - `sip_farm_store_errors_total`
  - `sip_farm_store_latency_ms`

### `sip.container-registry` — Container Registry

- **Responsibility:** Persist canonical container roles, reservations, and contents snapshots.
- **Owner path:** `apps/coordinator/src/sip/container-registry`
- **Provides:** `sip.container-registry.interface`
- **Requires:** `memory.transaction-manager`
- **Owns state:** `sip.containers`
- **Source refs:** `main.md#2-shared-infrastructure-plan-sip`
- **Milestone:** 5
- **Invariants:**
  - Writes are transactional and use the coordinator transaction manager.
  - Reads never expose uncommitted state.
- **Failure modes:**
  - Storage failure: abort the transaction, leave prior state intact, and return a typed repository error.
- **Tests:**
  - Repository contract test with rollback, concurrency, and stale-read cases.
- **Metrics:**
  - `sip_container_registry_errors_total`
  - `sip_container_registry_latency_ms`

### `sip.path-graph-store` — Path Graph Store

- **Responsibility:** Persist the SIP path graph nodes and edges used for routing and road planning.
- **Owner path:** `apps/coordinator/src/sip/path-graph-store`
- **Provides:** `sip.path-graph-store.interface`
- **Requires:** `memory.transaction-manager`
- **Owns state:** `sip.pathGraph`
- **Source refs:** `main.md#2-shared-infrastructure-plan-sip`
- **Milestone:** 5
- **Invariants:**
  - Writes are transactional and use the coordinator transaction manager.
  - Reads never expose uncommitted state.
- **Failure modes:**
  - Storage failure: abort the transaction, leave prior state intact, and return a typed repository error.
- **Tests:**
  - Repository contract test with rollback, concurrency, and stale-read cases.
- **Metrics:**
  - `sip_path_graph_store_errors_total`
  - `sip_path_graph_store_latency_ms`

### `sip.rules-store` — Rules Store

- **Responsibility:** Persist protected bounding boxes, allowed edits, and safety constraints.
- **Owner path:** `apps/coordinator/src/sip/rules-store`
- **Provides:** `sip.rules-store.interface`
- **Requires:** `memory.transaction-manager`
- **Owns state:** `sip.rules`
- **Source refs:** `main.md#2-shared-infrastructure-plan-sip`
- **Milestone:** 5
- **Invariants:**
  - Writes are transactional and use the coordinator transaction manager.
  - Reads never expose uncommitted state.
- **Failure modes:**
  - Storage failure: abort the transaction, leave prior state intact, and return a typed repository error.
- **Tests:**
  - Repository contract test with rollback, concurrency, and stale-read cases.
- **Metrics:**
  - `sip_rules_store_errors_total`
  - `sip_rules_store_latency_ms`

### `sip.revision-manager` — SIP Revision Manager

- **Responsibility:** Allocate monotonic revisions, reject stale proposals, and publish revision changes.
- **Owner path:** `apps/coordinator/src/sip/revision-manager`
- **Provides:** `sip.revision-manager.interface`
- **Requires:** `sip.rules-store`, `memory.transaction-manager`
- **Owns state:** `sip.revisions`
- **Source refs:** `main.md#2-shared-infrastructure-plan-sip`
- **Milestone:** 5
- **Invariants:**
  - Revisions are monotonic; stale proposals are rejected and revision changes invalidate outstanding grants.
- **Failure modes:**
  - Storage failure: abort the transaction, leave prior state intact, and return a typed repository error.
- **Tests:**
  - Repository contract test with rollback, concurrency, and stale-read cases.
- **Metrics:**
  - `sip_revision_manager_errors_total`
  - `sip_revision_manager_latency_ms`

### `sip.spatial-overlap-validator` — Spatial Overlap Validator

- **Responsibility:** Reject mutations that overlap protected zones, active structures, or disallowed edits.
- **Owner path:** `apps/coordinator/src/sip/spatial-overlap-validator`
- **Provides:** `sip.spatial-overlap-validator.interface`
- **Requires:** `sip.zone-store`, `sip.structure-store`, `sip.rules-store`
- **Owns state:** none
- **Source refs:** `main.md#2-shared-infrastructure-plan-sip`
- **Milestone:** 5
- **Invariants:**
  - Validation is pure and deterministic; the same input yields the same verdict.
  - Invalid input is rejected with a typed reason and causes no partial mutation.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `sip_spatial_overlap_validator_errors_total`
  - `sip_spatial_overlap_validator_latency_ms`

### `sip.dependency-validator` — Dependency Validator

- **Responsibility:** Reject mutations that violate structure, road, farm, container, or path-graph dependencies.
- **Owner path:** `apps/coordinator/src/sip/dependency-validator`
- **Provides:** `sip.dependency-validator.interface`
- **Requires:** `sip.structure-store`, `sip.road-store`, `sip.farm-store`, `sip.container-registry`, `sip.path-graph-store`
- **Owns state:** none
- **Source refs:** `main.md#2-shared-infrastructure-plan-sip`
- **Milestone:** 5
- **Invariants:**
  - Validation is pure and deterministic; the same input yields the same verdict.
  - Invalid input is rejected with a typed reason and causes no partial mutation.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `sip_dependency_validator_errors_total`
  - `sip_dependency_validator_latency_ms`

### `sip.mutation-proposer` — SIP Mutation Proposer

- **Responsibility:** Accept untrusted mutation proposals and attach actor, plan, grant, and idempotency metadata.
- **Owner path:** `apps/coordinator/src/sip/mutation-proposer`
- **Provides:** `sip.mutation-proposer.interface`
- **Requires:** `sip.revision-manager`, `sip.spatial-overlap-validator`, `sip.dependency-validator`
- **Owns state:** none
- **Source refs:** `main.md#2-shared-infrastructure-plan-sip`
- **Milestone:** 5
- **Invariants:**
  - Validation is pure and deterministic; the same input yields the same verdict.
  - Invalid input is rejected with a typed reason and causes no partial mutation.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `sip_mutation_proposer_errors_total`
  - `sip_mutation_proposer_latency_ms`

### `sip.transactional-committer` — SIP Transactional Committer

- **Responsibility:** Validate a proposal and commit all SIP stores in one SQLite transaction with a fencing token.
- **Owner path:** `apps/coordinator/src/sip/transactional-committer`
- **Provides:** `sip.transactional-committer.interface`
- **Requires:** `sip.zone-store`, `sip.structure-store`, `sip.road-store`, `sip.farm-store`, `sip.container-registry`, `sip.path-graph-store`, `sip.rules-store`, `sip.revision-manager`, `memory.transaction-manager`
- **Owns state:** none
- **Source refs:** `main.md#2-shared-infrastructure-plan-sip`
- **Milestone:** 5
- **Invariants:**
  - Every committed SIP change increments the revision exactly once inside one SQLite transaction.
  - A proposal with a stale revision or fencing token is rejected without partial writes.
- **Failure modes:**
  - Conflict or stale token: abort, leave state unchanged, and return a retryable conflict error.
- **Tests:**
  - Atomic commit, rollback, and stale-token rejection tests.
- **Metrics:**
  - `sip_transactional_committer_errors_total`
  - `sip_transactional_committer_latency_ms`

### `sip.reconciliation-engine` — SIP Reconciliation Engine

- **Responsibility:** Compare observed world against intended SIP state and update progress, deviations, and revisions.
- **Owner path:** `apps/coordinator/src/sip/reconciliation-engine`
- **Provides:** `sip.reconciliation-engine.interface`
- **Requires:** `world.world-reconciler`, `sip.structure-store`, `sip.farm-store`, `sip.road-store`, `sip.transactional-committer`
- **Owns state:** none
- **Source refs:** `main.md#2-shared-infrastructure-plan-sip`
- **Milestone:** 5
- **Invariants:**
  - Reconciliation compares observed world with intended SIP state and never mutates observed state.
- **Failure modes:**
  - Storage failure: abort the transaction, leave prior state intact, and return a typed repository error.
- **Tests:**
  - Repository contract test with rollback, concurrency, and stale-read cases.
- **Metrics:**
  - `sip_reconciliation_engine_errors_total`
  - `sip_reconciliation_engine_latency_ms`

---

## Task Board

- **ID:** `sys.tasks`
- **Owner package:** `apps/coordinator/src/tasks`
- **Milestone:** 5
- **Source refs:** `main.md#4-claims-leases-task-board`
- **Allowed cross-system dependencies:** `sys.memory`
- **Forbidden dependencies:** none

**Purpose.** Maintain the fleet work DAG and offer eligible jobs without duplicate execution.

**System invariants.**
- A task is claimed by at most one bot at a time.
- Task transitions are persisted before they are acknowledged.
- Dependencies and preconditions gate eligibility before a claim is allowed.
- Jobs are offers: bots may accept, defer, or decline with a reason.
- Declining a job is not a task failure and never changes task state.

### Components

| ID | Component | Responsibility | Owner path | Milestone |
|---|---|---|---|---:|
| `tasks.task-repository` | Task Repository | Persist tasks, dependencies, state, retries, priority, and dead-letter status. | `apps/coordinator/src/tasks/task-repository` | 5 |
| `tasks.dag-resolver` | Task DAG Resolver | Resolve task dependencies and expose eligible roots without cycles. | `apps/coordinator/src/tasks/dag-resolver` | 5 |
| `tasks.precondition-evaluator` | Precondition Evaluator | Evaluate world, inventory, zone, and claim preconditions before task eligibility. | `apps/coordinator/src/tasks/precondition-evaluator` | 5 |
| `tasks.priority-scheduler` | Priority Scheduler | Order eligible tasks by priority, role fit, distance, and fleet contention. | `apps/coordinator/src/tasks/priority-scheduler` | 5 |
| `tasks.atomic-task-claimer` | Atomic Task Claimer | Claim the next eligible task in one transaction and issue the task lease. | `apps/coordinator/src/tasks/atomic-task-claimer` | 5 |
| `tasks.job-offer-service` | Job Offer Service | Offer ranked eligible jobs to a bot and record accept, defer, and decline decisions without changing task state on decline. | `apps/coordinator/src/tasks/job-offer-service` | 13 |
| `tasks.retry-manager` | Retry Manager | Retry failed tasks with bounded backoff and failure-class-specific policy. | `apps/coordinator/src/tasks/retry-manager` | 5 |
| `tasks.dead-letter-manager` | Dead Letter Manager | Park exhausted tasks for planner review instead of retrying forever. | `apps/coordinator/src/tasks/dead-letter-manager` | 5 |
| `tasks.task-state-machine` | Task State Machine | Validate and persist every legal task transition with actor and reason. | `apps/coordinator/src/tasks/task-state-machine` | 5 |

### `tasks.task-repository` — Task Repository

- **Responsibility:** Persist tasks, dependencies, state, retries, priority, and dead-letter status.
- **Owner path:** `apps/coordinator/src/tasks/task-repository`
- **Provides:** `tasks.task-repository.interface`
- **Requires:** `memory.transaction-manager`
- **Owns state:** `tasks`
- **Source refs:** `main.md#4-claims-leases-task-board`
- **Milestone:** 5
- **Invariants:**
  - Writes are transactional and use the coordinator transaction manager.
  - Reads never expose uncommitted state.
- **Failure modes:**
  - Storage failure: abort the transaction, leave prior state intact, and return a typed repository error.
- **Tests:**
  - Repository contract test with rollback, concurrency, and stale-read cases.
- **Metrics:**
  - `tasks_task_repository_errors_total`
  - `tasks_task_repository_latency_ms`

### `tasks.dag-resolver` — Task DAG Resolver

- **Responsibility:** Resolve task dependencies and expose eligible roots without cycles.
- **Owner path:** `apps/coordinator/src/tasks/dag-resolver`
- **Provides:** `tasks.dag-resolver.interface`
- **Requires:** `tasks.task-repository`
- **Owns state:** none
- **Source refs:** `main.md#4-claims-leases-task-board`
- **Milestone:** 5
- **Invariants:**
  - Writes are transactional and use the coordinator transaction manager.
  - Reads never expose uncommitted state.
- **Failure modes:**
  - Storage failure: abort the transaction, leave prior state intact, and return a typed repository error.
- **Tests:**
  - Repository contract test with rollback, concurrency, and stale-read cases.
- **Metrics:**
  - `tasks_dag_resolver_errors_total`
  - `tasks_dag_resolver_latency_ms`

### `tasks.precondition-evaluator` — Precondition Evaluator

- **Responsibility:** Evaluate world, inventory, zone, and claim preconditions before task eligibility.
- **Owner path:** `apps/coordinator/src/tasks/precondition-evaluator`
- **Provides:** `tasks.precondition-evaluator.interface`
- **Requires:** `tasks.task-repository`, `world.spatial-query-engine`
- **Owns state:** none
- **Source refs:** `main.md#4-claims-leases-task-board`
- **Milestone:** 5
- **Invariants:**
  - Validation is pure and deterministic; the same input yields the same verdict.
  - Invalid input is rejected with a typed reason and causes no partial mutation.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `tasks_precondition_evaluator_errors_total`
  - `tasks_precondition_evaluator_latency_ms`

### `tasks.priority-scheduler` — Priority Scheduler

- **Responsibility:** Order eligible tasks by priority, role fit, distance, and fleet contention.
- **Owner path:** `apps/coordinator/src/tasks/priority-scheduler`
- **Provides:** `tasks.priority-scheduler.interface`
- **Requires:** `tasks.dag-resolver`, `tasks.precondition-evaluator`, `bots.profile-store`
- **Owns state:** none
- **Source refs:** `main.md#4-claims-leases-task-board`
- **Milestone:** 5
- **Invariants:**
  - Writes are transactional and use the coordinator transaction manager.
  - Reads never expose uncommitted state.
- **Failure modes:**
  - Storage failure: abort the transaction, leave prior state intact, and return a typed repository error.
- **Tests:**
  - Repository contract test with rollback, concurrency, and stale-read cases.
- **Metrics:**
  - `tasks_priority_scheduler_errors_total`
  - `tasks_priority_scheduler_latency_ms`

### `tasks.atomic-task-claimer` — Atomic Task Claimer

- **Responsibility:** Claim the next eligible task in one transaction and issue the task lease.
- **Owner path:** `apps/coordinator/src/tasks/atomic-task-claimer`
- **Provides:** `tasks.atomic-task-claimer.interface`
- **Requires:** `tasks.task-repository`, `tasks.priority-scheduler`, `memory.transaction-manager`
- **Owns state:** none
- **Source refs:** `main.md#4-claims-leases-task-board`
- **Milestone:** 5
- **Invariants:**
  - Claims and leases mutate only under the coordinator epoch and a valid fencing token.
  - Expired leases are reclaimed without losing audit history.
- **Failure modes:**
  - Lease conflict or stale token: reject the commit, requeue the work, and record contention.
- **Tests:**
  - Concurrent acquisition, expiry, and stale-commit race tests.
- **Metrics:**
  - `tasks_atomic_task_claimer_errors_total`
  - `tasks_atomic_task_claimer_latency_ms`

### `tasks.job-offer-service` — Job Offer Service

- **Responsibility:** Offer ranked eligible jobs to a bot and record accept, defer, and decline decisions without changing task state on decline.
- **Owner path:** `apps/coordinator/src/tasks/job-offer-service`
- **Provides:** `tasks.job-offer-service.interface`
- **Requires:** `tasks.task-repository`, `tasks.priority-scheduler`, `tasks.precondition-evaluator`
- **Owns state:** none
- **Source refs:** `main.md#4-claims-leases-task-board`
- **Milestone:** 13
- **Invariants:**
  - Offers are advisory and never reserve a job.
  - Accepting an offer claims the job in one transaction with a lease and fencing token.
  - Declining records a reason and leaves the job available for another bot.
- **Failure modes:**
  - Policy ambiguity or missing owner: deny the request and return a typed reason.
- **Tests:**
  - Grant/deny matrix including owner-offline and revision-bump cases.
- **Metrics:**
  - `tasks_jobs_offered_total`
  - `tasks_jobs_accepted_total`
  - `tasks_jobs_declined_total`
  - `tasks_job_offer_latency_ms`

### `tasks.retry-manager` — Retry Manager

- **Responsibility:** Retry failed tasks with bounded backoff and failure-class-specific policy.
- **Owner path:** `apps/coordinator/src/tasks/retry-manager`
- **Provides:** `tasks.retry-manager.interface`
- **Requires:** `tasks.task-repository`, `tasks.task-state-machine`
- **Owns state:** none
- **Source refs:** `main.md#4-claims-leases-task-board`
- **Milestone:** 5
- **Invariants:**
  - Writes are transactional and use the coordinator transaction manager.
  - Reads never expose uncommitted state.
- **Failure modes:**
  - Storage failure: abort the transaction, leave prior state intact, and return a typed repository error.
- **Tests:**
  - Repository contract test with rollback, concurrency, and stale-read cases.
- **Metrics:**
  - `tasks_retry_manager_errors_total`
  - `tasks_retry_manager_latency_ms`

### `tasks.dead-letter-manager` — Dead Letter Manager

- **Responsibility:** Park exhausted tasks for planner review instead of retrying forever.
- **Owner path:** `apps/coordinator/src/tasks/dead-letter-manager`
- **Provides:** `tasks.dead-letter-manager.interface`
- **Requires:** `tasks.task-repository`
- **Owns state:** none
- **Source refs:** `main.md#4-claims-leases-task-board`
- **Milestone:** 5
- **Invariants:**
  - Writes are transactional and use the coordinator transaction manager.
  - Reads never expose uncommitted state.
- **Failure modes:**
  - Storage failure: abort the transaction, leave prior state intact, and return a typed repository error.
- **Tests:**
  - Repository contract test with rollback, concurrency, and stale-read cases.
- **Metrics:**
  - `tasks_dead_letter_manager_errors_total`
  - `tasks_dead_letter_manager_latency_ms`

### `tasks.task-state-machine` — Task State Machine

- **Responsibility:** Validate and persist every legal task transition with actor and reason.
- **Owner path:** `apps/coordinator/src/tasks/task-state-machine`
- **Provides:** `tasks.task-state-machine.interface`
- **Requires:** `tasks.task-repository`, `memory.event-log-writer`
- **Owns state:** none
- **Source refs:** `main.md#4-claims-leases-task-board`
- **Milestone:** 5
- **Invariants:**
  - Validation is pure and deterministic; the same input yields the same verdict.
  - Invalid input is rejected with a typed reason and causes no partial mutation.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `tasks_task_state_machine_errors_total`
  - `tasks_task_state_machine_latency_ms`

---

## Claims and Leases

- **ID:** `sys.claims`
- **Owner package:** `apps/coordinator/src/claims`
- **Milestone:** 5
- **Source refs:** `main.md#4-claims-leases-task-board`
- **Allowed cross-system dependencies:** `sys.core`, `sys.memory`, `sys.sip`, `sys.tasks`, `sys.transport`
- **Forbidden dependencies:** none

**Purpose.** Prevent duplicate work through atomic claims, leases, heartbeats, and fencing tokens.

**System invariants.**
- Acquisition and overlap checks happen in one SQLite transaction.
- A commit with a stale fencing token is rejected.
- Expired leases return resources to planned state without losing audit history.

### Components

| ID | Component | Responsibility | Owner path | Milestone |
|---|---|---|---|---:|
| `claims.claim-repository` | Claim Repository | Persist claims, resource types, bounding boxes, leases, status, and fencing tokens. | `apps/coordinator/src/claims/claim-repository` | 5 |
| `claims.overlap-margin-checker` | Overlap Margin Checker | Reject claim requests that overlap an active claim or safety margin. | `apps/coordinator/src/claims/overlap-margin-checker` | 5 |
| `claims.atomic-acquirer` | Atomic Claim Acquirer | Acquire a resource claim atomically after overlap and task eligibility checks. | `apps/coordinator/src/claims/atomic-acquirer` | 5 |
| `claims.lease-heartbeat` | Lease Heartbeat | Renew active leases only while the owning bot remains connected and valid. | `apps/coordinator/src/claims/lease-heartbeat` | 5 |
| `claims.lease-reaper` | Lease Reaper | Expire overdue leases, requeue work, and invalidate fencing tokens. | `apps/coordinator/src/claims/lease-reaper` | 5 |
| `claims.fencing-token-authority` | Fencing Token Authority | Issue monotonic fencing tokens bound to coordinator epoch and claim identity. | `apps/coordinator/src/claims/fencing-token-authority` | 5 |
| `claims.claim-releaser` | Claim Releaser | Release a claim on completion, cancellation, or bot loss and requeue uncompleted work. | `apps/coordinator/src/claims/claim-releaser` | 5 |
| `claims.bot-claim-command-handler` | Bot Claim Command Handler | Accept typed claim acquire, renew, and release requests from bots and route them through the claim service. | `apps/coordinator/src/claims/bot-claim-command-handler` | 13 |
| `claims.contention-metrics` | Contention Metrics | Record claim wait, reclaims, duplicate attempts, and lease churn. | `apps/coordinator/src/claims/contention-metrics` | 5 |

### `claims.claim-repository` — Claim Repository

- **Responsibility:** Persist claims, resource types, bounding boxes, leases, status, and fencing tokens.
- **Owner path:** `apps/coordinator/src/claims/claim-repository`
- **Provides:** `claims.claim-repository.interface`
- **Requires:** `memory.transaction-manager`
- **Owns state:** `claims`
- **Source refs:** `main.md#4-claims-leases-task-board`
- **Milestone:** 5
- **Invariants:**
  - Claims and leases mutate only under the coordinator epoch and a valid fencing token.
  - Expired leases are reclaimed without losing audit history.
- **Failure modes:**
  - Lease conflict or stale token: reject the commit, requeue the work, and record contention.
- **Tests:**
  - Concurrent acquisition, expiry, and stale-commit race tests.
- **Metrics:**
  - `claims_claim_repository_errors_total`
  - `claims_claim_repository_latency_ms`

### `claims.overlap-margin-checker` — Overlap Margin Checker

- **Responsibility:** Reject claim requests that overlap an active claim or safety margin.
- **Owner path:** `apps/coordinator/src/claims/overlap-margin-checker`
- **Provides:** `claims.overlap-margin-checker.interface`
- **Requires:** `claims.claim-repository`, `sip.spatial-overlap-validator`
- **Owns state:** none
- **Source refs:** `main.md#4-claims-leases-task-board`
- **Milestone:** 5
- **Invariants:**
  - Validation is pure and deterministic; the same input yields the same verdict.
  - Invalid input is rejected with a typed reason and causes no partial mutation.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `claims_overlap_margin_checker_errors_total`
  - `claims_overlap_margin_checker_latency_ms`

### `claims.atomic-acquirer` — Atomic Claim Acquirer

- **Responsibility:** Acquire a resource claim atomically after overlap and task eligibility checks.
- **Owner path:** `apps/coordinator/src/claims/atomic-acquirer`
- **Provides:** `claims.atomic-acquirer.interface`
- **Requires:** `claims.claim-repository`, `claims.overlap-margin-checker`, `memory.transaction-manager`
- **Owns state:** none
- **Source refs:** `main.md#4-claims-leases-task-board`
- **Milestone:** 5
- **Invariants:**
  - Overlap checks and claim acquisition share one SQLite transaction with the configured safety margin.
- **Failure modes:**
  - Lease conflict or stale token: reject the commit, requeue the work, and record contention.
- **Tests:**
  - Concurrent acquisition, expiry, and stale-commit race tests.
- **Metrics:**
  - `claims_atomic_acquirer_errors_total`
  - `claims_atomic_acquirer_latency_ms`

### `claims.lease-heartbeat` — Lease Heartbeat

- **Responsibility:** Renew active leases only while the owning bot remains connected and valid.
- **Owner path:** `apps/coordinator/src/claims/lease-heartbeat`
- **Provides:** `claims.lease-heartbeat.interface`
- **Requires:** `claims.claim-repository`
- **Owns state:** none
- **Source refs:** `main.md#4-claims-leases-task-board`
- **Milestone:** 5
- **Invariants:**
  - Claims and leases mutate only under the coordinator epoch and a valid fencing token.
  - Expired leases are reclaimed without losing audit history.
- **Failure modes:**
  - Lease conflict or stale token: reject the commit, requeue the work, and record contention.
- **Tests:**
  - Concurrent acquisition, expiry, and stale-commit race tests.
- **Metrics:**
  - `claims_lease_heartbeat_errors_total`
  - `claims_lease_heartbeat_latency_ms`

### `claims.lease-reaper` — Lease Reaper

- **Responsibility:** Expire overdue leases, requeue work, and invalidate fencing tokens.
- **Owner path:** `apps/coordinator/src/claims/lease-reaper`
- **Provides:** `claims.lease-reaper.interface`
- **Requires:** `claims.claim-repository`, `tasks.task-state-machine`
- **Owns state:** none
- **Source refs:** `main.md#4-claims-leases-task-board`
- **Milestone:** 5
- **Invariants:**
  - Claims and leases mutate only under the coordinator epoch and a valid fencing token.
  - Expired leases are reclaimed without losing audit history.
- **Failure modes:**
  - Lease conflict or stale token: reject the commit, requeue the work, and record contention.
- **Tests:**
  - Concurrent acquisition, expiry, and stale-commit race tests.
- **Metrics:**
  - `claims_lease_reaper_errors_total`
  - `claims_lease_reaper_latency_ms`

### `claims.fencing-token-authority` — Fencing Token Authority

- **Responsibility:** Issue monotonic fencing tokens bound to coordinator epoch and claim identity.
- **Owner path:** `apps/coordinator/src/claims/fencing-token-authority`
- **Provides:** `claims.fencing-token-authority.interface`
- **Requires:** `core.coordinator-epoch`, `memory.transaction-manager`
- **Owns state:** none
- **Source refs:** `main.md#4-claims-leases-task-board`
- **Milestone:** 5
- **Invariants:**
  - Fencing tokens are monotonic and bound to coordinator epoch and claim identity.
- **Failure modes:**
  - Lease conflict or stale token: reject the commit, requeue the work, and record contention.
- **Tests:**
  - Concurrent acquisition, expiry, and stale-commit race tests.
- **Metrics:**
  - `claims_fencing_token_authority_errors_total`
  - `claims_fencing_token_authority_latency_ms`

### `claims.claim-releaser` — Claim Releaser

- **Responsibility:** Release a claim on completion, cancellation, or bot loss and requeue uncompleted work.
- **Owner path:** `apps/coordinator/src/claims/claim-releaser`
- **Provides:** `claims.claim-releaser.interface`
- **Requires:** `claims.claim-repository`, `tasks.task-state-machine`
- **Owns state:** none
- **Source refs:** `main.md#4-claims-leases-task-board`
- **Milestone:** 5
- **Invariants:**
  - Claims and leases mutate only under the coordinator epoch and a valid fencing token.
  - Expired leases are reclaimed without losing audit history.
- **Failure modes:**
  - Lease conflict or stale token: reject the commit, requeue the work, and record contention.
- **Tests:**
  - Concurrent acquisition, expiry, and stale-commit race tests.
- **Metrics:**
  - `claims_claim_releaser_errors_total`
  - `claims_claim_releaser_latency_ms`

### `claims.bot-claim-command-handler` — Bot Claim Command Handler

- **Responsibility:** Accept typed claim acquire, renew, and release requests from bots and route them through the claim service.
- **Owner path:** `apps/coordinator/src/claims/bot-claim-command-handler`
- **Provides:** `claims.bot-claim-command-handler.interface`
- **Requires:** `claims.claim-repository`, `transport.ws-codec`
- **Owns state:** none
- **Source refs:** `main.md#4-claims-leases-task-board`
- **Milestone:** 13
- **Invariants:**
  - Bot-originated claims use the same overlap, lease, and fencing rules as job claims.
  - A bot cannot acquire or release a claim for another bot.
- **Failure modes:**
  - Lease conflict or stale token: reject the commit, requeue the work, and record contention.
- **Tests:**
  - Concurrent acquisition, expiry, and stale-commit race tests.
- **Metrics:**
  - `claims_bot_claim_commands_total`
  - `claims_bot_claim_command_errors_total`
  - `claims_bot_claim_command_latency_ms`

### `claims.contention-metrics` — Contention Metrics

- **Responsibility:** Record claim wait, reclaims, duplicate attempts, and lease churn.
- **Owner path:** `apps/coordinator/src/claims/contention-metrics`
- **Provides:** `claims.contention-metrics.interface`
- **Requires:** `claims.claim-repository`, `ops.metrics-registry`
- **Owns state:** none
- **Source refs:** `main.md#4-claims-leases-task-board`
- **Milestone:** 5
- **Invariants:**
  - Claims and leases mutate only under the coordinator epoch and a valid fencing token.
  - Expired leases are reclaimed without losing audit history.
- **Failure modes:**
  - Lease conflict or stale token: reject the commit, requeue the work, and record contention.
- **Tests:**
  - Concurrent acquisition, expiry, and stale-commit race tests.
- **Metrics:**
  - `claims_contention_metrics_errors_total`
  - `claims_contention_metrics_latency_ms`

---

## Edit Grants and Collaboration

- **ID:** `sys.grants`
- **Owner package:** `apps/coordinator/src/grants`
- **Milestone:** 5
- **Source refs:** `main.md#3-collaboration-on-active-builds`
- **Allowed cross-system dependencies:** `sys.claims`, `sys.memory`, `sys.sip`
- **Forbidden dependencies:** none

**Purpose.** Allow scoped, revision-bound edits to active builds without corrupting owner plans.

**System invariants.**
- Active builds are private by default.
- Every non-owner edit presents an unexpired grant bound to the current design revision and fencing token.
- A design revision change invalidates outstanding grants immediately.

### Components

| ID | Component | Responsibility | Owner path | Milestone |
|---|---|---|---|---:|
| `grants.grant-repository` | Grant Repository | Persist edit grants, scopes, operation sets, revisions, expiries, and fencing tokens. | `apps/coordinator/src/grants/grant-repository` | 5 |
| `grants.policy-evaluator` | Collaboration Policy Evaluator | Apply private, invite, or open policy to an edit request. | `apps/coordinator/src/grants/policy-evaluator` | 5 |
| `grants.compatibility-checker` | Compatibility Checker | Verify proposed edits preserve invariants, do not undo work, and do not collide with claimed packages. | `apps/coordinator/src/grants/compatibility-checker` | 5 |
| `grants.design-revision-guard` | Design Revision Guard | Bind grants to one design revision and revoke grants when the revision changes. | `apps/coordinator/src/grants/design-revision-guard` | 5 |
| `grants.grant-issuer` | Grant Issuer | Issue a scoped grant after policy and compatibility approval. | `apps/coordinator/src/grants/grant-issuer` | 5 |
| `grants.grant-revoker` | Grant Revoker | Revoke a grant immediately by bumping its fencing token. | `apps/coordinator/src/grants/grant-revoker` | 5 |
| `grants.owner-offline-policy` | Owner Offline Policy | Deny by default when the owner is offline unless persisted policy explicitly accepts compatible helpers. | `apps/coordinator/src/grants/owner-offline-policy` | 5 |
| `grants.grant-expiry` | Grant Expiry | Expire grants by TTL and reject writes that arrive after expiry. | `apps/coordinator/src/grants/grant-expiry` | 5 |
| `grants.arbitration-adapter` | Arbitration Adapter | Escalate ambiguous compatibility decisions to the planner without bypassing safety rules. | `apps/coordinator/src/grants/arbitration-adapter` | 5 |

### `grants.grant-repository` — Grant Repository

- **Responsibility:** Persist edit grants, scopes, operation sets, revisions, expiries, and fencing tokens.
- **Owner path:** `apps/coordinator/src/grants/grant-repository`
- **Provides:** `grants.grant-repository.interface`
- **Requires:** `memory.transaction-manager`
- **Owns state:** `edit_grants`
- **Source refs:** `main.md#3-collaboration-on-active-builds`
- **Milestone:** 5
- **Invariants:**
  - Privilege decisions are deny-by-default and scoped to one design revision.
  - Revocation takes effect immediately through a fencing-token bump.
- **Failure modes:**
  - Policy ambiguity or missing owner: deny the request and return a typed reason.
- **Tests:**
  - Grant/deny matrix including owner-offline and revision-bump cases.
- **Metrics:**
  - `grants_grant_repository_errors_total`
  - `grants_grant_repository_latency_ms`

### `grants.policy-evaluator` — Collaboration Policy Evaluator

- **Responsibility:** Apply private, invite, or open policy to an edit request.
- **Owner path:** `apps/coordinator/src/grants/policy-evaluator`
- **Provides:** `grants.policy-evaluator.interface`
- **Requires:** `grants.grant-repository`, `sip.structure-store`
- **Owns state:** none
- **Source refs:** `main.md#3-collaboration-on-active-builds`
- **Milestone:** 5
- **Invariants:**
  - Privilege decisions are deny-by-default and scoped to one design revision.
  - Revocation takes effect immediately through a fencing-token bump.
- **Failure modes:**
  - Policy ambiguity or missing owner: deny the request and return a typed reason.
- **Tests:**
  - Grant/deny matrix including owner-offline and revision-bump cases.
- **Metrics:**
  - `grants_policy_evaluator_errors_total`
  - `grants_policy_evaluator_latency_ms`

### `grants.compatibility-checker` — Compatibility Checker

- **Responsibility:** Verify proposed edits preserve invariants, do not undo work, and do not collide with claimed packages.
- **Owner path:** `apps/coordinator/src/grants/compatibility-checker`
- **Provides:** `grants.compatibility-checker.interface`
- **Requires:** `grants.grant-repository`, `sip.structure-store`, `claims.claim-repository`, `sip.rules-store`
- **Owns state:** none
- **Source refs:** `main.md#3-collaboration-on-active-builds`
- **Milestone:** 5
- **Invariants:**
  - Compatibility requires matching design revision, no undone completed work, no claimed work-package collision, and preserved structural invariants.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `grants_compatibility_checker_errors_total`
  - `grants_compatibility_checker_latency_ms`

### `grants.design-revision-guard` — Design Revision Guard

- **Responsibility:** Bind grants to one design revision and revoke grants when the revision changes.
- **Owner path:** `apps/coordinator/src/grants/design-revision-guard`
- **Provides:** `grants.design-revision-guard.interface`
- **Requires:** `sip.revision-manager`, `grants.grant-repository`
- **Owns state:** none
- **Source refs:** `main.md#3-collaboration-on-active-builds`
- **Milestone:** 5
- **Invariants:**
  - Any design revision change invalidates all outstanding grants for that structure.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `grants_design_revision_guard_errors_total`
  - `grants_design_revision_guard_latency_ms`

### `grants.grant-issuer` — Grant Issuer

- **Responsibility:** Issue a scoped grant after policy and compatibility approval.
- **Owner path:** `apps/coordinator/src/grants/grant-issuer`
- **Provides:** `grants.grant-issuer.interface`
- **Requires:** `grants.policy-evaluator`, `grants.compatibility-checker`, `grants.design-revision-guard`, `grants.grant-repository`
- **Owns state:** none
- **Source refs:** `main.md#3-collaboration-on-active-builds`
- **Milestone:** 5
- **Invariants:**
  - Every grant is scoped to a bbox, an allowed operation set, and exactly one design revision.
  - Issued grants carry a fencing token bound to the coordinator epoch.
- **Failure modes:**
  - Policy ambiguity or missing owner: deny the request and return a typed reason.
- **Tests:**
  - Grant/deny matrix including owner-offline and revision-bump cases.
- **Metrics:**
  - `grants_grant_issuer_errors_total`
  - `grants_grant_issuer_latency_ms`

### `grants.grant-revoker` — Grant Revoker

- **Responsibility:** Revoke a grant immediately by bumping its fencing token.
- **Owner path:** `apps/coordinator/src/grants/grant-revoker`
- **Provides:** `grants.grant-revoker.interface`
- **Requires:** `grants.grant-repository`, `claims.fencing-token-authority`
- **Owns state:** none
- **Source refs:** `main.md#3-collaboration-on-active-builds`
- **Milestone:** 5
- **Invariants:**
  - Privilege decisions are deny-by-default and scoped to one design revision.
  - Revocation takes effect immediately through a fencing-token bump.
- **Failure modes:**
  - Policy ambiguity or missing owner: deny the request and return a typed reason.
- **Tests:**
  - Grant/deny matrix including owner-offline and revision-bump cases.
- **Metrics:**
  - `grants_grant_revoker_errors_total`
  - `grants_grant_revoker_latency_ms`

### `grants.owner-offline-policy` — Owner Offline Policy

- **Responsibility:** Deny by default when the owner is offline unless persisted policy explicitly accepts compatible helpers.
- **Owner path:** `apps/coordinator/src/grants/owner-offline-policy`
- **Provides:** `grants.owner-offline-policy.interface`
- **Requires:** `bots.presence-tracker`, `bots.profile-store`, `grants.compatibility-checker`
- **Owns state:** none
- **Source refs:** `main.md#3-collaboration-on-active-builds`
- **Milestone:** 5
- **Invariants:**
  - Owner-offline edits default to deny; they are allowed only when autoAcceptCompatibleHelpers is true and compatibility passes.
- **Failure modes:**
  - Policy ambiguity or missing owner: deny the request and return a typed reason.
- **Tests:**
  - Grant/deny matrix including owner-offline and revision-bump cases.
- **Metrics:**
  - `grants_owner_offline_policy_errors_total`
  - `grants_owner_offline_policy_latency_ms`

### `grants.grant-expiry` — Grant Expiry

- **Responsibility:** Expire grants by TTL and reject writes that arrive after expiry.
- **Owner path:** `apps/coordinator/src/grants/grant-expiry`
- **Provides:** `grants.grant-expiry.interface`
- **Requires:** `grants.grant-repository`
- **Owns state:** none
- **Source refs:** `main.md#3-collaboration-on-active-builds`
- **Milestone:** 5
- **Invariants:**
  - Privilege decisions are deny-by-default and scoped to one design revision.
  - Revocation takes effect immediately through a fencing-token bump.
- **Failure modes:**
  - Policy ambiguity or missing owner: deny the request and return a typed reason.
- **Tests:**
  - Grant/deny matrix including owner-offline and revision-bump cases.
- **Metrics:**
  - `grants_grant_expiry_errors_total`
  - `grants_grant_expiry_latency_ms`

### `grants.arbitration-adapter` — Arbitration Adapter

- **Responsibility:** Escalate ambiguous compatibility decisions to the planner without bypassing safety rules.
- **Owner path:** `apps/coordinator/src/grants/arbitration-adapter`
- **Provides:** `grants.arbitration-adapter.interface`
- **Requires:** `transport.event-stream`, `grants.compatibility-checker`
- **Owns state:** none
- **Source refs:** `main.md#3-collaboration-on-active-builds`
- **Milestone:** 5
- **Invariants:**
  - Privilege decisions are deny-by-default and scoped to one design revision.
  - Revocation takes effect immediately through a fencing-token bump.
- **Failure modes:**
  - Policy ambiguity or missing owner: deny the request and return a typed reason.
- **Tests:**
  - Grant/deny matrix including owner-offline and revision-bump cases.
- **Metrics:**
  - `grants_arbitration_adapter_errors_total`
  - `grants_arbitration_adapter_latency_ms`

---

## Bot Registry and Profiles

- **ID:** `sys.bots`
- **Owner package:** `apps/coordinator/src/bots`
- **Milestone:** 5
- **Source refs:** `main.md#5-bot-identity-roles-and-persistence`
- **Allowed cross-system dependencies:** `sys.agency`, `sys.config`, `sys.memory`
- **Forbidden dependencies:** none

**Purpose.** Persist bot identity, personality, needs, intention, roles, behavior, relationships, presence, home, and resume state.

**System invariants.**
- Bot identity and username assignment are stable across restarts.
- Resume restores intent, needs, home, and obligations, then reconciles with the world.
- Profiles, roles, and agency state are coordinator-owned and persisted continuously.

### Components

| ID | Component | Responsibility | Owner path | Milestone |
|---|---|---|---|---:|
| `bots.identity-authenticator` | Bot Identity Authenticator | Authenticate a bot by stable bot ID and username against persisted identity. | `apps/coordinator/src/bots/identity-authenticator` | 5 |
| `bots.profile-store` | Bot Profile Store | Persist identity, role, behavior, task, claims, grants, relationships, and sync cursors. | `apps/coordinator/src/bots/profile-store` | 5 |
| `bots.role-manager` | Role Manager | Persist fixed roles and apply temporary planner reassignment with restoration. | `apps/coordinator/src/bots/role-manager` | 5 |
| `bots.behavior-profile-manager` | Behavior Profile Manager | Persist risk tolerance, work radius, sociability, and preferred base. | `apps/coordinator/src/bots/behavior-profile-manager` | 5 |
| `bots.relationship-store` | Relationship Store | Persist trust and interaction history between bots. | `apps/coordinator/src/bots/relationship-store` | 5 |
| `bots.presence-tracker` | Presence Tracker | Track online, offline, and suspended state from session events. | `apps/coordinator/src/bots/presence-tracker` | 5 |
| `bots.delta-sync-planner` | Delta Sync Planner | Compute the state delta a reconnecting bot needs from persisted cursors. | `apps/coordinator/src/bots/delta-sync-planner` | 5 |
| `bots.resume-orchestrator` | Resume Orchestrator | Restore profile, leases, task, grants, and skill checkpoint; requeue if stale. | `apps/coordinator/src/bots/resume-orchestrator` | 5 |
| `bots.agency-state-store` | Agency State Store | Persist current needs, intention, routine, home, mood, and last deliberation time per bot. | `apps/coordinator/src/bots/agency-state-store` | 12 |
| `bots.name-pool-allocator` | Name Pool Allocator | Assign names by stable bot index and reject pools shorter than bot count. | `apps/coordinator/src/bots/name-pool-allocator` | 5 |

### `bots.identity-authenticator` — Bot Identity Authenticator

- **Responsibility:** Authenticate a bot by stable bot ID and username against persisted identity.
- **Owner path:** `apps/coordinator/src/bots/identity-authenticator`
- **Provides:** `bots.identity-authenticator.interface`
- **Requires:** `bots.profile-store`, `config.secrets-loader`
- **Owns state:** none
- **Source refs:** `main.md#5-bot-identity-roles-and-persistence`
- **Milestone:** 5
- **Invariants:**
  - Privilege decisions are deny-by-default and scoped to one design revision.
  - Revocation takes effect immediately through a fencing-token bump.
- **Failure modes:**
  - Policy ambiguity or missing owner: deny the request and return a typed reason.
- **Tests:**
  - Grant/deny matrix including owner-offline and revision-bump cases.
- **Metrics:**
  - `bots_identity_authenticator_errors_total`
  - `bots_identity_authenticator_latency_ms`

### `bots.profile-store` — Bot Profile Store

- **Responsibility:** Persist identity, role, behavior, task, claims, grants, relationships, and sync cursors.
- **Owner path:** `apps/coordinator/src/bots/profile-store`
- **Provides:** `bots.profile-store.interface`
- **Requires:** `memory.transaction-manager`
- **Owns state:** `bots`
- **Source refs:** `main.md#5-bot-identity-roles-and-persistence`
- **Milestone:** 5
- **Invariants:**
  - Writes are transactional and use the coordinator transaction manager.
  - Reads never expose uncommitted state.
- **Failure modes:**
  - Storage failure: abort the transaction, leave prior state intact, and return a typed repository error.
- **Tests:**
  - Repository contract test with rollback, concurrency, and stale-read cases.
- **Metrics:**
  - `bots_profile_store_errors_total`
  - `bots_profile_store_latency_ms`

### `bots.role-manager` — Role Manager

- **Responsibility:** Persist fixed roles and apply temporary planner reassignment with restoration.
- **Owner path:** `apps/coordinator/src/bots/role-manager`
- **Provides:** `bots.role-manager.interface`
- **Requires:** `bots.profile-store`
- **Owns state:** none
- **Source refs:** `main.md#5-bot-identity-roles-and-persistence`
- **Milestone:** 5
- **Invariants:**
  - Writes are transactional and use the coordinator transaction manager.
  - Reads never expose uncommitted state.
- **Failure modes:**
  - Storage failure: abort the transaction, leave prior state intact, and return a typed repository error.
- **Tests:**
  - Repository contract test with rollback, concurrency, and stale-read cases.
- **Metrics:**
  - `bots_role_manager_errors_total`
  - `bots_role_manager_latency_ms`

### `bots.behavior-profile-manager` — Behavior Profile Manager

- **Responsibility:** Persist risk tolerance, work radius, sociability, and preferred base.
- **Owner path:** `apps/coordinator/src/bots/behavior-profile-manager`
- **Provides:** `bots.behavior-profile-manager.interface`
- **Requires:** `bots.profile-store`
- **Owns state:** none
- **Source refs:** `main.md#5-bot-identity-roles-and-persistence`
- **Milestone:** 5
- **Invariants:**
  - Writes are transactional and use the coordinator transaction manager.
  - Reads never expose uncommitted state.
- **Failure modes:**
  - Storage failure: abort the transaction, leave prior state intact, and return a typed repository error.
- **Tests:**
  - Repository contract test with rollback, concurrency, and stale-read cases.
- **Metrics:**
  - `bots_behavior_profile_manager_errors_total`
  - `bots_behavior_profile_manager_latency_ms`

### `bots.relationship-store` — Relationship Store

- **Responsibility:** Persist trust and interaction history between bots.
- **Owner path:** `apps/coordinator/src/bots/relationship-store`
- **Provides:** `bots.relationship-store.interface`
- **Requires:** `bots.profile-store`
- **Owns state:** none
- **Source refs:** `main.md#5-bot-identity-roles-and-persistence`
- **Milestone:** 5
- **Invariants:**
  - Writes are transactional and use the coordinator transaction manager.
  - Reads never expose uncommitted state.
- **Failure modes:**
  - Storage failure: abort the transaction, leave prior state intact, and return a typed repository error.
- **Tests:**
  - Repository contract test with rollback, concurrency, and stale-read cases.
- **Metrics:**
  - `bots_relationship_store_errors_total`
  - `bots_relationship_store_latency_ms`

### `bots.presence-tracker` — Presence Tracker

- **Responsibility:** Track online, offline, and suspended state from session events.
- **Owner path:** `apps/coordinator/src/bots/presence-tracker`
- **Provides:** `bots.presence-tracker.interface`
- **Requires:** `bots.profile-store`
- **Owns state:** none
- **Source refs:** `main.md#5-bot-identity-roles-and-persistence`
- **Milestone:** 5
- **Invariants:**
  - Writes are transactional and use the coordinator transaction manager.
  - Reads never expose uncommitted state.
- **Failure modes:**
  - Storage failure: abort the transaction, leave prior state intact, and return a typed repository error.
- **Tests:**
  - Repository contract test with rollback, concurrency, and stale-read cases.
- **Metrics:**
  - `bots_presence_tracker_errors_total`
  - `bots_presence_tracker_latency_ms`

### `bots.delta-sync-planner` — Delta Sync Planner

- **Responsibility:** Compute the state delta a reconnecting bot needs from persisted cursors.
- **Owner path:** `apps/coordinator/src/bots/delta-sync-planner`
- **Provides:** `bots.delta-sync-planner.interface`
- **Requires:** `bots.profile-store`, `sip.revision-manager`, `tasks.task-repository`, `grants.grant-repository`
- **Owns state:** none
- **Source refs:** `main.md#5-bot-identity-roles-and-persistence`
- **Milestone:** 5
- **Invariants:**
  - Writes are transactional and use the coordinator transaction manager.
  - Reads never expose uncommitted state.
- **Failure modes:**
  - Storage failure: abort the transaction, leave prior state intact, and return a typed repository error.
- **Tests:**
  - Repository contract test with rollback, concurrency, and stale-read cases.
- **Metrics:**
  - `bots_delta_sync_planner_errors_total`
  - `bots_delta_sync_planner_latency_ms`

### `bots.resume-orchestrator` — Resume Orchestrator

- **Responsibility:** Restore profile, leases, task, grants, and skill checkpoint; requeue if stale.
- **Owner path:** `apps/coordinator/src/bots/resume-orchestrator`
- **Provides:** `bots.resume-orchestrator.interface`
- **Requires:** `bots.profile-store`, `claims.claim-releaser`, `skill-runtime.checkpoint-manager`, `bots.delta-sync-planner`, `sip.reconciliation-engine`
- **Owns state:** none
- **Source refs:** `main.md#5-bot-identity-roles-and-persistence`
- **Milestone:** 5
- **Invariants:**
  - Writes are transactional and use the coordinator transaction manager.
  - Reads never expose uncommitted state.
- **Failure modes:**
  - Storage failure: abort the transaction, leave prior state intact, and return a typed repository error.
- **Tests:**
  - Repository contract test with rollback, concurrency, and stale-read cases.
- **Metrics:**
  - `bots_resume_orchestrator_errors_total`
  - `bots_resume_orchestrator_latency_ms`

### `bots.agency-state-store` — Agency State Store

- **Responsibility:** Persist current needs, intention, routine, home, mood, and last deliberation time per bot.
- **Owner path:** `apps/coordinator/src/bots/agency-state-store`
- **Provides:** `bots.agency-state-store.interface`
- **Requires:** `memory.transaction-manager`, `agency.agency-state`
- **Owns state:** `agent_state`
- **Source refs:** `main.md#20-agency-and-motivation`
- **Milestone:** 12
- **Invariants:**
  - Agency state writes are transactional and never expose partial snapshots.
  - Restored intentions are marked for world reconciliation before resuming.
- **Failure modes:**
  - Storage failure: abort the transaction, leave prior state intact, and return a typed repository error.
- **Tests:**
  - Repository contract test with rollback, concurrency, and stale-read cases.
- **Metrics:**
  - `bots_agency_state_store_errors_total`
  - `bots_agency_state_store_latency_ms`

### `bots.name-pool-allocator` — Name Pool Allocator

- **Responsibility:** Assign names by stable bot index and reject pools shorter than bot count.
- **Owner path:** `apps/coordinator/src/bots/name-pool-allocator`
- **Provides:** `bots.name-pool-allocator.interface`
- **Requires:** `config.name-pool-validator`, `bots.profile-store`
- **Owns state:** none
- **Source refs:** `main.md#5-bot-identity-roles-and-persistence`
- **Milestone:** 5
- **Invariants:**
  - Privilege decisions are deny-by-default and scoped to one design revision.
  - Revocation takes effect immediately through a fencing-token bump.
- **Failure modes:**
  - Policy ambiguity or missing owner: deny the request and return a typed reason.
- **Tests:**
  - Grant/deny matrix including owner-offline and revision-bump cases.
- **Metrics:**
  - `bots_name_pool_allocator_errors_total`
  - `bots_name_pool_allocator_latency_ms`

---

## World Model and Landmarks

- **ID:** `sys.world`
- **Owner package:** `packages/worldmodel/src`
- **Milestone:** 3
- **Source refs:** `main.md#6-perception-shared-world-model`
- **Allowed cross-system dependencies:** `sys.memory`
- **Forbidden dependencies:** none

**Purpose.** Merge observations into one queryable world model and landmark registry.

**System invariants.**
- Newest valid observation wins; older conflicting observations decay.
- Observed world state is separate from intended SIP state.
- Every landmark carries confidence, evidence, and last-seen metadata.

### Components

| ID | Component | Responsibility | Owner path | Milestone |
|---|---|---|---|---:|
| `world.observation-ingestor` | Observation Ingestor | Ingest validated chunk snapshots and block updates from bot perception. | `packages/worldmodel/src/observation-ingestor` | 3 |
| `world.chunk-version-store` | Chunk Version Store | Persist per-chunk snapshots, versions, and sparse occupancy deltas. | `packages/worldmodel/src/chunk-version-store` | 3 |
| `world.occupancy-grid` | Sparse Occupancy Grid | Maintain the sparse 3D occupancy view used for spatial queries. | `packages/worldmodel/src/occupancy-grid` | 3 |
| `world.merge-conflict-resolver` | Merge Conflict Resolver | Resolve competing observations by recency, confidence, and source reliability. | `packages/worldmodel/src/merge-conflict-resolver` | 3 |
| `world.confidence-decay` | Confidence Decay | Decay landmark and observation confidence over time and flag re-verification. | `packages/worldmodel/src/confidence-decay` | 3 |
| `world.landmark-registry` | Landmark Registry | Persist landmarks, anchors, evidence, confidence, and plan tags. | `packages/worldmodel/src/landmark-registry` | 3 |
| `world.detector-result-integrator` | Detector Result Integrator | Turn detector candidates into landmark registry mutations. | `packages/worldmodel/src/detector-result-integrator` | 3 |
| `world.plan-tagging` | Plan Tagging | Tag observed blocks that belong to an active plan as in-progress rather than natural infrastructure. | `packages/worldmodel/src/plan-tagging` | 3 |
| `world.spatial-query-engine` | Spatial Query Engine | Answer nearest, inside-base, route, protected, container, and ownership queries. | `packages/worldmodel/src/spatial-query-engine` | 3 |
| `world.container-memory` | Container Memory | Track observed container positions, roles, and contents snapshots. | `packages/worldmodel/src/container-memory` | 3 |
| `world.world-reconciler` | World Reconciler | Compare observed state with intended state and emit deviation findings. | `packages/worldmodel/src/world-reconciler` | 3 |

### `world.observation-ingestor` — Observation Ingestor

- **Responsibility:** Ingest validated chunk snapshots and block updates from bot perception.
- **Owner path:** `packages/worldmodel/src/observation-ingestor`
- **Provides:** `world.observation-ingestor.interface`
- **Requires:** `transport.message-schema-registry`, `world.chunk-version-store`
- **Owns state:** none
- **Source refs:** `main.md#6-perception-shared-world-model`
- **Milestone:** 3
- **Invariants:**
  - Observed state and intended SIP state stay separate; merges never overwrite active plan tags.
  - Landmark confidence decays and conflicting evidence is flagged for re-verification.
- **Failure modes:**
  - Conflicting observations: keep the newest with evidence and flag the landmark for verification.
- **Tests:**
  - Merge, decay, conflict-resolution, and spatial-query fixtures.
- **Metrics:**
  - `world_observation_ingestor_errors_total`
  - `world_observation_ingestor_latency_ms`

### `world.chunk-version-store` — Chunk Version Store

- **Responsibility:** Persist per-chunk snapshots, versions, and sparse occupancy deltas.
- **Owner path:** `packages/worldmodel/src/chunk-version-store`
- **Provides:** `world.chunk-version-store.interface`
- **Requires:** `memory.transaction-manager`
- **Owns state:** `chunks`
- **Source refs:** `main.md#6-perception-shared-world-model`
- **Milestone:** 3
- **Invariants:**
  - Observed state and intended SIP state stay separate; merges never overwrite active plan tags.
  - Landmark confidence decays and conflicting evidence is flagged for re-verification.
- **Failure modes:**
  - Conflicting observations: keep the newest with evidence and flag the landmark for verification.
- **Tests:**
  - Merge, decay, conflict-resolution, and spatial-query fixtures.
- **Metrics:**
  - `world_chunk_version_store_errors_total`
  - `world_chunk_version_store_latency_ms`

### `world.occupancy-grid` — Sparse Occupancy Grid

- **Responsibility:** Maintain the sparse 3D occupancy view used for spatial queries.
- **Owner path:** `packages/worldmodel/src/occupancy-grid`
- **Provides:** `world.occupancy-grid.interface`
- **Requires:** `world.chunk-version-store`
- **Owns state:** none
- **Source refs:** `main.md#6-perception-shared-world-model`
- **Milestone:** 3
- **Invariants:**
  - Observed state and intended SIP state stay separate; merges never overwrite active plan tags.
  - Landmark confidence decays and conflicting evidence is flagged for re-verification.
- **Failure modes:**
  - Conflicting observations: keep the newest with evidence and flag the landmark for verification.
- **Tests:**
  - Merge, decay, conflict-resolution, and spatial-query fixtures.
- **Metrics:**
  - `world_occupancy_grid_errors_total`
  - `world_occupancy_grid_latency_ms`

### `world.merge-conflict-resolver` — Merge Conflict Resolver

- **Responsibility:** Resolve competing observations by recency, confidence, and source reliability.
- **Owner path:** `packages/worldmodel/src/merge-conflict-resolver`
- **Provides:** `world.merge-conflict-resolver.interface`
- **Requires:** `world.chunk-version-store`, `world.confidence-decay`
- **Owns state:** none
- **Source refs:** `main.md#6-perception-shared-world-model`
- **Milestone:** 3
- **Invariants:**
  - Observed state and intended SIP state stay separate; merges never overwrite active plan tags.
  - Landmark confidence decays and conflicting evidence is flagged for re-verification.
- **Failure modes:**
  - Conflicting observations: keep the newest with evidence and flag the landmark for verification.
- **Tests:**
  - Merge, decay, conflict-resolution, and spatial-query fixtures.
- **Metrics:**
  - `world_merge_conflict_resolver_errors_total`
  - `world_merge_conflict_resolver_latency_ms`

### `world.confidence-decay` — Confidence Decay

- **Responsibility:** Decay landmark and observation confidence over time and flag re-verification.
- **Owner path:** `packages/worldmodel/src/confidence-decay`
- **Provides:** `world.confidence-decay.interface`
- **Requires:** `world.chunk-version-store`
- **Owns state:** none
- **Source refs:** `main.md#6-perception-shared-world-model`
- **Milestone:** 3
- **Invariants:**
  - Observed state and intended SIP state stay separate; merges never overwrite active plan tags.
  - Landmark confidence decays and conflicting evidence is flagged for re-verification.
- **Failure modes:**
  - Conflicting observations: keep the newest with evidence and flag the landmark for verification.
- **Tests:**
  - Merge, decay, conflict-resolution, and spatial-query fixtures.
- **Metrics:**
  - `world_confidence_decay_errors_total`
  - `world_confidence_decay_latency_ms`

### `world.landmark-registry` — Landmark Registry

- **Responsibility:** Persist landmarks, anchors, evidence, confidence, and plan tags.
- **Owner path:** `packages/worldmodel/src/landmark-registry`
- **Provides:** `world.landmark-registry.interface`
- **Requires:** `memory.transaction-manager`
- **Owns state:** `landmarks`
- **Source refs:** `main.md#6-perception-shared-world-model`
- **Milestone:** 3
- **Invariants:**
  - Observed state and intended SIP state stay separate; merges never overwrite active plan tags.
  - Landmark confidence decays and conflicting evidence is flagged for re-verification.
- **Failure modes:**
  - Conflicting observations: keep the newest with evidence and flag the landmark for verification.
- **Tests:**
  - Merge, decay, conflict-resolution, and spatial-query fixtures.
- **Metrics:**
  - `world_landmark_registry_errors_total`
  - `world_landmark_registry_latency_ms`

### `world.detector-result-integrator` — Detector Result Integrator

- **Responsibility:** Turn detector candidates into landmark registry mutations.
- **Owner path:** `packages/worldmodel/src/detector-result-integrator`
- **Provides:** `world.detector-result-integrator.interface`
- **Requires:** `world.landmark-registry`, `world.merge-conflict-resolver`
- **Owns state:** none
- **Source refs:** `main.md#6-perception-shared-world-model`
- **Milestone:** 3
- **Invariants:**
  - Detectors are pure over a chunk snapshot and emit evidence with confidence.
  - Detection never mutates world state; it only emits landmark candidates.
- **Failure modes:**
  - Insufficient evidence: emit nothing rather than a low-confidence landmark.
- **Tests:**
  - Fixture-based detector precision and recall checks.
- **Metrics:**
  - `world_detector_result_integrator_errors_total`
  - `world_detector_result_integrator_latency_ms`

### `world.plan-tagging` — Plan Tagging

- **Responsibility:** Tag observed blocks that belong to an active plan as in-progress rather than natural infrastructure.
- **Owner path:** `packages/worldmodel/src/plan-tagging`
- **Provides:** `world.plan-tagging.interface`
- **Requires:** `world.landmark-registry`
- **Owns state:** none
- **Source refs:** `main.md#6-perception-shared-world-model`
- **Milestone:** 3
- **Invariants:**
  - Blocks belonging to an active planId are tagged in-progress and are never classified as natural infrastructure.
- **Failure modes:**
  - Conflicting observations: keep the newest with evidence and flag the landmark for verification.
- **Tests:**
  - Merge, decay, conflict-resolution, and spatial-query fixtures.
- **Metrics:**
  - `world_plan_tagging_errors_total`
  - `world_plan_tagging_latency_ms`

### `world.spatial-query-engine` — Spatial Query Engine

- **Responsibility:** Answer nearest, inside-base, route, protected, container, and ownership queries.
- **Owner path:** `packages/worldmodel/src/spatial-query-engine`
- **Provides:** `world.spatial-query-engine.interface`
- **Requires:** `world.occupancy-grid`, `world.landmark-registry`, `sip.path-graph-store`
- **Owns state:** none
- **Source refs:** `main.md#6-perception-shared-world-model`
- **Milestone:** 3
- **Invariants:**
  - Spatial queries expose nearest, insideBase, route, isProtected, containerAt, and whoOwns without mutating state.
- **Failure modes:**
  - Conflicting observations: keep the newest with evidence and flag the landmark for verification.
- **Tests:**
  - Merge, decay, conflict-resolution, and spatial-query fixtures.
- **Metrics:**
  - `world_spatial_query_engine_errors_total`
  - `world_spatial_query_engine_latency_ms`

### `world.container-memory` — Container Memory

- **Responsibility:** Track observed container positions, roles, and contents snapshots.
- **Owner path:** `packages/worldmodel/src/container-memory`
- **Provides:** `world.container-memory.interface`
- **Requires:** `world.landmark-registry`
- **Owns state:** `world.containerMemory`
- **Source refs:** `main.md#6-perception-shared-world-model`
- **Milestone:** 3
- **Invariants:**
  - Observed state and intended SIP state stay separate; merges never overwrite active plan tags.
  - Landmark confidence decays and conflicting evidence is flagged for re-verification.
- **Failure modes:**
  - Conflicting observations: keep the newest with evidence and flag the landmark for verification.
- **Tests:**
  - Merge, decay, conflict-resolution, and spatial-query fixtures.
- **Metrics:**
  - `world_container_memory_errors_total`
  - `world_container_memory_latency_ms`

### `world.world-reconciler` — World Reconciler

- **Responsibility:** Compare observed state with intended state and emit deviation findings.
- **Owner path:** `packages/worldmodel/src/world-reconciler`
- **Provides:** `world.world-reconciler.interface`
- **Requires:** `world.landmark-registry`, `world.spatial-query-engine`
- **Owns state:** none
- **Source refs:** `main.md#6-perception-shared-world-model`
- **Milestone:** 3
- **Invariants:**
  - Observed state and intended SIP state stay separate; merges never overwrite active plan tags.
  - Landmark confidence decays and conflicting evidence is flagged for re-verification.
- **Failure modes:**
  - Conflicting observations: keep the newest with evidence and flag the landmark for verification.
- **Tests:**
  - Merge, decay, conflict-resolution, and spatial-query fixtures.
- **Metrics:**
  - `world_world_reconciler_errors_total`
  - `world_world_reconciler_latency_ms`

---

## Perception

- **ID:** `sys.perception`
- **Owner package:** `packages/perception/src`
- **Milestone:** 3
- **Source refs:** `main.md#6-perception-shared-world-model`
- **Allowed cross-system dependencies:** `sys.config`
- **Forbidden dependencies:** `fe.perception-sip-write`

**Purpose.** Sample loaded chunks, detect infrastructure, and emit structured observations.

**System invariants.**
- Perception never writes world state directly; it emits observations.
- Sampling respects the configured ring and per-bot rate budget.
- Detectors are deterministic functions over chunk snapshots.

### Components

| ID | Component | Responsibility | Owner path | Milestone |
|---|---|---|---|---:|
| `perception.ring-sampler` | Ring Sampler | Sample loaded chunks within the configured 16-64 block ring without exceeding rate budget. | `packages/perception/src/ring-sampler` | 3 |
| `perception.chunk-snapshot-encoder` | Chunk Snapshot Encoder | Encode sparse chunk snapshots with version and evidence metadata. | `packages/perception/src/chunk-snapshot-encoder` | 3 |
| `perception.block-update-listener` | Block Update Listener | Turn relevant block updates into incremental observation events. | `packages/perception/src/block-update-listener` | 3 |
| `perception.path-detector` | Path and Road Detector | Detect standable-surface corridors with length, width, and material hints. | `packages/perception/src/path-detector` | 3 |
| `perception.house-detector` | House Detector | Detect enclosed interiors, shells, doors, beds, windows, and roofs. | `packages/perception/src/house-detector` | 3 |
| `perception.farm-detector` | Farm Detector | Detect farmland moisture, adjacent water, crop age, and plot clusters. | `packages/perception/src/farm-detector` | 3 |
| `perception.storage-workstation-detector` | Storage and Workstation Detector | Detect chest, barrel, furnace, and crafting-table clusters. | `packages/perception/src/storage-workstation-detector` | 3 |
| `perception.linear-structure-detector` | Linear Structure Detector | Detect walls, bridges, and mineshafts through PCA, RANSAC, and deck-over-air checks. | `packages/perception/src/linear-structure-detector` | 3 |
| `perception.detector-pipeline` | Detector Pipeline | Run detectors in a bounded order and merge candidates without duplicate landmarks. | `packages/perception/src/detector-pipeline` | 3 |
| `perception.landmark-candidate-emitter` | Landmark Candidate Emitter | Emit deduplicated landmark candidates with confidence and evidence. | `packages/perception/src/landmark-candidate-emitter` | 3 |
| `perception.perception-rate-limiter` | Perception Rate Limiter | Cap sampling and detector work per bot according to hardware profile. | `packages/perception/src/perception-rate-limiter` | 3 |

### `perception.ring-sampler` — Ring Sampler

- **Responsibility:** Sample loaded chunks within the configured 16-64 block ring without exceeding rate budget.
- **Owner path:** `packages/perception/src/ring-sampler`
- **Provides:** `perception.ring-sampler.interface`
- **Requires:** `perception.perception-rate-limiter`
- **Owns state:** none
- **Source refs:** `main.md#6-perception-shared-world-model`
- **Milestone:** 3
- **Invariants:**
  - Detectors are pure over a chunk snapshot and emit evidence with confidence.
  - Detection never mutates world state; it only emits landmark candidates.
- **Failure modes:**
  - Insufficient evidence: emit nothing rather than a low-confidence landmark.
- **Tests:**
  - Fixture-based detector precision and recall checks.
- **Metrics:**
  - `perception_ring_sampler_errors_total`
  - `perception_ring_sampler_latency_ms`

### `perception.chunk-snapshot-encoder` — Chunk Snapshot Encoder

- **Responsibility:** Encode sparse chunk snapshots with version and evidence metadata.
- **Owner path:** `packages/perception/src/chunk-snapshot-encoder`
- **Provides:** `perception.chunk-snapshot-encoder.interface`
- **Requires:** `perception.ring-sampler`
- **Owns state:** none
- **Source refs:** `main.md#6-perception-shared-world-model`
- **Milestone:** 3
- **Invariants:**
  - Detectors are pure over a chunk snapshot and emit evidence with confidence.
  - Detection never mutates world state; it only emits landmark candidates.
- **Failure modes:**
  - Insufficient evidence: emit nothing rather than a low-confidence landmark.
- **Tests:**
  - Fixture-based detector precision and recall checks.
- **Metrics:**
  - `perception_chunk_snapshot_encoder_errors_total`
  - `perception_chunk_snapshot_encoder_latency_ms`

### `perception.block-update-listener` — Block Update Listener

- **Responsibility:** Turn relevant block updates into incremental observation events.
- **Owner path:** `packages/perception/src/block-update-listener`
- **Provides:** `perception.block-update-listener.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#6-perception-shared-world-model`
- **Milestone:** 3
- **Invariants:**
  - Detectors are pure over a chunk snapshot and emit evidence with confidence.
  - Detection never mutates world state; it only emits landmark candidates.
- **Failure modes:**
  - Insufficient evidence: emit nothing rather than a low-confidence landmark.
- **Tests:**
  - Fixture-based detector precision and recall checks.
- **Metrics:**
  - `perception_block_update_listener_errors_total`
  - `perception_block_update_listener_latency_ms`

### `perception.path-detector` — Path and Road Detector

- **Responsibility:** Detect standable-surface corridors with length, width, and material hints.
- **Owner path:** `packages/perception/src/path-detector`
- **Provides:** `perception.path-detector.interface`
- **Requires:** `perception.chunk-snapshot-encoder`
- **Owns state:** none
- **Source refs:** `main.md#6-perception-shared-world-model`
- **Milestone:** 3
- **Invariants:**
  - Detectors are pure over a chunk snapshot and emit evidence with confidence.
  - Detection never mutates world state; it only emits landmark candidates.
- **Failure modes:**
  - Insufficient evidence: emit nothing rather than a low-confidence landmark.
- **Tests:**
  - Fixture-based detector precision and recall checks.
- **Metrics:**
  - `perception_path_detector_errors_total`
  - `perception_path_detector_latency_ms`

### `perception.house-detector` — House Detector

- **Responsibility:** Detect enclosed interiors, shells, doors, beds, windows, and roofs.
- **Owner path:** `packages/perception/src/house-detector`
- **Provides:** `perception.house-detector.interface`
- **Requires:** `perception.chunk-snapshot-encoder`
- **Owns state:** none
- **Source refs:** `main.md#6-perception-shared-world-model`
- **Milestone:** 3
- **Invariants:**
  - Detectors are pure over a chunk snapshot and emit evidence with confidence.
  - Detection never mutates world state; it only emits landmark candidates.
- **Failure modes:**
  - Insufficient evidence: emit nothing rather than a low-confidence landmark.
- **Tests:**
  - Fixture-based detector precision and recall checks.
- **Metrics:**
  - `perception_house_detector_errors_total`
  - `perception_house_detector_latency_ms`

### `perception.farm-detector` — Farm Detector

- **Responsibility:** Detect farmland moisture, adjacent water, crop age, and plot clusters.
- **Owner path:** `packages/perception/src/farm-detector`
- **Provides:** `perception.farm-detector.interface`
- **Requires:** `perception.chunk-snapshot-encoder`
- **Owns state:** none
- **Source refs:** `main.md#6-perception-shared-world-model`
- **Milestone:** 3
- **Invariants:**
  - Detectors are pure over a chunk snapshot and emit evidence with confidence.
  - Detection never mutates world state; it only emits landmark candidates.
- **Failure modes:**
  - Insufficient evidence: emit nothing rather than a low-confidence landmark.
- **Tests:**
  - Fixture-based detector precision and recall checks.
- **Metrics:**
  - `perception_farm_detector_errors_total`
  - `perception_farm_detector_latency_ms`

### `perception.storage-workstation-detector` — Storage and Workstation Detector

- **Responsibility:** Detect chest, barrel, furnace, and crafting-table clusters.
- **Owner path:** `packages/perception/src/storage-workstation-detector`
- **Provides:** `perception.storage-workstation-detector.interface`
- **Requires:** `perception.chunk-snapshot-encoder`
- **Owns state:** none
- **Source refs:** `main.md#6-perception-shared-world-model`
- **Milestone:** 3
- **Invariants:**
  - Detectors are pure over a chunk snapshot and emit evidence with confidence.
  - Detection never mutates world state; it only emits landmark candidates.
- **Failure modes:**
  - Insufficient evidence: emit nothing rather than a low-confidence landmark.
- **Tests:**
  - Fixture-based detector precision and recall checks.
- **Metrics:**
  - `perception_storage_workstation_detector_errors_total`
  - `perception_storage_workstation_detector_latency_ms`

### `perception.linear-structure-detector` — Linear Structure Detector

- **Responsibility:** Detect walls, bridges, and mineshafts through PCA, RANSAC, and deck-over-air checks.
- **Owner path:** `packages/perception/src/linear-structure-detector`
- **Provides:** `perception.linear-structure-detector.interface`
- **Requires:** `perception.chunk-snapshot-encoder`
- **Owns state:** none
- **Source refs:** `main.md#6-perception-shared-world-model`
- **Milestone:** 3
- **Invariants:**
  - Detectors are pure over a chunk snapshot and emit evidence with confidence.
  - Detection never mutates world state; it only emits landmark candidates.
- **Failure modes:**
  - Insufficient evidence: emit nothing rather than a low-confidence landmark.
- **Tests:**
  - Fixture-based detector precision and recall checks.
- **Metrics:**
  - `perception_linear_structure_detector_errors_total`
  - `perception_linear_structure_detector_latency_ms`

### `perception.detector-pipeline` — Detector Pipeline

- **Responsibility:** Run detectors in a bounded order and merge candidates without duplicate landmarks.
- **Owner path:** `packages/perception/src/detector-pipeline`
- **Provides:** `perception.detector-pipeline.interface`
- **Requires:** `perception.chunk-snapshot-encoder`, `perception.path-detector`, `perception.house-detector`, `perception.farm-detector`, `perception.storage-workstation-detector`, `perception.linear-structure-detector`
- **Owns state:** none
- **Source refs:** `main.md#6-perception-shared-world-model`
- **Milestone:** 3
- **Invariants:**
  - Detectors are pure over a chunk snapshot and emit evidence with confidence.
  - Detection never mutates world state; it only emits landmark candidates.
- **Failure modes:**
  - Insufficient evidence: emit nothing rather than a low-confidence landmark.
- **Tests:**
  - Fixture-based detector precision and recall checks.
- **Metrics:**
  - `perception_detector_pipeline_errors_total`
  - `perception_detector_pipeline_latency_ms`

### `perception.landmark-candidate-emitter` — Landmark Candidate Emitter

- **Responsibility:** Emit deduplicated landmark candidates with confidence and evidence.
- **Owner path:** `packages/perception/src/landmark-candidate-emitter`
- **Provides:** `perception.landmark-candidate-emitter.interface`
- **Requires:** `perception.detector-pipeline`, `transport.event-stream`
- **Owns state:** none
- **Source refs:** `main.md#6-perception-shared-world-model`
- **Milestone:** 3
- **Invariants:**
  - Detectors are pure over a chunk snapshot and emit evidence with confidence.
  - Detection never mutates world state; it only emits landmark candidates.
- **Failure modes:**
  - Insufficient evidence: emit nothing rather than a low-confidence landmark.
- **Tests:**
  - Fixture-based detector precision and recall checks.
- **Metrics:**
  - `perception_landmark_candidate_emitter_errors_total`
  - `perception_landmark_candidate_emitter_latency_ms`

### `perception.perception-rate-limiter` — Perception Rate Limiter

- **Responsibility:** Cap sampling and detector work per bot according to hardware profile.
- **Owner path:** `packages/perception/src/perception-rate-limiter`
- **Provides:** `perception.perception-rate-limiter.interface`
- **Requires:** `config.profile-resolver`
- **Owns state:** none
- **Source refs:** `main.md#6-perception-shared-world-model`
- **Milestone:** 3
- **Invariants:**
  - Detectors are pure over a chunk snapshot and emit evidence with confidence.
  - Detection never mutates world state; it only emits landmark candidates.
- **Failure modes:**
  - Insufficient evidence: emit nothing rather than a low-confidence landmark.
- **Tests:**
  - Fixture-based detector precision and recall checks.
- **Metrics:**
  - `perception_perception_rate_limiter_errors_total`
  - `perception_perception_rate_limiter_latency_ms`

---

## Laya Decision Service

- **ID:** `sys.decision`
- **Owner package:** `apps/coordinator/src/decision`
- **Milestone:** 8
- **Source refs:** `main.md#7-short-term-decision-service-laya`
- **Allowed cross-system dependencies:** `sys.config`, `sys.transport`
- **Forbidden dependencies:** `fe.model-action`, `fe.decision-sip-write`

**Purpose.** Run one shared Laya model, serialize inference, and return calibrated choices over needs, goals, and actions.

**System invariants.**
- One Laya instance exists fleet-wide; never one instance per bot.
- Only one inference forward pass is in flight at a time.
- Low-confidence or timed-out decisions fall back to deterministic utility policy.
- Laya advises among goal candidates and actions; it never owns motivation or execution.

### Components

| ID | Component | Responsibility | Owner path | Milestone |
|---|---|---|---|---:|
| `decision.model-loader` | Model Loader | Load the Laya ONNX bundle from the configured model directory. | `apps/coordinator/src/decision/model-loader` | 8 |
| `decision.execution-provider-selector` | Execution Provider Selector | Select CPU or WebGPU according to profile, availability, and measured p95. | `apps/coordinator/src/decision/execution-provider-selector` | 8 |
| `decision.queue` | Decision Queue | Order decision requests by priority with per-bot rate limits and bounded depth. | `apps/coordinator/src/decision/queue` | 8 |
| `decision.rate-limiter` | Decision Rate Limiter | Enforce fleet-wide and per-bot decision rates for the active hardware profile. | `apps/coordinator/src/decision/rate-limiter` | 8 |
| `decision.digest-cache` | Digest Cache | Cache normalized state digests to avoid repeated tokenization work. | `apps/coordinator/src/decision/digest-cache` | 8 |
| `decision.digest-assembler` | Digest Assembler | Validate and normalize the bot state digest, needs, goal candidates, and actions into a bounded inference request. | `apps/coordinator/src/decision/digest-assembler` | 8 |
| `decision.batch-runner` | Batch Runner | Batch questions from one decision request into a single forward pass. | `apps/coordinator/src/decision/batch-runner` | 8 |
| `decision.single-inflight-guard` | Single In-flight Guard | Block concurrent forward passes and enforce timeout around the model session. | `apps/coordinator/src/decision/single-inflight-guard` | 8 |
| `decision.output-parser` | Output Parser | Parse typed choice, score, and noul outputs without accepting free text. | `apps/coordinator/src/decision/output-parser` | 8 |
| `decision.confidence-calibrator` | Confidence Calibrator | Apply per-question temperature and compute calibrated answer confidence. | `apps/coordinator/src/decision/confidence-calibrator` | 8 |
| `decision.timeout-fallback` | Timeout and Fallback Handler | Return a fallback signal when inference exceeds budget or confidence is below gate. | `apps/coordinator/src/decision/timeout-fallback` | 8 |
| `decision.latency-metrics` | Latency Metrics | Record p50, p95, queue wait, provider, and fallback rate. | `apps/coordinator/src/decision/latency-metrics` | 8 |

### `decision.model-loader` — Model Loader

- **Responsibility:** Load the Laya ONNX bundle from the configured model directory.
- **Owner path:** `apps/coordinator/src/decision/model-loader`
- **Provides:** `decision.model-loader.interface`
- **Requires:** `config.laya-runtime-resolver`, `ext.onnx-runtime`
- **Owns state:** none
- **Source refs:** `main.md#7-short-term-decision-service-laya`
- **Milestone:** 8
- **Invariants:**
  - One shared Laya ONNX model is loaded per coordinator; providers are cpu on home-min and webgpu,cpu on home-full.
  - CPU fallback is always registered and intraOp threads are 3 on home-min and 8 on home-full.
- **Failure modes:**
  - Timeout, crash, or low confidence: fall back to deterministic policy and record the downgrade.
- **Tests:**
  - Typed output parsing, timeout fallback, and single-inflight tests.
- **Metrics:**
  - `decision_model_loader_errors_total`
  - `decision_model_loader_latency_ms`

### `decision.execution-provider-selector` — Execution Provider Selector

- **Responsibility:** Select CPU or WebGPU according to profile, availability, and measured p95.
- **Owner path:** `apps/coordinator/src/decision/execution-provider-selector`
- **Provides:** `decision.execution-provider-selector.interface`
- **Requires:** `decision.model-loader`, `config.hardware-probe`, `ops.structured-logger`
- **Owns state:** none
- **Source refs:** `main.md#7-short-term-decision-service-laya`
- **Milestone:** 8
- **Invariants:**
  - WebGPU is adopted only if it beats CPU p95 and runs 2h without crash or driver reset; otherwise CPU is used.
- **Failure modes:**
  - WebGPU init, crash, or slower p95: downgrade to CPU automatically and log the downgrade.
- **Tests:**
  - Typed output parsing, timeout fallback, and single-inflight tests.
- **Metrics:**
  - `decision_execution_provider_selector_errors_total`
  - `decision_execution_provider_selector_latency_ms`

### `decision.queue` — Decision Queue

- **Responsibility:** Order decision requests by priority with per-bot rate limits and bounded depth.
- **Owner path:** `apps/coordinator/src/decision/queue`
- **Provides:** `decision.queue.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#7-short-term-decision-service-laya`
- **Milestone:** 8
- **Invariants:**
  - One Laya model instance exists fleet-wide and at most one forward pass is in flight.
  - Model output is advisory; typed parsing rejects free text.
- **Failure modes:**
  - Timeout, crash, or low confidence: fall back to deterministic policy and record the downgrade.
- **Tests:**
  - Typed output parsing, timeout fallback, and single-inflight tests.
- **Metrics:**
  - `decision_queue_errors_total`
  - `decision_queue_latency_ms`

### `decision.rate-limiter` — Decision Rate Limiter

- **Responsibility:** Enforce fleet-wide and per-bot decision rates for the active hardware profile.
- **Owner path:** `apps/coordinator/src/decision/rate-limiter`
- **Provides:** `decision.rate-limiter.interface`
- **Requires:** `config.profile-resolver`, `decision.queue`
- **Owns state:** none
- **Source refs:** `main.md#7-short-term-decision-service-laya`
- **Milestone:** 8
- **Invariants:**
  - One Laya model instance exists fleet-wide and at most one forward pass is in flight.
  - Model output is advisory; typed parsing rejects free text.
- **Failure modes:**
  - Timeout, crash, or low confidence: fall back to deterministic policy and record the downgrade.
- **Tests:**
  - Typed output parsing, timeout fallback, and single-inflight tests.
- **Metrics:**
  - `decision_rate_limiter_errors_total`
  - `decision_rate_limiter_latency_ms`

### `decision.digest-cache` — Digest Cache

- **Responsibility:** Cache normalized state digests to avoid repeated tokenization work.
- **Owner path:** `apps/coordinator/src/decision/digest-cache`
- **Provides:** `decision.digest-cache.interface`
- **Requires:** `decision.queue`
- **Owns state:** none
- **Source refs:** `main.md#7-short-term-decision-service-laya`
- **Milestone:** 8
- **Invariants:**
  - One Laya model instance exists fleet-wide and at most one forward pass is in flight.
  - Model output is advisory; typed parsing rejects free text.
- **Failure modes:**
  - Timeout, crash, or low confidence: fall back to deterministic policy and record the downgrade.
- **Tests:**
  - Typed output parsing, timeout fallback, and single-inflight tests.
- **Metrics:**
  - `decision_digest_cache_errors_total`
  - `decision_digest_cache_latency_ms`

### `decision.digest-assembler` — Digest Assembler

- **Responsibility:** Validate and normalize the bot state digest, needs, goal candidates, and actions into a bounded inference request.
- **Owner path:** `apps/coordinator/src/decision/digest-assembler`
- **Provides:** `decision.digest-assembler.interface`
- **Requires:** `transport.message-schema-registry`
- **Owns state:** none
- **Source refs:** `main.md#7-short-term-decision-service-laya`
- **Milestone:** 8
- **Invariants:**
  - The state digest is at most 512 tokens and carries 8-16 goal or action candidates, each at most 12 words.
  - Needs are summarized as bounded ratios; goal candidates are typed and de-duplicated.
- **Failure modes:**
  - Timeout, crash, or low confidence: fall back to deterministic policy and record the downgrade.
- **Tests:**
  - Typed output parsing, timeout fallback, and single-inflight tests.
- **Metrics:**
  - `decision_digest_assembler_errors_total`
  - `decision_digest_assembler_latency_ms`

### `decision.batch-runner` — Batch Runner

- **Responsibility:** Batch questions from one decision request into a single forward pass.
- **Owner path:** `apps/coordinator/src/decision/batch-runner`
- **Provides:** `decision.batch-runner.interface`
- **Requires:** `decision.model-loader`, `decision.queue`, `decision.digest-cache`
- **Owns state:** none
- **Source refs:** `main.md#7-short-term-decision-service-laya`
- **Milestone:** 8
- **Invariants:**
  - One Laya model instance exists fleet-wide and at most one forward pass is in flight.
  - Model output is advisory; typed parsing rejects free text.
- **Failure modes:**
  - Timeout, crash, or low confidence: fall back to deterministic policy and record the downgrade.
- **Tests:**
  - Typed output parsing, timeout fallback, and single-inflight tests.
- **Metrics:**
  - `decision_batch_runner_errors_total`
  - `decision_batch_runner_latency_ms`

### `decision.single-inflight-guard` — Single In-flight Guard

- **Responsibility:** Block concurrent forward passes and enforce timeout around the model session.
- **Owner path:** `apps/coordinator/src/decision/single-inflight-guard`
- **Provides:** `decision.single-inflight-guard.interface`
- **Requires:** `decision.batch-runner`
- **Owns state:** none
- **Source refs:** `main.md#7-short-term-decision-service-laya`
- **Milestone:** 8
- **Invariants:**
  - At most one Laya forward pass is in flight per coordinator at any time.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `decision_single_inflight_guard_errors_total`
  - `decision_single_inflight_guard_latency_ms`

### `decision.output-parser` — Output Parser

- **Responsibility:** Parse typed choice, score, and noul outputs without accepting free text.
- **Owner path:** `apps/coordinator/src/decision/output-parser`
- **Provides:** `decision.output-parser.interface`
- **Requires:** `decision.batch-runner`
- **Owns state:** none
- **Source refs:** `main.md#7-short-term-decision-service-laya`
- **Milestone:** 8
- **Invariants:**
  - Only typed choice, score, and noul outputs are accepted; free text is rejected.
  - Choice cardinality stays at or below 16 and total option tokens at or below 192.
- **Failure modes:**
  - Timeout, crash, or low confidence: fall back to deterministic policy and record the downgrade.
- **Tests:**
  - Typed output parsing, timeout fallback, and single-inflight tests.
- **Metrics:**
  - `decision_output_parser_errors_total`
  - `decision_output_parser_latency_ms`

### `decision.confidence-calibrator` — Confidence Calibrator

- **Responsibility:** Apply per-question temperature and compute calibrated answer confidence.
- **Owner path:** `apps/coordinator/src/decision/confidence-calibrator`
- **Provides:** `decision.confidence-calibrator.interface`
- **Requires:** `decision.output-parser`, `config.config-schema-validator`
- **Owns state:** none
- **Source refs:** `main.md#7-short-term-decision-service-laya`
- **Milestone:** 8
- **Invariants:**
  - Per-question temperature is fitted on held-out traces.
  - A calibrated confidence below 0.60 routes the bot to its deterministic utility policy.
- **Failure modes:**
  - Timeout, crash, or low confidence: fall back to deterministic policy and record the downgrade.
- **Tests:**
  - Typed output parsing, timeout fallback, and single-inflight tests.
- **Metrics:**
  - `decision_confidence_calibrator_errors_total`
  - `decision_confidence_calibrator_latency_ms`

### `decision.timeout-fallback` — Timeout and Fallback Handler

- **Responsibility:** Return a fallback signal when inference exceeds budget or confidence is below gate.
- **Owner path:** `apps/coordinator/src/decision/timeout-fallback`
- **Provides:** `decision.timeout-fallback.interface`
- **Requires:** `decision.queue`
- **Owns state:** none
- **Source refs:** `main.md#7-short-term-decision-service-laya`
- **Milestone:** 8
- **Invariants:**
  - A decision request that would break the 250ms warm p95 budget is timed out and falls back to deterministic policy.
- **Failure modes:**
  - Timeout, crash, or low confidence: fall back to deterministic policy and record the downgrade.
- **Tests:**
  - Typed output parsing, timeout fallback, and single-inflight tests.
- **Metrics:**
  - `decision_timeout_fallback_errors_total`
  - `decision_timeout_fallback_latency_ms`

### `decision.latency-metrics` — Latency Metrics

- **Responsibility:** Record p50, p95, queue wait, provider, and fallback rate.
- **Owner path:** `apps/coordinator/src/decision/latency-metrics`
- **Provides:** `decision.latency-metrics.interface`
- **Requires:** `ops.metrics-registry`
- **Owns state:** none
- **Source refs:** `main.md#7-short-term-decision-service-laya`
- **Milestone:** 8
- **Invariants:**
  - One Laya model instance exists fleet-wide and at most one forward pass is in flight.
  - Model output is advisory; typed parsing rejects free text.
- **Failure modes:**
  - Timeout, crash, or low confidence: fall back to deterministic policy and record the downgrade.
- **Tests:**
  - Typed output parsing, timeout fallback, and single-inflight tests.
- **Metrics:**
  - `decision_latency_metrics_errors_total`
  - `decision_latency_metrics_latency_ms`

---

## Cloud Planner Advisor

- **ID:** `sys.planner`
- **Owner package:** `packages/planning/src`
- **Milestone:** 9
- **Source refs:** `main.md#8-long-term-planner-muse-spark-13-contributor`
- **Allowed cross-system dependencies:** `sys.config`, `sys.memory`, `sys.sip`
- **Forbidden dependencies:** `fe.planner-action`, `fe.planner-sip-write`

**Purpose.** Turn fleet-level context and events into optional strategic goals, validated SIP revisions, and opt-in job offers.

**System invariants.**
- Planner output is untrusted until schema and semantic validation pass.
- Planner never writes blocks or commits SIP state directly.
- Planner work is advisory: bots may defer or decline jobs.
- Invalid output keeps the last known good plan after bounded repair attempts.

### Components

| ID | Component | Responsibility | Owner path | Milestone |
|---|---|---|---|---:|
| `planner.openai-client` | OpenAI-Compatible Client | Call the configured planner endpoint with timeouts, cancellation, and no default URL. | `packages/planning/src/openai-client` | 9 |
| `planner.context-builder` | Planner Context Builder | Build a bounded fleet context from SIP, tasks, world queries, and bot profiles. | `packages/planning/src/context-builder` | 9 |
| `planner.trigger-evaluator` | Planner Trigger Evaluator | Trigger planning on interval, conflict, failure burst, death cluster, landmark, or chat request. | `packages/planning/src/trigger-evaluator` | 9 |
| `planner.schema-validator` | Planner Schema Validator | Validate strict JSON planner output against the versioned zod schema. | `packages/planning/src/schema-validator` | 9 |
| `planner.semantic-validator` | Planner Semantic Validator | Reject plans with unknown skills, infeasible materials, bad distances, zone violations, or budget overruns. | `packages/planning/src/semantic-validator` | 9 |
| `planner.repair-loop` | Planner Repair Loop | Attempt at most two schema or semantic repairs before keeping the last good plan. | `packages/planning/src/repair-loop` | 9 |
| `planner.sip-mutation-translator` | SIP Mutation Translator | Translate validated plan intent into SIP mutation proposals. | `packages/planning/src/sip-mutation-translator` | 9 |
| `planner.task-dag-translator` | Task DAG Translator | Translate validated plan intent into task board proposals. | `packages/planning/src/task-dag-translator` | 9 |
| `planner.budget-limiter` | Planner Budget Limiter | Enforce calls per minute, token caps, timeouts, cancellation, and cost accounting. | `packages/planning/src/budget-limiter` | 9 |
| `planner.plan-cache` | Plan Cache | Cache validated plans and recent planner responses for reuse and recovery. | `packages/planning/src/plan-cache` | 9 |
| `planner.arbitration-handler` | Planner Arbitration Handler | Arbitrate ambiguous edit compatibility once without bypassing safety rules. | `packages/planning/src/arbitration-handler` | 9 |
| `planner.keep-last-good-fallback` | Keep Last Good Fallback | Restore the last validated plan when planner output cannot be repaired. | `packages/planning/src/keep-last-good-fallback` | 9 |

### `planner.openai-client` — OpenAI-Compatible Client

- **Responsibility:** Call the configured planner endpoint with timeouts, cancellation, and no default URL.
- **Owner path:** `packages/planning/src/openai-client`
- **Provides:** `planner.openai-client.interface`
- **Requires:** `config.secrets-loader`, `config.config-schema-validator`, `ext.planner-endpoint`
- **Owns state:** none
- **Source refs:** `main.md#8-long-term-planner-muse-spark-13-contributor`
- **Milestone:** 9
- **Invariants:**
  - Planner output is untrusted JSON, schema-validated before any SIP or task proposal.
  - Planner never writes blocks and never mutates SIP directly.
- **Failure modes:**
  - Invalid plan: repair at most twice, then keep the last good plan.
- **Tests:**
  - Schema rejection, repair-loop, and budget-cap tests.
- **Metrics:**
  - `planner_openai_client_errors_total`
  - `planner_openai_client_latency_ms`

### `planner.context-builder` — Planner Context Builder

- **Responsibility:** Build a bounded fleet context from SIP, tasks, world queries, and bot profiles.
- **Owner path:** `packages/planning/src/context-builder`
- **Provides:** `planner.context-builder.interface`
- **Requires:** `sip.revision-manager`, `tasks.task-repository`, `world.spatial-query-engine`, `bots.profile-store`
- **Owns state:** none
- **Source refs:** `main.md#8-long-term-planner-muse-spark-13-contributor`
- **Milestone:** 9
- **Invariants:**
  - Planner output is untrusted JSON, schema-validated before any SIP or task proposal.
  - Planner never writes blocks and never mutates SIP directly.
- **Failure modes:**
  - Invalid plan: repair at most twice, then keep the last good plan.
- **Tests:**
  - Schema rejection, repair-loop, and budget-cap tests.
- **Metrics:**
  - `planner_context_builder_errors_total`
  - `planner_context_builder_latency_ms`

### `planner.trigger-evaluator` — Planner Trigger Evaluator

- **Responsibility:** Trigger planning on interval, conflict, failure burst, death cluster, landmark, or chat request.
- **Owner path:** `packages/planning/src/trigger-evaluator`
- **Provides:** `planner.trigger-evaluator.interface`
- **Requires:** `ops.metrics-registry`, `sip.revision-manager`, `tasks.dead-letter-manager`
- **Owns state:** none
- **Source refs:** `main.md#8-long-term-planner-muse-spark-13-contributor`
- **Milestone:** 9
- **Invariants:**
  - Planner output is untrusted JSON, schema-validated before any SIP or task proposal.
  - Planner never writes blocks and never mutates SIP directly.
- **Failure modes:**
  - Invalid plan: repair at most twice, then keep the last good plan.
- **Tests:**
  - Schema rejection, repair-loop, and budget-cap tests.
- **Metrics:**
  - `planner_trigger_evaluator_errors_total`
  - `planner_trigger_evaluator_latency_ms`

### `planner.schema-validator` — Planner Schema Validator

- **Responsibility:** Validate strict JSON planner output against the versioned zod schema.
- **Owner path:** `packages/planning/src/schema-validator`
- **Provides:** `planner.schema-validator.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#8-long-term-planner-muse-spark-13-contributor`
- **Milestone:** 9
- **Invariants:**
  - Validation is pure and deterministic; the same input yields the same verdict.
  - Invalid input is rejected with a typed reason and causes no partial mutation.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `planner_schema_validator_errors_total`
  - `planner_schema_validator_latency_ms`

### `planner.semantic-validator` — Planner Semantic Validator

- **Responsibility:** Reject plans with unknown skills, infeasible materials, bad distances, zone violations, or budget overruns.
- **Owner path:** `packages/planning/src/semantic-validator`
- **Provides:** `planner.semantic-validator.interface`
- **Requires:** `planner.schema-validator`, `sip.rules-store`, `sip.dependency-validator`, `skill-runtime.skill-registry`, `world.spatial-query-engine`
- **Owns state:** none
- **Source refs:** `main.md#8-long-term-planner-muse-spark-13-contributor`
- **Milestone:** 9
- **Invariants:**
  - Validation is pure and deterministic; the same input yields the same verdict.
  - Invalid input is rejected with a typed reason and causes no partial mutation.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `planner_semantic_validator_errors_total`
  - `planner_semantic_validator_latency_ms`

### `planner.repair-loop` — Planner Repair Loop

- **Responsibility:** Attempt at most two schema or semantic repairs before keeping the last good plan.
- **Owner path:** `packages/planning/src/repair-loop`
- **Provides:** `planner.repair-loop.interface`
- **Requires:** `planner.schema-validator`, `planner.semantic-validator`, `planner.openai-client`
- **Owns state:** none
- **Source refs:** `main.md#8-long-term-planner-muse-spark-13-contributor`
- **Milestone:** 9
- **Invariants:**
  - Invalid planner output gets at most two repair attempts before the last good plan is kept.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `planner_repair_loop_errors_total`
  - `planner_repair_loop_latency_ms`

### `planner.sip-mutation-translator` — SIP Mutation Translator

- **Responsibility:** Translate validated plan intent into SIP mutation proposals.
- **Owner path:** `packages/planning/src/sip-mutation-translator`
- **Provides:** `planner.sip-mutation-translator.interface`
- **Requires:** `planner.repair-loop`, `sip.mutation-proposer`
- **Owns state:** none
- **Source refs:** `main.md#8-long-term-planner-muse-spark-13-contributor`
- **Milestone:** 9
- **Invariants:**
  - Planner output is untrusted JSON, schema-validated before any SIP or task proposal.
  - Planner never writes blocks and never mutates SIP directly.
- **Failure modes:**
  - Invalid plan: repair at most twice, then keep the last good plan.
- **Tests:**
  - Schema rejection, repair-loop, and budget-cap tests.
- **Metrics:**
  - `planner_sip_mutation_translator_errors_total`
  - `planner_sip_mutation_translator_latency_ms`

### `planner.task-dag-translator` — Task DAG Translator

- **Responsibility:** Translate validated plan intent into task board proposals.
- **Owner path:** `packages/planning/src/task-dag-translator`
- **Provides:** `planner.task-dag-translator.interface`
- **Requires:** `planner.repair-loop`
- **Owns state:** none
- **Source refs:** `main.md#8-long-term-planner-muse-spark-13-contributor`
- **Milestone:** 9
- **Invariants:**
  - Planner output is untrusted JSON, schema-validated before any SIP or task proposal.
  - Planner never writes blocks and never mutates SIP directly.
- **Failure modes:**
  - Invalid plan: repair at most twice, then keep the last good plan.
- **Tests:**
  - Schema rejection, repair-loop, and budget-cap tests.
- **Metrics:**
  - `planner_task_dag_translator_errors_total`
  - `planner_task_dag_translator_latency_ms`

### `planner.budget-limiter` — Planner Budget Limiter

- **Responsibility:** Enforce calls per minute, token caps, timeouts, cancellation, and cost accounting.
- **Owner path:** `packages/planning/src/budget-limiter`
- **Provides:** `planner.budget-limiter.interface`
- **Requires:** `planner.openai-client`, `ops.metrics-registry`
- **Owns state:** none
- **Source refs:** `main.md#8-long-term-planner-muse-spark-13-contributor`
- **Milestone:** 9
- **Invariants:**
  - Planner calls obey calls-per-minute, token, timeout, cancellation, and cache budgets.
- **Failure modes:**
  - Policy ambiguity or missing owner: deny the request and return a typed reason.
- **Tests:**
  - Grant/deny matrix including owner-offline and revision-bump cases.
- **Metrics:**
  - `planner_budget_limiter_errors_total`
  - `planner_budget_limiter_latency_ms`

### `planner.plan-cache` — Plan Cache

- **Responsibility:** Cache validated plans and recent planner responses for reuse and recovery.
- **Owner path:** `packages/planning/src/plan-cache`
- **Provides:** `planner.plan-cache.interface`
- **Requires:** `memory.transaction-manager`
- **Owns state:** `planner.planCache`
- **Source refs:** `main.md#8-long-term-planner-muse-spark-13-contributor`
- **Milestone:** 9
- **Invariants:**
  - Planner output is untrusted JSON, schema-validated before any SIP or task proposal.
  - Planner never writes blocks and never mutates SIP directly.
- **Failure modes:**
  - Invalid plan: repair at most twice, then keep the last good plan.
- **Tests:**
  - Schema rejection, repair-loop, and budget-cap tests.
- **Metrics:**
  - `planner_plan_cache_errors_total`
  - `planner_plan_cache_latency_ms`

### `planner.arbitration-handler` — Planner Arbitration Handler

- **Responsibility:** Arbitrate ambiguous edit compatibility once without bypassing safety rules.
- **Owner path:** `packages/planning/src/arbitration-handler`
- **Provides:** `planner.arbitration-handler.interface`
- **Requires:** `transport.event-stream`, `grants.compatibility-checker`
- **Owns state:** none
- **Source refs:** `main.md#8-long-term-planner-muse-spark-13-contributor`
- **Milestone:** 9
- **Invariants:**
  - Planner output is untrusted JSON, schema-validated before any SIP or task proposal.
  - Planner never writes blocks and never mutates SIP directly.
- **Failure modes:**
  - Invalid plan: repair at most twice, then keep the last good plan.
- **Tests:**
  - Schema rejection, repair-loop, and budget-cap tests.
- **Metrics:**
  - `planner_arbitration_handler_errors_total`
  - `planner_arbitration_handler_latency_ms`

### `planner.keep-last-good-fallback` — Keep Last Good Fallback

- **Responsibility:** Restore the last validated plan when planner output cannot be repaired.
- **Owner path:** `packages/planning/src/keep-last-good-fallback`
- **Provides:** `planner.keep-last-good-fallback.interface`
- **Requires:** `planner.plan-cache`, `sip.revision-manager`
- **Owns state:** none
- **Source refs:** `main.md#8-long-term-planner-muse-spark-13-contributor`
- **Milestone:** 9
- **Invariants:**
  - A failed planner cycle never replaces the last validated plan.
- **Failure modes:**
  - Invalid plan: repair at most twice, then keep the last good plan.
- **Tests:**
  - Schema rejection, repair-loop, and budget-cap tests.
- **Metrics:**
  - `planner_keep_last_good_fallback_errors_total`
  - `planner_keep_last_good_fallback_latency_ms`

---

## Skill Runtime

- **ID:** `sys.skill-runtime`
- **Owner package:** `packages/skills/src`
- **Milestone:** 4
- **Source refs:** `main.md#9-skills`
- **Allowed cross-system dependencies:** `sys.memory`, `sys.world`
- **Forbidden dependencies:** none

**Purpose.** Run skills through a typed lifecycle with ticks, checkpoints, interruption, and effects.

**System invariants.**
- Every skill runs through canRun, plan, start, step, cancel, checkpoint, and restore.
- Skills emit typed effects; they never mutate SIP or claims directly.
- The guardian can preempt or veto a skill at any tick.

### Components

| ID | Component | Responsibility | Owner path | Milestone |
|---|---|---|---|---:|
| `skill-runtime.skill-contract` | Skill Contract | Define the typed skill interface, failure classes, progress events, and effects. | `packages/skills/src/skill-contract` | 4 |
| `skill-runtime.skill-registry` | Skill Registry | Register and resolve skills by stable ID and validate contract compliance. | `packages/skills/src/skill-registry` | 4 |
| `skill-runtime.lifecycle-executor` | Skill Lifecycle Executor | Execute skill plan, start, step, cancel, and completion transitions. | `packages/skills/src/lifecycle-executor` | 4 |
| `skill-runtime.tick-scheduler` | Skill Tick Scheduler | Step active skills at 200-500ms while preserving guardian priority. | `packages/skills/src/tick-scheduler` | 4 |
| `skill-runtime.context-builder` | Skill Context Builder | Build the bounded skill context from world, SIP, inventory, task, and checkpoint state. | `packages/skills/src/context-builder` | 4 |
| `skill-runtime.progress-reporter` | Skill Progress Reporter | Report progress and failure class to Laya, planner, and metrics. | `packages/skills/src/progress-reporter` | 4 |
| `skill-runtime.checkpoint-manager` | Skill Checkpoint Manager | Persist and load skill checkpoints by bot, task, and skill. | `packages/skills/src/checkpoint-manager` | 4 |
| `skill-runtime.restore-validator` | Skill Restore Validator | Reject stale checkpoints that no longer match the world or claim state. | `packages/skills/src/restore-validator` | 4 |
| `skill-runtime.effects-emitter` | Typed Effects Emitter | Emit declared place, break, use, attack, and inventory effects. | `packages/skills/src/effects-emitter` | 4 |
| `skill-runtime.preemption-handler` | Skill Preemption Handler | Cancel or pause a skill when the guardian, claim, or grant state changes. | `packages/skills/src/preemption-handler` | 4 |

### `skill-runtime.skill-contract` — Skill Contract

- **Responsibility:** Define the typed skill interface, failure classes, progress events, and effects.
- **Owner path:** `packages/skills/src/skill-contract`
- **Provides:** `skill-runtime.skill-contract.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - Skills execute through the lifecycle executor with veto checks before every effect.
  - Checkpoints capture resumable state and restore is validated against the observed world.
- **Failure modes:**
  - Skill failure: classify, checkpoint when resumable, and report to Laya or the planner.
- **Tests:**
  - Lifecycle, preemption, checkpoint/restore, and failure-class tests.
- **Metrics:**
  - `skill_runtime_skill_contract_errors_total`
  - `skill_runtime_skill_contract_latency_ms`

### `skill-runtime.skill-registry` — Skill Registry

- **Responsibility:** Register and resolve skills by stable ID and validate contract compliance.
- **Owner path:** `packages/skills/src/skill-registry`
- **Provides:** `skill-runtime.skill-registry.interface`
- **Requires:** `skill-runtime.skill-contract`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - Skills execute through the lifecycle executor with veto checks before every effect.
  - Checkpoints capture resumable state and restore is validated against the observed world.
- **Failure modes:**
  - Skill failure: classify, checkpoint when resumable, and report to Laya or the planner.
- **Tests:**
  - Lifecycle, preemption, checkpoint/restore, and failure-class tests.
- **Metrics:**
  - `skill_runtime_skill_registry_errors_total`
  - `skill_runtime_skill_registry_latency_ms`

### `skill-runtime.lifecycle-executor` — Skill Lifecycle Executor

- **Responsibility:** Execute skill plan, start, step, cancel, and completion transitions.
- **Owner path:** `packages/skills/src/lifecycle-executor`
- **Provides:** `skill-runtime.lifecycle-executor.interface`
- **Requires:** `skill-runtime.skill-registry`, `skill-runtime.skill-contract`, `skill-runtime.context-builder`, `skill-runtime.effects-emitter`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - Skills execute through the lifecycle executor with veto checks before every effect.
  - Checkpoints capture resumable state and restore is validated against the observed world.
- **Failure modes:**
  - Skill failure: classify, checkpoint when resumable, and report to Laya or the planner.
- **Tests:**
  - Lifecycle, preemption, checkpoint/restore, and failure-class tests.
- **Metrics:**
  - `skill_runtime_lifecycle_executor_errors_total`
  - `skill_runtime_lifecycle_executor_latency_ms`

### `skill-runtime.tick-scheduler` — Skill Tick Scheduler

- **Responsibility:** Step active skills at 200-500ms while preserving guardian priority.
- **Owner path:** `packages/skills/src/tick-scheduler`
- **Provides:** `skill-runtime.tick-scheduler.interface`
- **Requires:** `skill-runtime.lifecycle-executor`, `brains.reflex-guardian-loop`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - Skills execute through the lifecycle executor with veto checks before every effect.
  - Checkpoints capture resumable state and restore is validated against the observed world.
- **Failure modes:**
  - Skill failure: classify, checkpoint when resumable, and report to Laya or the planner.
- **Tests:**
  - Lifecycle, preemption, checkpoint/restore, and failure-class tests.
- **Metrics:**
  - `skill_runtime_tick_scheduler_errors_total`
  - `skill_runtime_tick_scheduler_latency_ms`

### `skill-runtime.context-builder` — Skill Context Builder

- **Responsibility:** Build the bounded skill context from world, SIP, inventory, task, and checkpoint state.
- **Owner path:** `packages/skills/src/context-builder`
- **Provides:** `skill-runtime.context-builder.interface`
- **Requires:** `bot-runtime.world-cache-adapter`, `world.spatial-query-engine`, `sip.revision-manager`, `skill-runtime.checkpoint-manager`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - Skills execute through the lifecycle executor with veto checks before every effect.
  - Checkpoints capture resumable state and restore is validated against the observed world.
- **Failure modes:**
  - Skill failure: classify, checkpoint when resumable, and report to Laya or the planner.
- **Tests:**
  - Lifecycle, preemption, checkpoint/restore, and failure-class tests.
- **Metrics:**
  - `skill_runtime_context_builder_errors_total`
  - `skill_runtime_context_builder_latency_ms`

### `skill-runtime.progress-reporter` — Skill Progress Reporter

- **Responsibility:** Report progress and failure class to Laya, planner, and metrics.
- **Owner path:** `packages/skills/src/progress-reporter`
- **Provides:** `skill-runtime.progress-reporter.interface`
- **Requires:** `transport.event-stream`, `ops.metrics-registry`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - Skills execute through the lifecycle executor with veto checks before every effect.
  - Checkpoints capture resumable state and restore is validated against the observed world.
- **Failure modes:**
  - Skill failure: classify, checkpoint when resumable, and report to Laya or the planner.
- **Tests:**
  - Lifecycle, preemption, checkpoint/restore, and failure-class tests.
- **Metrics:**
  - `skill_runtime_progress_reporter_errors_total`
  - `skill_runtime_progress_reporter_latency_ms`

### `skill-runtime.checkpoint-manager` — Skill Checkpoint Manager

- **Responsibility:** Persist and load skill checkpoints by bot, task, and skill.
- **Owner path:** `packages/skills/src/checkpoint-manager`
- **Provides:** `skill-runtime.checkpoint-manager.interface`
- **Requires:** `memory.transaction-manager`
- **Owns state:** `skill_checkpoints`
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - Skills execute through the lifecycle executor with veto checks before every effect.
  - Checkpoints capture resumable state and restore is validated against the observed world.
- **Failure modes:**
  - Skill failure: classify, checkpoint when resumable, and report to Laya or the planner.
- **Tests:**
  - Lifecycle, preemption, checkpoint/restore, and failure-class tests.
- **Metrics:**
  - `skill_runtime_checkpoint_manager_errors_total`
  - `skill_runtime_checkpoint_manager_latency_ms`

### `skill-runtime.restore-validator` — Skill Restore Validator

- **Responsibility:** Reject stale checkpoints that no longer match the world or claim state.
- **Owner path:** `packages/skills/src/restore-validator`
- **Provides:** `skill-runtime.restore-validator.interface`
- **Requires:** `skill-runtime.checkpoint-manager`, `world.spatial-query-engine`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - Validation is pure and deterministic; the same input yields the same verdict.
  - Invalid input is rejected with a typed reason and causes no partial mutation.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `skill_runtime_restore_validator_errors_total`
  - `skill_runtime_restore_validator_latency_ms`

### `skill-runtime.effects-emitter` — Typed Effects Emitter

- **Responsibility:** Emit declared place, break, use, attack, and inventory effects.
- **Owner path:** `packages/skills/src/effects-emitter`
- **Provides:** `skill-runtime.effects-emitter.interface`
- **Requires:** `transport.event-stream`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - Skills execute through the lifecycle executor with veto checks before every effect.
  - Checkpoints capture resumable state and restore is validated against the observed world.
- **Failure modes:**
  - Skill failure: classify, checkpoint when resumable, and report to Laya or the planner.
- **Tests:**
  - Lifecycle, preemption, checkpoint/restore, and failure-class tests.
- **Metrics:**
  - `skill_runtime_effects_emitter_errors_total`
  - `skill_runtime_effects_emitter_latency_ms`

### `skill-runtime.preemption-handler` — Skill Preemption Handler

- **Responsibility:** Cancel or pause a skill when the guardian, claim, or grant state changes.
- **Owner path:** `packages/skills/src/preemption-handler`
- **Provides:** `skill-runtime.preemption-handler.interface`
- **Requires:** `skill-runtime.lifecycle-executor`, `safety.action-veto-gate`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - Skills execute through the lifecycle executor with veto checks before every effect.
  - Checkpoints capture resumable state and restore is validated against the observed world.
- **Failure modes:**
  - Skill failure: classify, checkpoint when resumable, and report to Laya or the planner.
- **Tests:**
  - Lifecycle, preemption, checkpoint/restore, and failure-class tests.
- **Metrics:**
  - `skill_runtime_preemption_handler_errors_total`
  - `skill_runtime_preemption_handler_latency_ms`

---

## Skill Library

- **ID:** `sys.skills`
- **Owner package:** `packages/skills/src`
- **Milestone:** 4
- **Source refs:** `main.md#9-skills`
- **Allowed cross-system dependencies:** `sys.bot-runtime`, `sys.building`, `sys.safety`, `sys.sip`, `sys.skill-runtime`, `sys.world`
- **Forbidden dependencies:** `fe.skills-sip-write`

**Purpose.** Implement the v1 deterministic skills used by bots.

**System invariants.**
- Skills are idempotent where possible and report progress and failure class.
- Skills request actions through the bot runtime; they do not touch mineflayer directly.
- Skills respect claims, grants, and safety vetoes.

### Components

| ID | Component | Responsibility | Owner path | Milestone |
|---|---|---|---|---:|
| `skills.navigate` | Navigate | Move a bot to a target position using pathfinding and stuck recovery. | `packages/skills/src/navigate` | 4 |
| `skills.follow-path` | Follow Path | Follow a SIP path graph route with waypoint and deviation handling. | `packages/skills/src/follow-path` | 4 |
| `skills.mine` | Mine | Mine a targeted block with tool selection, reach checks, and drop collection. | `packages/skills/src/mine` | 4 |
| `skills.collect` | Collect | Collect nearby drops or resource blocks within a bounded area. | `packages/skills/src/collect` | 4 |
| `skills.craft` | Craft | Craft an item from a recipe using available inventory and workstations. | `packages/skills/src/craft` | 4 |
| `skills.smelt` | Smelt | Smelt input items in a reachable furnace with fuel accounting. | `packages/skills/src/smelt` | 4 |
| `skills.eat` | Eat | Consume the best available food when hunger or health requires it. | `packages/skills/src/eat` | 4 |
| `skills.deposit` | Deposit | Deposit selected inventory into a reserved container. | `packages/skills/src/deposit` | 4 |
| `skills.withdraw` | Withdraw | Withdraw requested materials from a reserved container. | `packages/skills/src/withdraw` | 4 |
| `skills.sleep` | Sleep | Reach and use a bed safely when night or threat requires it. | `packages/skills/src/sleep` | 4 |
| `skills.flee-defend` | Flee or Defend | Flee, kite, or defend against hostile mobs according to role and risk. | `packages/skills/src/flee-defend` | 4 |
| `skills.explore` | Explore | Explore unknown territory while avoiding protected and claimed areas. | `packages/skills/src/explore` | 4 |
| `skills.bridge` | Bridge | Place a safe bridge across a gap or obstacle without violating safety rules. | `packages/skills/src/bridge` | 4 |
| `skills.clear` | Clear | Remove permitted blocks from a work package after grant and safety validation. | `packages/skills/src/clear` | 4 |
| `skills.place-build` | Place Build | Place blueprint blocks for a work package in support-first order. | `packages/skills/src/place-build` | 4 |
| `skills.construction` | Construction | Execute an ordered construction plan through verified block changes and scaffold cleanup. | `packages/skills/src/construction` | 6 |
| `skills.schematic-build` | Schematic Build | Execute a schematic-backed blueprint with diffing and partitioning. | `packages/skills/src/schematic-build` | 4 |
| `skills.repair` | Repair | Repair a structure by diffing intended blueprint against observed blocks. | `packages/skills/src/repair` | 4 |
| `skills.harvest-farm` | Harvest Farm | Harvest mature crops from an assigned farm plot. | `packages/skills/src/harvest-farm` | 4 |
| `skills.plant-farm` | Plant Farm | Plant seeds and maintain water and crop state on an assigned plot. | `packages/skills/src/plant-farm` | 4 |
| `skills.entity-targeting` | Entity Targeting | Find and track the nearest matching entity and verify that a target still exists. | `packages/skills/src/entity-targeting` | 15 |
| `skills.equip-gear` | Equip Gear | Equip the best available weapon and armor into the correct slots. | `packages/skills/src/equip-gear` | 15 |
| `skills.gather-food` | Gather Food | Hunt passive animals and collect their drops until enough food is carried. | `packages/skills/src/gather-food` | 15 |
| `skills.gather-wool` | Gather Wool | Shear or hunt sheep for wool and skip already-sheared targets. | `packages/skills/src/gather-wool` | 15 |
| `skills.place-bed` | Place Bed | Move to the target cell and place a carried bed with support-safe placement. | `packages/skills/src/place-bed` | 15 |
| `skills.dig-shelter` | Dig Shelter | Dig a sealed two-block pocket, wait out the night, then unseal and refill it. | `packages/skills/src/dig-shelter` | 15 |
| `skills.shared-utilities` | Skill Shared Utilities | Provide target selection, inventory math, reach checks, and progress helpers. | `packages/skills/src/shared-utilities` | 4 |

### `skills.navigate` — Navigate

- **Responsibility:** Move a bot to a target position using pathfinding and stuck recovery.
- **Owner path:** `packages/skills/src/navigate`
- **Provides:** `skills.navigate.interface`
- **Requires:** `skill-runtime.skill-contract`, `bot-runtime.action-executor`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - The skill declares canRun/plan/step/cancel and checkpoint/restore with typed effects.
  - Every effect passes the guardian veto gate before reaching the action executor.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_navigate_errors_total`
  - `skills_navigate_latency_ms`

### `skills.follow-path` — Follow Path

- **Responsibility:** Follow a SIP path graph route with waypoint and deviation handling.
- **Owner path:** `packages/skills/src/follow-path`
- **Provides:** `skills.follow-path.interface`
- **Requires:** `skills.navigate`, `sip.path-graph-store`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - The skill declares canRun/plan/step/cancel and checkpoint/restore with typed effects.
  - Every effect passes the guardian veto gate before reaching the action executor.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_follow_path_errors_total`
  - `skills_follow_path_latency_ms`

### `skills.mine` — Mine

- **Responsibility:** Mine a targeted block with tool selection, reach checks, and drop collection.
- **Owner path:** `packages/skills/src/mine`
- **Provides:** `skills.mine.interface`
- **Requires:** `bot-runtime.action-executor`, `skills.navigate`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - The skill declares canRun/plan/step/cancel and checkpoint/restore with typed effects.
  - Every effect passes the guardian veto gate before reaching the action executor.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_mine_errors_total`
  - `skills_mine_latency_ms`

### `skills.collect` — Collect

- **Responsibility:** Collect nearby drops or resource blocks within a bounded area.
- **Owner path:** `packages/skills/src/collect`
- **Provides:** `skills.collect.interface`
- **Requires:** `bot-runtime.action-executor`, `skills.navigate`, `skills.mine`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - The skill declares canRun/plan/step/cancel and checkpoint/restore with typed effects.
  - Every effect passes the guardian veto gate before reaching the action executor.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_collect_errors_total`
  - `skills_collect_latency_ms`

### `skills.craft` — Craft

- **Responsibility:** Craft an item from a recipe using available inventory and workstations.
- **Owner path:** `packages/skills/src/craft`
- **Provides:** `skills.craft.interface`
- **Requires:** `bot-runtime.action-executor`, `skill-runtime.context-builder`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - The skill declares canRun/plan/step/cancel and checkpoint/restore with typed effects.
  - Every effect passes the guardian veto gate before reaching the action executor.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_craft_errors_total`
  - `skills_craft_latency_ms`

### `skills.smelt` — Smelt

- **Responsibility:** Smelt input items in a reachable furnace with fuel accounting.
- **Owner path:** `packages/skills/src/smelt`
- **Provides:** `skills.smelt.interface`
- **Requires:** `bot-runtime.action-executor`, `skills.navigate`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - The skill declares canRun/plan/step/cancel and checkpoint/restore with typed effects.
  - Every effect passes the guardian veto gate before reaching the action executor.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_smelt_errors_total`
  - `skills_smelt_latency_ms`

### `skills.eat` — Eat

- **Responsibility:** Consume the best available food when hunger or health requires it.
- **Owner path:** `packages/skills/src/eat`
- **Provides:** `skills.eat.interface`
- **Requires:** `bot-runtime.action-executor`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - The skill declares canRun/plan/step/cancel and checkpoint/restore with typed effects.
  - Every effect passes the guardian veto gate before reaching the action executor.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_eat_errors_total`
  - `skills_eat_latency_ms`

### `skills.deposit` — Deposit

- **Responsibility:** Deposit selected inventory into a reserved container.
- **Owner path:** `packages/skills/src/deposit`
- **Provides:** `skills.deposit.interface`
- **Requires:** `bot-runtime.action-executor`, `world.container-memory`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - The skill declares canRun/plan/step/cancel and checkpoint/restore with typed effects.
  - Every effect passes the guardian veto gate before reaching the action executor.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_deposit_errors_total`
  - `skills_deposit_latency_ms`

### `skills.withdraw` — Withdraw

- **Responsibility:** Withdraw requested materials from a reserved container.
- **Owner path:** `packages/skills/src/withdraw`
- **Provides:** `skills.withdraw.interface`
- **Requires:** `bot-runtime.action-executor`, `world.container-memory`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - The skill declares canRun/plan/step/cancel and checkpoint/restore with typed effects.
  - Every effect passes the guardian veto gate before reaching the action executor.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_withdraw_errors_total`
  - `skills_withdraw_latency_ms`

### `skills.sleep` — Sleep

- **Responsibility:** Reach and use a bed safely when night or threat requires it.
- **Owner path:** `packages/skills/src/sleep`
- **Provides:** `skills.sleep.interface`
- **Requires:** `bot-runtime.action-executor`, `skills.navigate`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - The skill declares canRun/plan/step/cancel and checkpoint/restore with typed effects.
  - Every effect passes the guardian veto gate before reaching the action executor.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_sleep_errors_total`
  - `skills_sleep_latency_ms`

### `skills.flee-defend` — Flee or Defend

- **Responsibility:** Flee, kite, or defend against hostile mobs according to role and risk.
- **Owner path:** `packages/skills/src/flee-defend`
- **Provides:** `skills.flee-defend.interface`
- **Requires:** `bot-runtime.action-executor`, `skills.navigate`, `safety.mob-threat-evaluator`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - The skill declares canRun/plan/step/cancel and checkpoint/restore with typed effects.
  - Every effect passes the guardian veto gate before reaching the action executor.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_flee_defend_errors_total`
  - `skills_flee_defend_latency_ms`

### `skills.explore` — Explore

- **Responsibility:** Explore unknown territory while avoiding protected and claimed areas.
- **Owner path:** `packages/skills/src/explore`
- **Provides:** `skills.explore.interface`
- **Requires:** `skills.navigate`, `world.spatial-query-engine`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - The skill declares canRun/plan/step/cancel and checkpoint/restore with typed effects.
  - Every effect passes the guardian veto gate before reaching the action executor.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_explore_errors_total`
  - `skills_explore_latency_ms`

### `skills.bridge` — Bridge

- **Responsibility:** Place a safe bridge across a gap or obstacle without violating safety rules.
- **Owner path:** `packages/skills/src/bridge`
- **Provides:** `skills.bridge.interface`
- **Requires:** `building.block-executor`, `skills.navigate`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - The skill declares canRun/plan/step/cancel and checkpoint/restore with typed effects.
  - Every effect passes the guardian veto gate before reaching the action executor.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_bridge_errors_total`
  - `skills_bridge_latency_ms`

### `skills.clear` — Clear

- **Responsibility:** Remove permitted blocks from a work package after grant and safety validation.
- **Owner path:** `packages/skills/src/clear`
- **Provides:** `skills.clear.interface`
- **Requires:** `building.block-executor`, `safety.action-veto-gate`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - The skill declares canRun/plan/step/cancel and checkpoint/restore with typed effects.
  - Every effect passes the guardian veto gate before reaching the action executor.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_clear_errors_total`
  - `skills_clear_latency_ms`

### `skills.place-build` — Place Build

- **Responsibility:** Place blueprint blocks for a work package in support-first order.
- **Owner path:** `packages/skills/src/place-build`
- **Provides:** `skills.place-build.interface`
- **Requires:** `building.block-executor`, `skill-runtime.context-builder`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - The skill declares canRun/plan/step/cancel and checkpoint/restore with typed effects.
  - Every effect passes the guardian veto gate before reaching the action executor.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_place_build_errors_total`
  - `skills_place_build_latency_ms`

### `skills.construction` — Construction

- **Responsibility:** Execute an ordered construction plan through verified block changes and scaffold cleanup.
- **Owner path:** `packages/skills/src/construction`
- **Provides:** `skills.construction.interface`
- **Requires:** `bot-runtime.building-execution-service`, `building.construction-plan-planner`, `building.schematic-diff`, `skill-runtime.context-builder`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Construction restores by re-diffing the world instead of replaying stale coordinates.
  - Every block change carries claim, grant, blueprint revision, and fencing attribution.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_construction_errors_total`
  - `skills_construction_latency_ms`

### `skills.schematic-build` — Schematic Build

- **Responsibility:** Execute a schematic-backed blueprint with diffing and partitioning.
- **Owner path:** `packages/skills/src/schematic-build`
- **Provides:** `skills.schematic-build.interface`
- **Requires:** `building.build-order-planner`, `building.block-executor`, `building.work-package-partitioner`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - The skill declares canRun/plan/step/cancel and checkpoint/restore with typed effects.
  - Every effect passes the guardian veto gate before reaching the action executor.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_schematic_build_errors_total`
  - `skills_schematic_build_latency_ms`

### `skills.repair` — Repair

- **Responsibility:** Repair a structure by diffing intended blueprint against observed blocks.
- **Owner path:** `packages/skills/src/repair`
- **Provides:** `skills.repair.interface`
- **Requires:** `building.schematic-diff`, `building.block-executor`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - The skill declares canRun/plan/step/cancel and checkpoint/restore with typed effects.
  - Every effect passes the guardian veto gate before reaching the action executor.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_repair_errors_total`
  - `skills_repair_latency_ms`

### `skills.harvest-farm` — Harvest Farm

- **Responsibility:** Harvest mature crops from an assigned farm plot.
- **Owner path:** `packages/skills/src/harvest-farm`
- **Provides:** `skills.harvest-farm.interface`
- **Requires:** `skills.navigate`, `bot-runtime.action-executor`, `sip.farm-store`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - The skill declares canRun/plan/step/cancel and checkpoint/restore with typed effects.
  - Every effect passes the guardian veto gate before reaching the action executor.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_harvest_farm_errors_total`
  - `skills_harvest_farm_latency_ms`

### `skills.plant-farm` — Plant Farm

- **Responsibility:** Plant seeds and maintain water and crop state on an assigned plot.
- **Owner path:** `packages/skills/src/plant-farm`
- **Provides:** `skills.plant-farm.interface`
- **Requires:** `skills.navigate`, `bot-runtime.action-executor`, `sip.farm-store`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - The skill declares canRun/plan/step/cancel and checkpoint/restore with typed effects.
  - Every effect passes the guardian veto gate before reaching the action executor.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_plant_farm_errors_total`
  - `skills_plant_farm_latency_ms`

### `skills.entity-targeting` — Entity Targeting

- **Responsibility:** Find and track the nearest matching entity and verify that a target still exists.
- **Owner path:** `packages/skills/src/entity-targeting`
- **Provides:** `skills.entity-targeting.interface`
- **Requires:** `bot-runtime.world-cache-adapter`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 15
- **Invariants:**
  - The skill declares canRun/plan/step/cancel and checkpoint/restore with typed effects.
  - Every effect passes the guardian veto gate before reaching the action executor.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_entity_targeting_errors_total`
  - `skills_entity_targeting_latency_ms`

### `skills.equip-gear` — Equip Gear

- **Responsibility:** Equip the best available weapon and armor into the correct slots.
- **Owner path:** `packages/skills/src/equip-gear`
- **Provides:** `skills.equip-gear.interface`
- **Requires:** `skills.shared-utilities`, `bot-runtime.action-executor`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 15
- **Invariants:**
  - Only inventory items may be equipped and no slot is filled with an incompatible item.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_equip_gear_errors_total`
  - `skills_equip_gear_latency_ms`

### `skills.gather-food` — Gather Food

- **Responsibility:** Hunt passive animals and collect their drops until enough food is carried.
- **Owner path:** `packages/skills/src/gather-food`
- **Provides:** `skills.gather-food.interface`
- **Requires:** `skills.entity-targeting`, `skills.shared-utilities`, `bot-runtime.action-executor`, `bot-runtime.world-cache-adapter`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 15
- **Invariants:**
  - Gathering stops at the requested food count and never attacks players or bots.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_gather_food_errors_total`
  - `skills_gather_food_latency_ms`

### `skills.gather-wool` — Gather Wool

- **Responsibility:** Shear or hunt sheep for wool and skip already-sheared targets.
- **Owner path:** `packages/skills/src/gather-wool`
- **Provides:** `skills.gather-wool.interface`
- **Requires:** `skills.entity-targeting`, `skills.shared-utilities`, `bot-runtime.action-executor`, `bot-runtime.world-cache-adapter`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 15
- **Invariants:**
  - A sheared target is not retried indefinitely and gathering stops at the requested wool count.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_gather_wool_errors_total`
  - `skills_gather_wool_latency_ms`

### `skills.place-bed` — Place Bed

- **Responsibility:** Move to the target cell and place a carried bed with support-safe placement.
- **Owner path:** `packages/skills/src/place-bed`
- **Provides:** `skills.place-bed.interface`
- **Requires:** `skills.shared-utilities`, `bot-runtime.action-executor`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 15
- **Invariants:**
  - A bed is placed only when a bed item is carried and the target cell is reachable.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_place_bed_errors_total`
  - `skills_place_bed_latency_ms`

### `skills.dig-shelter` — Dig Shelter

- **Responsibility:** Dig a sealed two-block pocket, wait out the night, then unseal and refill it.
- **Owner path:** `packages/skills/src/dig-shelter`
- **Provides:** `skills.dig-shelter.interface`
- **Requires:** `skills.shared-utilities`, `bot-runtime.action-executor`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 15
- **Invariants:**
  - Each dug block is recorded and restored when the shelter is left.
  - Digging advances only after the current break action completes.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_dig_shelter_errors_total`
  - `skills_dig_shelter_latency_ms`

### `skills.shared-utilities` — Skill Shared Utilities

- **Responsibility:** Provide target selection, inventory math, reach checks, and progress helpers.
- **Owner path:** `packages/skills/src/shared-utilities`
- **Provides:** `skills.shared-utilities.interface`
- **Requires:** `skill-runtime.context-builder`, `world.spatial-query-engine`
- **Owns state:** none
- **Source refs:** `main.md#9-skills`
- **Milestone:** 4
- **Invariants:**
  - The skill declares canRun/plan/step/cancel and checkpoint/restore with typed effects.
  - Every effect passes the guardian veto gate before reaching the action executor.
- **Failure modes:**
  - Precondition loss or blocked path: cancel cleanly and report the failure class.
- **Tests:**
  - Happy path, blocked path, and checkpoint-resume fixtures.
- **Metrics:**
  - `skills_shared_utilities_errors_total`
  - `skills_shared_utilities_latency_ms`

---

## Building

- **ID:** `sys.building`
- **Owner package:** `packages/building/src`
- **Milestone:** 6
- **Source refs:** `main.md#10-building-three-layers`
- **Allowed cross-system dependencies:** `sys.bot-runtime`, `sys.safety`, `sys.sip`
- **Forbidden dependencies:** none

**Purpose.** Represent blueprints, compose templates and schematics, partition work, and execute block changes safely.

**System invariants.**
- Every block change is support-first, verified, rate-limited, and journaled.
- Work packages are claimed before execution and idempotent on retry.
- No destructive change bypasses grants, safety, or protected bounding boxes.

### Components

| ID | Component | Responsibility | Owner path | Milestone |
|---|---|---|---|---:|
| `building.blueprint-ir` | Blueprint IR | Define the validated blueprint intermediate representation of blocks, materials, and constraints. | `packages/building/src/blueprint-ir` | 6 |
| `building.blueprint-validator` | Blueprint Validator | Validate blueprint blocks, constraints, materials, and zone compatibility. | `packages/building/src/blueprint-validator` | 6 |
| `building.template-registry` | Template Registry | Register and resolve procedural building templates by type. | `packages/building/src/template-registry` | 6 |
| `building.template-house` | House Template | Generate parameterized house walls, roof, door, windows, and interior. | `packages/building/src/template-house` | 6 |
| `building.template-road` | Road Template | Generate parameterized road and path segments. | `packages/building/src/template-road` | 6 |
| `building.template-farm` | Farm Template | Generate a parameterized 9x9 farm with water and crop layout. | `packages/building/src/template-farm` | 6 |
| `building.template-wall` | Wall Template | Generate parameterized defensive walls. | `packages/building/src/template-wall` | 6 |
| `building.template-bridge` | Bridge Template | Generate parameterized bridges with support and deck rules. | `packages/building/src/template-bridge` | 6 |
| `building.template-storage` | Storage Room Template | Generate a parameterized storage room with container placement. | `packages/building/src/template-storage` | 6 |
| `building.template-watchtower` | Watchtower Template | Generate a parameterized watchtower with safe access. | `packages/building/src/template-watchtower` | 6 |
| `building.template-instantiator` | Template Instantiator | Instantiate a template with size, material, anchor, and rotation into a blueprint. | `packages/building/src/template-instantiator` | 6 |
| `building.schematic-parser` | Schematic Parser | Parse .schem and optional .litematic files into blueprints. | `packages/building/src/schematic-parser` | 6 |
| `building.schematic-diff` | Schematic Diff | Diff blueprint against world blocks to compute missing and extra blocks. | `packages/building/src/schematic-diff` | 6 |
| `building.work-package-partitioner` | Work Package Partitioner | Split a blueprint into claimable layers, slices, or quadrants. | `packages/building/src/work-package-partitioner` | 6 |
| `building.build-order-planner` | Build Order Planner | Order blocks support-first and bottom-up with dependency constraints. | `packages/building/src/build-order-planner` | 6 |
| `building.reachability-scaffold-planner` | Reachability and Scaffold Planner | Plan safe reachability and scaffold fallback for each block target. | `packages/building/src/reachability-scaffold-planner` | 6 |
| `building.block-verifier` | Block Verifier | Verify target block state before and after placement or removal. | `packages/building/src/block-verifier` | 6 |
| `building.block-executor` | Block Executor | Execute verified block changes through the bot action executor with safety veto and rollback. | `packages/building/src/block-executor` | 6 |
| `building.material-preflight` | Material Preflight | Check inventory and containers for required materials before starting a package. | `packages/building/src/material-preflight` | 6 |
| `building.container-refill-adapter` | Container Refill Adapter | Withdraw missing materials and deposit surplus through deterministic skills. | `packages/building/src/container-refill-adapter` | 6 |
| `building.rollback-journal` | Rollback Journal | Journal every block before/after image for reversible changes. | `packages/building/src/rollback-journal` | 6 |
| `building.construction-types` | Construction Plan Types | Define site, foundation, dependency, scaffold, procurement, and construction-plan contracts. | `packages/building/src/construction-types` | 6 |
| `building.blueprint-document` | Blueprint Document | Version, hash, source, and persist blueprint documents with provenance and construction phases. | `packages/building/src/blueprint-document` | 6 |
| `building.seeded-random` | Seeded Random | Provide deterministic random values for identical briefs and seeds. | `packages/building/src/seeded-random` | 6 |
| `building.style-palette` | Style Palette | Resolve style profiles into deterministic structure, floor, roof, accent, and glass palettes. | `packages/building/src/style-palette` | 6 |
| `building.motif-library` | Motif Library | Provide reusable door, window, stair, bed, storage, lighting, farm, and roof motifs. | `packages/building/src/motif-library` | 6 |
| `building.blueprint-composer` | Blueprint Composer | Compose a compact building brief into a validated, deterministic, functional blueprint. | `packages/building/src/blueprint-composer` | 6 |
| `building.observed-blueprint` | Observed Blueprint | Capture existing structures into blueprints for repair, renovation, and imitation. | `packages/building/src/observed-blueprint` | 6 |
| `building.blueprint-source-resolver` | Blueprint Source Resolver | Resolve template, composed, schematic, observed, and gated raw-block blueprint sources. | `packages/building/src/blueprint-source-resolver` | 6 |
| `building.site-planner` | Site Planner | Select a deterministic site, reject hazards and protected zones, and adapt access and foundation needs. | `packages/building/src/site-planner` | 6 |
| `building.foundation-planner` | Foundation Planner | Plan foundation fills, cuts, clearance, and foundation materials without mutating the canonical blueprint. | `packages/building/src/foundation-planner` | 6 |
| `building.construction-dependency-graph` | Construction Dependency Graph | Order construction changes by support, attachments, multi-block objects, phases, and explicit dependencies. | `packages/building/src/construction-dependency-graph` | 6 |
| `building.work-package-planner` | Work Package Planner | Partition ordered construction changes into phase-aware packages without splitting dependency stacks. | `packages/building/src/work-package-planner` | 6 |
| `building.construction-plan-planner` | Construction Plan Planner | Combine site, foundation, blueprint, scaffold, and package planning into one ordered construction plan. | `packages/building/src/construction-plan-planner` | 6 |
| `building.material-procurement-planner` | Material Procurement Planner | Convert material shortages into withdrawals, crafting, gathering, reservations, or blocking failures. | `packages/building/src/material-procurement-planner` | 6 |

### `building.blueprint-ir` — Blueprint IR

- **Responsibility:** Define the validated blueprint intermediate representation of blocks, materials, and constraints.
- **Owner path:** `packages/building/src/blueprint-ir`
- **Provides:** `building.blueprint-ir.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_blueprint_ir_errors_total`
  - `building_blueprint_ir_latency_ms`

### `building.blueprint-validator` — Blueprint Validator

- **Responsibility:** Validate blueprint blocks, constraints, materials, and zone compatibility.
- **Owner path:** `packages/building/src/blueprint-validator`
- **Provides:** `building.blueprint-validator.interface`
- **Requires:** `building.blueprint-ir`, `sip.rules-store`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Validation is pure and deterministic; the same input yields the same verdict.
  - Invalid input is rejected with a typed reason and causes no partial mutation.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `building_blueprint_validator_errors_total`
  - `building_blueprint_validator_latency_ms`

### `building.template-registry` — Template Registry

- **Responsibility:** Register and resolve procedural building templates by type.
- **Owner path:** `packages/building/src/template-registry`
- **Provides:** `building.template-registry.interface`
- **Requires:** `building.blueprint-ir`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_template_registry_errors_total`
  - `building_template_registry_latency_ms`

### `building.template-house` — House Template

- **Responsibility:** Generate parameterized house walls, roof, door, windows, and interior.
- **Owner path:** `packages/building/src/template-house`
- **Provides:** `building.template-house.interface`
- **Requires:** `building.blueprint-ir`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_template_house_errors_total`
  - `building_template_house_latency_ms`

### `building.template-road` — Road Template

- **Responsibility:** Generate parameterized road and path segments.
- **Owner path:** `packages/building/src/template-road`
- **Provides:** `building.template-road.interface`
- **Requires:** `building.blueprint-ir`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_template_road_errors_total`
  - `building_template_road_latency_ms`

### `building.template-farm` — Farm Template

- **Responsibility:** Generate a parameterized 9x9 farm with water and crop layout.
- **Owner path:** `packages/building/src/template-farm`
- **Provides:** `building.template-farm.interface`
- **Requires:** `building.blueprint-ir`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_template_farm_errors_total`
  - `building_template_farm_latency_ms`

### `building.template-wall` — Wall Template

- **Responsibility:** Generate parameterized defensive walls.
- **Owner path:** `packages/building/src/template-wall`
- **Provides:** `building.template-wall.interface`
- **Requires:** `building.blueprint-ir`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_template_wall_errors_total`
  - `building_template_wall_latency_ms`

### `building.template-bridge` — Bridge Template

- **Responsibility:** Generate parameterized bridges with support and deck rules.
- **Owner path:** `packages/building/src/template-bridge`
- **Provides:** `building.template-bridge.interface`
- **Requires:** `building.blueprint-ir`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_template_bridge_errors_total`
  - `building_template_bridge_latency_ms`

### `building.template-storage` — Storage Room Template

- **Responsibility:** Generate a parameterized storage room with container placement.
- **Owner path:** `packages/building/src/template-storage`
- **Provides:** `building.template-storage.interface`
- **Requires:** `building.blueprint-ir`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_template_storage_errors_total`
  - `building_template_storage_latency_ms`

### `building.template-watchtower` — Watchtower Template

- **Responsibility:** Generate a parameterized watchtower with safe access.
- **Owner path:** `packages/building/src/template-watchtower`
- **Provides:** `building.template-watchtower.interface`
- **Requires:** `building.blueprint-ir`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_template_watchtower_errors_total`
  - `building_template_watchtower_latency_ms`

### `building.template-instantiator` — Template Instantiator

- **Responsibility:** Instantiate a template with size, material, anchor, and rotation into a blueprint.
- **Owner path:** `packages/building/src/template-instantiator`
- **Provides:** `building.template-instantiator.interface`
- **Requires:** `building.template-registry`, `building.blueprint-validator`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_template_instantiator_errors_total`
  - `building_template_instantiator_latency_ms`

### `building.schematic-parser` — Schematic Parser

- **Responsibility:** Parse .schem and optional .litematic files into blueprints.
- **Owner path:** `packages/building/src/schematic-parser`
- **Provides:** `building.schematic-parser.interface`
- **Requires:** `building.blueprint-ir`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_schematic_parser_errors_total`
  - `building_schematic_parser_latency_ms`

### `building.schematic-diff` — Schematic Diff

- **Responsibility:** Diff blueprint against world blocks to compute missing and extra blocks.
- **Owner path:** `packages/building/src/schematic-diff`
- **Provides:** `building.schematic-diff.interface`
- **Requires:** `building.blueprint-ir`, `world.spatial-query-engine`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_schematic_diff_errors_total`
  - `building_schematic_diff_latency_ms`

### `building.work-package-partitioner` — Work Package Partitioner

- **Responsibility:** Split a blueprint into claimable layers, slices, or quadrants.
- **Owner path:** `packages/building/src/work-package-partitioner`
- **Provides:** `building.work-package-partitioner.interface`
- **Requires:** `building.blueprint-ir`, `sip.structure-store`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Multi-bot builds split into claimable packages by layers, perimeter slices, or quadrants.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_work_package_partitioner_errors_total`
  - `building_work_package_partitioner_latency_ms`

### `building.build-order-planner` — Build Order Planner

- **Responsibility:** Order blocks support-first and bottom-up with dependency constraints.
- **Owner path:** `packages/building/src/build-order-planner`
- **Provides:** `building.build-order-planner.interface`
- **Requires:** `building.blueprint-ir`, `building.work-package-partitioner`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_build_order_planner_errors_total`
  - `building_build_order_planner_latency_ms`

### `building.reachability-scaffold-planner` — Reachability and Scaffold Planner

- **Responsibility:** Plan safe reachability and scaffold fallback for each block target.
- **Owner path:** `packages/building/src/reachability-scaffold-planner`
- **Provides:** `building.reachability-scaffold-planner.interface`
- **Requires:** `building.build-order-planner`, `world.spatial-query-engine`, `bot-runtime.world-cache-adapter`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_reachability_scaffold_planner_errors_total`
  - `building_reachability_scaffold_planner_latency_ms`

### `building.block-verifier` — Block Verifier

- **Responsibility:** Verify target block state before and after placement or removal.
- **Owner path:** `packages/building/src/block-verifier`
- **Provides:** `building.block-verifier.interface`
- **Requires:** `world.spatial-query-engine`, `building.blueprint-ir`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Validation is pure and deterministic; the same input yields the same verdict.
  - Invalid input is rejected with a typed reason and causes no partial mutation.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `building_block_verifier_errors_total`
  - `building_block_verifier_latency_ms`

### `building.block-executor` — Block Executor

- **Responsibility:** Execute verified block changes through the bot action executor with safety veto and rollback.
- **Owner path:** `packages/building/src/block-executor`
- **Provides:** `building.block-executor.interface`
- **Requires:** `building.block-verifier`, `bot-runtime.action-executor`, `safety.action-veto-gate`, `building.rollback-journal`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Block placement is support-first, bottom-up, reachability-planned, and idempotent.
  - Placement respects protected bboxes, active bot support, and material bans.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_block_executor_errors_total`
  - `building_block_executor_latency_ms`

### `building.material-preflight` — Material Preflight

- **Responsibility:** Check inventory and containers for required materials before starting a package.
- **Owner path:** `packages/building/src/material-preflight`
- **Provides:** `building.material-preflight.interface`
- **Requires:** `building.blueprint-ir`, `skill-runtime.context-builder`, `world.container-memory`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Validation is pure and deterministic; the same input yields the same verdict.
  - Invalid input is rejected with a typed reason and causes no partial mutation.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `building_material_preflight_errors_total`
  - `building_material_preflight_latency_ms`

### `building.container-refill-adapter` — Container Refill Adapter

- **Responsibility:** Withdraw missing materials and deposit surplus through deterministic skills.
- **Owner path:** `packages/building/src/container-refill-adapter`
- **Provides:** `building.container-refill-adapter.interface`
- **Requires:** `world.container-memory`, `bot-runtime.action-executor`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_container_refill_adapter_errors_total`
  - `building_container_refill_adapter_latency_ms`

### `building.rollback-journal` — Rollback Journal

- **Responsibility:** Journal every block before/after image for reversible changes.
- **Owner path:** `packages/building/src/rollback-journal`
- **Provides:** `building.rollback-journal.interface`
- **Requires:** `memory.block-changelog-writer`, `sip.structure-store`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Every destructive change records block before/after, actor, grantId, planId, and timestamp and is rollback-capable.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_rollback_journal_errors_total`
  - `building_rollback_journal_latency_ms`

### `building.construction-types` — Construction Plan Types

- **Responsibility:** Define site, foundation, dependency, scaffold, procurement, and construction-plan contracts.
- **Owner path:** `packages/building/src/construction-types`
- **Provides:** `building.construction-types.interface`
- **Requires:** `building.blueprint-ir`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_construction_types_errors_total`
  - `building_construction_types_latency_ms`

### `building.blueprint-document` — Blueprint Document

- **Responsibility:** Version, hash, source, and persist blueprint documents with provenance and construction phases.
- **Owner path:** `packages/building/src/blueprint-document`
- **Provides:** `building.blueprint-document.interface`
- **Requires:** `building.blueprint-ir`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_blueprint_document_errors_total`
  - `building_blueprint_document_latency_ms`

### `building.seeded-random` — Seeded Random

- **Responsibility:** Provide deterministic random values for identical briefs and seeds.
- **Owner path:** `packages/building/src/seeded-random`
- **Provides:** `building.seeded-random.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_seeded_random_errors_total`
  - `building_seeded_random_latency_ms`

### `building.style-palette` — Style Palette

- **Responsibility:** Resolve style profiles into deterministic structure, floor, roof, accent, and glass palettes.
- **Owner path:** `packages/building/src/style-palette`
- **Provides:** `building.style-palette.interface`
- **Requires:** `building.blueprint-ir`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_style_palette_errors_total`
  - `building_style_palette_latency_ms`

### `building.motif-library` — Motif Library

- **Responsibility:** Provide reusable door, window, stair, bed, storage, lighting, farm, and roof motifs.
- **Owner path:** `packages/building/src/motif-library`
- **Provides:** `building.motif-library.interface`
- **Requires:** `building.blueprint-ir`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_motif_library_errors_total`
  - `building_motif_library_latency_ms`

### `building.blueprint-composer` — Blueprint Composer

- **Responsibility:** Compose a compact building brief into a validated, deterministic, functional blueprint.
- **Owner path:** `packages/building/src/blueprint-composer`
- **Provides:** `building.blueprint-composer.interface`
- **Requires:** `building.blueprint-document`, `building.blueprint-validator`, `building.style-palette`, `building.motif-library`, `building.seeded-random`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_blueprint_composer_errors_total`
  - `building_blueprint_composer_latency_ms`

### `building.observed-blueprint` — Observed Blueprint

- **Responsibility:** Capture existing structures into blueprints for repair, renovation, and imitation.
- **Owner path:** `packages/building/src/observed-blueprint`
- **Provides:** `building.observed-blueprint.interface`
- **Requires:** `building.blueprint-ir`, `world.spatial-query-engine`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_observed_blueprint_errors_total`
  - `building_observed_blueprint_latency_ms`

### `building.blueprint-source-resolver` — Blueprint Source Resolver

- **Responsibility:** Resolve template, composed, schematic, observed, and gated raw-block blueprint sources.
- **Owner path:** `packages/building/src/blueprint-source-resolver`
- **Provides:** `building.blueprint-source-resolver.interface`
- **Requires:** `building.blueprint-composer`, `building.template-instantiator`, `building.schematic-parser`, `building.observed-blueprint`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_blueprint_source_resolver_errors_total`
  - `building_blueprint_source_resolver_latency_ms`

### `building.site-planner` — Site Planner

- **Responsibility:** Select a deterministic site, reject hazards and protected zones, and adapt access and foundation needs.
- **Owner path:** `packages/building/src/site-planner`
- **Provides:** `building.site-planner.interface`
- **Requires:** `building.blueprint-ir`, `building.construction-types`, `world.spatial-query-engine`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Validation is pure and deterministic; the same input yields the same verdict.
  - Invalid input is rejected with a typed reason and causes no partial mutation.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `building_site_planner_errors_total`
  - `building_site_planner_latency_ms`

### `building.foundation-planner` — Foundation Planner

- **Responsibility:** Plan foundation fills, cuts, clearance, and foundation materials without mutating the canonical blueprint.
- **Owner path:** `packages/building/src/foundation-planner`
- **Provides:** `building.foundation-planner.interface`
- **Requires:** `building.blueprint-ir`, `building.construction-types`, `building.site-planner`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_foundation_planner_errors_total`
  - `building_foundation_planner_latency_ms`

### `building.construction-dependency-graph` — Construction Dependency Graph

- **Responsibility:** Order construction changes by support, attachments, multi-block objects, phases, and explicit dependencies.
- **Owner path:** `packages/building/src/construction-dependency-graph`
- **Provides:** `building.construction-dependency-graph.interface`
- **Requires:** `building.blueprint-ir`, `building.construction-types`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Validation is pure and deterministic; the same input yields the same verdict.
  - Invalid input is rejected with a typed reason and causes no partial mutation.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `building_construction_dependency_graph_errors_total`
  - `building_construction_dependency_graph_latency_ms`

### `building.work-package-planner` — Work Package Planner

- **Responsibility:** Partition ordered construction changes into phase-aware packages without splitting dependency stacks.
- **Owner path:** `packages/building/src/work-package-planner`
- **Provides:** `building.work-package-planner.interface`
- **Requires:** `building.blueprint-ir`, `building.construction-types`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_work_package_planner_errors_total`
  - `building_work_package_planner_latency_ms`

### `building.construction-plan-planner` — Construction Plan Planner

- **Responsibility:** Combine site, foundation, blueprint, scaffold, and package planning into one ordered construction plan.
- **Owner path:** `packages/building/src/construction-plan-planner`
- **Provides:** `building.construction-plan-planner.interface`
- **Requires:** `building.construction-types`, `building.foundation-planner`, `building.construction-dependency-graph`, `building.work-package-planner`, `building.reachability-scaffold-planner`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Building is support-first and idempotent; blocks already correct are skipped.
  - No load-bearing block of an occupied structure is removed without a valid grant.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `building_construction_plan_planner_errors_total`
  - `building_construction_plan_planner_latency_ms`

### `building.material-procurement-planner` — Material Procurement Planner

- **Responsibility:** Convert material shortages into withdrawals, crafting, gathering, reservations, or blocking failures.
- **Owner path:** `packages/building/src/material-procurement-planner`
- **Provides:** `building.material-procurement-planner.interface`
- **Requires:** `building.blueprint-ir`, `building.material-preflight`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Validation is pure and deterministic; the same input yields the same verdict.
  - Invalid input is rejected with a typed reason and causes no partial mutation.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `building_material_procurement_planner_errors_total`
  - `building_material_procurement_planner_latency_ms`

---

## Bot Runtime and Mineflayer Adapter

- **ID:** `sys.bot-runtime`
- **Owner package:** `apps/bot/src`
- **Milestone:** 1
- **Source refs:** `main.md#1-fleet-coordinator`
- **Allowed cross-system dependencies:** `sys.config`, `sys.perception`, `sys.safety`, `sys.skill-runtime`, `sys.transport`, `sys.agency`
- **Forbidden dependencies:** `fe.bot-sqlite`

**Purpose.** Own each bot child process, mineflayer lifecycle, local state digest, affordances, and action execution.

**System invariants.**
- No model or planner calls mineflayer directly.
- The 20Hz guardian runs locally and can veto any action.
- Actions are rate-limited and validated for reach and safety before execution.

### Components

| ID | Component | Responsibility | Owner path | Milestone |
|---|---|---|---|---:|
| `bot-runtime.connection-lifecycle` | Connection Lifecycle | Create, join, maintain, and close the mineflayer connection. | `apps/bot/src/connection-lifecycle` | 1 |
| `bot-runtime.join-auth` | Join and Auth | Join the LAN server with the assigned identity and offline auth. | `apps/bot/src/join-auth` | 1 |
| `bot-runtime.event-bridge` | Mineflayer Event Bridge | Translate mineflayer events into typed local and coordinator events. | `apps/bot/src/event-bridge` | 1 |
| `bot-runtime.world-cache-adapter` | World Cache Adapter | Expose local block, chunk, entity, and inventory state to perception and skills. | `apps/bot/src/world-cache-adapter` | 1 |
| `bot-runtime.shelter-inspector` | Shelter Inspector | Inspect the home bounding box for shelter and bed state and find a safe nearby dig site. | `apps/bot/src/shelter-inspector` | 15 |
| `bot-runtime.reach-rate-guard` | Reach and Rate Guard | Reject impossible reach and enforce configurable action rates. | `apps/bot/src/reach-rate-guard` | 1 |
| `bot-runtime.action-executor` | Action Executor | Execute only safety-approved place, break, use, attack, and movement actions. | `apps/bot/src/action-executor` | 1 |
| `bot-runtime.building-execution-service` | Building Execution Service | Prepare, verify, journal, and complete block changes for construction skills. | `apps/bot/src/building-execution-service` | 6 |
| `bot-runtime.blueprint-fetch-client` | Blueprint Fetch Client | Fetch and cache exact blueprint document revisions from the coordinator. | `apps/bot/src/blueprint-fetch-client` | 6 |
| `bot-runtime.construction-source` | Construction Source | Derive site, foundation, dependency, package, scaffold, and replacement operations for a fetched blueprint. | `apps/bot/src/construction-source` | 6 |
| `bot-runtime.state-digest-collector` | State Digest Collector | Collect health, food, time, biome, y-level, target, inventory, hazards, and skill progress. | `apps/bot/src/state-digest-collector` | 1 |
| `bot-runtime.guardian-hook` | Guardian Hook | Connect the local reflex guardian to the action veto gate on every tick. | `apps/bot/src/guardian-hook` | 1 |
| `bot-runtime.skill-host` | Skill Host | Host the skill runtime inside the bot process and step active skills. | `apps/bot/src/skill-host` | 1 |
| `bot-runtime.perception-host` | Perception Host | Host the perception sampler and detector pipeline inside the bot process. | `apps/bot/src/perception-host` | 1 |
| `bot-runtime.agent-loop` | Agent Loop | Run the local agency tick, decide between personal goals and jobs, and drive intention execution through skills. | `apps/bot/src/agent-loop` | 12 |
| `bot-runtime.chat-adapter` | Chat Adapter | Send and receive typed social messages through mineflayer chat with rate limits and no physical actions. | `apps/bot/src/chat` | 14 |
| `bot-runtime.agency-state-adapter` | Agency State Adapter | Load and persist agency snapshots through coordinator state and reconcile intention with the observed world. | `apps/bot/src/agency-state-adapter` | 12 |
| `bot-runtime.reconnect-supervisor` | Reconnect Supervisor | Reconnect after disconnect and trigger delta resync and resume. | `apps/bot/src/reconnect-supervisor` | 1 |

### `bot-runtime.connection-lifecycle` — Connection Lifecycle

- **Responsibility:** Create, join, maintain, and close the mineflayer connection.
- **Owner path:** `apps/bot/src/connection-lifecycle`
- **Provides:** `bot-runtime.connection-lifecycle.interface`
- **Requires:** `config.config-schema-validator`, `ext.minecraft-server`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 1
- **Invariants:**
  - The adapter is the only path to mineflayer; higher tiers issue typed actions only.
  - Reach and action-rate guards run before every physical action.
- **Failure modes:**
  - Disconnect or blocked action: stop the skill and reconnect with backoff.
- **Tests:**
  - Adapter contract tests with mocked mineflayer and rate-limit cases.
- **Metrics:**
  - `bot_runtime_connection_lifecycle_errors_total`
  - `bot_runtime_connection_lifecycle_latency_ms`

### `bot-runtime.join-auth` — Join and Auth

- **Responsibility:** Join the LAN server with the assigned identity and offline auth.
- **Owner path:** `apps/bot/src/join-auth`
- **Provides:** `bot-runtime.join-auth.interface`
- **Requires:** `bot-runtime.connection-lifecycle`, `config.profile-resolver`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 1
- **Invariants:**
  - The adapter is the only path to mineflayer; higher tiers issue typed actions only.
  - Reach and action-rate guards run before every physical action.
- **Failure modes:**
  - Disconnect or blocked action: stop the skill and reconnect with backoff.
- **Tests:**
  - Adapter contract tests with mocked mineflayer and rate-limit cases.
- **Metrics:**
  - `bot_runtime_join_auth_errors_total`
  - `bot_runtime_join_auth_latency_ms`

### `bot-runtime.event-bridge` — Mineflayer Event Bridge

- **Responsibility:** Translate mineflayer events into typed local and coordinator events.
- **Owner path:** `apps/bot/src/event-bridge`
- **Provides:** `bot-runtime.event-bridge.interface`
- **Requires:** `bot-runtime.connection-lifecycle`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 1
- **Invariants:**
  - The adapter is the only path to mineflayer; higher tiers issue typed actions only.
  - Reach and action-rate guards run before every physical action.
- **Failure modes:**
  - Disconnect or blocked action: stop the skill and reconnect with backoff.
- **Tests:**
  - Adapter contract tests with mocked mineflayer and rate-limit cases.
- **Metrics:**
  - `bot_runtime_event_bridge_errors_total`
  - `bot_runtime_event_bridge_latency_ms`

### `bot-runtime.world-cache-adapter` — World Cache Adapter

- **Responsibility:** Expose local block, chunk, entity, and inventory state to perception and skills.
- **Owner path:** `apps/bot/src/world-cache-adapter`
- **Provides:** `bot-runtime.world-cache-adapter.interface`
- **Requires:** `bot-runtime.event-bridge`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 1
- **Invariants:**
  - The adapter is the only path to mineflayer; higher tiers issue typed actions only.
  - Reach and action-rate guards run before every physical action.
- **Failure modes:**
  - Disconnect or blocked action: stop the skill and reconnect with backoff.
- **Tests:**
  - Adapter contract tests with mocked mineflayer and rate-limit cases.
- **Metrics:**
  - `bot_runtime_world_cache_adapter_errors_total`
  - `bot_runtime_world_cache_adapter_latency_ms`

### `bot-runtime.shelter-inspector` — Shelter Inspector

- **Responsibility:** Inspect the home bounding box for shelter and bed state and find a safe nearby dig site.
- **Owner path:** `apps/bot/src/shelter-inspector`
- **Provides:** `bot-runtime.shelter-inspector.interface`
- **Requires:** `bot-runtime.world-cache-adapter`
- **Owns state:** none
- **Source refs:** `main.md#20-agency-and-motivation`
- **Milestone:** 15
- **Invariants:**
  - Shelter is reported only while the bot is inside or next to the home bounds.
  - Dig sites exclude water, lava, bedrock, and storage blocks.
- **Failure modes:**
  - Disconnect or blocked action: stop the skill and reconnect with backoff.
- **Tests:**
  - Adapter contract tests with mocked mineflayer and rate-limit cases.
- **Metrics:**
  - `bot_runtime_shelter_inspector_errors_total`
  - `bot_runtime_shelter_inspector_latency_ms`

### `bot-runtime.reach-rate-guard` — Reach and Rate Guard

- **Responsibility:** Reject impossible reach and enforce configurable action rates.
- **Owner path:** `apps/bot/src/reach-rate-guard`
- **Provides:** `bot-runtime.reach-rate-guard.interface`
- **Requires:** `config.config-schema-validator`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 1
- **Invariants:**
  - Validation is pure and deterministic; the same input yields the same verdict.
  - Invalid input is rejected with a typed reason and causes no partial mutation.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `bot_runtime_reach_rate_guard_errors_total`
  - `bot_runtime_reach_rate_guard_latency_ms`

### `bot-runtime.action-executor` — Action Executor

- **Responsibility:** Execute only safety-approved place, break, use, attack, and movement actions.
- **Owner path:** `apps/bot/src/action-executor`
- **Provides:** `bot-runtime.action-executor.interface`
- **Requires:** `bot-runtime.connection-lifecycle`, `bot-runtime.reach-rate-guard`, `safety.action-veto-gate`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 1
- **Invariants:**
  - The action executor is the only path to mineflayer and enforces reach and action-rate limits.
- **Failure modes:**
  - Disconnect or blocked action: stop the skill and reconnect with backoff.
- **Tests:**
  - Adapter contract tests with mocked mineflayer and rate-limit cases.
- **Metrics:**
  - `bot_runtime_action_executor_errors_total`
  - `bot_runtime_action_executor_latency_ms`

### `bot-runtime.building-execution-service` — Building Execution Service

- **Responsibility:** Prepare, verify, journal, and complete block changes for construction skills.
- **Owner path:** `apps/bot/src/building-execution-service`
- **Provides:** `bot-runtime.building-execution-service.interface`
- **Requires:** `building.block-executor`, `building.rollback-journal`, `safety.action-veto-gate`, `bot-runtime.world-cache-adapter`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Block changes are verified before and after execution and journaled with attribution.
  - Claim fencing tokens are required whenever a claim id is present.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `bot_runtime_building_execution_service_errors_total`
  - `bot_runtime_building_execution_service_latency_ms`

### `bot-runtime.blueprint-fetch-client` — Blueprint Fetch Client

- **Responsibility:** Fetch and cache exact blueprint document revisions from the coordinator.
- **Owner path:** `apps/bot/src/blueprint-fetch-client`
- **Provides:** `bot-runtime.blueprint-fetch-client.interface`
- **Requires:** `transport.message-schema-registry`, `transport.request-correlator`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Blueprint fetches require an exact id and revision and never fall back to the latest revision.
  - Fetched documents are hash-checked before caching.
- **Failure modes:**
  - Disconnect or blocked action: stop the skill and reconnect with backoff.
- **Tests:**
  - Adapter contract tests with mocked mineflayer and rate-limit cases.
- **Metrics:**
  - `bot_runtime_blueprint_fetch_client_errors_total`
  - `bot_runtime_blueprint_fetch_client_latency_ms`

### `bot-runtime.construction-source` — Construction Source

- **Responsibility:** Derive site, foundation, dependency, package, scaffold, and replacement operations for a fetched blueprint.
- **Owner path:** `apps/bot/src/construction-source`
- **Provides:** `bot-runtime.construction-source.interface`
- **Requires:** `building.construction-plan-planner`, `building.site-planner`, `bot-runtime.world-cache-adapter`, `bot-runtime.blueprint-fetch-client`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 6
- **Invariants:**
  - Construction planning starts from a cached exact blueprint revision.
  - Mismatched existing blocks become break-then-place operations.
- **Failure modes:**
  - Unreachable target or missing material: pause the package and request refill or replan.
- **Tests:**
  - Blueprint diff, ordering, idempotency, and rollback tests.
- **Metrics:**
  - `bot_runtime_construction_source_errors_total`
  - `bot_runtime_construction_source_latency_ms`

### `bot-runtime.state-digest-collector` — State Digest Collector

- **Responsibility:** Collect health, food, time, biome, y-level, target, inventory, hazards, and skill progress.
- **Owner path:** `apps/bot/src/state-digest-collector`
- **Provides:** `bot-runtime.state-digest-collector.interface`
- **Requires:** `bot-runtime.world-cache-adapter`, `bot-runtime.connection-lifecycle`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 1
- **Invariants:**
  - The adapter is the only path to mineflayer; higher tiers issue typed actions only.
  - Reach and action-rate guards run before every physical action.
- **Failure modes:**
  - Disconnect or blocked action: stop the skill and reconnect with backoff.
- **Tests:**
  - Adapter contract tests with mocked mineflayer and rate-limit cases.
- **Metrics:**
  - `bot_runtime_state_digest_collector_errors_total`
  - `bot_runtime_state_digest_collector_latency_ms`

### `bot-runtime.guardian-hook` — Guardian Hook

- **Responsibility:** Connect the local reflex guardian to the action veto gate on every tick.
- **Owner path:** `apps/bot/src/guardian-hook`
- **Provides:** `bot-runtime.guardian-hook.interface`
- **Requires:** `brains.reflex-guardian-loop`, `safety.action-veto-gate`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 1
- **Invariants:**
  - Validation is pure and deterministic; the same input yields the same verdict.
  - Invalid input is rejected with a typed reason and causes no partial mutation.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `bot_runtime_guardian_hook_errors_total`
  - `bot_runtime_guardian_hook_latency_ms`

### `bot-runtime.skill-host` — Skill Host

- **Responsibility:** Host the skill runtime inside the bot process and step active skills.
- **Owner path:** `apps/bot/src/skill-host`
- **Provides:** `bot-runtime.skill-host.interface`
- **Requires:** `skill-runtime.tick-scheduler`, `skill-runtime.lifecycle-executor`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 1
- **Invariants:**
  - The adapter is the only path to mineflayer; higher tiers issue typed actions only.
  - Reach and action-rate guards run before every physical action.
- **Failure modes:**
  - Disconnect or blocked action: stop the skill and reconnect with backoff.
- **Tests:**
  - Adapter contract tests with mocked mineflayer and rate-limit cases.
- **Metrics:**
  - `bot_runtime_skill_host_errors_total`
  - `bot_runtime_skill_host_latency_ms`

### `bot-runtime.perception-host` — Perception Host

- **Responsibility:** Host the perception sampler and detector pipeline inside the bot process.
- **Owner path:** `apps/bot/src/perception-host`
- **Provides:** `bot-runtime.perception-host.interface`
- **Requires:** `perception.ring-sampler`, `perception.detector-pipeline`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 1
- **Invariants:**
  - The adapter is the only path to mineflayer; higher tiers issue typed actions only.
  - Reach and action-rate guards run before every physical action.
- **Failure modes:**
  - Disconnect or blocked action: stop the skill and reconnect with backoff.
- **Tests:**
  - Adapter contract tests with mocked mineflayer and rate-limit cases.
- **Metrics:**
  - `bot_runtime_perception_host_errors_total`
  - `bot_runtime_perception_host_latency_ms`

### `bot-runtime.agent-loop` — Agent Loop

- **Responsibility:** Run the local agency tick, decide between personal goals and jobs, and drive intention execution through skills.
- **Owner path:** `apps/bot/src/agent-loop`
- **Provides:** `bot-runtime.agent-loop.interface`
- **Requires:** `agency.agency-state`, `agency.goal-arbiter`, `agency.goal-generator`, `agency.intention-manager`, `agency.routine-model`, `brains.laya-client`, `brains.deterministic-policy`, `bot-runtime.state-digest-collector`, `bot-runtime.skill-host`
- **Owns state:** none
- **Source refs:** `main.md#20-agency-and-motivation`
- **Milestone:** 12
- **Invariants:**
  - The agent loop never blocks the 20Hz guardian and never calls mineflayer directly.
  - Urgent needs preempt jobs and personal goals; the guardian preempts everything.
  - No job is accepted without a local utility decision and a valid lease.
- **Failure modes:**
  - Model or profile unavailable: use the deterministic utility policy and record the downgrade.
- **Tests:**
  - Affordance enumeration, utility fallback, and Laya-client timeout tests.
- **Metrics:**
  - `bot_runtime_agent_loop_errors_total`
  - `bot_runtime_agent_loop_latency_ms`
  - `bot_runtime_self_initiated_goals_total`
  - `bot_runtime_idle_milliseconds`

### `bot-runtime.chat-adapter` — Chat Adapter

- **Responsibility:** Send and receive typed social messages through mineflayer chat with rate limits and no physical actions.
- **Owner path:** `apps/bot/src/chat`
- **Provides:** `bot-runtime.chat-adapter.interface`
- **Requires:** `agency.social-engine`, `bot-runtime.connection-lifecycle`
- **Owns state:** none
- **Source refs:** `main.md#21-social-behavior`
- **Milestone:** 14
- **Invariants:**
  - Chat never triggers a physical action directly and never echoes arbitrary input.
  - Chat is rate-limited per bot and can be muted by ops.
- **Failure modes:**
  - Disconnect or blocked action: stop the skill and reconnect with backoff.
- **Tests:**
  - Adapter contract tests with mocked mineflayer and rate-limit cases.
- **Metrics:**
  - `bot_runtime_chat_adapter_errors_total`
  - `bot_runtime_chat_messages_total`
  - `bot_runtime_chat_rate_limited_total`

### `bot-runtime.agency-state-adapter` — Agency State Adapter

- **Responsibility:** Load and persist agency snapshots through coordinator state and reconcile intention with the observed world.
- **Owner path:** `apps/bot/src/agency-state-adapter`
- **Provides:** `bot-runtime.agency-state-adapter.interface`
- **Requires:** `agency.agency-state`, `transport.ws-codec`
- **Owns state:** none
- **Source refs:** `main.md#20-agency-and-motivation`
- **Milestone:** 12
- **Invariants:**
  - Restored intentions are validated against the observed world before resuming.
  - Agency state writes go through coordinator persistence, never local SQLite.
- **Failure modes:**
  - Model or profile unavailable: use the deterministic utility policy and record the downgrade.
- **Tests:**
  - Affordance enumeration, utility fallback, and Laya-client timeout tests.
- **Metrics:**
  - `bot_runtime_agency_state_adapter_errors_total`
  - `bot_runtime_agency_state_adapter_latency_ms`

### `bot-runtime.reconnect-supervisor` — Reconnect Supervisor

- **Responsibility:** Reconnect after disconnect and trigger delta resync and resume.
- **Owner path:** `apps/bot/src/reconnect-supervisor`
- **Provides:** `bot-runtime.reconnect-supervisor.interface`
- **Requires:** `bot-runtime.connection-lifecycle`, `transport.reconnect`, `bots.delta-sync-planner`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 1
- **Invariants:**
  - The adapter is the only path to mineflayer; higher tiers issue typed actions only.
  - Reach and action-rate guards run before every physical action.
- **Failure modes:**
  - Disconnect or blocked action: stop the skill and reconnect with backoff.
- **Tests:**
  - Adapter contract tests with mocked mineflayer and rate-limit cases.
- **Metrics:**
  - `bot_runtime_reconnect_supervisor_errors_total`
  - `bot_runtime_reconnect_supervisor_latency_ms`

---

## Autonomy and Safety

- **ID:** `sys.safety`
- **Owner package:** `packages/safety/src`
- **Milestone:** 4
- **Source refs:** `main.md#11-autonomy-loop-and-safety`
- **Allowed cross-system dependencies:** `sys.transport`
- **Forbidden dependencies:** none

**Purpose.** Guarantee deterministic survival reflexes, safety invariants, and veto authority over all actions.

**System invariants.**
- Guardian priority is always above Laya and planner.
- No destructive action executes without passing the veto gate.
- No fire, lava, or TNT unless explicitly enabled.

### Components

| ID | Component | Responsibility | Owner path | Milestone |
|---|---|---|---|---:|
| `safety.hazard-evaluator` | Hazard Evaluator | Detect lava, void, fall, and drowning risk from the current world snapshot. | `packages/safety/src/hazard-evaluator` | 4 |
| `safety.mob-threat-evaluator` | Mob Threat Evaluator | Detect hostile mobs, threat distance, and escape options. | `packages/safety/src/mob-threat-evaluator` | 4 |
| `safety.hunger-evaluator` | Hunger Evaluator | Detect critical hunger and food availability from the bot snapshot. | `packages/safety/src/hunger-evaluator` | 4 |
| `safety.stuck-timeout-evaluator` | Stuck and Timeout Evaluator | Detect stuck movement, path timeout, and unreachable targets. | `packages/safety/src/stuck-evaluator` | 4 |
| `safety.inventory-evaluator` | Inventory Evaluator | Detect full inventory or missing required tools and materials. | `packages/safety/src/inventory-evaluator` | 4 |
| `safety.claim-loss-evaluator` | Claim Loss Evaluator | Detect lost or expired claims and stop work that no longer owns its resource. | `packages/safety/src/claim-loss-evaluator` | 4 |
| `safety.protected-bbox-rule` | Protected BBox Rule | Reject actions inside protected, no-build, or active work-package bounding boxes. | `packages/safety/src/rules` | 4 |
| `safety.active-bot-support-rule` | Active Bot Support Rule | Reject breaking blocks that support or occupy an online bot. | `packages/safety/src/rules` | 4 |
| `safety.material-ban-rule` | Material Ban Rule | Reject fire, lava, TNT, and other banned materials unless explicitly enabled. | `packages/safety/src/rules` | 4 |
| `safety.safety-policy-engine` | Safety Policy Engine | Evaluate protected bboxes, support rules, active-bot exclusion, and material bans. | `packages/safety/src/safety-policy-engine` | 4 |
| `safety.action-veto-gate` | Action Veto Gate | Reject any action that fails guardian, safety policy, claim, or grant validation. | `packages/safety/src/action-veto-gate` | 4 |
| `safety.recovery-ladder` | Recovery Ladder | Escalate from local retry to Laya alternative, planner replan, safe mode, then emergency stop. | `packages/safety/src/recovery-ladder` | 4 |
| `safety.emergency-stop-controller` | Emergency Stop Controller | Stop a bot or the fleet safely and require explicit resume. | `packages/safety/src/emergency-stop-controller` | 4 |
| `safety.incident-journal` | Incident Journal | Record safety incidents, vetoes, and recovery escalation with actor context. | `packages/safety/src/incident-journal` | 4 |

### `safety.hazard-evaluator` — Hazard Evaluator

- **Responsibility:** Detect lava, void, fall, and drowning risk from the current world snapshot.
- **Owner path:** `packages/safety/src/hazard-evaluator`
- **Provides:** `safety.hazard-evaluator.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#11-autonomy-loop-and-safety`
- **Milestone:** 4
- **Invariants:**
  - Guardian evaluation runs at 20Hz and outranks Laya and the planner.
  - No destructive action executes without passing the veto gate.
- **Failure modes:**
  - Hazard detected: veto the action, record the incident, and enter the recovery ladder.
- **Tests:**
  - Guardian invariant tests per hazard class and veto precedence.
- **Metrics:**
  - `safety_hazard_evaluator_errors_total`
  - `safety_hazard_evaluator_latency_ms`

### `safety.mob-threat-evaluator` — Mob Threat Evaluator

- **Responsibility:** Detect hostile mobs, threat distance, and escape options.
- **Owner path:** `packages/safety/src/mob-threat-evaluator`
- **Provides:** `safety.mob-threat-evaluator.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#11-autonomy-loop-and-safety`
- **Milestone:** 4
- **Invariants:**
  - Guardian evaluation runs at 20Hz and outranks Laya and the planner.
  - No destructive action executes without passing the veto gate.
- **Failure modes:**
  - Hazard detected: veto the action, record the incident, and enter the recovery ladder.
- **Tests:**
  - Guardian invariant tests per hazard class and veto precedence.
- **Metrics:**
  - `safety_mob_threat_evaluator_errors_total`
  - `safety_mob_threat_evaluator_latency_ms`

### `safety.hunger-evaluator` — Hunger Evaluator

- **Responsibility:** Detect critical hunger and food availability from the bot snapshot.
- **Owner path:** `packages/safety/src/hunger-evaluator`
- **Provides:** `safety.hunger-evaluator.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#11-autonomy-loop-and-safety`
- **Milestone:** 4
- **Invariants:**
  - Guardian evaluation runs at 20Hz and outranks Laya and the planner.
  - No destructive action executes without passing the veto gate.
- **Failure modes:**
  - Hazard detected: veto the action, record the incident, and enter the recovery ladder.
- **Tests:**
  - Guardian invariant tests per hazard class and veto precedence.
- **Metrics:**
  - `safety_hunger_evaluator_errors_total`
  - `safety_hunger_evaluator_latency_ms`

### `safety.stuck-timeout-evaluator` — Stuck and Timeout Evaluator

- **Responsibility:** Detect stuck movement, path timeout, and unreachable targets.
- **Owner path:** `packages/safety/src/stuck-evaluator`
- **Provides:** `safety.stuck-timeout-evaluator.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#11-autonomy-loop-and-safety`
- **Milestone:** 4
- **Invariants:**
  - Guardian evaluation runs at 20Hz and outranks Laya and the planner.
  - No destructive action executes without passing the veto gate.
- **Failure modes:**
  - Hazard detected: veto the action, record the incident, and enter the recovery ladder.
- **Tests:**
  - Guardian invariant tests per hazard class and veto precedence.
- **Metrics:**
  - `safety_stuck_timeout_evaluator_errors_total`
  - `safety_stuck_timeout_evaluator_latency_ms`

### `safety.inventory-evaluator` — Inventory Evaluator

- **Responsibility:** Detect full inventory or missing required tools and materials.
- **Owner path:** `packages/safety/src/inventory-evaluator`
- **Provides:** `safety.inventory-evaluator.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#11-autonomy-loop-and-safety`
- **Milestone:** 4
- **Invariants:**
  - Guardian evaluation runs at 20Hz and outranks Laya and the planner.
  - No destructive action executes without passing the veto gate.
- **Failure modes:**
  - Hazard detected: veto the action, record the incident, and enter the recovery ladder.
- **Tests:**
  - Guardian invariant tests per hazard class and veto precedence.
- **Metrics:**
  - `safety_inventory_evaluator_errors_total`
  - `safety_inventory_evaluator_latency_ms`

### `safety.claim-loss-evaluator` — Claim Loss Evaluator

- **Responsibility:** Detect lost or expired claims and stop work that no longer owns its resource.
- **Owner path:** `packages/safety/src/claim-loss-evaluator`
- **Provides:** `safety.claim-loss-evaluator.interface`
- **Requires:** `claims.claim-repository`
- **Owns state:** none
- **Source refs:** `main.md#11-autonomy-loop-and-safety`
- **Milestone:** 4
- **Invariants:**
  - Losing a claim or edit grant immediately stops work that depends on it.
- **Failure modes:**
  - Hazard detected: veto the action, record the incident, and enter the recovery ladder.
- **Tests:**
  - Guardian invariant tests per hazard class and veto precedence.
- **Metrics:**
  - `safety_claim_loss_evaluator_errors_total`
  - `safety_claim_loss_evaluator_latency_ms`

### `safety.protected-bbox-rule` — Protected BBox Rule

- **Responsibility:** Reject actions inside protected, no-build, or active work-package bounding boxes.
- **Owner path:** `packages/safety/src/rules`
- **Provides:** `safety.protected-bbox-rule.interface`
- **Requires:** `sip.rules-store`, `claims.claim-repository`
- **Owns state:** none
- **Source refs:** `main.md#11-autonomy-loop-and-safety`
- **Milestone:** 4
- **Invariants:**
  - Validation is pure and deterministic; the same input yields the same verdict.
  - Invalid input is rejected with a typed reason and causes no partial mutation.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `safety_protected_bbox_rule_errors_total`
  - `safety_protected_bbox_rule_latency_ms`

### `safety.active-bot-support-rule` — Active Bot Support Rule

- **Responsibility:** Reject breaking blocks that support or occupy an online bot.
- **Owner path:** `packages/safety/src/rules`
- **Provides:** `safety.active-bot-support-rule.interface`
- **Requires:** `world.spatial-query-engine`, `claims.claim-repository`
- **Owns state:** none
- **Source refs:** `main.md#11-autonomy-loop-and-safety`
- **Milestone:** 4
- **Invariants:**
  - Blocks supporting an online bot are never broken.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `safety_active_bot_support_rule_errors_total`
  - `safety_active_bot_support_rule_latency_ms`

### `safety.material-ban-rule` — Material Ban Rule

- **Responsibility:** Reject fire, lava, TNT, and other banned materials unless explicitly enabled.
- **Owner path:** `packages/safety/src/rules`
- **Provides:** `safety.material-ban-rule.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#11-autonomy-loop-and-safety`
- **Milestone:** 4
- **Invariants:**
  - Fire, lava, and TNT are forbidden unless explicitly enabled in configuration.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `safety_material_ban_rule_errors_total`
  - `safety_material_ban_rule_latency_ms`

### `safety.safety-policy-engine` — Safety Policy Engine

- **Responsibility:** Evaluate protected bboxes, support rules, active-bot exclusion, and material bans.
- **Owner path:** `packages/safety/src/safety-policy-engine`
- **Provides:** `safety.safety-policy-engine.interface`
- **Requires:** `safety.protected-bbox-rule`, `safety.active-bot-support-rule`, `safety.material-ban-rule`
- **Owns state:** none
- **Source refs:** `main.md#11-autonomy-loop-and-safety`
- **Milestone:** 4
- **Invariants:**
  - Guardian evaluation runs at 20Hz and outranks Laya and the planner.
  - No destructive action executes without passing the veto gate.
- **Failure modes:**
  - Hazard detected: veto the action, record the incident, and enter the recovery ladder.
- **Tests:**
  - Guardian invariant tests per hazard class and veto precedence.
- **Metrics:**
  - `safety_safety_policy_engine_errors_total`
  - `safety_safety_policy_engine_latency_ms`

### `safety.action-veto-gate` — Action Veto Gate

- **Responsibility:** Reject any action that fails guardian, safety policy, claim, or grant validation.
- **Owner path:** `packages/safety/src/action-veto-gate`
- **Provides:** `safety.action-veto-gate.interface`
- **Requires:** `safety.safety-policy-engine`, `brains.reflex-guardian-loop`
- **Owns state:** none
- **Source refs:** `main.md#11-autonomy-loop-and-safety`
- **Milestone:** 4
- **Invariants:**
  - Guardian has final veto over Laya and planner actions.
  - No destructive or mineflayer-bound action executes without passing the gate.
- **Failure modes:**
  - Hazard detected: veto the action, record the incident, and enter the recovery ladder.
- **Tests:**
  - Guardian invariant tests per hazard class and veto precedence.
- **Metrics:**
  - `safety_action_veto_gate_errors_total`
  - `safety_action_veto_gate_latency_ms`

### `safety.recovery-ladder` — Recovery Ladder

- **Responsibility:** Escalate from local retry to Laya alternative, planner replan, safe mode, then emergency stop.
- **Owner path:** `packages/safety/src/recovery-ladder`
- **Provides:** `safety.recovery-ladder.interface`
- **Requires:** `transport.event-stream`, `core.command-router`
- **Owns state:** none
- **Source refs:** `main.md#11-autonomy-loop-and-safety`
- **Milestone:** 4
- **Invariants:**
  - Guardian evaluation runs at 20Hz and outranks Laya and the planner.
  - No destructive action executes without passing the veto gate.
- **Failure modes:**
  - Hazard detected: veto the action, record the incident, and enter the recovery ladder.
- **Tests:**
  - Guardian invariant tests per hazard class and veto precedence.
- **Metrics:**
  - `safety_recovery_ladder_errors_total`
  - `safety_recovery_ladder_latency_ms`

### `safety.emergency-stop-controller` — Emergency Stop Controller

- **Responsibility:** Stop a bot or the fleet safely and require explicit resume.
- **Owner path:** `packages/safety/src/emergency-stop-controller`
- **Provides:** `safety.emergency-stop-controller.interface`
- **Requires:** `transport.event-stream`, `core.command-router`
- **Owns state:** none
- **Source refs:** `main.md#11-autonomy-loop-and-safety`
- **Milestone:** 4
- **Invariants:**
  - Guardian evaluation runs at 20Hz and outranks Laya and the planner.
  - No destructive action executes without passing the veto gate.
- **Failure modes:**
  - Hazard detected: veto the action, record the incident, and enter the recovery ladder.
- **Tests:**
  - Guardian invariant tests per hazard class and veto precedence.
- **Metrics:**
  - `safety_emergency_stop_controller_errors_total`
  - `safety_emergency_stop_controller_latency_ms`

### `safety.incident-journal` — Incident Journal

- **Responsibility:** Record safety incidents, vetoes, and recovery escalation with actor context.
- **Owner path:** `packages/safety/src/incident-journal`
- **Provides:** `safety.incident-journal.interface`
- **Requires:** `memory.event-log-writer`
- **Owns state:** none
- **Source refs:** `main.md#11-autonomy-loop-and-safety`
- **Milestone:** 4
- **Invariants:**
  - Guardian evaluation runs at 20Hz and outranks Laya and the planner.
  - No destructive action executes without passing the veto gate.
- **Failure modes:**
  - Hazard detected: veto the action, record the incident, and enter the recovery ladder.
- **Tests:**
  - Guardian invariant tests per hazard class and veto precedence.
- **Metrics:**
  - `safety_incident_journal_errors_total`
  - `safety_incident_journal_latency_ms`

---

## Memory and Persistence

- **ID:** `sys.memory`
- **Owner package:** `packages/memory/src`
- **Milestone:** 1
- **Source refs:** `main.md#12-memory-and-persistence`
- **Allowed cross-system dependencies:** none
- **Forbidden dependencies:** none

**Purpose.** Provide SQLite WAL persistence, migrations, transactions, logs, changelogs, and retention.

**System invariants.**
- All domain writes use repositories and coordinator-owned transactions.
- Event log and block changelog are append-only.
- Retention prunes only expired logs; state persists until manual pruning.

### Components

| ID | Component | Responsibility | Owner path | Milestone |
|---|---|---|---|---:|
| `memory.sqlite-runtime` | SQLite Runtime | Open SQLite in WAL mode with bounded connections and busy timeout. | `packages/memory/src/sqlite-runtime` | 1 |
| `memory.migration-runner` | Migration Runner | Apply versioned migrations deterministically and record schema version. | `packages/memory/src/migration-runner` | 1 |
| `memory.transaction-manager` | Transaction Manager | Provide atomic transactions and fail-closed rollback for domain commits. | `packages/memory/src/transaction-manager` | 1 |
| `memory.event-log-writer` | Event Log Writer | Append normalized domain events with actor, timestamp, and causation ID. | `packages/memory/src/event-log-writer` | 1 |
| `memory.block-changelog-writer` | Block Changelog Writer | Append block before/after images with grant, claim, and rollback metadata. | `packages/memory/src/block-changelog-writer` | 1 |
| `memory.retention-pruner` | Retention Pruner | Prune event logs and block changelogs after 30 days without touching current state. | `packages/memory/src/retention-pruner` | 1 |
| `memory.snapshot-export` | Snapshot Export | Export consistent snapshots for backup, replay, and evaluation. | `packages/memory/src/snapshot-export` | 1 |
| `memory.schema-version-registry` | Schema Version Registry | Track and validate the applied database schema version. | `packages/memory/src/schema-version-registry` | 1 |
| `memory.episode-store` | Episode Store | Persist task episodes and outcome traces for replay, evaluation, and training export. | `packages/memory/src/episode-store` | 1 |
| `memory.agent-episode-repository` | Agent Episode Repository | Persist append-only episodic memories for needs, intentions, discoveries, deaths, gifts, chats, and goal outcomes. | `packages/memory/src/agent-episode-repository` | 12 |

### `memory.sqlite-runtime` — SQLite Runtime

- **Responsibility:** Open SQLite in WAL mode with bounded connections and busy timeout.
- **Owner path:** `packages/memory/src/sqlite-runtime`
- **Provides:** `memory.sqlite-runtime.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#12-memory-and-persistence`
- **Milestone:** 1
- **Invariants:**
  - All domain writes go through repositories and coordinator-owned transactions.
  - Event logs and block changelogs are append-only.
- **Failure modes:**
  - SQLite or migration failure: fail closed at startup, or abort the write at runtime.
- **Tests:**
  - Migration, WAL mode, retention, and append-only tests.
- **Metrics:**
  - `memory_sqlite_runtime_errors_total`
  - `memory_sqlite_runtime_latency_ms`

### `memory.migration-runner` — Migration Runner

- **Responsibility:** Apply versioned migrations deterministically and record schema version.
- **Owner path:** `packages/memory/src/migration-runner`
- **Provides:** `memory.migration-runner.interface`
- **Requires:** `memory.sqlite-runtime`
- **Owns state:** none
- **Source refs:** `main.md#12-memory-and-persistence`
- **Milestone:** 1
- **Invariants:**
  - All domain writes go through repositories and coordinator-owned transactions.
  - Event logs and block changelogs are append-only.
- **Failure modes:**
  - SQLite or migration failure: fail closed at startup, or abort the write at runtime.
- **Tests:**
  - Migration, WAL mode, retention, and append-only tests.
- **Metrics:**
  - `memory_migration_runner_errors_total`
  - `memory_migration_runner_latency_ms`

### `memory.transaction-manager` — Transaction Manager

- **Responsibility:** Provide atomic transactions and fail-closed rollback for domain commits.
- **Owner path:** `packages/memory/src/transaction-manager`
- **Provides:** `memory.transaction-manager.interface`
- **Requires:** `memory.sqlite-runtime`
- **Owns state:** none
- **Source refs:** `main.md#12-memory-and-persistence`
- **Milestone:** 1
- **Invariants:**
  - All domain writes go through repositories and coordinator-owned transactions.
  - Event logs and block changelogs are append-only.
- **Failure modes:**
  - SQLite or migration failure: fail closed at startup, or abort the write at runtime.
- **Tests:**
  - Migration, WAL mode, retention, and append-only tests.
- **Metrics:**
  - `memory_transaction_manager_errors_total`
  - `memory_transaction_manager_latency_ms`

### `memory.event-log-writer` — Event Log Writer

- **Responsibility:** Append normalized domain events with actor, timestamp, and causation ID.
- **Owner path:** `packages/memory/src/event-log-writer`
- **Provides:** `memory.event-log-writer.interface`
- **Requires:** `memory.transaction-manager`
- **Owns state:** `bot_events`
- **Source refs:** `main.md#12-memory-and-persistence`
- **Milestone:** 1
- **Invariants:**
  - bot_events is append-only and records decisions, task transitions, grants, and failures with actor and timestamp.
- **Failure modes:**
  - SQLite or migration failure: fail closed at startup, or abort the write at runtime.
- **Tests:**
  - Migration, WAL mode, retention, and append-only tests.
- **Metrics:**
  - `memory_event_log_writer_errors_total`
  - `memory_event_log_writer_latency_ms`

### `memory.block-changelog-writer` — Block Changelog Writer

- **Responsibility:** Append block before/after images with grant, claim, and rollback metadata.
- **Owner path:** `packages/memory/src/block-changelog-writer`
- **Provides:** `memory.block-changelog-writer.interface`
- **Requires:** `memory.transaction-manager`
- **Owns state:** `block_changelog`
- **Source refs:** `main.md#12-memory-and-persistence`
- **Milestone:** 1
- **Invariants:**
  - All domain writes go through repositories and coordinator-owned transactions.
  - Event logs and block changelogs are append-only.
- **Failure modes:**
  - SQLite or migration failure: fail closed at startup, or abort the write at runtime.
- **Tests:**
  - Migration, WAL mode, retention, and append-only tests.
- **Metrics:**
  - `memory_block_changelog_writer_errors_total`
  - `memory_block_changelog_writer_latency_ms`

### `memory.retention-pruner` — Retention Pruner

- **Responsibility:** Prune event logs and block changelogs after 30 days without touching current state.
- **Owner path:** `packages/memory/src/retention-pruner`
- **Provides:** `memory.retention-pruner.interface`
- **Requires:** `memory.transaction-manager`, `memory.event-log-writer`, `memory.block-changelog-writer`
- **Owns state:** none
- **Source refs:** `main.md#12-memory-and-persistence`
- **Milestone:** 1
- **Invariants:**
  - Event logs and block changelogs are pruned after 30 days; current SQLite state is never pruned automatically.
- **Failure modes:**
  - SQLite or migration failure: fail closed at startup, or abort the write at runtime.
- **Tests:**
  - Migration, WAL mode, retention, and append-only tests.
- **Metrics:**
  - `memory_retention_pruner_errors_total`
  - `memory_retention_pruner_latency_ms`

### `memory.snapshot-export` — Snapshot Export

- **Responsibility:** Export consistent snapshots for backup, replay, and evaluation.
- **Owner path:** `packages/memory/src/snapshot-export`
- **Provides:** `memory.snapshot-export.interface`
- **Requires:** `memory.transaction-manager`
- **Owns state:** none
- **Source refs:** `main.md#12-memory-and-persistence`
- **Milestone:** 1
- **Invariants:**
  - All domain writes go through repositories and coordinator-owned transactions.
  - Event logs and block changelogs are append-only.
- **Failure modes:**
  - SQLite or migration failure: fail closed at startup, or abort the write at runtime.
- **Tests:**
  - Migration, WAL mode, retention, and append-only tests.
- **Metrics:**
  - `memory_snapshot_export_errors_total`
  - `memory_snapshot_export_latency_ms`

### `memory.schema-version-registry` — Schema Version Registry

- **Responsibility:** Track and validate the applied database schema version.
- **Owner path:** `packages/memory/src/schema-version-registry`
- **Provides:** `memory.schema-version-registry.interface`
- **Requires:** `memory.migration-runner`
- **Owns state:** none
- **Source refs:** `main.md#12-memory-and-persistence`
- **Milestone:** 1
- **Invariants:**
  - All domain writes go through repositories and coordinator-owned transactions.
  - Event logs and block changelogs are append-only.
- **Failure modes:**
  - SQLite or migration failure: fail closed at startup, or abort the write at runtime.
- **Tests:**
  - Migration, WAL mode, retention, and append-only tests.
- **Metrics:**
  - `memory_schema_version_registry_errors_total`
  - `memory_schema_version_registry_latency_ms`

### `memory.episode-store` — Episode Store

- **Responsibility:** Persist task episodes and outcome traces for replay, evaluation, and training export.
- **Owner path:** `packages/memory/src/episode-store`
- **Provides:** `memory.episode-store.interface`
- **Requires:** `memory.transaction-manager`
- **Owns state:** `episodes`
- **Source refs:** `main.md#12-memory-and-persistence`
- **Milestone:** 1
- **Invariants:**
  - Episodes are append-only outcome traces tied to bot, task, and episode id.
  - Episode retention follows the same 30-day log policy.
- **Failure modes:**
  - SQLite or migration failure: fail closed at startup, or abort the write at runtime.
- **Tests:**
  - Migration, WAL mode, retention, and append-only tests.
- **Metrics:**
  - `memory_episode_store_writes_total`
  - `memory_episode_store_latency_ms`

### `memory.agent-episode-repository` — Agent Episode Repository

- **Responsibility:** Persist append-only episodic memories for needs, intentions, discoveries, deaths, gifts, chats, and goal outcomes.
- **Owner path:** `packages/memory/src/agent-episode-repository`
- **Provides:** `memory.agent-episode-repository.interface`
- **Requires:** `memory.transaction-manager`
- **Owns state:** `agent_episodes`
- **Source refs:** `main.md#20-agency-and-motivation`
- **Milestone:** 12
- **Invariants:**
  - Agent episodes are append-only and tied to bot, goal, and episode id.
  - Episode retention follows the same 30-day log policy.
- **Failure modes:**
  - SQLite or migration failure: fail closed at startup, or abort the write at runtime.
- **Tests:**
  - Migration, WAL mode, retention, and append-only tests.
- **Metrics:**
  - `memory_agent_episode_repository_writes_total`
  - `memory_agent_episode_repository_latency_ms`

---

## Ops and Observability

- **ID:** `sys.ops`
- **Owner package:** `apps/coordinator/src/ops`
- **Milestone:** 11
- **Source refs:** `main.md#1-fleet-coordinator`
- **Allowed cross-system dependencies:** `sys.bots`, `sys.decision`, `sys.memory`, `sys.sip`, `sys.transport`
- **Forbidden dependencies:** none

**Purpose.** Expose fleet status, controls, metrics, logs, health, and audit views.

**System invariants.**
- Ops controls can pause or stop work but cannot bypass safety policy.
- Status and metrics are read-only views over coordinator state.
- Every pause, resume, and emergency stop is audited.

### Components

| ID | Component | Responsibility | Owner path | Milestone |
|---|---|---|---|---:|
| `ops.ops-api` | Ops API | Expose status, pause, resume, stop, SIP dump, and metrics endpoints. | `apps/coordinator/src/ops/ops-api` | 11 |
| `ops.status-aggregator` | Status Aggregator | Aggregate bot, task, claim, grant, SIP, and decision status for operators. | `apps/coordinator/src/ops/status-aggregator` | 11 |
| `ops.agency-status-view` | Agency Status View | Expose current needs, intention, routine, home, goal outcomes, and chat rate per bot. | `apps/coordinator/src/ops/agency-status-view` | 12 |
| `ops.pause-resume-controller` | Pause and Resume Controller | Pause or resume one bot or the fleet without corrupting claims. | `apps/coordinator/src/ops/pause-resume-controller` | 11 |
| `ops.fleet-emergency-stop` | Fleet Emergency Stop | Trigger a fleet-wide safe stop through the safety authority. | `apps/coordinator/src/ops/fleet-emergency-stop` | 11 |
| `ops.sip-dump` | SIP Dump | Render a read-only snapshot of the current SIP revision. | `apps/coordinator/src/ops/sip-dump` | 11 |
| `ops.metrics-registry` | Metrics Registry | Collect counters, gauges, and histograms for tasks, claims, decisions, and safety. | `apps/coordinator/src/ops/metrics-registry` | 11 |
| `ops.structured-logger` | Structured Logger | Emit structured pino logs with bot, task, claim, and trace identifiers. | `apps/coordinator/src/ops/structured-logger` | 11 |
| `ops.health-readiness` | Health and Readiness | Report coordinator, database, model, and transport health for startup and probes. | `apps/coordinator/src/ops/health-readiness` | 11 |
| `ops.audit-viewer` | Audit Viewer | Read event and block changelog views for incident and rollback review. | `apps/coordinator/src/ops/audit-viewer` | 11 |

### `ops.ops-api` — Ops API

- **Responsibility:** Expose status, pause, resume, stop, SIP dump, and metrics endpoints.
- **Owner path:** `apps/coordinator/src/ops/ops-api`
- **Provides:** `ops.ops-api.interface`
- **Requires:** `transport.message-schema-registry`, `ops.status-aggregator`, `ops.agency-status-view`, `ops.pause-resume-controller`, `ops.fleet-emergency-stop`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 11
- **Invariants:**
  - Ops endpoints never mutate domain state except through explicit control components.
  - Metrics and logs are non-blocking; loss is bounded and recorded.
- **Failure modes:**
  - Metrics sink or logger unavailable: drop telemetry without blocking fleet work.
- **Tests:**
  - Endpoint contract, pause/stop, and telemetry-failure tests.
- **Metrics:**
  - `ops_ops_api_errors_total`
  - `ops_ops_api_latency_ms`

### `ops.status-aggregator` — Status Aggregator

- **Responsibility:** Aggregate bot, task, claim, grant, SIP, and decision status for operators.
- **Owner path:** `apps/coordinator/src/ops/status-aggregator`
- **Provides:** `ops.status-aggregator.interface`
- **Requires:** `ops.metrics-registry`, `bots.presence-tracker`, `tasks.task-repository`, `claims.claim-repository`, `sip.revision-manager`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 11
- **Invariants:**
  - Ops endpoints never mutate domain state except through explicit control components.
  - Metrics and logs are non-blocking; loss is bounded and recorded.
- **Failure modes:**
  - Metrics sink or logger unavailable: drop telemetry without blocking fleet work.
- **Tests:**
  - Endpoint contract, pause/stop, and telemetry-failure tests.
- **Metrics:**
  - `ops_status_aggregator_errors_total`
  - `ops_status_aggregator_latency_ms`

### `ops.agency-status-view` — Agency Status View

- **Responsibility:** Expose current needs, intention, routine, home, goal outcomes, and chat rate per bot.
- **Owner path:** `apps/coordinator/src/ops/agency-status-view`
- **Provides:** `ops.agency-status-view.interface`
- **Requires:** `bots.agency-state-store`, `memory.agent-episode-repository`, `bots.presence-tracker`
- **Owns state:** none
- **Source refs:** `main.md#20-agency-and-motivation`
- **Milestone:** 12
- **Invariants:**
  - Agency status is read-only and never mutates needs or intention.
- **Failure modes:**
  - Metrics sink or logger unavailable: drop telemetry without blocking fleet work.
- **Tests:**
  - Endpoint contract, pause/stop, and telemetry-failure tests.
- **Metrics:**
  - `ops_agency_status_view_errors_total`
  - `ops_agency_status_view_latency_ms`

### `ops.pause-resume-controller` — Pause and Resume Controller

- **Responsibility:** Pause or resume one bot or the fleet without corrupting claims.
- **Owner path:** `apps/coordinator/src/ops/pause-resume-controller`
- **Provides:** `ops.pause-resume-controller.interface`
- **Requires:** `transport.event-stream`, `bots.presence-tracker`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 11
- **Invariants:**
  - Ops endpoints never mutate domain state except through explicit control components.
  - Metrics and logs are non-blocking; loss is bounded and recorded.
- **Failure modes:**
  - Metrics sink or logger unavailable: drop telemetry without blocking fleet work.
- **Tests:**
  - Endpoint contract, pause/stop, and telemetry-failure tests.
- **Metrics:**
  - `ops_pause_resume_controller_errors_total`
  - `ops_pause_resume_controller_latency_ms`

### `ops.fleet-emergency-stop` — Fleet Emergency Stop

- **Responsibility:** Trigger a fleet-wide safe stop through the safety authority.
- **Owner path:** `apps/coordinator/src/ops/fleet-emergency-stop`
- **Provides:** `ops.fleet-emergency-stop.interface`
- **Requires:** `transport.event-stream`, `safety.emergency-stop-controller`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 11
- **Invariants:**
  - Fleet emergency stop halts all bots, revokes active action authority, and is itself audited.
- **Failure modes:**
  - Metrics sink or logger unavailable: drop telemetry without blocking fleet work.
- **Tests:**
  - Endpoint contract, pause/stop, and telemetry-failure tests.
- **Metrics:**
  - `ops_fleet_emergency_stop_errors_total`
  - `ops_fleet_emergency_stop_latency_ms`

### `ops.sip-dump` — SIP Dump

- **Responsibility:** Render a read-only snapshot of the current SIP revision.
- **Owner path:** `apps/coordinator/src/ops/sip-dump`
- **Provides:** `ops.sip-dump.interface`
- **Requires:** `sip.revision-manager`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 11
- **Invariants:**
  - Ops endpoints never mutate domain state except through explicit control components.
  - Metrics and logs are non-blocking; loss is bounded and recorded.
- **Failure modes:**
  - Metrics sink or logger unavailable: drop telemetry without blocking fleet work.
- **Tests:**
  - Endpoint contract, pause/stop, and telemetry-failure tests.
- **Metrics:**
  - `ops_sip_dump_errors_total`
  - `ops_sip_dump_latency_ms`

### `ops.metrics-registry` — Metrics Registry

- **Responsibility:** Collect counters, gauges, and histograms for tasks, claims, decisions, and safety.
- **Owner path:** `apps/coordinator/src/ops/metrics-registry`
- **Provides:** `ops.metrics-registry.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 11
- **Invariants:**
  - Ops endpoints never mutate domain state except through explicit control components.
  - Metrics and logs are non-blocking; loss is bounded and recorded.
- **Failure modes:**
  - Metrics sink or logger unavailable: drop telemetry without blocking fleet work.
- **Tests:**
  - Endpoint contract, pause/stop, and telemetry-failure tests.
- **Metrics:**
  - `ops_metrics_registry_errors_total`
  - `ops_metrics_registry_latency_ms`

### `ops.structured-logger` — Structured Logger

- **Responsibility:** Emit structured pino logs with bot, task, claim, and trace identifiers.
- **Owner path:** `apps/coordinator/src/ops/structured-logger`
- **Provides:** `ops.structured-logger.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 11
- **Invariants:**
  - Ops endpoints never mutate domain state except through explicit control components.
  - Metrics and logs are non-blocking; loss is bounded and recorded.
- **Failure modes:**
  - Metrics sink or logger unavailable: drop telemetry without blocking fleet work.
- **Tests:**
  - Endpoint contract, pause/stop, and telemetry-failure tests.
- **Metrics:**
  - `ops_structured_logger_errors_total`
  - `ops_structured_logger_latency_ms`

### `ops.health-readiness` — Health and Readiness

- **Responsibility:** Report coordinator, database, model, and transport health for startup and probes.
- **Owner path:** `apps/coordinator/src/ops/health-readiness`
- **Provides:** `ops.health-readiness.interface`
- **Requires:** `ops.status-aggregator`, `memory.sqlite-runtime`, `decision.model-loader`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 11
- **Invariants:**
  - Ops endpoints never mutate domain state except through explicit control components.
  - Metrics and logs are non-blocking; loss is bounded and recorded.
- **Failure modes:**
  - Metrics sink or logger unavailable: drop telemetry without blocking fleet work.
- **Tests:**
  - Endpoint contract, pause/stop, and telemetry-failure tests.
- **Metrics:**
  - `ops_health_readiness_errors_total`
  - `ops_health_readiness_latency_ms`

### `ops.audit-viewer` — Audit Viewer

- **Responsibility:** Read event and block changelog views for incident and rollback review.
- **Owner path:** `apps/coordinator/src/ops/audit-viewer`
- **Provides:** `ops.audit-viewer.interface`
- **Requires:** `memory.event-log-writer`, `memory.block-changelog-writer`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 11
- **Invariants:**
  - Ops endpoints never mutate domain state except through explicit control components.
  - Metrics and logs are non-blocking; loss is bounded and recorded.
- **Failure modes:**
  - Metrics sink or logger unavailable: drop telemetry without blocking fleet work.
- **Tests:**
  - Endpoint contract, pause/stop, and telemetry-failure tests.
- **Metrics:**
  - `ops_audit_viewer_errors_total`
  - `ops_audit_viewer_latency_ms`

---

## Config and Profiles

- **ID:** `sys.config`
- **Owner package:** `packages/core/src/config`
- **Milestone:** 1
- **Source refs:** `main.md#13-repo-layout`
- **Allowed cross-system dependencies:** none
- **Forbidden dependencies:** none

**Purpose.** Validate environment, hardware profiles, secrets, bot names, and Laya runtime settings at startup.

**System invariants.**
- Config is loaded once at startup and validated before services start.
- No component reads process.env directly outside the config loader.
- Missing secrets or invalid profiles fail fast with an actionable error.

### Components

| ID | Component | Responsibility | Owner path | Milestone |
|---|---|---|---|---:|
| `config.env-parser` | Environment Parser | Parse environment variables and optional config/.env without logging secrets. | `packages/core/src/config/env-parser` | 1 |
| `config.config-schema-validator` | Config Schema Validator | Validate the merged config against the versioned schema. | `packages/core/src/config/config-schema-validator` | 1 |
| `config.profile-resolver` | Profile Resolver | Resolve home-min or home-full profile values and apply defaults. | `packages/core/src/config/profile-resolver` | 1 |
| `config.hardware-probe` | Hardware Probe | Probe CPU, memory, and WebGPU availability for runtime selection. | `packages/core/src/config/hardware-probe` | 1 |
| `config.secrets-loader` | Secrets Loader | Load planner base URL and API key from process env or gitignored config/.env. | `packages/core/src/config/secrets-loader` | 1 |
| `config.name-pool-validator` | Name Pool Validator | Validate that the ordered bot name pool is long enough for bot count. | `packages/core/src/config/name-pool-validator` | 1 |
| `config.laya-runtime-resolver` | Laya Runtime Resolver | Resolve execution providers and thread counts for the active profile. | `packages/core/src/config/laya-runtime-resolver` | 1 |
| `config.fail-fast-handler` | Fail Fast Handler | Abort startup with a precise reason when required config is missing or invalid. | `packages/core/src/config/fail-fast-handler` | 1 |

### `config.env-parser` — Environment Parser

- **Responsibility:** Parse environment variables and optional config/.env without logging secrets.
- **Owner path:** `packages/core/src/config/env-parser`
- **Provides:** `config.env-parser.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#13-repo-layout`
- **Milestone:** 1
- **Invariants:**
  - Configuration is validated once at startup; missing secrets fail fast.
  - No component reads process.env outside the config loader.
- **Failure modes:**
  - Missing or invalid configuration: exit non-zero with an actionable error.
- **Tests:**
  - Profile matrix, missing-secret, and schema-validation tests.
- **Metrics:**
  - `config_env_parser_errors_total`
  - `config_env_parser_latency_ms`

### `config.config-schema-validator` — Config Schema Validator

- **Responsibility:** Validate the merged config against the versioned schema.
- **Owner path:** `packages/core/src/config/config-schema-validator`
- **Provides:** `config.config-schema-validator.interface`
- **Requires:** `config.env-parser`
- **Owns state:** none
- **Source refs:** `main.md#13-repo-layout`
- **Milestone:** 1
- **Invariants:**
  - Validation is pure and deterministic; the same input yields the same verdict.
  - Invalid input is rejected with a typed reason and causes no partial mutation.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `config_config_schema_validator_errors_total`
  - `config_config_schema_validator_latency_ms`

### `config.profile-resolver` — Profile Resolver

- **Responsibility:** Resolve home-min or home-full profile values and apply defaults.
- **Owner path:** `packages/core/src/config/profile-resolver`
- **Provides:** `config.profile-resolver.interface`
- **Requires:** `config.config-schema-validator`
- **Owns state:** none
- **Source refs:** `main.md#13-repo-layout`
- **Milestone:** 1
- **Invariants:**
  - Configuration is validated once at startup; missing secrets fail fast.
  - No component reads process.env outside the config loader.
- **Failure modes:**
  - Missing or invalid configuration: exit non-zero with an actionable error.
- **Tests:**
  - Profile matrix, missing-secret, and schema-validation tests.
- **Metrics:**
  - `config_profile_resolver_errors_total`
  - `config_profile_resolver_latency_ms`

### `config.hardware-probe` — Hardware Probe

- **Responsibility:** Probe CPU, memory, and WebGPU availability for runtime selection.
- **Owner path:** `packages/core/src/config/hardware-probe`
- **Provides:** `config.hardware-probe.interface`
- **Requires:** `config.profile-resolver`, `ext.host-hardware`
- **Owns state:** none
- **Source refs:** `main.md#13-repo-layout`
- **Milestone:** 1
- **Invariants:**
  - Hardware profile is detected or read from HARDWARE_PROFILE and drives Laya providers and thread counts.
- **Failure modes:**
  - Missing or invalid configuration: exit non-zero with an actionable error.
- **Tests:**
  - Profile matrix, missing-secret, and schema-validation tests.
- **Metrics:**
  - `config_hardware_probe_errors_total`
  - `config_hardware_probe_latency_ms`

### `config.secrets-loader` — Secrets Loader

- **Responsibility:** Load planner base URL and API key from process env or gitignored config/.env.
- **Owner path:** `packages/core/src/config/secrets-loader`
- **Provides:** `config.secrets-loader.interface`
- **Requires:** `config.env-parser`
- **Owns state:** none
- **Source refs:** `main.md#13-repo-layout`
- **Milestone:** 1
- **Invariants:**
  - PLANNER_BASE_URL and PLANNER_API_KEY have no defaults and are loaded from process env or gitignored config/.env.
- **Failure modes:**
  - Missing planner secret: fail fast with an actionable error before any planner call.
- **Tests:**
  - Profile matrix, missing-secret, and schema-validation tests.
- **Metrics:**
  - `config_secrets_loader_errors_total`
  - `config_secrets_loader_latency_ms`

### `config.name-pool-validator` — Name Pool Validator

- **Responsibility:** Validate that the ordered bot name pool is long enough for bot count.
- **Owner path:** `packages/core/src/config/name-pool-validator`
- **Provides:** `config.name-pool-validator.interface`
- **Requires:** `config.config-schema-validator`
- **Owns state:** none
- **Source refs:** `main.md#13-repo-layout`
- **Milestone:** 1
- **Invariants:**
  - Validation is pure and deterministic; the same input yields the same verdict.
  - Invalid input is rejected with a typed reason and causes no partial mutation.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `config_name_pool_validator_errors_total`
  - `config_name_pool_validator_latency_ms`

### `config.laya-runtime-resolver` — Laya Runtime Resolver

- **Responsibility:** Resolve execution providers and thread counts for the active profile.
- **Owner path:** `packages/core/src/config/laya-runtime-resolver`
- **Provides:** `config.laya-runtime-resolver.interface`
- **Requires:** `config.profile-resolver`, `config.hardware-probe`
- **Owns state:** none
- **Source refs:** `main.md#13-repo-layout`
- **Milestone:** 1
- **Invariants:**
  - LAYA_EP auto resolves to webgpu,cpu on home-full and cpu on home-min; explicit values are honored.
  - Thread counts come from the active hardware profile, not constants.
- **Failure modes:**
  - Missing or invalid configuration: exit non-zero with an actionable error.
- **Tests:**
  - Profile matrix, missing-secret, and schema-validation tests.
- **Metrics:**
  - `config_laya_runtime_resolver_errors_total`
  - `config_laya_runtime_resolver_latency_ms`

### `config.fail-fast-handler` — Fail Fast Handler

- **Responsibility:** Abort startup with a precise reason when required config is missing or invalid.
- **Owner path:** `packages/core/src/config/fail-fast-handler`
- **Provides:** `config.fail-fast-handler.interface`
- **Requires:** `config.config-schema-validator`
- **Owns state:** none
- **Source refs:** `main.md#13-repo-layout`
- **Milestone:** 1
- **Invariants:**
  - Configuration is validated once at startup; missing secrets fail fast.
  - No component reads process.env outside the config loader.
- **Failure modes:**
  - Missing or invalid configuration: exit non-zero with an actionable error.
- **Tests:**
  - Profile matrix, missing-secret, and schema-validation tests.
- **Metrics:**
  - `config_fail_fast_handler_errors_total`
  - `config_fail_fast_handler_latency_ms`

---

## Testing and Evaluation

- **ID:** `sys.eval`
- **Owner package:** `packages/eval/src`
- **Milestone:** 10
- **Source refs:** `main.md#15-testing-and-evaluation`
- **Allowed cross-system dependencies:** `sys.claims`, `sys.decision`, `sys.memory`, `sys.perception`, `sys.tasks`
- **Forbidden dependencies:** none

**Purpose.** Run deterministic scenarios, contention tests, benchmarks, replays, and soak tests.

**System invariants.**
- Every solver-critical invariant has a deterministic test fixture.
- Integration tests run against a disposable 1.20.1 offline superflat server.
- Benchmarks record p50 and p95 with hardware profile and provider metadata.

### Components

| ID | Component | Responsibility | Owner path | Milestone |
|---|---|---|---|---:|
| `eval.unit-fixtures` | Unit Fixtures | Provide shared fixtures for SIP, claims, grants, blueprints, and guardian invariants. | `packages/eval/src/unit-fixtures` | 10 |
| `eval.detector-fixtures` | Detector Fixtures | Provide golden chunk snapshots for each perception detector. | `packages/eval/src/detector-fixtures` | 10 |
| `eval.docker-server-harness` | Docker Server Harness | Start and stop a disposable itzg/minecraft-server 1.20.1 offline superflat server. | `packages/eval/src/docker-server-harness` | 10 |
| `eval.scenario-runner` | Scenario Runner | Run multi-bot scenarios with deterministic setup and teardown. | `packages/eval/src/scenario-runner` | 10 |
| `eval.replay-engine` | Replay Engine | Replay event logs and block changelogs for regression analysis. | `packages/eval/src/replay-engine` | 10 |
| `eval.contention-harness` | Contention Harness | Stress claims, task board, and decision queue under 4-bot and 8-bot load. | `packages/eval/src/contention-harness` | 10 |
| `eval.metrics-reporter` | Metrics Reporter | Collect and report task success, duplicates, contention, deaths, and latency. | `packages/eval/src/metrics-reporter` | 10 |
| `eval.soak-runner` | Soak Runner | Run 2+ hour stability tests and detect memory growth, deadlocks, and claim drift. | `packages/eval/src/soak-runner` | 10 |
| `eval.architecture-guard-tests` | Architecture Guard Tests | Assert dependency rules, forbidden edges, and graph coverage in CI. | `packages/eval/src/architecture-guard-tests` | 10 |
| `eval.laya-benchmark-harness` | Laya Benchmark Harness | Measure warm-model p50 and p95 for CPU and WebGPU with stability gates. | `packages/eval/src/laya-benchmark-harness` | 10 |

### `eval.unit-fixtures` — Unit Fixtures

- **Responsibility:** Provide shared fixtures for SIP, claims, grants, blueprints, and guardian invariants.
- **Owner path:** `packages/eval/src/unit-fixtures`
- **Provides:** `eval.unit-fixtures.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#15-testing-and-evaluation`
- **Milestone:** 10
- **Invariants:**
  - Harnesses use disposable servers and deterministic fixtures.
  - Benchmarks record hardware profile, execution provider, and p50/p95.
- **Failure modes:**
  - Environment unavailable: skip with an explicit reason; never pass silently.
- **Tests:**
  - Self-tests for fixture setup and metric reporting.
- **Metrics:**
  - `eval_unit_fixtures_errors_total`
  - `eval_unit_fixtures_latency_ms`

### `eval.detector-fixtures` — Detector Fixtures

- **Responsibility:** Provide golden chunk snapshots for each perception detector.
- **Owner path:** `packages/eval/src/detector-fixtures`
- **Provides:** `eval.detector-fixtures.interface`
- **Requires:** `eval.unit-fixtures`, `perception.detector-pipeline`
- **Owns state:** none
- **Source refs:** `main.md#15-testing-and-evaluation`
- **Milestone:** 10
- **Invariants:**
  - Detectors are pure over a chunk snapshot and emit evidence with confidence.
  - Detection never mutates world state; it only emits landmark candidates.
- **Failure modes:**
  - Insufficient evidence: emit nothing rather than a low-confidence landmark.
- **Tests:**
  - Fixture-based detector precision and recall checks.
- **Metrics:**
  - `eval_detector_fixtures_errors_total`
  - `eval_detector_fixtures_latency_ms`

### `eval.docker-server-harness` — Docker Server Harness

- **Responsibility:** Start and stop a disposable itzg/minecraft-server 1.20.1 offline superflat server.
- **Owner path:** `packages/eval/src/docker-server-harness`
- **Provides:** `eval.docker-server-harness.interface`
- **Requires:** `eval.unit-fixtures`, `ext.minecraft-server`
- **Owns state:** none
- **Source refs:** `main.md#15-testing-and-evaluation`
- **Milestone:** 10
- **Invariants:**
  - Harnesses use disposable servers and deterministic fixtures.
  - Benchmarks record hardware profile, execution provider, and p50/p95.
- **Failure modes:**
  - Environment unavailable: skip with an explicit reason; never pass silently.
- **Tests:**
  - Self-tests for fixture setup and metric reporting.
- **Metrics:**
  - `eval_docker_server_harness_errors_total`
  - `eval_docker_server_harness_latency_ms`

### `eval.scenario-runner` — Scenario Runner

- **Responsibility:** Run multi-bot scenarios with deterministic setup and teardown.
- **Owner path:** `packages/eval/src/scenario-runner`
- **Provides:** `eval.scenario-runner.interface`
- **Requires:** `eval.docker-server-harness`, `eval.metrics-reporter`
- **Owns state:** none
- **Source refs:** `main.md#15-testing-and-evaluation`
- **Milestone:** 10
- **Invariants:**
  - Harnesses use disposable servers and deterministic fixtures.
  - Benchmarks record hardware profile, execution provider, and p50/p95.
- **Failure modes:**
  - Environment unavailable: skip with an explicit reason; never pass silently.
- **Tests:**
  - Self-tests for fixture setup and metric reporting.
- **Metrics:**
  - `eval_scenario_runner_errors_total`
  - `eval_scenario_runner_latency_ms`

### `eval.replay-engine` — Replay Engine

- **Responsibility:** Replay event logs and block changelogs for regression analysis.
- **Owner path:** `packages/eval/src/replay-engine`
- **Provides:** `eval.replay-engine.interface`
- **Requires:** `memory.event-log-writer`, `eval.scenario-runner`
- **Owns state:** none
- **Source refs:** `main.md#15-testing-and-evaluation`
- **Milestone:** 10
- **Invariants:**
  - Harnesses use disposable servers and deterministic fixtures.
  - Benchmarks record hardware profile, execution provider, and p50/p95.
- **Failure modes:**
  - Environment unavailable: skip with an explicit reason; never pass silently.
- **Tests:**
  - Self-tests for fixture setup and metric reporting.
- **Metrics:**
  - `eval_replay_engine_errors_total`
  - `eval_replay_engine_latency_ms`

### `eval.contention-harness` — Contention Harness

- **Responsibility:** Stress claims, task board, and decision queue under 4-bot and 8-bot load.
- **Owner path:** `packages/eval/src/contention-harness`
- **Provides:** `eval.contention-harness.interface`
- **Requires:** `eval.scenario-runner`, `claims.claim-repository`, `tasks.task-repository`
- **Owns state:** none
- **Source refs:** `main.md#15-testing-and-evaluation`
- **Milestone:** 10
- **Invariants:**
  - Harnesses use disposable servers and deterministic fixtures.
  - Benchmarks record hardware profile, execution provider, and p50/p95.
- **Failure modes:**
  - Environment unavailable: skip with an explicit reason; never pass silently.
- **Tests:**
  - Self-tests for fixture setup and metric reporting.
- **Metrics:**
  - `eval_contention_harness_errors_total`
  - `eval_contention_harness_latency_ms`

### `eval.metrics-reporter` — Metrics Reporter

- **Responsibility:** Collect and report task success, duplicates, contention, deaths, and latency.
- **Owner path:** `packages/eval/src/metrics-reporter`
- **Provides:** `eval.metrics-reporter.interface`
- **Requires:** `ops.metrics-registry`
- **Owns state:** none
- **Source refs:** `main.md#15-testing-and-evaluation`
- **Milestone:** 10
- **Invariants:**
  - Harnesses use disposable servers and deterministic fixtures.
  - Benchmarks record hardware profile, execution provider, and p50/p95.
- **Failure modes:**
  - Environment unavailable: skip with an explicit reason; never pass silently.
- **Tests:**
  - Self-tests for fixture setup and metric reporting.
- **Metrics:**
  - `eval_metrics_reporter_errors_total`
  - `eval_metrics_reporter_latency_ms`

### `eval.soak-runner` — Soak Runner

- **Responsibility:** Run 2+ hour stability tests and detect memory growth, deadlocks, and claim drift.
- **Owner path:** `packages/eval/src/soak-runner`
- **Provides:** `eval.soak-runner.interface`
- **Requires:** `eval.scenario-runner`, `eval.metrics-reporter`
- **Owns state:** none
- **Source refs:** `main.md#15-testing-and-evaluation`
- **Milestone:** 10
- **Invariants:**
  - Soak runs 4 bots on home-min and 8 on home-full for at least 2 hours with no memory growth or deadlock.
- **Failure modes:**
  - Environment unavailable: skip with an explicit reason; never pass silently.
- **Tests:**
  - Self-tests for fixture setup and metric reporting.
- **Metrics:**
  - `eval_soak_runner_errors_total`
  - `eval_soak_runner_latency_ms`

### `eval.architecture-guard-tests` — Architecture Guard Tests

- **Responsibility:** Assert dependency rules, forbidden edges, and graph coverage in CI.
- **Owner path:** `packages/eval/src/architecture-guard-tests`
- **Provides:** `eval.architecture-guard-tests.interface`
- **Requires:** `eval.unit-fixtures`
- **Owns state:** none
- **Source refs:** `main.md#15-testing-and-evaluation`
- **Milestone:** 10
- **Invariants:**
  - Validation is pure and deterministic; the same input yields the same verdict.
  - Invalid input is rejected with a typed reason and causes no partial mutation.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `eval_architecture_guard_tests_errors_total`
  - `eval_architecture_guard_tests_latency_ms`

### `eval.laya-benchmark-harness` — Laya Benchmark Harness

- **Responsibility:** Measure warm-model p50 and p95 for CPU and WebGPU with stability gates.
- **Owner path:** `packages/eval/src/laya-benchmark-harness`
- **Provides:** `eval.laya-benchmark-harness.interface`
- **Requires:** `eval.scenario-runner`, `decision.model-loader`, `decision.latency-metrics`
- **Owns state:** none
- **Source refs:** `main.md#15-testing-and-evaluation`
- **Milestone:** 10
- **Invariants:**
  - Hard gates are warm-model p95 below 250ms and 2h with no crash or driver reset.
  - WebGPU is adopted only if it also beats CPU p95.
- **Failure modes:**
  - Environment unavailable: skip with an explicit reason; never pass silently.
- **Tests:**
  - Self-tests for fixture setup and metric reporting.
- **Metrics:**
  - `eval_laya_benchmark_harness_errors_total`
  - `eval_laya_benchmark_harness_latency_ms`

---

## Laya Training

- **ID:** `sys.training`
- **Owner package:** `tools/laya-train`
- **Milestone:** 10
- **Source refs:** `main.md#14-laya-training-and-calibration-dev-time-python-runtime-bun`
- **Allowed cross-system dependencies:** `sys.eval`
- **Forbidden dependencies:** `fe.training-runtime`

**Purpose.** Dev-only trace export, labeling, fine-tuning, ONNX export, calibration, and promotion.

**System invariants.**
- Training is dev-only and never imported by the runtime.
- The runtime loads only the exported ONNX bundle.
- A new model is promoted only if it beats the deterministic baseline end-to-end.

### Components

| ID | Component | Responsibility | Owner path | Milestone |
|---|---|---|---|---:|
| `training.trace-exporter` | Trace Exporter | Export state digest, affordances, chosen action, and outcome traces. | `tools/laya-train/trace-exporter` | 10 |
| `training.labeling-pipeline` | Labeling Pipeline | Label exported traces with cloud teacher labels and outcome rewards. | `tools/laya-train/labeling-pipeline` | 10 |
| `training.reward-computer` | Reward Computer | Compute progress, damage, time, material, and completion rewards. | `tools/laya-train/reward-computer` | 10 |
| `training.fine-tune-runner` | Fine-tune Runner | Fine-tune Laya in Python using labeled traces and reward signals. | `tools/laya-train/fine-tune-runner` | 10 |
| `training.onnx-exporter` | ONNX Exporter | Export the fine-tuned model into the models/ ONNX bundle. | `tools/laya-train/onnx-exporter` | 10 |
| `training.calibration-fitter` | Calibration Fitter | Fit per-question temperature on held-out traces. | `tools/laya-train/calibration-fitter` | 10 |
| `training.promotion-gate` | Promotion Gate | Promote an ONNX bundle only after benchmark and calibration gates pass. | `tools/laya-train/promotion-gate` | 10 |

### `training.trace-exporter` — Trace Exporter

- **Responsibility:** Export state digest, affordances, chosen action, and outcome traces.
- **Owner path:** `tools/laya-train/trace-exporter`
- **Provides:** `training.trace-exporter.interface`
- **Requires:** `memory.event-log-writer`
- **Owns state:** none
- **Source refs:** `main.md#14-laya-training-and-calibration-dev-time-python-runtime-bun`
- **Milestone:** 10
- **Invariants:**
  - Trace export reads runtime data but never becomes a runtime dependency.
- **Failure modes:**
  - Training or export failure: leave the last bundle intact and report the failure.
- **Tests:**
  - Dataset, export, and artifact-checksum tests.
- **Metrics:**
  - `training_trace_exporter_errors_total`
  - `training_trace_exporter_latency_ms`

### `training.labeling-pipeline` — Labeling Pipeline

- **Responsibility:** Label exported traces with cloud teacher labels and outcome rewards.
- **Owner path:** `tools/laya-train/labeling-pipeline`
- **Provides:** `training.labeling-pipeline.interface`
- **Requires:** `training.trace-exporter`
- **Owns state:** none
- **Source refs:** `main.md#14-laya-training-and-calibration-dev-time-python-runtime-bun`
- **Milestone:** 10
- **Invariants:**
  - Training is dev-only and is never imported by runtime.
  - Exported ONNX bundles are immutable artifacts with recorded provenance.
- **Failure modes:**
  - Training or export failure: leave the last bundle intact and report the failure.
- **Tests:**
  - Dataset, export, and artifact-checksum tests.
- **Metrics:**
  - `training_labeling_pipeline_errors_total`
  - `training_labeling_pipeline_latency_ms`

### `training.reward-computer` — Reward Computer

- **Responsibility:** Compute progress, damage, time, material, and completion rewards.
- **Owner path:** `tools/laya-train/reward-computer`
- **Provides:** `training.reward-computer.interface`
- **Requires:** `training.trace-exporter`
- **Owns state:** none
- **Source refs:** `main.md#14-laya-training-and-calibration-dev-time-python-runtime-bun`
- **Milestone:** 10
- **Invariants:**
  - Training is dev-only and is never imported by runtime.
  - Exported ONNX bundles are immutable artifacts with recorded provenance.
- **Failure modes:**
  - Training or export failure: leave the last bundle intact and report the failure.
- **Tests:**
  - Dataset, export, and artifact-checksum tests.
- **Metrics:**
  - `training_reward_computer_errors_total`
  - `training_reward_computer_latency_ms`

### `training.fine-tune-runner` — Fine-tune Runner

- **Responsibility:** Fine-tune Laya in Python using labeled traces and reward signals.
- **Owner path:** `tools/laya-train/fine-tune-runner`
- **Provides:** `training.fine-tune-runner.interface`
- **Requires:** `training.labeling-pipeline`, `training.reward-computer`
- **Owns state:** none
- **Source refs:** `main.md#14-laya-training-and-calibration-dev-time-python-runtime-bun`
- **Milestone:** 10
- **Invariants:**
  - Training is dev-only and is never imported by runtime.
  - Exported ONNX bundles are immutable artifacts with recorded provenance.
- **Failure modes:**
  - Training or export failure: leave the last bundle intact and report the failure.
- **Tests:**
  - Dataset, export, and artifact-checksum tests.
- **Metrics:**
  - `training_fine_tune_runner_errors_total`
  - `training_fine_tune_runner_latency_ms`

### `training.onnx-exporter` — ONNX Exporter

- **Responsibility:** Export the fine-tuned model into the models/ ONNX bundle.
- **Owner path:** `tools/laya-train/onnx-exporter`
- **Provides:** `training.onnx-exporter.interface`
- **Requires:** `training.fine-tune-runner`
- **Owns state:** none
- **Source refs:** `main.md#14-laya-training-and-calibration-dev-time-python-runtime-bun`
- **Milestone:** 10
- **Invariants:**
  - Training is dev-only and is never imported by runtime.
  - Exported ONNX bundles are immutable artifacts with recorded provenance.
- **Failure modes:**
  - Training or export failure: leave the last bundle intact and report the failure.
- **Tests:**
  - Dataset, export, and artifact-checksum tests.
- **Metrics:**
  - `training_onnx_exporter_errors_total`
  - `training_onnx_exporter_latency_ms`

### `training.calibration-fitter` — Calibration Fitter

- **Responsibility:** Fit per-question temperature on held-out traces.
- **Owner path:** `tools/laya-train/calibration-fitter`
- **Provides:** `training.calibration-fitter.interface`
- **Requires:** `training.trace-exporter`, `decision.confidence-calibrator`
- **Owns state:** none
- **Source refs:** `main.md#14-laya-training-and-calibration-dev-time-python-runtime-bun`
- **Milestone:** 10
- **Invariants:**
  - Training is dev-only and is never imported by runtime.
  - Exported ONNX bundles are immutable artifacts with recorded provenance.
- **Failure modes:**
  - Training or export failure: leave the last bundle intact and report the failure.
- **Tests:**
  - Dataset, export, and artifact-checksum tests.
- **Metrics:**
  - `training_calibration_fitter_errors_total`
  - `training_calibration_fitter_latency_ms`

### `training.promotion-gate` — Promotion Gate

- **Responsibility:** Promote an ONNX bundle only after benchmark and calibration gates pass.
- **Owner path:** `tools/laya-train/promotion-gate`
- **Provides:** `training.promotion-gate.interface`
- **Requires:** `eval.laya-benchmark-harness`, `training.calibration-fitter`, `training.onnx-exporter`
- **Owns state:** none
- **Source refs:** `main.md#14-laya-training-and-calibration-dev-time-python-runtime-bun`
- **Milestone:** 10
- **Invariants:**
  - Training is dev-only and is never imported by runtime.
  - Exported ONNX bundles are immutable artifacts with recorded provenance.
- **Failure modes:**
  - Training or export failure: leave the last bundle intact and report the failure.
- **Tests:**
  - Dataset, export, and artifact-checksum tests.
- **Metrics:**
  - `training_promotion_gate_errors_total`
  - `training_promotion_gate_latency_ms`

---

## Brains

- **ID:** `sys.brains`
- **Owner package:** `packages/brains/src`
- **Milestone:** 4
- **Source refs:** `main.md#7-short-term-decision-service-laya`, `main.md#11-autonomy-loop-and-safety`, `main.md#13-repo-layout`
- **Allowed cross-system dependencies:** `sys.bot-runtime`, `sys.safety`, `sys.skill-runtime`, `sys.transport`
- **Forbidden dependencies:** none

**Purpose.** Own reflex, affordances, deterministic decision fallback, and the bot-side Laya client.

**System invariants.**
- Brain components emit proposals and never call mineflayer directly.
- Deterministic policy is always available when Laya is unavailable, late, or low-confidence.
- Reflex guardian outranks agency, Laya, and the planner.

### Components

| ID | Component | Responsibility | Owner path | Milestone |
|---|---|---|---|---:|
| `brains.reflex-guardian-loop` | Reflex Guardian Loop | Run deterministic safety checks at 20Hz and issue veto or recovery signals. | `packages/brains/src/reflex-guardian-loop` | 4 |
| `brains.affordance-enumerator` | Affordance Enumerator | Enumerate 8-16 legal actions with short labels for the decision service. | `packages/brains/src/affordance-enumerator` | 4 |
| `brains.deterministic-policy` | Deterministic Policy | Choose a legal action from utility scores when Laya is unavailable, late, or low-confidence. | `packages/brains/src/deterministic-policy` | 4 |
| `brains.laya-client` | Laya Client | Submit decision requests to the coordinator Laya service and apply typed responses with timeout fallback. | `packages/brains/src/laya-client` | 8 |

### `brains.reflex-guardian-loop` — Reflex Guardian Loop

- **Responsibility:** Run deterministic safety checks at 20Hz and issue veto or recovery signals.
- **Owner path:** `packages/brains/src/reflex-guardian-loop`
- **Provides:** `safety.guardian-loop.interface`
- **Requires:** `safety.hazard-evaluator`, `safety.mob-threat-evaluator`, `safety.hunger-evaluator`, `safety.stuck-timeout-evaluator`, `safety.inventory-evaluator`, `safety.claim-loss-evaluator`
- **Owns state:** none
- **Source refs:** `main.md#11-autonomy-loop-and-safety`
- **Milestone:** 4
- **Invariants:**
  - The reflex guardian runs at 20Hz per bot and can veto any skill or Laya action.
  - Guardian failure is fail-safe: stop actions rather than continue unguarded.
- **Failure modes:**
  - Unknown rule or malformed input: reject closed with an actionable reason.
- **Tests:**
  - Table-driven accept/reject fixtures including boundary and malformed inputs.
- **Metrics:**
  - `safety_guardian_loop_errors_total`
  - `safety_guardian_loop_latency_ms`

### `brains.affordance-enumerator` — Affordance Enumerator

- **Responsibility:** Enumerate 8-16 legal actions with short labels for the decision service.
- **Owner path:** `packages/brains/src/affordance-enumerator`
- **Provides:** `bot-runtime.affordance-enumerator.interface`
- **Requires:** `bot-runtime.world-cache-adapter`, `skill-runtime.skill-registry`, `brains.reflex-guardian-loop`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 4
- **Invariants:**
  - Affordances are legal, typed, and limited to 8-16 options of at most 12 words each.
- **Failure modes:**
  - Model or profile unavailable: use the deterministic utility policy and record the downgrade.
- **Tests:**
  - Affordance enumeration, utility fallback, and Laya-client timeout tests.
- **Metrics:**
  - `bot_runtime_affordance_enumerator_errors_total`
  - `bot_runtime_affordance_enumerator_latency_ms`

### `brains.deterministic-policy` — Deterministic Policy

- **Responsibility:** Choose a legal action from utility scores when Laya is unavailable, late, or low-confidence.
- **Owner path:** `packages/brains/src/deterministic-policy`
- **Provides:** `bot-runtime.deterministic-policy.interface`
- **Requires:** `brains.affordance-enumerator`, `bot-runtime.state-digest-collector`, `bots.behavior-profile-manager`
- **Owns state:** none
- **Source refs:** `main.md#1-fleet-coordinator`
- **Milestone:** 4
- **Invariants:**
  - Deterministic utility policy is always available and is used when Laya is unavailable, late, or below 0.60 confidence.
- **Failure modes:**
  - Model or profile unavailable: use the deterministic utility policy and record the downgrade.
- **Tests:**
  - Affordance enumeration, utility fallback, and Laya-client timeout tests.
- **Metrics:**
  - `bot_runtime_deterministic_policy_errors_total`
  - `bot_runtime_deterministic_policy_latency_ms`

### `brains.laya-client` — Laya Client

- **Responsibility:** Submit decision requests to the coordinator Laya service and apply typed responses with timeout fallback.
- **Owner path:** `packages/brains/src/laya-client`
- **Provides:** `brains.laya-client.interface`
- **Requires:** `brains.affordance-enumerator`, `transport.ws-codec`, `brains.deterministic-policy`
- **Owns state:** none
- **Source refs:** `main.md#7-short-term-decision-service-laya`
- **Milestone:** 8
- **Invariants:**
  - The bot-side Laya client never blocks the 20Hz guardian and falls back to deterministic policy on timeout.
- **Failure modes:**
  - Coordinator unreachable or decision timeout: use deterministic policy and reconnect.
- **Tests:**
  - Affordance enumeration, utility fallback, and Laya-client timeout tests.
- **Metrics:**
  - `brains_laya_client_timeouts_total`
  - `brains_laya_client_latency_ms`

---

## Agency

- **ID:** `sys.agency`
- **Owner package:** `packages/agency/src`
- **Milestone:** 12
- **Source refs:** `main.md#20-agency-and-motivation`, `main.md#21-social-behavior`
- **Allowed cross-system dependencies:** none
- **Forbidden dependencies:** none

**Purpose.** Turn needs, personality, memory, world context, and social signals into goal candidates, committed intentions, routines, and social proposals without executing actions.

**System invariants.**
- Agency components emit proposals only; they never call mineflayer or write SIP state.
- Deterministic utility is always available when Laya is unavailable, late, or below the confidence gate.
- Needs, intention, routine, home, and social state survive restart and are reconciled before resumption.
- Agency never bypasses the reflex guardian.

### Components

| ID | Component | Responsibility | Owner path | Milestone |
|---|---|---|---|---:|
| `agency.personality-model` | Personality Model | Seed, validate, and expose persistent personality traits that weight needs, goals, risk, and chat style. | `packages/agency/src/personality-model` | 12 |
| `agency.needs-model` | Needs Model | Maintain homeostatic need levels, decay them over time, and apply satisfaction events. | `packages/agency/src/needs-model` | 12 |
| `agency.goal-catalog` | Goal Catalog | Define typed goal templates, their skill steps, costs, risks, and expected values. | `packages/agency/src/goal-catalog` | 12 |
| `agency.goal-generator` | Goal Generator | Emit concrete goal candidates from needs, personality, world context, time, home, and social signals. | `packages/agency/src/goal-generator` | 12 |
| `agency.goal-arbiter` | Goal Arbiter | Score goal candidates with utility, personality, commitment hysteresis, cost, and risk. | `packages/agency/src/goal-arbiter` | 12 |
| `agency.intention-manager` | Intention Manager | Track the active goal, step index, retries, completion, abandonment, preemption, and expiry. | `packages/agency/src/intention-manager` | 12 |
| `agency.routine-model` | Routine Model | Derive morning, day, evening, and night phases and expose work, rest, and social preferences. | `packages/agency/src/routine-model` | 12 |
| `agency.item-knowledge` | Item Knowledge | Classify food, weapons, armor, wool, beds, and building materials from the bot inventory. | `packages/agency/src/item-knowledge` | 15 |
| `agency.night-prep-config` | Night Preparation Config | Define night preparation thresholds, material requirements, and shelter strategy switches. | `packages/agency/src/night-prep-config` | 15 |
| `agency.shelter-strategy` | Shelter Strategy | Choose keep, build, dig-in, or none from shelter state, daylight left, and available material. | `packages/agency/src/shelter-strategy` | 15 |
| `agency.shelter-plan` | Shelter Plan | Generate a bounded support-first shell of blocks for a first shelter. | `packages/agency/src/shelter-plan` | 15 |
| `agency.night-readiness` | Night Readiness | Assess home, shelter, bed, food, combat, and hostile gaps and emit ordered night preparation actions. | `packages/agency/src/night-readiness` | 15 |
| `agency.social-engine` | Social Engine | Classify social messages, generate personality-styled replies, and enforce chat rate limits. | `packages/agency/src/social-engine` | 14 |
| `agency.working-memory` | Working Memory | Track bounded focus, commitments, interruption, recent experience, and tactical revision for continuity across goals and restarts. | `packages/agency/src/working-memory` | 12 |
| `agency.project-focus` | Project Focus Policy | Keep long-lived project focus as agency focus while allowing bounded survival and routine interruptions. | `packages/agency/src/project-focus` | 13 |
| `agency.agency-state` | Agency State | Aggregate personality, needs, intention, routine, home, mood, working memory, and deliberation status into one snapshot. | `packages/agency/src/agency-state` | 12 |

### `agency.personality-model` — Personality Model

- **Responsibility:** Seed, validate, and expose persistent personality traits that weight needs, goals, risk, and chat style.
- **Owner path:** `packages/agency/src/personality-model`
- **Provides:** `agency.personality-model.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#20-agency-and-motivation`
- **Milestone:** 12
- **Invariants:**
  - Traits are seeded deterministically from bot index, persisted, and always bounded to 0..1.
  - Traits modulate utility and style but never override the guardian.
- **Failure modes:**
  - Model or profile unavailable: use the deterministic utility policy and record the downgrade.
- **Tests:**
  - Affordance enumeration, utility fallback, and Laya-client timeout tests.
- **Metrics:**
  - `agency_personality_model_errors_total`
  - `agency_personality_model_latency_ms`

### `agency.needs-model` — Needs Model

- **Responsibility:** Maintain homeostatic need levels, decay them over time, and apply satisfaction events.
- **Owner path:** `packages/agency/src/needs-model`
- **Provides:** `agency.needs-model.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#20-agency-and-motivation`
- **Milestone:** 12
- **Invariants:**
  - Need levels are bounded to 0..1 and decay deterministically with elapsed time.
  - Need satisfaction never decreases unrelated needs.
- **Failure modes:**
  - Model or profile unavailable: use the deterministic utility policy and record the downgrade.
- **Tests:**
  - Affordance enumeration, utility fallback, and Laya-client timeout tests.
- **Metrics:**
  - `agency_needs_model_errors_total`
  - `agency_needs_model_latency_ms`

### `agency.goal-catalog` — Goal Catalog

- **Responsibility:** Define typed goal templates, their skill steps, costs, risks, and expected values.
- **Owner path:** `packages/agency/src/goal-catalog`
- **Provides:** `agency.goal-catalog.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#20-agency-and-motivation`
- **Milestone:** 12
- **Invariants:**
  - Every goal template names an existing skill id and bounded typed input.
- **Failure modes:**
  - Model or profile unavailable: use the deterministic utility policy and record the downgrade.
- **Tests:**
  - Affordance enumeration, utility fallback, and Laya-client timeout tests.
- **Metrics:**
  - `agency_goal_catalog_errors_total`
  - `agency_goal_catalog_latency_ms`

### `agency.goal-generator` — Goal Generator

- **Responsibility:** Emit concrete goal candidates from needs, personality, world context, time, home, and social signals.
- **Owner path:** `packages/agency/src/goal-generator`
- **Provides:** `agency.goal-generator.interface`
- **Requires:** `agency.goal-catalog`, `agency.needs-model`, `agency.night-prep-config`, `agency.night-readiness`, `agency.personality-model`, `agency.routine-model`
- **Owns state:** none
- **Source refs:** `main.md#20-agency-and-motivation`
- **Milestone:** 12
- **Invariants:**
  - Generation returns 1-16 legal candidates and rejects infeasible or unsafe goals.
- **Failure modes:**
  - Model or profile unavailable: use the deterministic utility policy and record the downgrade.
- **Tests:**
  - Affordance enumeration, utility fallback, and Laya-client timeout tests.
- **Metrics:**
  - `agency_goal_generator_errors_total`
  - `agency_goal_generator_latency_ms`

### `agency.goal-arbiter` — Goal Arbiter

- **Responsibility:** Score goal candidates with utility, personality, commitment hysteresis, cost, and risk.
- **Owner path:** `packages/agency/src/goal-arbiter`
- **Provides:** `agency.goal-arbiter.interface`
- **Requires:** `agency.goal-generator`, `agency.needs-model`, `agency.personality-model`
- **Owns state:** none
- **Source refs:** `main.md#20-agency-and-motivation`
- **Milestone:** 12
- **Invariants:**
  - Selection is deterministic for the same inputs and keeps an active goal until completion, abandonment, or preemption.
  - Laya advice is requested only when top scores are close or after repeated failure.
- **Failure modes:**
  - Model or profile unavailable: use the deterministic utility policy and record the downgrade.
- **Tests:**
  - Affordance enumeration, utility fallback, and Laya-client timeout tests.
- **Metrics:**
  - `agency_goal_arbiter_errors_total`
  - `agency_goal_arbiter_latency_ms`

### `agency.intention-manager` — Intention Manager

- **Responsibility:** Track the active goal, step index, retries, completion, abandonment, preemption, and expiry.
- **Owner path:** `packages/agency/src/intention-manager`
- **Provides:** `agency.intention-manager.interface`
- **Requires:** `agency.goal-arbiter`
- **Owns state:** none
- **Source refs:** `main.md#20-agency-and-motivation`
- **Milestone:** 12
- **Invariants:**
  - Only one intention is active per bot.
  - Every completion or abandonment records a typed reason and timestamp.
- **Failure modes:**
  - Model or profile unavailable: use the deterministic utility policy and record the downgrade.
- **Tests:**
  - Affordance enumeration, utility fallback, and Laya-client timeout tests.
- **Metrics:**
  - `agency_intention_manager_errors_total`
  - `agency_intention_manager_latency_ms`

### `agency.routine-model` — Routine Model

- **Responsibility:** Derive morning, day, evening, and night phases and expose work, rest, and social preferences.
- **Owner path:** `packages/agency/src/routine-model`
- **Provides:** `agency.routine-model.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#20-agency-and-motivation`
- **Milestone:** 12
- **Invariants:**
  - Routine phase is a pure function of time of day and is a prior, not a script.
- **Failure modes:**
  - Model or profile unavailable: use the deterministic utility policy and record the downgrade.
- **Tests:**
  - Affordance enumeration, utility fallback, and Laya-client timeout tests.
- **Metrics:**
  - `agency_routine_model_errors_total`
  - `agency_routine_model_latency_ms`

### `agency.item-knowledge` — Item Knowledge

- **Responsibility:** Classify food, weapons, armor, wool, beds, and building materials from the bot inventory.
- **Owner path:** `packages/agency/src/item-knowledge`
- **Provides:** `agency.item-knowledge.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#20-agency-and-motivation`
- **Milestone:** 15
- **Invariants:**
  - The brain layer emits proposals only; it never calls mineflayer.
  - Deterministic policy is always available as the fallback path.
- **Failure modes:**
  - Model or profile unavailable: use the deterministic utility policy and record the downgrade.
- **Tests:**
  - Affordance enumeration, utility fallback, and Laya-client timeout tests.
- **Metrics:**
  - `agency_item_knowledge_errors_total`
  - `agency_item_knowledge_latency_ms`

### `agency.night-prep-config` — Night Preparation Config

- **Responsibility:** Define night preparation thresholds, material requirements, and shelter strategy switches.
- **Owner path:** `packages/agency/src/night-prep-config`
- **Provides:** `agency.night-prep-config.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#20-agency-and-motivation`
- **Milestone:** 15
- **Invariants:**
  - The brain layer emits proposals only; it never calls mineflayer.
  - Deterministic policy is always available as the fallback path.
- **Failure modes:**
  - Model or profile unavailable: use the deterministic utility policy and record the downgrade.
- **Tests:**
  - Affordance enumeration, utility fallback, and Laya-client timeout tests.
- **Metrics:**
  - `agency_night_prep_config_errors_total`
  - `agency_night_prep_config_latency_ms`

### `agency.shelter-strategy` — Shelter Strategy

- **Responsibility:** Choose keep, build, dig-in, or none from shelter state, daylight left, and available material.
- **Owner path:** `packages/agency/src/shelter-strategy`
- **Provides:** `agency.shelter-strategy.interface`
- **Requires:** `agency.night-prep-config`
- **Owns state:** none
- **Source refs:** `main.md#20-agency-and-motivation`
- **Milestone:** 15
- **Invariants:**
  - Build is chosen only when enough daylight and material remain.
  - Dig-in is chosen only when a safe dig site is available.
- **Failure modes:**
  - Model or profile unavailable: use the deterministic utility policy and record the downgrade.
- **Tests:**
  - Affordance enumeration, utility fallback, and Laya-client timeout tests.
- **Metrics:**
  - `agency_shelter_strategy_errors_total`
  - `agency_shelter_strategy_latency_ms`

### `agency.shelter-plan` — Shelter Plan

- **Responsibility:** Generate a bounded support-first shell of blocks for a first shelter.
- **Owner path:** `packages/agency/src/shelter-plan`
- **Provides:** `agency.shelter-plan.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 15
- **Invariants:**
  - Shelter blocks are ordered support-first and bounded to a small footprint.
- **Failure modes:**
  - Model or profile unavailable: use the deterministic utility policy and record the downgrade.
- **Tests:**
  - Affordance enumeration, utility fallback, and Laya-client timeout tests.
- **Metrics:**
  - `agency_shelter_plan_errors_total`
  - `agency_shelter_plan_latency_ms`

### `agency.night-readiness` — Night Readiness

- **Responsibility:** Assess home, shelter, bed, food, combat, and hostile gaps and emit ordered night preparation actions.
- **Owner path:** `packages/agency/src/night-readiness`
- **Provides:** `agency.night-readiness.interface`
- **Requires:** `agency.item-knowledge`, `agency.night-prep-config`, `agency.routine-model`, `agency.shelter-plan`, `agency.shelter-strategy`
- **Owns state:** none
- **Source refs:** `main.md#20-agency-and-motivation`
- **Milestone:** 15
- **Invariants:**
  - Readiness is a pure assessment and never calls a skill directly.
  - Every emitted action names a supported skill id and typed input.
- **Failure modes:**
  - Model or profile unavailable: use the deterministic utility policy and record the downgrade.
- **Tests:**
  - Affordance enumeration, utility fallback, and Laya-client timeout tests.
- **Metrics:**
  - `agency_night_readiness_errors_total`
  - `agency_night_readiness_latency_ms`

### `agency.social-engine` — Social Engine

- **Responsibility:** Classify social messages, generate personality-styled replies, and enforce chat rate limits.
- **Owner path:** `packages/agency/src/social-engine`
- **Provides:** `agency.social-engine.interface`
- **Requires:** `agency.personality-model`
- **Owns state:** none
- **Source refs:** `main.md#21-social-behavior`
- **Milestone:** 14
- **Invariants:**
  - Social output is typed, rate-limited, and never echoes arbitrary input.
  - Social behavior never triggers a physical action outside the skill pipeline.
- **Failure modes:**
  - Model or profile unavailable: use the deterministic utility policy and record the downgrade.
- **Tests:**
  - Affordance enumeration, utility fallback, and Laya-client timeout tests.
- **Metrics:**
  - `agency_social_engine_errors_total`
  - `agency_social_engine_latency_ms`

### `agency.working-memory` — Working Memory

- **Responsibility:** Track bounded focus, commitments, interruption, recent experience, and tactical revision for continuity across goals and restarts.
- **Owner path:** `packages/agency/src/working-memory`
- **Provides:** `agency.working-memory.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#11-autonomy-loop-and-safety`
- **Milestone:** 12
- **Invariants:**
  - The revision increments on every focus, commitment, interruption, and experience change.
  - Commitments and recent experiences stay within their configured bounds.
  - Missing persisted working memory restores to an empty memory.
- **Failure modes:**
  - Model or profile unavailable: use the deterministic utility policy and record the downgrade.
- **Tests:**
  - Affordance enumeration, utility fallback, and Laya-client timeout tests.
- **Metrics:**
  - `agency_working_memory_errors_total`
  - `agency_working_memory_latency_ms`

### `agency.project-focus` — Project Focus Policy

- **Responsibility:** Keep long-lived project focus as agency focus while allowing bounded survival and routine interruptions.
- **Owner path:** `packages/agency/src/project-focus`
- **Provides:** `agency.project-focus.interface`
- **Requires:** `agency.working-memory`
- **Owns state:** none
- **Source refs:** `main.md#10-building-three-layers`
- **Milestone:** 13
- **Invariants:**
  - Project focus never creates a second goal manager.
  - Project sub-work does not replace project focus.
  - Survival goals may interrupt project focus and restore it when complete.
- **Failure modes:**
  - Model or profile unavailable: use the deterministic utility policy and record the downgrade.
- **Tests:**
  - Affordance enumeration, utility fallback, and Laya-client timeout tests.
- **Metrics:**
  - `agency_project_focus_errors_total`
  - `agency_project_focus_latency_ms`

### `agency.agency-state` — Agency State

- **Responsibility:** Aggregate personality, needs, intention, routine, home, mood, working memory, and deliberation status into one snapshot.
- **Owner path:** `packages/agency/src/agency-state`
- **Provides:** `agency.agency-state.interface`
- **Requires:** `agency.needs-model`, `agency.personality-model`, `agency.intention-manager`, `agency.routine-model`, `agency.working-memory`
- **Owns state:** none
- **Source refs:** `main.md#20-agency-and-motivation`
- **Milestone:** 12
- **Invariants:**
  - Agency state snapshots are immutable and restart-safe.
- **Failure modes:**
  - Model or profile unavailable: use the deterministic utility policy and record the downgrade.
- **Tests:**
  - Affordance enumeration, utility fallback, and Laya-client timeout tests.
- **Metrics:**
  - `agency_agency_state_errors_total`
  - `agency_agency_state_latency_ms`

---

## Bootstrap and Toolchain

- **ID:** `sys.toolchain`
- **Owner package:** `tools`
- **Milestone:** 1
- **Source refs:** `main.md#19-self-contained-bootstrap`
- **Allowed cross-system dependencies:** none
- **Forbidden dependencies:** none

**Purpose.** Provision every dependency and app into repo-local paths, verify pinned artifacts, and operate the local Minecraft test server.

**System invariants.**
- All dependencies and apps install into gitignored repo-local paths.
- Bootstrap never performs global installs or invokes a system package manager.
- Every download matches a pinned checksum from tools/bootstrap/manifest.json.
- Runtime processes never depend on toolchain components.

### Components

| ID | Component | Responsibility | Owner path | Milestone |
|---|---|---|---|---:|
| `toolchain.bootstrap` | Bootstrap Orchestrator | Detect missing dependencies and apps, enforce disk guards, and provision repo-local install roots. | `tools/bootstrap/bootstrap.mjs` | 1 |
| `toolchain.capability-check` | Capability Check | Report required and optional capabilities, installed artifacts, and free disk without modifying state. | `tools/bootstrap/check-env.mjs` | 1 |
| `toolchain.python-env` | Python Environment | Create a repo-local virtualenv and install pinned training requirements for the selected PyTorch variant. | `tools/bootstrap/python-env.mjs` | 1 |
| `toolchain.minecraft-server` | Minecraft Server Controller | Start, stop, and inspect the repo-provisioned local Minecraft 1.20.1 test server with explicit EULA consent. | `tools/bootstrap/minecraft-server.mjs` | 1 |
| `toolchain.svg-renderer` | Firefox SVG Renderer | Render Mermaid source to SVG using the installed Firefox browser without downloading Chromium. | `tools/architecture/render-svg.mjs` | 1 |

### `toolchain.bootstrap` — Bootstrap Orchestrator

- **Responsibility:** Detect missing dependencies and apps, enforce disk guards, and provision repo-local install roots.
- **Owner path:** `tools/bootstrap/bootstrap.mjs`
- **Provides:** `toolchain.bootstrap.interface`
- **Requires:** `toolchain.capability-check`, `toolchain.python-env`, `toolchain.minecraft-server`, `toolchain.svg-renderer`
- **Owns state:** none
- **Source refs:** `main.md#19-self-contained-bootstrap`
- **Milestone:** 1
- **Invariants:**
  - Runs only against repo-local dependencies and caches.
  - Fails closed with actionable diagnostics instead of mutating the host.
- **Failure modes:**
  - Missing or mismatched pinned artifact.
  - Insufficient disk space or unavailable runtime prerequisite.
- **Tests:**
  - Bootstrap is idempotent on a clean checkout.
  - Bootstrap fails fast when a required prerequisite is missing.
- **Metrics:**
  - `bootstrap_phase_total`
  - `bootstrap_bytes_downloaded`

### `toolchain.capability-check` — Capability Check

- **Responsibility:** Report required and optional capabilities, installed artifacts, and free disk without modifying state.
- **Owner path:** `tools/bootstrap/check-env.mjs`
- **Provides:** `toolchain.capability-check.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#19-self-contained-bootstrap`
- **Milestone:** 1
- **Invariants:**
  - Runs only against repo-local dependencies and caches.
  - Fails closed with actionable diagnostics instead of mutating the host.
- **Failure modes:**
  - Missing or mismatched pinned artifact.
  - Insufficient disk space or unavailable runtime prerequisite.
- **Tests:**
  - Bootstrap is idempotent on a clean checkout.
  - Bootstrap fails fast when a required prerequisite is missing.
- **Metrics:**
  - `capability_missing_total`
  - `capability_check_latency_ms`

### `toolchain.python-env` — Python Environment

- **Responsibility:** Create a repo-local virtualenv and install pinned training requirements for the selected PyTorch variant.
- **Owner path:** `tools/bootstrap/python-env.mjs`
- **Provides:** `toolchain.python-env.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#19-self-contained-bootstrap`
- **Milestone:** 1
- **Invariants:**
  - Runs only against repo-local dependencies and caches.
  - Fails closed with actionable diagnostics instead of mutating the host.
- **Failure modes:**
  - Missing or mismatched pinned artifact.
  - Insufficient disk space or unavailable runtime prerequisite.
- **Tests:**
  - Bootstrap is idempotent on a clean checkout.
  - Bootstrap fails fast when a required prerequisite is missing.
- **Metrics:**
  - `python_env_install_seconds`
  - `python_variant_info`

### `toolchain.minecraft-server` — Minecraft Server Controller

- **Responsibility:** Start, stop, and inspect the repo-provisioned local Minecraft 1.20.1 test server with explicit EULA consent.
- **Owner path:** `tools/bootstrap/minecraft-server.mjs`
- **Provides:** `toolchain.minecraft-server.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#19-self-contained-bootstrap`
- **Milestone:** 1
- **Invariants:**
  - Runs only against repo-local dependencies and caches.
  - Fails closed with actionable diagnostics instead of mutating the host.
- **Failure modes:**
  - Missing or mismatched pinned artifact.
  - Insufficient disk space or unavailable runtime prerequisite.
- **Tests:**
  - Bootstrap is idempotent on a clean checkout.
  - Bootstrap fails fast when a required prerequisite is missing.
- **Metrics:**
  - `minecraft_server_status`
  - `minecraft_server_restarts_total`

### `toolchain.svg-renderer` — Firefox SVG Renderer

- **Responsibility:** Render Mermaid source to SVG using the installed Firefox browser without downloading Chromium.
- **Owner path:** `tools/architecture/render-svg.mjs`
- **Provides:** `toolchain.svg-renderer.interface`
- **Requires:** none
- **Owns state:** none
- **Source refs:** `main.md#19-self-contained-bootstrap`
- **Milestone:** 1
- **Invariants:**
  - Runs only against repo-local dependencies and caches.
  - Fails closed with actionable diagnostics instead of mutating the host.
- **Failure modes:**
  - Missing or mismatched pinned artifact.
  - Insufficient disk space or unavailable runtime prerequisite.
- **Tests:**
  - Bootstrap is idempotent on a clean checkout.
  - Bootstrap fails fast when a required prerequisite is missing.
- **Metrics:**
  - `svg_render_seconds`
  - `svg_render_failures_total`

---
