import { BuiltInTemplates } from '@ticrafter/building';
import {
    attempt,
    BOT_PROJECT_UPDATE_EVENT,
    BOT_SAFETY_STOP,
    type LoggerPort,
    MessageSchemaRegistry,
    PLANNER_STRATEGIC_INTENT_EVENT,
    type PlannerSecrets,
    ProtocolEnvelope,
    type Result,
    STRATEGIC_GOAL_KINDS,
    type StrategicIntent,
    type TicrafterConfig,
} from '@ticrafter/core';
import {
    AgentEpisodeRepository,
    BlockChangelogReader,
    BlockChangelogWriter,
    EpisodeStore,
    EventLogWriter,
    RetentionPruner,
    SqlitePlannerPlanStore,
    SqliteSkillCheckpointStore,
    TransactionManager,
} from '@ticrafter/memory';
import {
    FetchPlannerHttpPort,
    OpenAiPlannerClient,
    PlannerArbitrationHandler,
    PlannerBudgetLimiter,
    PlannerContextBuilder,
    type PlannerCycleResult,
    PlannerKeepLastGoodFallback,
    PlannerPlanCache,
    type PlannerPosition,
    PlannerRepairLoop,
    PlannerSchemaValidator,
    PlannerSemanticValidator,
    PlannerService,
    PlannerSipMutationTranslator,
    PlannerTaskDagTranslator,
    PlannerTriggerEvaluator,
    StrategicIntentStore,
} from '@ticrafter/planning';
import { SkillCatalog } from '@ticrafter/skills';

import {
    AgencyStateStore,
    BotDeltaSyncPlanner,
    BotIdentityAuthenticator,
    BotPresenceTracker,
    BotProfileStore,
    BotResumeOrchestrator,
} from './bots/index.js';
import {
    BlueprintCommandHandler,
    BlueprintDocumentRepository,
    BlueprintDocumentService,
    ConstructionEditAuthorizer,
    ConstructionPlanCommandHandler,
    ConstructionPlanDocumentService,
    ConstructionPlanRepository,
    CoordinatorConstructionWorld,
    ProjectConstructionPlanner,
    ProjectConstructionService,
    ProjectConstructionTaskSeeder,
} from './building/index.js';
import { ClaimRepository, ClaimService } from './claims/index.js';
import {
    BackpressureController,
    BotProcessSupervisor,
    CommandRouter,
    Coordinator,
    type CoordinatorDatabase,
    MessageRouter,
    RestartRecovery,
    Scheduler,
    SessionHandshake,
    SessionManager,
} from './core/index.js';
import {
    DecisionCommandAdapter,
    DecisionModelLoader,
    DecisionService,
    DecisionTraceRecorder,
} from './decision/index.js';
import { EditGrantRepository, GrantService } from './grants/index.js';
import {
    AgencyStatusSource,
    AgencyStatusView,
    OpsApi,
    OpsAuditViewer,
    OpsFleetEmergencyStop,
    OpsHealthReadiness,
    OpsMetricsRegistry,
    OpsPauseResumeController,
    OpsSipDump,
    OpsStatusAggregator,
    OpsStructuredLogger,
} from './ops/index.js';
import {
    CoordinatorPlannerContextSource,
    CoordinatorSipProposalPort,
    CoordinatorTaskProposalPort,
    PlannerCycleApplier,
    PlannerRuntime,
    TaskIndependenceAuditor,
} from './planner/index.js';
import {
    PersonalProjectRepository,
    PersonalProjectService,
    ProjectCommandHandler,
    ProjectConstructionProgressService,
    ProjectSipAdapter,
} from './projects/index.js';
import { SipReconciliationEngine, SipTransactionalCommitter } from './sip/index.js';
import {
    CoordinatorJobOfferMarket,
    JobCommandHandler,
    JobOfferService,
    TaskBoard,
    TaskCommandHandler,
    TaskLeaseReaper,
    TaskRepository,
} from './tasks/index.js';
import { TransportServer } from './transport/index.js';
import { CoordinatorWorldModel } from './world-model.js';

const ACTIONABLE_TASK_STATUSES = new Set(['pending', 'ready', 'claimed', 'running']);

export interface CoordinatorCompositionOptions {
    config: TicrafterConfig;
    logger: LoggerPort;
    database: CoordinatorDatabase;
    epoch: number;
    schemaVersion: number;
    currentWorkingDirectory: string;
    planner: PlannerSecrets;
}

export class CoordinatorComposition {
    static build(options: CoordinatorCompositionOptions): Coordinator {
        const sessions = new SessionManager();
        const registry = MessageSchemaRegistry.withDefaults();
        const events = new EventLogWriter(options.database);
        const blockChanges = new BlockChangelogWriter(options.database);
        const worldModel = new CoordinatorWorldModel(options.database, options.logger);
        const transactions = new TransactionManager(options.database);
        const claimRepository = new ClaimRepository(options.database);
        let grants: GrantService | null = null;
        let plannerRuntime: PlannerRuntime | null = null;
        const sip = new SipTransactionalCommitter(options.database, (commit) => {
            grants?.handleSipCommit(commit);
            plannerRuntime?.noteConflict(`SIP revision ${commit.revision} committed`);
        });
        const retention = new RetentionPruner(options.database);
        const reconciliation = new SipReconciliationEngine(
            {
                loadSnapshot: () => {
                    const [snapshot, loadError] = sip.loadSnapshot();
                    if (loadError) return [null, CoordinatorComposition.describeFailure(loadError)];
                    return [snapshot, null];
                },
            },
            {
                reconcile: (intended) => worldModel.reconcile(intended),
                intersecting: (bbox) => {
                    const [landmarks, queryError] = worldModel.intersecting(bbox);
                    if (queryError) {
                        return [null, CoordinatorComposition.describeFailure(queryError)];
                    }
                    return [landmarks, null];
                },
            },
            {
                commit: (input) => {
                    const [commit, commitError] = sip.commit(input);
                    if (commitError) {
                        return [null, CoordinatorComposition.describeFailure(commitError)];
                    }
                    if (commit === null) return [null, 'SIP commit returned null'];
                    return [commit.revision, null];
                },
            },
            events,
        );
        let claims: ClaimService | null = null;
        const tasks = new TaskBoard({
            database: options.database,
            events,
            transactions,
            world: worldModel,
            claims: {
                hasActiveOverlap: (bbox) =>
                    claims === null ? [null, 'claims unavailable'] : claims.hasActiveOverlap(bbox),
            },
        });
        const taskAuditor = new TaskIndependenceAuditor({
            tasks,
            logger: options.logger,
        });
        const taskLeaseReaper = new TaskLeaseReaper({
            tasks,
            logger: options.logger,
        });
        const claimService = new ClaimService({
            database: options.database,
            transactions,
            sessions: { isConnected: (botId) => sessions.get(botId) !== undefined },
            tasks: {
                requeue: (taskId, actor, reason, now) => tasks.requeue(taskId, actor, reason, now),
            },
            epoch: options.epoch,
        });
        claims = claimService;
        const grantService = new GrantService({
            database: options.database,
            transactions,
            sip: { load: () => sip.loadSnapshot() },
            claims: { listActive: () => claimRepository.listActive() },
            presence: { isOnline: (botId) => sessions.get(botId) !== undefined },
            epoch: options.epoch,
        });
        grants = grantService;
        const constructionEdits = new ConstructionEditAuthorizer({
            claims: claimService,
            grants: grantService,
            sip: { loadSnapshot: () => sip.loadSnapshot() },
        });
        const taskRepository = new TaskRepository(options.database);
        const grantRepository = new EditGrantRepository(options.database);
        const botStore = new BotProfileStore(options.database);
        const plannerSchema = new PlannerSchemaValidator();
        const plannerCache = new PlannerPlanCache({
            store: new SqlitePlannerPlanStore(options.database),
            schemaValidator: plannerSchema,
        });
        const strategicIntentStore = new StrategicIntentStore();
        const [, intentHydrateError] = strategicIntentStore.hydrate(plannerCache);
        if (intentHydrateError !== null) {
            options.logger.debug(
                { error: intentHydrateError },
                'no persisted strategic intent loaded',
            );
        }
        let broadcastIntent: ((intent: StrategicIntent) => void) | null = null;
        if (options.config.planner.enabled) {
            const [skillRegistry, skillError] = SkillCatalog.createRegistry();
            if (skillError) {
                options.logger.error(
                    { error: skillError },
                    'planner disabled: skill catalog failed',
                );
            }
            if (skillError === null && skillRegistry !== null) {
                plannerRuntime = CoordinatorComposition.buildPlannerRuntime({
                    config: options.config,
                    logger: options.logger,
                    secrets: options.planner,
                    database: options.database,
                    tasks,
                    taskRepository,
                    botStore,
                    worldModel,
                    sip,
                    positions: (botId) => sessions.get(botId)?.position ?? null,
                    auditor: taskAuditor,
                    skillIds: new Set(skillRegistry.list().map((skill) => skill.id)),
                    schema: plannerSchema,
                    cache: plannerCache,
                    onApplied: (cycle) => {
                        if (!strategicIntentStore.updateFromCycle(cycle)) return;
                        const intent = strategicIntentStore.current();
                        if (intent !== null) broadcastIntent?.(intent);
                    },
                });
            }
        }
        const botPresence = new BotPresenceTracker(botStore);
        const botIdentity = new BotIdentityAuthenticator(botStore, options.config.botNames);
        const botDelta = new BotDeltaSyncPlanner(botStore, {
            tasks: taskRepository,
            grants: grantRepository,
            sip: {
                revision: () => {
                    const [snapshot, snapshotError] = sip.loadSnapshot();
                    if (snapshotError) return [null, snapshotError];
                    return [snapshot?.revision ?? 0, null];
                },
            },
        });
        const agencyStore = new AgencyStateStore(options.database, {
            workingMemory: options.config.agency.workingMemory,
        });
        const agentEpisodes = new AgentEpisodeRepository(options.database);
        const projectRepository = new PersonalProjectRepository(options.database);
        const blueprintDocuments = new BlueprintDocumentService({
            documents: new BlueprintDocumentRepository(options.database),
        });
        const constructionPlans = new ConstructionPlanDocumentService({
            plans: new ConstructionPlanRepository(options.database),
        });
        const constructionPlanner = new ProjectConstructionPlanner({
            world: new CoordinatorConstructionWorld(worldModel),
            blueprints: blueprintDocuments,
            plans: constructionPlans,
            maxStructureBlocks: options.config.building.maxStructureBlocks,
            maxWorkPackageBlocks: options.config.building.maxWorkPackageBlocks,
        });
        const constructionTasks = new ProjectConstructionTaskSeeder(tasks);
        const projectConstruction = new ProjectConstructionService(
            constructionPlanner,
            constructionTasks,
        );
        const projectService = new PersonalProjectService({
            projects: projectRepository,
            claims: {
                acquire: (input, now) => {
                    const [claim, claimError] = claimService.acquire(input, now);
                    if (claimError) {
                        return [null, CoordinatorComposition.describeFailure(claimError)];
                    }
                    if (claim === null) return [null, 'claim returned null'];
                    return [{ id: claim.id, fencingToken: claim.fencingToken }, null];
                },
                release: (claimId, botId, fencingToken, now) => {
                    const [, releaseError] = claimService.release(
                        claimId,
                        botId,
                        fencingToken,
                        now,
                    );
                    if (releaseError) {
                        return [null, CoordinatorComposition.describeFailure(releaseError)];
                    }
                    return [undefined, null];
                },
            },
            bots: botStore,
            agency: agencyStore,
            episodes: agentEpisodes,
            events,
            sip: new ProjectSipAdapter({
                loadSnapshot: () => sip.loadSnapshot(),
                commit: (input) => sip.commit(input),
            }),
            construction: projectConstruction,
            logger: options.logger,
        });
        const projectProgress = new ProjectConstructionProgressService({
            tasks,
            projects: projectRepository,
            claims: claimService,
            grants: grantService,
            sip: {
                loadSnapshot: () => sip.loadSnapshot(),
                commit: (input) => sip.commit(input),
            },
            events,
            logger: options.logger,
        });
        const jobMarket = new JobOfferService(
            new CoordinatorJobOfferMarket(
                tasks,
                events,
                () => new Date().toISOString(),
                grants ?? undefined,
            ),
        );
        const botResume = new BotResumeOrchestrator(
            botStore,
            {
                agency: agencyStore,
                projects: projectRepository,
                claims: claimRepository,
                tasks: taskRepository,
                grants: grantRepository,
                checkpoints: new SqliteSkillCheckpointStore(options.database),
            },
            botDelta,
            options.epoch,
        );
        let messageRouter: MessageRouter | null = null;
        const transport = new TransportServer({
            host: options.config.transport.host,
            port: options.config.transport.port,
            registry,
            logger: options.logger,
            onMessage: (connection, envelope) => messageRouter?.handleMessage(connection, envelope),
            onClose: (connection) => messageRouter?.handleClose(connection),
        });
        const router = new CommandRouter({
            epoch: options.epoch,
            sessions,
            transport,
            logger: options.logger,
        });
        const decision = new DecisionService({
            config: options.config,
            logger: options.logger,
            loader: new DecisionModelLoader(),
        });
        const backpressure = new BackpressureController();
        const decisionTrace = new DecisionTraceRecorder(
            events,
            options.config.training.traceEnabled,
            options.logger,
        );
        const decisionAdapter = new DecisionCommandAdapter(
            decision,
            transport,
            options.logger,
            decisionTrace,
        );
        const refreshProjectProgress = (): void => {
            const [completed, progressError] = projectProgress.reconcile();
            if (progressError) {
                options.logger.warn(
                    { error: progressError },
                    'project progress reconciliation failed',
                );
                return;
            }
            for (const project of completed ?? []) {
                const connection = transport
                    .list()
                    .find((candidate) => candidate.botId === project.botId);
                if (connection === undefined) continue;
                transport.send(
                    connection,
                    ProtocolEnvelope.create('event', BOT_PROJECT_UPDATE_EVENT, {
                        botId: project.botId,
                        project,
                    }),
                );
            }
        };
        const taskCommands = new TaskCommandHandler(tasks, transport, options.logger, () =>
            refreshProjectProgress(),
        );
        const projectCommands = new ProjectCommandHandler(
            projectService,
            transport,
            options.logger,
        );
        const jobCommands = new JobCommandHandler(jobMarket, transport, options.logger);
        const blueprintCommands = new BlueprintCommandHandler(
            blueprintDocuments,
            transport,
            options.logger,
        );
        const constructionPlanCommands = new ConstructionPlanCommandHandler(
            constructionPlans,
            transport,
            options.logger,
        );
        broadcastIntent = (intent) => {
            const [, broadcastError] = transport.broadcast(
                ProtocolEnvelope.create('event', PLANNER_STRATEGIC_INTENT_EVENT, { intent }),
            );
            if (broadcastError !== null) {
                options.logger.warn(
                    { error: broadcastError.type },
                    'strategic intent broadcast failed',
                );
            }
        };
        const handshake = new SessionHandshake({
            epoch: options.epoch,
            botNames: options.config.botNames,
            sessions,
            events,
            transport,
            logger: options.logger,
            strategicIntent: (botId) => strategicIntentStore.forBot(botId),
            bots: {
                authenticate: (botId, username, now) =>
                    botIdentity.authenticate(botId, username, now),
                markOnline: (botId, now) => botPresence.markOnline(botId, now),
                resume: (botId, now) => botResume.resume(botId, now),
            },
        });
        messageRouter = new MessageRouter({
            sessions,
            router,
            handshake,
            events,
            logger: options.logger,
            onChunkSnapshot: (payload) => {
                const [, ingestError] = worldModel.ingestChunk(payload);
                if (ingestError) {
                    options.logger.warn(
                        { error: ingestError, chunk: payload.chunk },
                        'chunk snapshot ingestion failed',
                    );
                }
            },
            onLandmarkCandidate: (payload) => {
                const [, ingestError] = worldModel.ingestLandmark(payload);
                if (ingestError) {
                    options.logger.warn(
                        { error: ingestError, type: payload.candidate.type },
                        'landmark candidate ingestion failed',
                    );
                    return;
                }
                plannerRuntime?.noteLandmark(payload.candidate.type);
            },
            onBlockUpdate: (payload) => {
                const [before, beforeError] = worldModel.blockAt(payload.block.position);
                const [decision, decisionError] = constructionEdits.authorize(
                    payload,
                    beforeError === null ? (before?.blockId ?? null) : null,
                );
                if (decisionError !== null) {
                    options.logger.warn(
                        { error: decisionError, botId: payload.botId },
                        'construction edit authorization failed',
                    );
                }
                const [, ingestError] = worldModel.ingestBlockUpdate(payload);
                if (ingestError) {
                    options.logger.warn(
                        { error: ingestError, chunk: payload.chunk },
                        'block update ingestion failed',
                    );
                    return;
                }
                const authorized = decision?.authorized ?? false;
                const rejectionReason =
                    decision !== null && decision.authorized === false
                        ? decision.reason
                        : undefined;
                const [, changelogError] = blockChanges.append({
                    botId: payload.botId,
                    position: payload.block.position,
                    before: before ?? undefined,
                    after: payload.block,
                    createdAt: payload.observedAt,
                    authorized,
                    ...(rejectionReason === undefined ? {} : { rejectionReason }),
                    ...(payload.attribution ?? {}),
                });
                if (changelogError) {
                    options.logger.warn(
                        { error: changelogError.type },
                        'block changelog write failed',
                    );
                }
                if (authorized) return;
                const reason = rejectionReason ?? decisionError ?? 'block edit rejected';
                const taskId = payload.attribution?.taskId;
                if (taskId !== undefined) {
                    const [, requeueError] = tasks.requeue(
                        taskId,
                        'coordinator',
                        reason,
                        payload.observedAt,
                    );
                    if (requeueError) {
                        options.logger.warn(
                            { error: requeueError, taskId },
                            'rejected edit task requeue failed',
                        );
                    }
                }
                const [, eventError] = events.append({
                    type: 'construction.edit-rejected',
                    botId: payload.botId,
                    actor: 'coordinator',
                    payload: {
                        position: payload.block.position,
                        reason,
                        attribution: payload.attribution ?? null,
                    },
                    createdAt: payload.observedAt,
                });
                if (eventError) {
                    options.logger.warn({ error: eventError.type }, 'rejected edit audit failed');
                }
                const connection = transport
                    .list()
                    .find((candidate) => candidate.botId === payload.botId);
                if (connection !== undefined) {
                    transport.send(
                        connection,
                        ProtocolEnvelope.create('request', BOT_SAFETY_STOP, { reason }),
                    );
                }
            },
            onAgencyState: (payload) => {
                const [, saveError] = agencyStore.saveSnapshot(
                    payload.botId,
                    payload.state,
                    payload.at,
                );
                if (saveError) {
                    options.logger.warn(
                        { botId: payload.botId, error: saveError },
                        'agency state save failed',
                    );
                }
            },
            onAgencyEpisode: (payload) => {
                const [, appendError] = agentEpisodes.append({
                    id: payload.episode.id,
                    botId: payload.botId,
                    goalId: payload.episode.goalId,
                    kind: payload.episode.kind,
                    summary: payload.episode.summary,
                    position: payload.episode.position,
                    relatedBotId: payload.episode.relatedBotId,
                    payload: payload.episode.payload,
                    createdAt: payload.at,
                });
                if (appendError) {
                    options.logger.warn(
                        { botId: payload.botId, error: appendError },
                        'agency episode append failed',
                    );
                }
            },
            onDecisionRequest: (connection, payload, envelope) => {
                void decisionAdapter.handle(connection, payload, envelope);
            },
            onProjectPropose: (connection, payload, envelope) =>
                projectCommands.handlePropose(connection, payload, envelope),
            onProjectAbandon: (connection, payload, envelope) =>
                projectCommands.handleAbandon(connection, payload, envelope),
            onBlueprintGet: (connection, payload, envelope) =>
                blueprintCommands.handleGet(connection, payload, envelope),
            onConstructionPlanGet: (connection, payload, envelope) =>
                constructionPlanCommands.handleGet(connection, payload, envelope),
            onJobOffers: (connection, payload, envelope) =>
                jobCommands.handleOffers(connection, payload, envelope),
            onJobDecide: (connection, payload, envelope) =>
                jobCommands.handleDecide(connection, payload, envelope),
            onTaskClaim: (connection, payload, envelope) =>
                taskCommands.handleClaim(connection, payload, envelope),
            onTaskRenew: (connection, payload, envelope) =>
                taskCommands.handleRenew(connection, payload, envelope),
            onTaskComplete: (connection, payload, envelope) =>
                taskCommands.handleComplete(connection, payload, envelope),
            onTaskFail: (connection, payload, envelope) =>
                taskCommands.handleFail(connection, payload, envelope),
            onSessionClosed: (botId) => {
                const [, presenceError] = botPresence.markOffline(botId);
                if (presenceError) {
                    options.logger.warn(
                        { botId, error: presenceError },
                        'bot offline presence update failed',
                    );
                }
            },
        });
        const opsMetrics = new OpsMetricsRegistry();
        const opsLogger = new OpsStructuredLogger(options.logger);
        const status = new OpsStatusAggregator({
            bots: { list: () => botPresence.list() },
            tasks: taskRepository,
            claims: claimRepository,
            grants: grantRepository,
            sip: { loadSnapshot: () => sip.loadSnapshot() },
            decisions: { status: () => decision.status() },
            metrics: opsMetrics,
        });
        const opsHealth = new OpsHealthReadiness({
            status,
            decisions: { status: () => decision.status() },
            database: {
                ping: (): Result<void, string> => {
                    const [, pingError] = attempt(() => options.database.prepare('SELECT 1').get());
                    return pingError
                        ? [null, pingError instanceof Error ? pingError.message : String(pingError)]
                        : [undefined, null];
                },
            },
            transport: { isListening: () => transport.isListening() },
            uptimeSeconds: () => Math.round(process.uptime()),
            metrics: opsMetrics,
        });
        const ops = new OpsApi({
            host: options.config.ops.host,
            port: options.config.ops.port,
            logger: opsLogger,
            metrics: opsMetrics,
            status,
            health: opsHealth,
            agency: new AgencyStatusView(
                new AgencyStatusSource({
                    states: agencyStore,
                    episodes: agentEpisodes,
                    sessions,
                }),
            ),
            sip: new OpsSipDump({ loadSnapshot: () => sip.loadSnapshot() }, opsMetrics),
            audit: new OpsAuditViewer(
                {
                    events,
                    blocks: new BlockChangelogReader(options.database),
                    episodes: new EpisodeStore(options.database),
                },
                opsMetrics,
            ),
            pauseResume: new OpsPauseResumeController({
                transport,
                presence: botPresence,
                audit: events,
                logger: opsLogger,
                metrics: opsMetrics,
            }),
            emergencyStop: new OpsFleetEmergencyStop({
                transport,
                presence: botPresence,
                audit: events,
                logger: opsLogger,
                metrics: opsMetrics,
            }),
            context: {
                epoch: options.epoch,
                schemaVersion: options.schemaVersion,
                sessions: () => sessions.count(),
                uptimeSeconds: () => Math.round(process.uptime()),
            },
        });
        let lastDecayAt = Date.now();
        let lastBackpressureLevel = backpressure.current().level;
        let lastReconcileAt = Date.now();
        let lastRetentionAt = Date.now();
        const scheduler = new Scheduler({
            intervalMs: 5000,
            logger: options.logger,
            tick: () => {
                const staleSessions = sessions.pruneStale(15_000);
                if (staleSessions.length) {
                    options.logger.warn({ staleSessions }, 'pruned stale sessions');
                    staleSessions.forEach((botId) => botPresence.markOffline(botId));
                }
                if (claims !== null) {
                    const [reaped, reapError] = claims.reapExpired();
                    if (reapError) {
                        options.logger.warn({ error: reapError }, 'claim lease reaping failed');
                    } else if (reaped !== null && reaped.length > 0) {
                        options.logger.info({ reaped: reaped.length }, 'claim leases expired');
                    }
                }
                if (grants !== null) {
                    const [expired, expiryError] = grants.expire();
                    if (expiryError) {
                        options.logger.warn({ error: expiryError }, 'grant expiry failed');
                    } else if (expired !== null && expired.length > 0) {
                        options.logger.info({ expired: expired.length }, 'edit grants expired');
                    }
                }
                const now = Date.now();
                if (now - lastDecayAt >= 30_000) {
                    lastDecayAt = now;
                    const [, decayError] = worldModel.applyDecay(new Date(now).toISOString());
                    if (decayError) {
                        options.logger.warn({ error: decayError }, 'landmark decay failed');
                    }
                }
                if (now - lastReconcileAt >= 60_000) {
                    lastReconcileAt = now;
                    const [, reconcileError] = reconciliation.run();
                    if (reconcileError) {
                        options.logger.warn({ error: reconcileError }, 'SIP reconciliation failed');
                    }
                }
                if (now - lastRetentionAt >= 86_400_000) {
                    lastRetentionAt = now;
                    const [, pruneError] = retention.prune(30);
                    if (pruneError) {
                        options.logger.warn({ error: pruneError }, 'retention pruning failed');
                    }
                }
                const decisionStatus = decision.status();
                const pressure = backpressure.evaluate({
                    decisionP95Milliseconds: decisionStatus.latency.p95,
                    decisionSamples: decisionStatus.latency.samples,
                });
                decision.setRateScale(pressure.rateScale);
                if (pressure.level !== lastBackpressureLevel) {
                    lastBackpressureLevel = pressure.level;
                    const [, auditError] = events.append({
                        type: 'core.backpressure',
                        actor: 'coordinator',
                        payload: pressure,
                    });
                    if (auditError) {
                        options.logger.warn(
                            { error: auditError.type },
                            'backpressure audit write failed',
                        );
                    }
                    options.logger.info(
                        {
                            level: pressure.level,
                            rateScale: pressure.rateScale,
                            reasons: pressure.reasons,
                        },
                        'backpressure state changed',
                    );
                }
                refreshProjectProgress();
                const [, leaseError] = taskLeaseReaper.reap();
                if (leaseError) {
                    options.logger.warn({ error: leaseError }, 'task lease reaping failed');
                }
                if (plannerRuntime !== null) {
                    const [, auditError] = taskAuditor.audit();
                    if (auditError) {
                        options.logger.warn(
                            { error: auditError },
                            'task independence audit failed',
                        );
                    }
                }
                const [taskList, taskListError] = taskRepository.list();
                const [botList, botListError] = botStore.list();
                if (taskListError || botListError) {
                    options.logger.warn(
                        {
                            taskError: taskListError?.type ?? null,
                            botError: botListError?.type ?? null,
                        },
                        'work gap counts unavailable',
                    );
                    plannerRuntime?.tick();
                } else if (plannerRuntime !== null) {
                    const openTasks =
                        taskList?.filter((task) => ACTIONABLE_TASK_STATUSES.has(task.status))
                            .length ?? 0;
                    const onlineBots =
                        botList?.filter((bot) => bot.status === 'online').length ?? 0;
                    const requiredTasks =
                        onlineBots * (1 + options.config.planner.reserveTasksPerBot);
                    plannerRuntime.tick(openTasks, requiredTasks);
                }
            },
        });
        const recovery = new RestartRecovery(options.database, options.epoch);
        const supervisor = options.config.autoSpawnBots
            ? new BotProcessSupervisor({
                  root: options.currentWorkingDirectory,
                  botCount: options.config.botCount,
                  logger: options.logger,
              })
            : null;

        return new Coordinator({
            config: options.config,
            logger: options.logger,
            database: options.database,
            epoch: options.epoch,
            schemaVersion: options.schemaVersion,
            transport,
            messageRouter,
            ops,
            scheduler,
            recovery,
            reconcile: () => {
                const [report, reconcileError] = reconciliation.run();
                if (reconcileError) return [null, reconcileError];
                if (report !== null) {
                    options.logger.info(
                        {
                            revision: report.revision,
                            structures: report.structures,
                            findings: report.findings.length,
                            progressChanges: report.progressChanges.length,
                        },
                        'startup SIP reconciliation complete',
                    );
                }
                return [undefined, null];
            },
            supervisor,
            sip,
            tasks,
            claims,
            grants,
            decision,
            blueprints: blueprintDocuments,
        });
    }

    private static describeFailure(failure: unknown): string {
        if (failure instanceof Error) return failure.message;
        if (typeof failure !== 'object' || failure === null) return String(failure);
        if ('message' in failure && typeof failure.message === 'string') return failure.message;
        if ('type' in failure && typeof failure.type === 'string') return failure.type;
        return JSON.stringify(failure);
    }

    private static buildPlannerRuntime(options: {
        config: TicrafterConfig;
        logger: LoggerPort;
        secrets: PlannerSecrets;
        database: CoordinatorDatabase;
        tasks: TaskBoard;
        taskRepository: TaskRepository;
        botStore: BotProfileStore;
        worldModel: CoordinatorWorldModel;
        sip: SipTransactionalCommitter;
        positions: (botId: string) => PlannerPosition | null;
        auditor: TaskIndependenceAuditor;
        skillIds: ReadonlySet<string>;
        schema: PlannerSchemaValidator;
        cache: PlannerPlanCache;
        onApplied: (cycle: PlannerCycleResult) => void;
    }): PlannerRuntime {
        const planner = options.config.planner;
        const client = new OpenAiPlannerClient({
            baseUrl: options.secrets.baseUrl,
            apiKey: options.secrets.apiKey,
            model: planner.model,
            sessionId: `ses_${crypto.randomUUID()}`,
            http: new FetchPlannerHttpPort(),
            timeoutMilliseconds: planner.timeoutMilliseconds,
        });
        const budget = new PlannerBudgetLimiter({
            callsPerMinute: planner.callsPerMinute,
            maxTokensPerCall: planner.maxTokensPerCall,
        });
        const schema = options.schema;
        const sipPorts = new CoordinatorSipProposalPort();
        const templateCatalog = BuiltInTemplates.createRegistry();
        if (templateCatalog[1] !== null) {
            options.logger.warn(
                { error: templateCatalog[1] },
                'building template catalog unavailable',
            );
        }
        const templateTypes =
            templateCatalog[0] === null ? new Set<string>() : new Set(templateCatalog[0].types());
        const semantic = new PlannerSemanticValidator({
            skills: { has: (skillId) => options.skillIds.has(skillId) },
            sip: sipPorts,
            reserveTasksPerBot: planner.reserveTasksPerBot,
            strategicIntentRequired: planner.strategicIntent.enabled,
            maxBotOverrides: planner.strategicIntent.maxBotOverrides,
            goalKinds: new Set(STRATEGIC_GOAL_KINDS),
            blueprints: {
                has: (reference) =>
                    reference.startsWith('template:') &&
                    templateTypes.has(reference.slice('template:'.length)),
            },
        });
        const cache = options.cache;
        const context = new PlannerContextBuilder({
            source: new CoordinatorPlannerContextSource({
                sip: options.sip,
                tasks: options.taskRepository,
                bots: options.botStore,
                world: options.worldModel,
                positions: options.positions,
            }),
            allowedSkills: [...options.skillIds].sort(),
            maxContextCharacters: planner.maxContextCharacters,
            reserveTasksPerBot: planner.reserveTasksPerBot,
            strategicIntentEnabled: planner.strategicIntent.enabled,
        });
        const service = new PlannerService({
            enabled: true,
            contextBuilder: context,
            repairLoop: new PlannerRepairLoop({
                client,
                schemaValidator: schema,
                semanticValidator: semantic,
                budgetLimiter: budget,
                maxRepairAttempts: planner.maxRepairAttempts,
                maxOutputTokens: planner.maxTokensPerCall,
                onRejectedResponse: (response) => {
                    const [, recordError] = cache.recordResponses(null, [response]);
                    if (recordError) {
                        options.logger.warn(
                            { error: recordError.type },
                            'planner rejected response record failed',
                        );
                    }
                },
            }),
            cache,
            keepLastGood: new PlannerKeepLastGoodFallback(cache),
            sipTranslator: new PlannerSipMutationTranslator(sipPorts),
            taskTranslator: new PlannerTaskDagTranslator(
                new CoordinatorTaskProposalPort(options.taskRepository),
            ),
            arbitration: new PlannerArbitrationHandler({
                client,
                budgetLimiter: budget,
                maxOutputTokens: planner.maxTokensPerCall,
            }),
        });
        return new PlannerRuntime({
            service,
            triggers: new PlannerTriggerEvaluator({
                intervalMilliseconds: planner.intervalMilliseconds,
            }),
            applier: PlannerCycleApplier.forTaskBoard(options.sip, options.tasks),
            onApplied: options.onApplied,
            beforeCycle: () => {
                const [, auditError] = options.auditor.audit();
                if (auditError) return [null, auditError];
                return [undefined, null];
            },
            logger: options.logger,
        });
    }
}
