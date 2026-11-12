import { AgencyState, PersonalityModel, StrategicIntentPolicy } from '@ticrafter/agency';
import { DeterministicPolicy, LayaClient, TacticalDecisionPolicy } from '@ticrafter/brains';
import {
    attempt,
    BLOCK_UPDATE_EVENT,
    BOT_AUTONOMY_PAUSE,
    BOT_AUTONOMY_RESUME,
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
    SKILL_PROGRESS_EVENT,
    type TicrafterConfig,
} from '@ticrafter/core';
import { BlockUpdateListener } from '@ticrafter/perception';
import {
    MemoryCheckpointStore,
    type SkillCheckpointStore,
    type SkillInput,
    type SkillProgressSink,
} from '@ticrafter/skills';

import { ActionExecutor } from '../index.js';
import { AgencyRuntime } from '../index.js';
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
import { BotTransportClient } from '../transport/index.js';
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
    private closed = false;
    private autonomyPausedReason: string | null = null;

    constructor(private readonly options: HeadlessBotRuntimeOptions) {}

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

        const { config } = this.options;
        const { ports } = this.options;
        const actionPort = ports.dispatch;
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
        const actionExecutor = new ActionExecutor(this.guardian, actionPort, this.options.logger);
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
                buildingServices ?? undefined,
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
        const [created, createError] =
            restored === null
                ? AgencyState.create({
                      botId: this.options.botId,
                      traits: PersonalityModel.fromBotIndex(this.options.botIndex),
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
                ),
                skills,
                persistence,
                logger: this.options.logger,
                config: config.agency,
                clock: ports.clock,
                isPaused: () => this.autonomyPausedReason !== null,
                isJobActive: () => this.autonomy?.hasActiveTask === true,
                isProjectTaskActive: () => this.autonomy?.activeTaskProjectId !== null,
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
            jobMarket: { context: () => ({ ...agency.jobContext(), role: null }) },
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
        agency.start();
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
        if (this.heartbeat !== null) this.options.ports.clock.clearInterval(this.heartbeat);
        this.transport?.close();
        this.agency = null;
        this.autonomy = null;
        this.guardian = null;
        this.skills = null;
        this.transport = null;
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
