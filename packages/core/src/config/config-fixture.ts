import type { Result } from '../kernel/index.js';
import { ConfigLoader, type ConfigSource } from './config-loader.js';
import type { ConfigFailure } from './failures.js';

const defaultConfig: Record<string, unknown> = {
    hardwareProfile: 'home-min',
    botCount: 4,
    botNames: ['TiBot1', 'TiBot2', 'TiBot3', 'TiBot4', 'TiBot5', 'TiBot6', 'TiBot7', 'TiBot8'],
    autoSpawnBots: false,
    lan: { host: 'localhost', port: 25565 },
    transport: { host: '127.0.0.1', port: 8788 },
    ops: { host: '127.0.0.1', port: 8787 },
    dataDir: './data',
    perception: { ringRadius: 32, chunksPerSecond: 1, burst: 2 },
    laya: { executionProviders: ['cpu'], threads: 3 },
    decision: {
        enabled: true,
        timeoutMilliseconds: 1200,
        minConfidence: 0.6,
        maxQueueDepth: 64,
        fleetRatePerSecond: 4,
        botRatePerSecond: 1,
        maxInputTokens: 600,
        modelRevision: 'd42786bdff8a7550316339c5fbf8f46caa83ea1b',
        cacheDirectory: 'models/laya',
        modelDirectory: '',
        providerTemperatures: { nextAction: 1, danger: 1, shouldContinue: 1 },
        tactical: {
            enabled: true,
            mode: 'background',
            deadlineMilliseconds: 1200,
            minimumIntervalMilliseconds: 1000,
            maxDecisionsPerMinute: 4,
            skipSingleAffordance: true,
            circuitBreakerFailureCount: 3,
        },
    },
    planner: {
        enabled: false,
        baseUrl: '',
        apiKey: '',
        model: 'Muse Spark 1.3 Contributor',
        intervalMilliseconds: 300000,
        callsPerMinute: 6,
        maxTokensPerCall: 16000,
        timeoutMilliseconds: 60000,
        maxRepairAttempts: 2,
        maxContextCharacters: 48000,
        reserveTasksPerBot: 1,
        strategicIntent: { enabled: true, maxBotOverrides: 8 },
    },
    logging: { level: 'info' },
    behavior: {
        movement: {
            sprintDistanceThreshold: 24,
            waypointPauseChance: 0.12,
            waypointPauseMilliseconds: { minimum: 400, maximum: 1600 },
            scanChance: 0.2,
            finalApproachPauseMilliseconds: 150,
        },
        gaze: {
            yawRateRadiansPerSecond: 3.5,
            pitchRateRadiansPerSecond: 2.5,
            updateHz: 10,
            scanSweepRadians: 0.9,
        },
        rhythm: {
            reactionLatencyMilliseconds: { minimum: 50, maximum: 250 },
            minimumDwellMilliseconds: 30000,
            switchThreshold: 0.2,
            progressTimeoutMilliseconds: 120000,
            actionGapMilliseconds: 50,
        },
        perception: {
            visibilityRefreshHz: 4,
            maxRaycastsPerTick: 8,
            sightingTtlMs: 60000,
            focusRadius: 64,
            viewHalfAngleRadians: 1.0471975511965976,
        },
        social: {
            replyDelayMilliseconds: { minimum: 800, maximum: 3000 },
            greetingCooldownMilliseconds: 60000,
        },
        idle: { minimumMilliseconds: 5000, maximumMilliseconds: 20000 },
        village: {
            ownershipRadius: 32,
            allowedPlotRegions: [],
            playerBaseLinks: [],
            playerConfidenceInitial: 0.5,
            playerConfidenceThreshold: 0.6,
            playerConfidenceHalfLifeDays: 30,
            playerLinkRadius: 32,
            playerLinkMinSightings: 3,
            playerLinkWindowMs: 600000,
            permissionAskCooldownMs: 300000,
            permissionTimeoutMs: 60000,
            permissionGrantTtlMs: 600000,
        },
    },
    agency: {
        enabled: true,
        goalCadenceMilliseconds: 2000,
        idleThresholdMilliseconds: 10000,
        chatRatePerMinute: 5,
        needDecayPerMinute: 0.02,
        needDecayByNeed: {
            safety: 0.01,
            hunger: 0.02,
            rest: 0.01,
            materials: 0.01,
            tools: 0.005,
            shelter: 0.005,
            social: 0.015,
            novelty: 0.02,
            achievement: 0.005,
        },
        committedGoalBonus: 0.15,
        progression: { enabled: true },
        workingMemory: { maxCommitments: 4, maxExperiences: 8 },
        goalTieBreak: { enabled: false, closeScore: 0.12 },
        reflection: { enabled: true, maxTraitDelta: 0.01 },
        nightPrep: {
            enabled: true,
            duskLeadTicks: 3000,
            foodServings: 3,
            minHealth: 10,
            homeRadius: 8,
            buildWindowTicks: 2000,
            buildMaterialCount: 32,
            woolTarget: 3,
            allowShelterBuild: true,
            allowDigIn: true,
        },
    },
    building: {
        maxStructureBlocks: 4000,
        maxWorkPackageBlocks: 128,
        allowRawBlockBlueprints: false,
    },
    safety: { guardianHz: 20, interactionReach: 4.5, actionsPerSecond: 10 },
    skills: { tickMilliseconds: 250 },
    training: { traceEnabled: false },
};

const profiles: Record<string, Record<string, unknown>> = {
    'home-min': {
        hardwareProfile: 'home-min',
        botCount: 4,
        laya: { executionProviders: ['cpu'], threads: 3 },
        decision: { tactical: { mode: 'background' } },
        building: { maxStructureBlocks: 4000, maxWorkPackageBlocks: 128 },
    },
    'home-full': {
        hardwareProfile: 'home-full',
        botCount: 8,
        laya: { executionProviders: ['webgpu', 'cpu'], threads: 8 },
        decision: { tactical: { mode: 'blocking' } },
        building: { maxStructureBlocks: 12000, maxWorkPackageBlocks: 256 },
    },
};

class FakeConfigSource implements ConfigSource {
    constructor(private readonly envFile = '') {}

    readEnvironmentFile(): Result<string, ConfigFailure> {
        return [this.envFile, null];
    }

    readDefaults(): Result<string, ConfigFailure> {
        return [JSON.stringify(defaultConfig), null];
    }

    readProfile(name: string): Result<string, ConfigFailure> {
        const profile = profiles[name];
        if (!profile) {
            return [
                null,
                {
                    type: 'READ_FAILED',
                    path: `profiles/${name}.json`,
                    message: 'missing profile',
                },
            ];
        }
        return [JSON.stringify(profile), null];
    }
}

export class ConfigFixture {
    static load(environment: Record<string, string | undefined> = {}) {
        return new ConfigLoader({
            source: new FakeConfigSource(),
            environment: environment,
        }).load();
    }
}
