import {
    AgencyState,
    NeedsModel,
    PersonalityModel,
    ProgressionPlanner,
    RoutineModel,
    SocialEngine,
    StaticRecipePort,
    StrategicIntentPolicy,
} from '@ticrafter/agency';
import {
    DeterministicPolicy,
    GazeController,
    HumanizationPolicy,
    LayaClient,
    SeededRandomSource,
    TacticalDecisionPolicy,
} from '@ticrafter/brains';
import {
    attempt,
    BLOCK_UPDATE_EVENT,
    BOT_AUTONOMY_PAUSE,
    BOT_AUTONOMY_RESUME,
    BOT_PERMISSION_OUTCOME_EVENT,
    BOT_PLAYER_SIGHTING_EVENT,
    BOT_SAFETY_RESUME,
    BOT_SAFETY_STOP,
    BOT_SKILL_CANCEL,
    BOT_SKILL_RESUME,
    BOT_SKILL_START,
    botAutonomyPauseSchema,
    botAutonomyResumeSchema,
    botSafetyResumeSchema,
    botSafetyStopSchema,
    botSkillCancelSchema,
    botSkillResumeSchema,
    botSkillStartSchema,
    type ClockHandle,
    type Envelope,
    type LoggerPort,
    type MessageSchemaRegistry,
    PLANNER_STRATEGIC_INTENT_EVENT,
    plannerStrategicIntentEventSchema,
    type Result,
    type SessionResume,
    SKILL_PROGRESS_EVENT,
    type TicrafterConfig,
} from '@ticrafter/core';
import { BlockUpdateListener } from '@ticrafter/perception';
import {
    MemoryCheckpointStore,
    type SkillCheckpointStore,
    type SkillInput,
    type SkillProgressSink,
    type SkillServices,
} from '@ticrafter/skills';

import { ChatAdapter, SocialPresence } from '../chat/index.js';
import { BehavioralDispatch } from '../index.js';
import { ActionExecutor } from '../index.js';
import { BehaviorTraceRecorder } from '../index.js';
import { AgencyRuntime, type AgencyRuntimeConfig } from '../index.js';
import { type AgencyHomeSnapshot } from '../index.js';
import { AgencyStateAdapter } from '../index.js';
import { BlueprintFetchClient } from '../index.js';
import { BuildingExecutionService } from '../index.js';
import { BuildingProcurementService } from '../index.js';
import { BuildingSkillServices } from '../index.js';
import { ConstructionPlanFetchClient } from '../index.js';
import { GuardianHook } from '../index.js';
import { SkillHost } from '../index.js';
import { TaskAutonomy } from '../index.js';
import { PlotOwnershipClient } from '../index.js';
import { BotTransportClient } from '../transport/index.js';
import { PlayerSightingReporter, VillageRuntime } from '../village/index.js';
import type { BotPlatformPorts } from './ports.js';
import { HeadlessAgencySnapshotSource, HeadlessSkillContextSource } from './sources.js';

export interface HeadlessBotRuntimeOptions {
    config: TicrafterConfig;
    name: string;
    botId: string;
    botIndex: number;
    url: string;
    registry: MessageSchemaRegistry;
    logger: LoggerPort;
    dataDirectory: string;
    ports: BotPlatformPorts;
    checkpointStore?: SkillCheckpointStore;
    traits?: Readonly<Record<string, number>>;
    needs?: Readonly<Record<string, number>>;
}

export class HeadlessBotRuntime {
    private transport: BotTransportClient | null = null;
    private guardian: GuardianHook | null = null;
    private skills: SkillHost | null = null;
    private agency: AgencyRuntime | null = null;
    private autonomy: TaskAutonomy | null = null;
    private buildingServices: BuildingSkillServices | null = null;
    private buildExecution: BuildingExecutionService | null = null;
    private unsubscribeInbound: (() => void) | null = null;
    private unsubscribeBlocks: (() => void) | null = null;
    private heartbeat: ClockHandle | null = null;
    private social: SocialPresence | null = null;
    private villageRuntime: VillageRuntime | null = null;
    private playerSightings: PlayerSightingReporter | null = null;
    private perceptionTimer: ClockHandle | null = null;
    private unsubscribeChat: (() => void) | null = null;
    private closed = false;
    private autonomyPausedReason: string | null = null;
    private pendingResume: SessionResume | null = null;

    constructor(private readonly options: HeadlessBotRuntimeOptions) {}

    get botId(): string {
        return this.options.botId;
    }

    async start(): Promise<Result<void, string>> {
        const transport = new BotTransportClient({
            url: this.options.url,
            registry: this.options.registry,
            clock: this.options.ports.clock,
        });
        const [, connectError] = await transport.connect();
        if (connectError) return [null, HeadlessBotRuntime.describe(connectError)];
        this.transport = transport;
        const [hello, helloError] = await transport.hello(this.options.botId, this.options.name);
        if (helloError) {
            transport.close();
            return [null, HeadlessBotRuntime.describe(helloError)];
        }
        if (hello === null || !hello.accepted) {
            transport.close();
            return [null, hello?.reason ?? 'coordinator rejected session'];
        }
        this.pendingResume = hello.resume ?? null;

        const { config } = this.options;
        const { ports } = this.options;
        const actionPort = ports.dispatch;
        const trace = new BehaviorTraceRecorder(
            this.options.botId,
            (entry) => {
                transport.sendEvent('bot.event', {
                    botId: this.options.botId,
                    event: 'behavior.trace',
                    at: entry.at,
                    data: entry,
                });
            },
            () => this.options.ports.clock.now(),
        );
        this.guardian = new GuardianHook({
            source: { read: () => ports.safety() },
            logger: this.options.logger,
            intervalMilliseconds: Math.max(1, Math.floor(1000 / config.safety.guardianHz)),
            clock: ports.clock,
            onCritical: (report) => {
                if (report.signals.some((signal) => signal.severity === 'critical')) {
                    this.skills?.preempt('guardian critical hazard');
                }
            },
            incidentSink: {
                record: (incident) => {
                    transport.sendEvent('bot.event', {
                        botId: this.options.botId,
                        event: 'safety.incident',
                        at: incident.at,
                        data: incident,
                    });
                },
            },
        });
        this.buildExecution = new BuildingExecutionService({
            world: ports.world,
            snapshot: () => ports.safety(),
            safety: {
                evaluate: (request) =>
                    this.guardian?.evaluate(request) ?? {
                        allowed: false,
                        reason: 'guardian unavailable',
                        signals: [],
                        recovery: { kind: 'safe-mode', reason: 'guardian unavailable' },
                    },
            },
            clock: ports.clock,
        });
        const procurement = new BuildingProcurementService(ports.containers, ports.procurement);
        const [buildingServices] = await BuildingSkillServices.create(
            this.options.dataDirectory,
            ports.world,
            {
                documents: new BlueprintFetchClient(transport, this.options.botId),
                plans: new ConstructionPlanFetchClient(transport, this.options.botId),
                buildExecution: this.buildExecution,
                procurement,
                containers: ports.containers,
            },
        );
        this.buildingServices = buildingServices;

        const [personality, personalityError] = this.options.traits
            ? PersonalityModel.create(this.options.traits)
            : [PersonalityModel.fromBotIndex(this.options.botIndex), null];
        if (personalityError || personality === null) {
            transport.close();
            return [null, personalityError ?? 'personality creation failed'];
        }
        const humanization = new HumanizationPolicy(
            new SeededRandomSource(this.options.botIndex + 1),
            {
                caution: personality.traits.caution,
                orderliness: personality.traits.orderliness,
                patience: personality.traits.patience,
            },
            {
                reactionLatencyMilliseconds: config.behavior.rhythm.reactionLatencyMilliseconds,
                pauseChance: config.behavior.movement.waypointPauseChance,
                pauseDurationMilliseconds: config.behavior.movement.waypointPauseMilliseconds,
                scanChance: config.behavior.movement.scanChance,
                chatDelayMilliseconds: config.behavior.social.replyDelayMilliseconds,
                switchThreshold: config.behavior.rhythm.switchThreshold,
                sprintDistanceThreshold: config.behavior.movement.sprintDistanceThreshold,
            },
        );
        const gaze = new GazeController(
            { yaw: 0, pitch: 0 },
            {
                yawRateRadiansPerSecond: config.behavior.gaze.yawRateRadiansPerSecond,
                pitchRateRadiansPerSecond: config.behavior.gaze.pitchRateRadiansPerSecond,
                updateHz: config.behavior.gaze.updateHz,
            },
        );
        const behavioralDispatch = new BehavioralDispatch({
            inner: actionPort,
            clock: ports.clock,
            policy: humanization,
            trace,
            gaze,
            position: () => ports.position(),
            urgent: () => this.guardian?.emergencyStopActive === true,
        });
        const actionExecutor = new ActionExecutor(
            this.guardian,
            behavioralDispatch,
            this.options.logger,
        );
        const social = new SocialPresence({
            botName: this.options.name,
            adapter: new ChatAdapter({
                transport: {
                    send: (text) => ports.chat?.send(text) ?? [undefined, null],
                },
                engine: new SocialEngine(),
                personality,
                ratePerMinute: config.agency.chatRatePerMinute,
                now: () => ports.clock.now(),
            }),
            clock: ports.clock,
            logger: this.options.logger,
            chatDelay: () => humanization.chatDelay(),
            trace,
            context: (username) => ({
                botName: this.options.name,
                recipient: username,
                phase: RoutineModel.phase(ports.timeOfDay()),
                activeGoal: null,
            }),
            permissionReply: (playerId, _username, message) =>
                this.villageRuntime?.handlePermissionReply(playerId, message) ?? false,
        });
        this.social = social;
        const plotOwnership = new PlotOwnershipClient(transport, this.options.botId);
        this.villageRuntime = new VillageRuntime({
            botId: this.options.botId,
            config: config.behavior.village,
            clock: ports.clock,
            logger: this.options.logger,
            trace,
            world: ports.world,
            ownership: (plot) => plotOwnership.resolve({ plotId: plot.id, bbox: plot.bbox }),
            chat: {
                inquire: (text, usernames) => social.inquire(text, usernames),
            },
            onOutcome: (playerId, plotId, kept, at) => {
                transport.sendEvent(BOT_PERMISSION_OUTCOME_EVENT, {
                    botId: this.options.botId,
                    playerId,
                    plotId,
                    kept,
                    at,
                });
            },
        });
        this.playerSightings = new PlayerSightingReporter({
            clock: ports.clock,
            logger: this.options.logger,
            botId: this.options.botId,
            intervalMilliseconds: 5000,
            radius: config.behavior.village.playerLinkRadius,
            position: () => ports.position(),
            players: () => ports.players?.() ?? [],
            send: (payload) => {
                const [, sendError] = transport.sendEvent(BOT_PLAYER_SIGHTING_EVENT, payload);
                return sendError === null ? [undefined, null] : [null, sendError.type];
            },
        });
        this.unsubscribeChat =
            ports.chat?.listen((username, message, playerId) => {
                const [, socialError] = social.handleIncoming(username, message, playerId);
                if (socialError !== null) {
                    this.options.logger.warn({ error: socialError }, 'social message failed');
                }
            }) ?? null;

        const progressSink: SkillProgressSink = {
            report: (event) => {
                this.autonomy?.observeProgress(event);
                this.agency?.observeProgress(event);
                const [, sendError] = transport.sendEvent(SKILL_PROGRESS_EVENT, event);
                return sendError ? [null, sendError.type] : [undefined, null];
            },
        };
        const [skills, skillsError] = SkillHost.create({
            source: new HeadlessSkillContextSource(
                this.options.botId,
                ports,
                this.skillServices(buildingServices),
            ),
            dispatch: actionExecutor,
            progressSink,
            logger: this.options.logger,
            tickMilliseconds: config.skills.tickMilliseconds,
            checkpointStore: this.options.checkpointStore ?? new MemoryCheckpointStore(),
            clock: ports.clock,
        });
        if (skillsError || skills === null) return [null, skillsError ?? 'skill host failed'];
        this.skills = skills;

        const decisions = new LayaClient({
            transport,
            timeoutMilliseconds: config.decision.timeoutMilliseconds,
            minimumConfidence: config.decision.minConfidence,
            policy: new DeterministicPolicy(),
            tactical: new TacticalDecisionPolicy(config.decision.tactical),
            now: () => ports.clock.now(),
        });
        const persistence = new AgencyStateAdapter({
            botId: this.options.botId,
            events: transport,
            logger: this.options.logger,
            workingMemory: config.agency.workingMemory,
        });
        const [restored, restoreError] = persistence.restore(hello.resume?.agency);
        if (restoreError) return [null, restoreError];
        const [needs, needsError] = this.options.needs
            ? NeedsModel.create(this.options.needs)
            : [null, null];
        if (needsError) {
            transport.close();
            return [null, needsError];
        }
        const [created, createError] =
            restored === null
                ? AgencyState.create({
                      botId: this.options.botId,
                      traits: personality,
                      ...(needs === null ? {} : { needs }),
                      timeOfDay: ports.timeOfDay(),
                  })
                : [restored, null];
        if (createError || created === null) return [null, createError ?? 'agency state missing'];
        const [agency, agencyError] = AgencyRuntime.create(
            {
                botId: this.options.botId,
                context: new HeadlessAgencySnapshotSource(
                    ports,
                    () => ports.home(),
                    () => ports.project(),
                    () => ports.nightIntent(),
                    () => this.villageRuntime?.farmSnapshots() ?? [],
                    () => this.villageRuntime?.villageSnapshots() ?? [],
                ),
                skills,
                persistence,
                logger: this.options.logger,
                config: this.agencyRuntimeConfig(),
                clock: ports.clock,
                isPaused: () => this.autonomyPausedReason !== null,
                isJobActive: () => this.autonomy?.hasActiveTask === true,
                isProjectTaskActive: () => this.autonomy?.activeTaskProjectId !== null,
                progressionPlanner: new ProgressionPlanner(new StaticRecipePort()),
                trace,
            },
            created,
        );
        if (agencyError || agency === null) return [null, agencyError ?? 'agency runtime failed'];
        this.agency = agency;
        const project = ports.project();
        agency.syncProjectFocus(project === null ? [] : [project]);

        this.autonomy = new TaskAutonomy({
            botId: this.options.botId,
            transport,
            decisions,
            skills,
            snapshot: {
                read: () => ({
                    health: ports.health(),
                    food: ports.food(),
                    position: ports.position(),
                    inventory: ports.inventory.items(),
                    hazards: ports.hostiles().map((hostile) => hostile.name),
                }),
            },
            logger: this.options.logger,
            now: () => ports.clock.now(),
            clock: ports.clock,
            jobMarket: {
                context: () => ({
                    ...agency.jobContext(),
                    role: this.pendingResume?.role ?? null,
                }),
            },
            canClaim: () => !agency.hasActiveGoal && skills.activeSkillId === null,
            tacticalContext: () => agency.tacticalContext(),
            recordTacticalDecision: (input) => agency.recordTacticalDecision(input),
            recordTacticalDrop: (input) => agency.recordTacticalDrop(input),
            constructionPrefetch: (input, skillId) =>
                this.buildingServices?.prefetch(input, skillId) ??
                Promise.resolve([null, 'building services are unavailable']),
        });
        this.unsubscribeInbound = transport.onMessage((envelope) => this.handleCommand(envelope));
        this.unsubscribeBlocks = ports.world.onBlockChanged((change) =>
            this.forwardBlockUpdate(change, transport),
        );

        this.guardian.start();
        skills.start();
        agency.restore();
        this.autonomy.start();
        void this.applyPendingResume();
        agency.start();
        this.villageRuntime.start();
        this.playerSightings.start();
        if (ports.perception !== undefined) {
            this.perceptionTimer = ports.clock.setInterval(() => {
                const [candidates, perceptionError] = attempt(
                    () => ports.perception?.candidates() ?? [],
                );
                if (perceptionError !== null) {
                    trace.record('perception', 'candidates', {
                        error:
                            perceptionError instanceof Error
                                ? perceptionError.message
                                : String(perceptionError),
                    });
                    return;
                }
                trace.record('perception', 'candidates', {
                    count: candidates?.length ?? 0,
                    farms: candidates?.filter((candidate) => candidate.type === 'farm').length ?? 0,
                });
                this.villageRuntime?.observeCandidates(candidates ?? [], ports.villagers?.() ?? []);
            }, 1000);
        }
        this.heartbeat = ports.clock.setInterval(() => this.sendHeartbeat(transport), 1000);
        return [undefined, null];
    }

    close(): void {
        this.closed = true;
        this.agency?.stop();
        this.autonomy?.stop();
        this.guardian?.stop();
        this.skills?.stop();
        this.unsubscribeInbound?.();
        this.unsubscribeBlocks?.();
        this.unsubscribeChat?.();
        if (this.heartbeat !== null) this.options.ports.clock.clearInterval(this.heartbeat);
        if (this.perceptionTimer !== null) {
            this.options.ports.clock.clearInterval(this.perceptionTimer);
        }
        this.villageRuntime?.stop();
        this.playerSightings?.stop();
        this.social?.close();
        this.transport?.close();
        this.agency = null;
        this.autonomy = null;
        this.guardian = null;
        this.skills = null;
        this.transport = null;
        this.social = null;
        this.villageRuntime = null;
        this.playerSightings = null;
        this.unsubscribeChat = null;
        this.perceptionTimer = null;
    }

    private async applyPendingResume(): Promise<void> {
        const autonomy = this.autonomy;
        const resume = this.pendingResume;
        if (autonomy === null || resume === null) return;
        if (resume.task === null || resume.fencingToken === null) {
            this.pendingResume = null;
            return;
        }
        if (!autonomy.resumeTask(resume)) {
            this.pendingResume = null;
            return;
        }
        const skillId = resume.task.payload.skillId;
        if (
            this.skills === null ||
            resume.task === null ||
            resume.checkpoint === null ||
            resume.checkpoint === undefined ||
            typeof skillId !== 'string'
        ) {
            return;
        }
        if (skillId === 'construction' || skillId === 'procurement') {
            const planId = resume.task.payload.planId;
            const planRevision = resume.task.payload.planRevision;
            if (typeof planId !== 'string' || typeof planRevision !== 'number') return;
            const [, prefetchError] = (await this.buildingServices?.prefetch(
                { planId, planRevision },
                skillId,
            )) ?? [null, 'building services are unavailable'];
            if (prefetchError !== null) return;
        }
        this.skills.resume(skillId, resume.task.id);
        this.pendingResume = null;
    }

    private skillServices(building: BuildingSkillServices | null): SkillServices | undefined {
        const farms = this.villageRuntime?.farmSource();
        if (building === null && farms === undefined) return undefined;
        return {
            ...(building ?? {}),
            ...(farms === undefined ? {} : { farms }),
        };
    }

    private agencyRuntimeConfig(): AgencyRuntimeConfig {
        const config = this.options.config;
        return {
            enabled: config.agency.enabled,
            goalCadenceMilliseconds: config.agency.goalCadenceMilliseconds,
            needDecayPerMinute: config.agency.needDecayPerMinute,
            committedGoalBonus: config.agency.committedGoalBonus,
            workingMemory: config.agency.workingMemory,
            goalTieBreak: config.agency.goalTieBreak,
            progression: config.agency.progression,
            reflection: config.agency.reflection,
            nightPrep: config.agency.nightPrep,
            minimumDwellMilliseconds: config.behavior.rhythm.minimumDwellMilliseconds,
            switchThreshold: config.behavior.rhythm.switchThreshold,
            progressTimeoutMilliseconds: config.behavior.rhythm.progressTimeoutMilliseconds,
            ...(config.agency.needDecayByNeed === undefined
                ? {}
                : {
                      needDecayByNeed: config.agency
                          .needDecayByNeed as AgencyRuntimeConfig['needDecayByNeed'],
                  }),
            ...(config.agency.goalDeadlines === undefined
                ? {}
                : {
                      goalDeadlines: config.agency
                          .goalDeadlines as AgencyRuntimeConfig['goalDeadlines'],
                  }),
        };
    }

    private handleCommand(envelope: Envelope): void {
        if (this.closed) return;
        if (envelope.kind === 'event' && envelope.type === PLANNER_STRATEGIC_INTENT_EVENT) {
            const parsed = plannerStrategicIntentEventSchema.safeParse(envelope.payload);
            if (parsed.success) {
                this.agency?.setStrategicIntent(
                    StrategicIntentPolicy.forBot(parsed.data.intent, this.options.botId),
                );
            }
            return;
        }
        if (envelope.kind !== 'request') return;
        if (envelope.type === BOT_SKILL_START) {
            void this.handleSkillStart(envelope.payload);
            return;
        }
        if (envelope.type === BOT_SKILL_CANCEL) {
            const parsed = botSkillCancelSchema.safeParse(envelope.payload);
            if (parsed.success) {
                this.skills?.cancel(parsed.data.reason ?? 'coordinator cancelled skill');
            }
            return;
        }
        if (envelope.type === BOT_SKILL_RESUME) {
            const parsed = botSkillResumeSchema.safeParse(envelope.payload);
            if (parsed.success) {
                this.skills?.resume(parsed.data.skillId, parsed.data.taskId ?? 'default');
            }
            return;
        }
        if (envelope.type === BOT_SAFETY_RESUME) {
            const parsed = botSafetyResumeSchema.safeParse(envelope.payload);
            if (!parsed.success) return;
            this.guardian?.resumeSafety();
            this.autonomyPausedReason = null;
            this.autonomy?.resume();
            return;
        }
        if (envelope.type === BOT_SAFETY_STOP) {
            const parsed = botSafetyStopSchema.safeParse(envelope.payload);
            if (!parsed.success) return;
            this.guardian?.triggerEmergencyStop(parsed.data.reason);
            this.autonomyPausedReason = parsed.data.reason;
            this.autonomy?.pause(parsed.data.reason);
            return;
        }
        if (envelope.type === BOT_AUTONOMY_PAUSE) {
            const parsed = botAutonomyPauseSchema.safeParse(envelope.payload);
            if (parsed.success) this.autonomy?.pause(parsed.data.reason ?? 'autonomy paused');
            return;
        }
        if (envelope.type === BOT_AUTONOMY_RESUME) {
            const parsed = botAutonomyResumeSchema.safeParse(envelope.payload);
            if (parsed.success) this.autonomy?.resume();
        }
    }

    private async handleSkillStart(payload: unknown): Promise<void> {
        const parsed = botSkillStartSchema.safeParse(payload);
        if (!parsed.success || this.skills === null) return;
        const input: SkillInput =
            parsed.data.taskId === undefined
                ? parsed.data.input
                : { ...parsed.data.input, taskId: parsed.data.taskId };
        if (parsed.data.skillId === 'construction' || parsed.data.skillId === 'procurement') {
            const [, prefetchError] = (await this.buildingServices?.prefetch(
                input,
                parsed.data.skillId,
            )) ?? [null, 'building services unavailable'];
            if (prefetchError !== null) return;
        }
        this.skills.run(parsed.data.skillId, input);
    }

    private forwardBlockUpdate(
        change: import('./ports.js').HeadlessBlockChange,
        transport: BotTransportClient,
    ): void {
        const [observation] = new BlockUpdateListener().observe(
            this.options.botId,
            {
                position: change.position,
                blockId: change.blockId,
                solid: change.solid,
                ...(change.properties === undefined ? {} : { properties: change.properties }),
            },
            new Date(this.options.ports.clock.now()).toISOString(),
        );
        if (observation === null) return;
        const attribution = this.buildExecution?.attributionFor(observation.block.position);
        transport.sendEvent(BLOCK_UPDATE_EVENT, {
            botId: observation.botId,
            chunk: observation.chunk,
            observedAt: observation.observedAt,
            block: observation.block,
            ...(attribution === null || attribution === undefined ? {} : { attribution }),
        });
    }

    private sendHeartbeat(transport: BotTransportClient): void {
        const inventory = this.options.ports.inventory.items();
        transport.sendEvent('bot.heartbeat', {
            botId: this.options.botId,
            at: new Date(this.options.ports.clock.now()).toISOString(),
            digest: {
                health: this.options.ports.health(),
                food: this.options.ports.food(),
                position: this.options.ports.position(),
                inventoryCount: inventory.reduce((total, item) => total + item.count, 0),
                ...(this.skills?.activeSkillId === null || this.skills?.activeSkillId === undefined
                    ? {}
                    : { currentSkill: this.skills.activeSkillId }),
                inventorySummary: inventory,
                hazards: this.options.ports.hostiles().map((hostile) => hostile.name),
            },
        });
    }

    private static describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}

export type { AgencyHomeSnapshot };
