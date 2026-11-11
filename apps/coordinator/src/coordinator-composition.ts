import {
    type LoggerPort,
    MessageSchemaRegistry,
    type PlannerSecrets,
    type TicrafterConfig,
} from '@ticrafter/core';
import {
    BlockChangelogWriter,
    EventLogWriter,
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
    PlannerKeepLastGoodFallback,
    PlannerPlanCache,
    PlannerRepairLoop,
    PlannerSchemaValidator,
    PlannerSemanticValidator,
    PlannerService,
    PlannerSipMutationTranslator,
    PlannerTaskDagTranslator,
    PlannerTriggerEvaluator,
} from '@ticrafter/planning';
import { SkillCatalog } from '@ticrafter/skills';

import {
    BotDeltaSyncPlanner,
    BotIdentityAuthenticator,
    BotPresenceTracker,
    BotProfileStore,
    BotResumeOrchestrator,
} from './bots/index.js';
import { ClaimRepository, ClaimService } from './claims/index.js';
import {
    BotProcessSupervisor,
    CommandRouter,
    Coordinator,
    type CoordinatorDatabase,
    MessageRouter,
    OpsServer,
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
    CoordinatorPlannerContextSource,
    CoordinatorSipProposalPort,
    CoordinatorTaskProposalPort,
    PlannerRuntime,
} from './planner/index.js';
import { SipTransactionalCommitter } from './sip/index.js';
import { TaskBoard, TaskCommandHandler, TaskRepository } from './tasks/index.js';
import { TransportServer } from './transport/index.js';
import { CoordinatorWorldModel } from './world-model.js';

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
        claims = new ClaimService({
            database: options.database,
            transactions,
            sessions: { isConnected: (botId) => sessions.get(botId) !== undefined },
            tasks: {
                requeue: (taskId, actor, reason, now) => tasks.requeue(taskId, actor, reason, now),
            },
            epoch: options.epoch,
        });
        grants = new GrantService({
            database: options.database,
            transactions,
            sip: { load: () => sip.loadSnapshot() },
            claims: { listActive: () => claimRepository.listActive() },
            presence: { isOnline: (botId) => sessions.get(botId) !== undefined },
            epoch: options.epoch,
        });
        const taskRepository = new TaskRepository(options.database);
        const grantRepository = new EditGrantRepository(options.database);
        const botStore = new BotProfileStore(options.database);
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
                    taskRepository,
                    botStore,
                    worldModel,
                    sip,
                    skillIds: new Set(skillRegistry.list().map((skill) => skill.id)),
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
        const botResume = new BotResumeOrchestrator(
            botStore,
            {
                claims: claimRepository,
                tasks: taskRepository,
                grants: grantRepository,
                checkpoints: new SqliteSkillCheckpointStore(options.database),
            },
            botDelta,
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
        const taskCommands = new TaskCommandHandler(tasks, transport, options.logger);
        const handshake = new SessionHandshake({
            epoch: options.epoch,
            botNames: options.config.botNames,
            sessions,
            events,
            transport,
            logger: options.logger,
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
                const [before] = worldModel.blockAt(payload.block.position);
                const [, ingestError] = worldModel.ingestBlockUpdate(payload);
                if (ingestError) {
                    options.logger.warn(
                        { error: ingestError, chunk: payload.chunk },
                        'block update ingestion failed',
                    );
                    return;
                }
                const [, changelogError] = blockChanges.append({
                    botId: payload.botId,
                    position: payload.block.position,
                    before: before ?? undefined,
                    after: payload.block,
                    createdAt: payload.observedAt,
                });
                if (changelogError) {
                    options.logger.warn(
                        { error: changelogError.type },
                        'block changelog write failed',
                    );
                }
            },
            onDecisionRequest: (connection, payload, envelope) => {
                void decisionAdapter.handle(connection, payload, envelope);
            },
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
        const ops = new OpsServer({
            host: options.config.ops.host,
            port: options.config.ops.port,
            logger: options.logger,
            status: () => ({
                ok: true,
                epoch: options.epoch,
                uptimeSeconds: Math.round(process.uptime()),
                sessions: sessions.count(),
                schemaVersion: options.schemaVersion,
            }),
        });
        let lastDecayAt = Date.now();
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
                plannerRuntime?.tick();
            },
        });
        const recovery = new RestartRecovery(options.database);
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
            supervisor,
            sip,
            tasks,
            claims,
            grants,
            decision,
        });
    }

    private static buildPlannerRuntime(options: {
        config: TicrafterConfig;
        logger: LoggerPort;
        secrets: PlannerSecrets;
        database: CoordinatorDatabase;
        taskRepository: TaskRepository;
        botStore: BotProfileStore;
        worldModel: CoordinatorWorldModel;
        sip: SipTransactionalCommitter;
        skillIds: ReadonlySet<string>;
    }): PlannerRuntime {
        const planner = options.config.planner;
        const client = new OpenAiPlannerClient({
            baseUrl: options.secrets.baseUrl,
            apiKey: options.secrets.apiKey,
            model: planner.model,
            http: new FetchPlannerHttpPort(),
            timeoutMilliseconds: planner.timeoutMilliseconds,
        });
        const budget = new PlannerBudgetLimiter({
            callsPerMinute: planner.callsPerMinute,
            maxTokensPerCall: planner.maxTokensPerCall,
        });
        const schema = new PlannerSchemaValidator();
        const sipPorts = new CoordinatorSipProposalPort();
        const semantic = new PlannerSemanticValidator({
            skills: { has: (skillId) => options.skillIds.has(skillId) },
            sip: sipPorts,
        });
        const cache = new PlannerPlanCache({
            store: new SqlitePlannerPlanStore(options.database),
            schemaValidator: schema,
        });
        const context = new PlannerContextBuilder({
            source: new CoordinatorPlannerContextSource({
                sip: options.sip,
                tasks: options.taskRepository,
                bots: options.botStore,
                world: options.worldModel,
            }),
            maxContextCharacters: planner.maxContextCharacters,
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
            logger: options.logger,
        });
    }
}
