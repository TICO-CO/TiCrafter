import path from 'node:path';

import { AgencyState, type NightIntent, PersonalityModel } from '@ticrafter/agency';
import { DeterministicPolicy, type GuardianReport, LayaClient } from '@ticrafter/brains';
import {
    attempt,
    BLOCK_UPDATE_EVENT,
    BOT_AUTONOMY_PAUSE,
    BOT_AUTONOMY_RESUME,
    BOT_PROJECT_PROPOSE,
    BOT_SAFETY_RESUME,
    BOT_SAFETY_STOP,
    BOT_SKILL_CANCEL,
    BOT_SKILL_RESUME,
    BOT_SKILL_START,
    botAutonomyPauseSchema,
    botAutonomyResumeSchema,
    botProjectResponseSchema,
    botSafetyResumeSchema,
    botSafetyStopSchema,
    botSkillCancelSchema,
    botSkillResumeSchema,
    botSkillStartSchema,
    type Envelope,
    EventStream,
    type LoggerPort,
    type MessageSchemaRegistry,
    type Result,
    type SessionResume,
    SKILL_PROGRESS_EVENT,
    type TicrafterConfig,
} from '@ticrafter/core';
import { BlockUpdateListener, PerceptionRateLimiter, RingSampler } from '@ticrafter/perception';
import { type EmergencyStopController } from '@ticrafter/safety';
import {
    MemoryCheckpointStore,
    type SkillCheckpointStore,
    type SkillInput,
    type SkillProgressSink,
} from '@ticrafter/skills';
import { type Bot, createBot } from 'mineflayer';

import { ActionExecutor } from './action-executor.js';
import { AgencyRuntime } from './agency-runtime.js';
import { type AgencyHomeSnapshot, AgencySnapshotSource } from './agency-snapshot-source.js';
import { AgencyStateAdapter } from './agency-state-adapter.js';
import { BuildingSkillServices } from './building-services.js';
import { BotEventBridge } from './event-bridge.js';
import { GuardianHook } from './guardian.js';
import { MineflayerActionExecutor } from './mineflayer-action-executor.js';
import { PerceptionHost } from './perception-host.js';
import { MineflayerPerceptionSource } from './perception-source.js';
import { ReachRateGuard } from './reach-rate-guard.js';
import { SafetySnapshotSource } from './safety-snapshot.js';
import { BotSkillContextSource } from './skill-context-source.js';
import { SkillHost } from './skill-host.js';
import { StateDigest } from './state-digest.js';
import { TaskAutonomy, type TaskAutonomySnapshot } from './task-autonomy.js';
import { BotTransportClient } from './transport/index.js';
import { WorldCacheAdapter } from './world-cache.js';

export interface BotConnectionOptions {
    config: TicrafterConfig;
    name: string;
    botId: string;
    botIndex: number;
    url: string;
    registry: MessageSchemaRegistry;
    logger: LoggerPort;
    checkpointStore?: SkillCheckpointStore;
    emergencyStop?: EmergencyStopController;
}

interface BlockLike {
    name?: string;
    boundingBox?: string;
    position?: { x: number; y: number; z: number };
    getProperties?: () => Record<string, string | number | boolean>;
}

export class BotConnection {
    private bot: Bot | null = null;
    private transport: BotTransportClient | null = null;
    private world: WorldCacheAdapter | null = null;
    private perception: PerceptionHost | null = null;
    private guardian: GuardianHook | null = null;
    private skills: SkillHost | null = null;
    private agencyRuntime: AgencyRuntime | null = null;
    private taskAutonomy: TaskAutonomy | null = null;
    private unsubscribeInbound: (() => void) | null = null;
    private autonomyStarted = false;
    private autonomyPausedReason: string | null = null;
    private pendingResume: SessionResume | null = null;
    private homeSnapshot: AgencyHomeSnapshot | null = null;
    private role: string | null = null;
    private homeProjectRequested = false;
    private lastReflexAt = 0;

    constructor(private readonly options: BotConnectionOptions) {}

    async run(): Promise<Result<boolean, string>> {
        const transport = new BotTransportClient({
            url: this.options.url,
            registry: this.options.registry,
        });
        const [connected, connectError] = await transport.connect();
        if (connectError) return [null, this.describe(connectError)];
        if (connected === null) return [null, 'transport connect returned null'];

        this.transport = transport;
        const [hello, helloError] = await transport.hello(this.options.botId, this.options.name);
        if (helloError) {
            this.closeTransport();
            return [null, this.describe(helloError)];
        }
        if (hello === null) {
            this.closeTransport();
            return [null, 'session hello returned null'];
        }
        if (!hello.accepted) {
            this.closeTransport();
            return [null, hello.reason ?? 'coordinator rejected session'];
        }
        this.pendingResume = hello.resume ?? null;
        this.homeSnapshot = BotConnection.homeSnapshotFromResume(this.pendingResume);
        this.role = this.pendingResume?.role ?? null;
        this.options.logger.info({ epoch: hello.epoch }, 'coordinator accepted session');

        const [bot, botError] = attempt<Bot>(() =>
            createBot({
                host: this.options.config.lan.host,
                port: this.options.config.lan.port,
                username: this.options.name,
                auth: 'offline',
            }),
        );
        if (botError || bot === null) {
            this.closeTransport();
            return [null, `mineflayer failed: ${this.describe(botError)}`];
        }
        this.bot = bot;
        const [injected, injectionError] = await this.waitForInjection(bot);
        if (injectionError) {
            this.close();
            return [null, injectionError];
        }
        if (injected === null) {
            this.close();
            return [null, 'mineflayer injection returned null'];
        }
        const world = new WorldCacheAdapter(bot);
        this.world = world;
        const actionPort = new MineflayerActionExecutor(
            bot,
            this.options.logger,
            undefined,
            new ReachRateGuard({
                maximumReach: this.options.config.safety.interactionReach,
                actionsPerSecond: this.options.config.safety.actionsPerSecond,
            }),
        );
        const [, installError] = actionPort.install();
        if (installError) {
            this.options.logger.warn({ error: installError }, 'pathfinder install failed');
        }
        const safetySource = new SafetySnapshotSource(
            bot,
            world,
            () => this.skills?.activeSkillId ?? null,
            {
                botNames: this.options.config.botNames,
                allowDestructiveMaterials: false,
                failureSource: () => {
                    const failure = actionPort.lastFailure;
                    const at = actionPort.lastFailureAt;
                    return failure === null || at === null ? null : { class: failure.class, at };
                },
            },
        );
        this.guardian = new GuardianHook({
            source: safetySource,
            logger: this.options.logger,
            intervalMilliseconds: Math.max(
                1,
                Math.floor(1000 / this.options.config.safety.guardianHz),
            ),
            onCritical: (report) => this.handleCritical(report),
            emergencyStop: this.options.emergencyStop,
            incidentSink: {
                record: (incident) => {
                    const [, sendError] = transport.sendEvent('bot.event', {
                        botId: this.options.botId,
                        event: 'safety.incident',
                        at: incident.at,
                        data: incident,
                    });
                    if (sendError) {
                        this.options.logger.debug(
                            { error: sendError.type },
                            'safety incident send failed',
                        );
                    }
                },
            },
        });
        const actionExecutor = new ActionExecutor(this.guardian, actionPort, this.options.logger);
        const progressSink: SkillProgressSink = {
            report: (event) => {
                this.taskAutonomy?.observeProgress(event);
                this.agencyRuntime?.observeProgress(event);
                const [, sendError] = transport.sendEvent(SKILL_PROGRESS_EVENT, event);
                return sendError ? [null, sendError.type] : [undefined, null];
            },
        };
        const [buildingServices, buildingServicesError] = await BuildingSkillServices.create(
            path.resolve(process.cwd(), this.options.config.dataDir),
            world,
        );
        if (buildingServicesError) {
            this.options.logger.warn(
                { error: buildingServicesError },
                'building skill services unavailable',
            );
        }
        const [skills, skillsError] = SkillHost.create({
            source: new BotSkillContextSource(bot, world, buildingServices ?? undefined),
            dispatch: actionExecutor,
            progressSink,
            logger: this.options.logger,
            tickMilliseconds: this.options.config.skills.tickMilliseconds,
            checkpointStore: this.options.checkpointStore ?? new MemoryCheckpointStore(),
        });
        if (skillsError) {
            this.options.logger.error({ error: skillsError }, 'skill host creation failed');
        } else {
            this.skills = skills;
            this.unsubscribeInbound = transport.onMessage((envelope) =>
                this.handleCommand(envelope),
            );
            const [agencyRuntime, agencyError] = this.createAgencyRuntime(bot, world, transport);
            if (agencyError) {
                this.options.logger.warn({ error: agencyError }, 'agency runtime creation failed');
            } else {
                this.agencyRuntime = agencyRuntime;
            }
        }

        const blockUpdates = new BlockUpdateListener();
        const bridge = new BotEventBridge(
            bot,
            (event) => transport.sendEvent('bot.event', { botId: this.options.botId, ...event }),
            this.options.logger,
            (block) => this.forwardBlockUpdate(block, blockUpdates, transport),
        );
        let spawned = false;
        bot.once('spawn', () => {
            spawned = true;
            bridge.attach();
            this.startPerception(bot, transport);
            this.options.logger.info({ name: this.options.name }, 'bot spawned');
            this.startAutonomy();
        });
        bot.once('login', () => {
            spawned = true;
            this.options.logger.info({ name: this.options.name }, 'bot logged in');
        });

        const heartbeat = setInterval(() => this.sendHeartbeat(), 1000);

        await this.waitForEnd();

        clearInterval(heartbeat);
        this.stopAutonomy();
        this.unsubscribeInbound?.();
        this.unsubscribeInbound = null;
        this.perception?.stop();
        this.perception = null;
        bridge.detachAll();
        this.closeTransport();
        this.bot = null;
        this.world = null;
        this.guardian = null;
        this.skills = null;
        return [spawned, null];
    }

    close(): void {
        this.stopAutonomy();
        this.unsubscribeInbound?.();
        this.unsubscribeInbound = null;
        this.perception?.stop();
        this.perception = null;
        const [, quitError] = attempt(() => this.bot?.quit());
        if (quitError) {
            this.options.logger.warn({ error: this.describe(quitError) }, 'mineflayer quit failed');
        }
        this.closeTransport();
        this.bot = null;
        this.world = null;
        this.guardian = null;
        this.skills = null;
    }

    private createAgencyRuntime(
        bot: Bot,
        world: WorldCacheAdapter,
        transport: BotTransportClient,
    ): Result<AgencyRuntime, string> {
        const skills = this.skills;
        if (skills === null) return [null, 'skill host unavailable'];
        const persistence = new AgencyStateAdapter({
            botId: this.options.botId,
            events: transport,
            logger: this.options.logger,
        });
        const [restored, restoreError] = persistence.restore(this.pendingResume?.agency);
        if (restoreError) return [null, restoreError];
        let state = restored;
        if (state === null) {
            const [created, createError] = AgencyState.create({
                botId: this.options.botId,
                traits: PersonalityModel.fromBotIndex(this.options.botIndex),
                timeOfDay: bot.time?.timeOfDay ?? null,
            });
            if (createError) return [null, createError];
            if (created === null) return [null, 'agency state creation returned null'];
            state = created;
        }
        const [runtime, runtimeError] = AgencyRuntime.create(
            {
                botId: this.options.botId,
                context: new AgencySnapshotSource({
                    bot,
                    world,
                    home: () => this.homeSnapshot,
                    nightIntent: () => this.nightIntent(),
                }),
                skills,
                persistence,
                logger: this.options.logger,
                config: this.options.config.agency,
                isPaused: () =>
                    this.autonomyPausedReason !== null ||
                    this.guardian?.emergencyStopActive === true,
                isJobActive: () => this.taskAutonomy?.hasActiveTask === true,
            },
            state,
        );
        if (runtimeError) return [null, runtimeError];
        if (runtime === null) return [null, 'agency runtime creation returned null'];
        return [runtime, null];
    }

    private startAutonomy(): void {
        if (this.autonomyStarted) return;
        this.autonomyStarted = true;
        if (this.guardian) {
            const [, guardianError] = this.guardian.start();
            if (guardianError) {
                this.options.logger.warn({ error: guardianError }, 'guardian start failed');
            }
        }
        if (this.skills) {
            const [, skillError] = this.skills.start();
            if (skillError) {
                this.options.logger.warn({ error: skillError }, 'skill host start failed');
            }
        }
        if (this.agencyRuntime !== null) {
            const [, reconciliationError] = this.agencyRuntime.restore();
            if (reconciliationError) {
                this.options.logger.warn(
                    { error: reconciliationError },
                    'agency intention reconciliation failed',
                );
            }
        }
        if (this.skills !== null && this.transport !== null && this.bot !== null) {
            const decisions = new LayaClient({
                transport: this.transport,
                timeoutMilliseconds: this.options.config.decision.timeoutMilliseconds,
                minimumConfidence: this.options.config.decision.minConfidence,
                policy: new DeterministicPolicy(),
            });
            const agencyRuntime = this.agencyRuntime;
            const autonomy = new TaskAutonomy({
                botId: this.options.botId,
                transport: this.transport,
                decisions,
                skills: this.skills,
                snapshot: { read: () => this.readTaskSnapshot() },
                logger: this.options.logger,
                jobMarket:
                    agencyRuntime === null
                        ? undefined
                        : {
                              context: () => ({
                                  ...agencyRuntime.jobContext(),
                                  role: this.role,
                              }),
                          },
                canClaim: () =>
                    this.agencyRuntime?.hasActiveGoal !== true &&
                    this.skills?.activeSkillId === null,
            });
            this.taskAutonomy = autonomy;
            if (this.autonomyPausedReason === null) this.applyPendingResume();
            autonomy.start();
            if (this.autonomyPausedReason !== null) autonomy.pause(this.autonomyPausedReason);
            this.agencyRuntime?.start();
            if (this.options.config.agency.enabled && this.homeSnapshot === null) {
                void this.ensureHomeProject(this.transport);
            }
        }
    }

    private applyPendingResume(): void {
        const autonomy = this.taskAutonomy;
        const resume = this.pendingResume;
        if (autonomy === null || resume === null) return;
        if (resume.task === null || resume.fencingToken === null) {
            this.pendingResume = null;
            return;
        }
        if (!autonomy.resumeTask(resume)) {
            this.pendingResume = null;
            this.options.logger.warn(
                { taskId: resume.task.id },
                'pending task resume was not applicable',
            );
            return;
        }
        this.pendingResume = null;
        const skillId = resume.task?.payload.skillId;
        if (
            this.skills === null ||
            resume.task === null ||
            resume.checkpoint === null ||
            resume.checkpoint === undefined ||
            typeof skillId !== 'string'
        ) {
            return;
        }
        const [step, resumeError] = this.skills.resume(skillId, resume.task.id);
        if (resumeError) {
            this.options.logger.warn(
                { error: resumeError, skillId, taskId: resume.task.id },
                'skill checkpoint resume failed',
            );
            return;
        }
        this.options.logger.info(
            { skillId, taskId: resume.task.id, status: step?.status },
            'skill checkpoint resumed',
        );
    }

    private stopAutonomy(): void {
        this.agencyRuntime?.stop();
        this.agencyRuntime = null;
        this.taskAutonomy?.stop();
        this.taskAutonomy = null;
        this.guardian?.stop();
        this.skills?.stop();
        this.autonomyStarted = false;
    }

    private nightIntent(): NightIntent | null {
        const payload = this.taskAutonomy?.activeTaskPayload;
        return payload?.requiresMobDrops === true ? 'hunt' : null;
    }

    private async ensureHomeProject(transport: BotTransportClient): Promise<void> {
        if (this.homeProjectRequested || this.homeSnapshot !== null || this.bot === null) return;
        this.homeProjectRequested = true;
        const position = this.bot.entity?.position;
        if (position === undefined) return;
        const anchor = {
            x: Math.floor(position.x),
            y: Math.floor(position.y),
            z: Math.floor(position.z),
        };
        const bbox = {
            min: anchor,
            max: { x: anchor.x + 6, y: anchor.y + 3, z: anchor.z + 6 },
        };
        const [envelope, requestError] = await transport.request(BOT_PROJECT_PROPOSE, {
            botId: this.options.botId,
            title: `Home of ${this.options.name}`,
            kind: 'home',
            anchor,
            bbox,
            storagePosition: { x: anchor.x + 1, y: anchor.y + 1, z: anchor.z + 5 },
        });
        if (requestError || envelope === null) {
            this.options.logger.warn({ error: requestError }, 'home project request failed');
            return;
        }
        const parsed = botProjectResponseSchema.safeParse(envelope.payload);
        if (!parsed.success || !parsed.data.ok || parsed.data.project === null) {
            this.options.logger.info(
                { reason: parsed.success ? parsed.data.reason : 'invalid response' },
                'home project was not accepted',
            );
            return;
        }
        this.homeSnapshot = {
            anchor: parsed.data.project.anchor,
            bbox: parsed.data.project.bbox,
            status: parsed.data.project.status,
            structureId: parsed.data.project.structureId,
        };
        this.options.logger.info(
            { projectId: parsed.data.project.id },
            'personal home project created',
        );
    }

    private static homeSnapshotFromResume(resume: SessionResume | null): AgencyHomeSnapshot | null {
        if (resume?.projects === undefined) return null;
        const project = resume.projects.find(
            (candidate) =>
                candidate.kind === 'home' &&
                (candidate.status === 'proposed' || candidate.status === 'active'),
        );
        if (project === undefined) return null;
        return {
            anchor: project.anchor,
            bbox: project.bbox,
            status: project.status,
            structureId: project.structureId,
        };
    }

    private readTaskSnapshot(): TaskAutonomySnapshot {
        const bot = this.bot;
        if (bot === null) {
            return {
                health: 0,
                food: 0,
                position: { x: 0, y: 0, z: 0 },
                inventory: [],
                hazards: [],
            };
        }
        const digest = StateDigest.collect(bot, this.skills?.activeSkillId ?? null);
        return {
            health: digest.health,
            food: digest.food,
            position: digest.position,
            inventory: (bot.inventory?.items() ?? []).map((item) => ({
                name: item.name,
                count: item.count,
            })),
            hazards: digest.hazards ?? [],
        };
    }

    private handleCommand(envelope: Envelope): void {
        if (envelope.kind !== 'request') return;
        if (envelope.type === BOT_SKILL_START) {
            this.handleSkillStart(envelope.payload);
            return;
        }
        if (envelope.type === BOT_SKILL_CANCEL) {
            this.handleSkillCancel(envelope.payload);
            return;
        }
        if (envelope.type === BOT_SKILL_RESUME) {
            this.handleSkillResume(envelope.payload);
            return;
        }
        if (envelope.type === BOT_SAFETY_RESUME) {
            this.handleSafetyResume(envelope.payload);
            return;
        }
        if (envelope.type === BOT_SAFETY_STOP) {
            this.handleSafetyStop(envelope.payload);
            return;
        }
        if (envelope.type === BOT_AUTONOMY_PAUSE) {
            this.handleAutonomyPause(envelope.payload);
            return;
        }
        if (envelope.type === BOT_AUTONOMY_RESUME) {
            this.handleAutonomyResume(envelope.payload);
        }
    }

    private handleSkillStart(payload: unknown): void {
        const parsed = botSkillStartSchema.safeParse(payload);
        if (!parsed.success) {
            this.options.logger.warn(
                { error: parsed.error.message },
                'invalid skill start command',
            );
            return;
        }
        if (this.skills === null) {
            this.options.logger.warn('skill host is not available');
            return;
        }
        const input: SkillInput =
            parsed.data.taskId === undefined
                ? parsed.data.input
                : { ...parsed.data.input, taskId: parsed.data.taskId };
        const [step, startError] = this.skills.run(parsed.data.skillId, input);
        if (startError) {
            this.options.logger.warn(
                { error: startError, skillId: parsed.data.skillId },
                'skill start command failed',
            );
            return;
        }
        this.options.logger.info(
            { skillId: parsed.data.skillId, status: step?.status },
            'skill started',
        );
    }

    private handleSkillCancel(payload: unknown): void {
        const parsed = botSkillCancelSchema.safeParse(payload);
        if (!parsed.success) {
            this.options.logger.warn(
                { error: parsed.error.message },
                'invalid skill cancel command',
            );
            return;
        }
        if (this.skills === null) {
            this.options.logger.warn('skill host is not available');
            return;
        }
        if (
            parsed.data.skillId !== undefined &&
            parsed.data.skillId !== this.skills.activeSkillId
        ) {
            this.options.logger.warn(
                { skillId: parsed.data.skillId, active: this.skills.activeSkillId },
                'skill cancel ignored',
            );
            return;
        }
        if (
            parsed.data.taskId !== undefined &&
            this.skills.activeTaskId !== null &&
            parsed.data.taskId !== this.skills.activeTaskId
        ) {
            this.options.logger.warn(
                { taskId: parsed.data.taskId, active: this.skills.activeTaskId },
                'skill cancel ignored',
            );
            return;
        }
        const [step, cancelError] = this.skills.cancel(
            parsed.data.reason ?? 'coordinator cancelled skill',
        );
        if (cancelError) {
            this.options.logger.warn({ error: cancelError }, 'skill cancel command failed');
            return;
        }
        this.options.logger.info({ status: step?.status }, 'skill cancelled');
    }

    private handleSkillResume(payload: unknown): void {
        const parsed = botSkillResumeSchema.safeParse(payload);
        if (!parsed.success) {
            this.options.logger.warn(
                { error: parsed.error.message },
                'invalid skill resume command',
            );
            return;
        }
        if (this.skills === null) {
            this.options.logger.warn('skill host is not available');
            return;
        }
        const [step, resumeError] = this.skills.resume(
            parsed.data.skillId,
            parsed.data.taskId ?? 'default',
        );
        if (resumeError) {
            this.options.logger.warn(
                { error: resumeError, skillId: parsed.data.skillId },
                'skill resume command failed',
            );
            return;
        }
        this.options.logger.info(
            { skillId: parsed.data.skillId, status: step?.status },
            'skill resumed',
        );
    }

    private handleSafetyResume(payload: unknown): void {
        const parsed = botSafetyResumeSchema.safeParse(payload);
        if (!parsed.success) {
            this.options.logger.warn(
                { error: parsed.error.message },
                'invalid safety resume command',
            );
            return;
        }
        if (this.guardian === null) {
            this.options.logger.warn('guardian is not available');
            return;
        }
        this.guardian.resumeSafety();
        this.autonomyPausedReason = null;
        this.applyPendingResume();
        this.taskAutonomy?.resume();
        this.options.logger.info({ reason: parsed.data.reason }, 'safety resumed');
    }

    private handleSafetyStop(payload: unknown): void {
        const parsed = botSafetyStopSchema.safeParse(payload);
        if (!parsed.success) {
            this.options.logger.warn(
                { error: parsed.error.message },
                'invalid safety stop command',
            );
            return;
        }
        this.autonomyPausedReason = parsed.data.reason;
        this.guardian?.triggerEmergencyStop(parsed.data.reason);
        this.taskAutonomy?.pause(parsed.data.reason);
        if (this.skills !== null) {
            const [, stopError] = this.skills.preempt(parsed.data.reason);
            if (stopError) {
                this.options.logger.warn({ error: stopError }, 'emergency skill preempt failed');
            }
        }
        this.options.logger.warn({ reason: parsed.data.reason }, 'safety stopped');
    }

    private handleAutonomyPause(payload: unknown): void {
        const parsed = botAutonomyPauseSchema.safeParse(payload);
        if (!parsed.success) {
            this.options.logger.warn(
                { error: parsed.error.message },
                'invalid autonomy pause command',
            );
            return;
        }
        const reason = parsed.data.reason ?? 'operator pause';
        this.autonomyPausedReason = reason;
        this.taskAutonomy?.pause(reason);
        if (this.skills !== null) {
            const [, cancelError] = this.skills.cancel(reason);
            if (cancelError) {
                this.options.logger.warn({ error: cancelError }, 'autonomy pause cancel failed');
            }
        }
        this.options.logger.info({ reason }, 'autonomy paused');
    }

    private handleAutonomyResume(payload: unknown): void {
        const parsed = botAutonomyResumeSchema.safeParse(payload);
        if (!parsed.success) {
            this.options.logger.warn(
                { error: parsed.error.message },
                'invalid autonomy resume command',
            );
            return;
        }
        this.autonomyPausedReason = null;
        this.applyPendingResume();
        this.taskAutonomy?.resume();
        this.options.logger.info({ reason: parsed.data.reason }, 'autonomy resumed');
    }

    private handleCritical(report: GuardianReport): void {
        if (this.skills === null) return;
        if (report.emergencyStop) {
            this.skills.preempt('guardian emergency stop');
            return;
        }
        const hunger = report.signals.some((signal) => signal.code === 'hunger.low');
        const threat = report.signals.some((signal) => signal.code === 'mob.threat');
        if (hunger || threat) {
            if (Date.now() - this.lastReflexAt < 2000) return;
            this.lastReflexAt = Date.now();
            if (hunger && this.skills.activeSkillId !== 'eat') {
                this.skills.preempt('hunger critical');
                const [, error] = this.skills.run('eat', {});
                if (error) this.options.logger.warn({ error }, 'reflex eat failed');
                return;
            }
            if (threat && this.skills.activeSkillId !== 'flee-defend') {
                this.skills.preempt('threat critical');
                const [, error] = this.skills.run('flee-defend', {});
                if (error) this.options.logger.warn({ error }, 'reflex flee failed');
            }
            return;
        }
        if (report.safeMode) {
            this.skills.preempt('guardian safe mode');
            return;
        }
        const critical = report.signals.some((signal) => signal.severity === 'critical');
        if (critical) this.skills.preempt('guardian critical hazard');
    }

    private forwardBlockUpdate(
        block: unknown,
        listener: BlockUpdateListener,
        transport: BotTransportClient,
    ): void {
        const candidate = block as BlockLike | null;
        if (
            candidate === null ||
            candidate.name === undefined ||
            candidate.position === undefined
        ) {
            return;
        }
        const properties = candidate.getProperties?.();
        const [observation, observeError] = listener.observe(
            this.options.botId,
            {
                position: {
                    x: Math.floor(candidate.position.x),
                    y: Math.floor(candidate.position.y),
                    z: Math.floor(candidate.position.z),
                },
                blockId: candidate.name,
                solid: candidate.boundingBox === 'block',
                ...(properties === undefined
                    ? {}
                    : {
                          properties: Object.fromEntries(
                              Object.entries(properties).map(([key, value]) => [
                                  key,
                                  String(value),
                              ]),
                          ) as Record<string, string>,
                      }),
            },
            new Date().toISOString(),
        );
        if (observeError) {
            this.options.logger.warn({ error: observeError }, 'block update rejected');
            return;
        }
        if (observation === null) return;
        const [, sendError] = transport.sendEvent(BLOCK_UPDATE_EVENT, {
            botId: observation.botId,
            chunk: observation.chunk,
            observedAt: observation.observedAt,
            block: observation.block,
        });
        if (sendError) {
            this.options.logger.warn({ error: sendError }, 'block update send failed');
        }
    }

    private startPerception(bot: Bot, transport: BotTransportClient): void {
        const config = this.options.config.perception;
        const [limiter, limiterError] = PerceptionRateLimiter.create(
            {
                tokensPerSecond: config.chunksPerSecond,
                burst: config.burst,
            },
            () => Date.now(),
        );
        if (limiterError || limiter === null) {
            this.options.logger.error(
                { error: limiterError },
                'perception rate limiter creation failed',
            );
            return;
        }
        const [sampler, samplerError] = RingSampler.create(
            { ringRadius: config.ringRadius },
            limiter,
        );
        if (samplerError || sampler === null) {
            this.options.logger.error(
                { error: samplerError },
                'perception ring sampler creation failed',
            );
            return;
        }
        const events = new EventStream();
        this.perception = new PerceptionHost({
            botId: this.options.botId,
            source: new MineflayerPerceptionSource(bot),
            sampler,
            events,
            sink: (envelope) => transport.send(envelope),
            logger: this.options.logger,
            ringRadius: config.ringRadius,
            intervalMilliseconds: 1000,
            maxChunksPerTick: Math.max(1, Math.ceil(config.chunksPerSecond)),
        });
        this.perception.start();
    }

    private sendHeartbeat(): void {
        if (!this.bot || !this.transport) return;
        const [, sendError] = this.transport.sendEvent('bot.heartbeat', {
            botId: this.options.botId,
            at: new Date().toISOString(),
            digest: StateDigest.collect(this.bot, this.skills?.activeSkillId ?? null),
        });
        if (sendError) {
            this.options.logger.debug({ error: this.describe(sendError) }, 'heartbeat send failed');
        }
    }

    private waitForInjection(bot: Bot): Promise<Result<void, string>> {
        return new Promise((resolve) => {
            bot.once('inject_allowed', () => resolve([undefined, null]));
            bot.once('end', () => resolve([null, 'mineflayer ended before injection']));
        });
    }

    private waitForEnd(): Promise<void> {
        return new Promise<void>((resolve) => {
            if (!this.bot) {
                resolve();
                return;
            }
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                resolve();
            };
            this.bot.once('end', (reason) => {
                this.options.logger.warn(
                    { name: this.options.name, reason },
                    'mineflayer connection ended',
                );
                finish();
            });
            this.bot.once('error', (error) => {
                this.options.logger.warn(
                    { name: this.options.name, error: error.message },
                    'mineflayer error',
                );
                finish();
            });
        });
    }

    private closeTransport(): void {
        if (!this.transport) return;
        const [, closeError] = this.transport.close();
        if (closeError) {
            this.options.logger.warn(
                { error: this.describe(closeError) },
                'transport close failed',
            );
        }
        this.transport = null;
    }

    private describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
