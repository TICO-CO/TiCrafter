import { z as zod } from 'zod';

import type { Result } from '../kernel/index.js';
import type { ConfigFailure } from './failures.js';

const executionProvider = zod.enum(['cpu', 'webgpu']);

export const profileSchema = zod.enum(['home-min', 'home-full']);

export const configSchema = zod
    .object({
        hardwareProfile: profileSchema,
        botCount: zod.number().int().min(1).max(8),
        botNames: zod.array(zod.string().min(1)).min(1),
        autoSpawnBots: zod.boolean(),
        lan: zod.object({
            host: zod.string().min(1),
            port: zod.number().int().min(1).max(65535),
        }),
        transport: zod.object({
            host: zod.string().min(1),
            port: zod.number().int().min(1).max(65535),
        }),
        ops: zod.object({
            host: zod.string().min(1),
            port: zod.number().int().min(1).max(65535),
        }),
        dataDir: zod.string().min(1),
        perception: zod.object({
            ringRadius: zod.number().int().min(16).max(64),
            chunksPerSecond: zod.number().positive(),
            burst: zod.number().int().positive(),
        }),
        laya: zod.object({
            executionProviders: zod.array(executionProvider).min(1),
            threads: zod.number().int().min(1),
        }),
        decision: zod.object({
            enabled: zod.boolean(),
            timeoutMilliseconds: zod.number().int().min(1),
            minConfidence: zod.number().min(0).max(1),
            maxQueueDepth: zod.number().int().min(1),
            fleetRatePerSecond: zod.number().positive(),
            botRatePerSecond: zod.number().positive(),
            maxInputTokens: zod.number().int().min(1),
            modelRevision: zod.string().min(1),
            cacheDirectory: zod.string().min(1),
            modelDirectory: zod.string(),
            providerTemperatures: zod.object({
                nextAction: zod.number().positive(),
                danger: zod.number().positive(),
                shouldContinue: zod.number().positive(),
            }),
            tactical: zod.object({
                enabled: zod.boolean(),
                mode: zod.enum(['background', 'blocking']),
                deadlineMilliseconds: zod.number().int().positive(),
                minimumIntervalMilliseconds: zod.number().int().nonnegative(),
                maxDecisionsPerMinute: zod.number().int().positive(),
                skipSingleAffordance: zod.boolean(),
                circuitBreakerFailureCount: zod.number().int().min(1),
            }),
        }),
        planner: zod.object({
            enabled: zod.boolean(),
            baseUrl: zod.string(),
            apiKey: zod.string(),
            model: zod.string().min(1),
            intervalMilliseconds: zod.number().int().positive(),
            callsPerMinute: zod.number().int().positive(),
            maxTokensPerCall: zod.number().int().positive(),
            timeoutMilliseconds: zod.number().int().positive(),
            maxRepairAttempts: zod.number().int().min(0).max(2),
            maxContextCharacters: zod.number().int().positive(),
            reserveTasksPerBot: zod.number().int().min(0).max(8),
            strategicIntent: zod.object({
                enabled: zod.boolean(),
                maxBotOverrides: zod.number().int().min(0).max(8),
            }),
        }),
        behavior: zod.object({
            movement: zod.object({
                sprintDistanceThreshold: zod.number().positive(),
                waypointPauseChance: zod.number().min(0).max(1),
                waypointPauseMilliseconds: zod.object({
                    minimum: zod.number().int().nonnegative(),
                    maximum: zod.number().int().nonnegative(),
                }),
                scanChance: zod.number().min(0).max(1),
                finalApproachPauseMilliseconds: zod.number().int().nonnegative(),
            }),
            gaze: zod.object({
                yawRateRadiansPerSecond: zod.number().positive(),
                pitchRateRadiansPerSecond: zod.number().positive(),
                updateHz: zod.number().positive(),
                scanSweepRadians: zod.number().positive(),
            }),
            rhythm: zod.object({
                reactionLatencyMilliseconds: zod.object({
                    minimum: zod.number().int().nonnegative(),
                    maximum: zod.number().int().nonnegative(),
                }),
                minimumDwellMilliseconds: zod.number().int().nonnegative(),
                switchThreshold: zod.number().min(0).max(1),
                progressTimeoutMilliseconds: zod.number().int().positive(),
                actionGapMilliseconds: zod.number().int().nonnegative(),
            }),
            perception: zod.object({
                visibilityRefreshHz: zod.number().positive(),
                maxRaycastsPerTick: zod.number().int().positive(),
                sightingTtlMs: zod.number().int().positive(),
                focusRadius: zod.number().positive(),
                viewHalfAngleRadians: zod.number().positive(),
            }),
            social: zod.object({
                replyDelayMilliseconds: zod.object({
                    minimum: zod.number().int().nonnegative(),
                    maximum: zod.number().int().nonnegative(),
                }),
                greetingCooldownMilliseconds: zod.number().int().nonnegative(),
            }),
            idle: zod.object({
                minimumMilliseconds: zod.number().int().nonnegative(),
                maximumMilliseconds: zod.number().int().nonnegative(),
            }),
            village: zod.object({
                ownershipRadius: zod.number().positive(),
                allowedPlotRegions: zod.array(
                    zod.object({
                        id: zod.string().min(1),
                        min: zod.object({
                            x: zod.number(),
                            y: zod.number(),
                            z: zod.number(),
                        }),
                        max: zod.object({
                            x: zod.number(),
                            y: zod.number(),
                            z: zod.number(),
                        }),
                    }),
                ),
                playerBaseLinks: zod.array(
                    zod.object({
                        playerId: zod.string().min(1),
                        username: zod.string().min(1),
                        baseId: zod.string().min(1),
                        confidence: zod.number().min(0).max(1).optional(),
                    }),
                ),
                playerConfidenceInitial: zod.number().min(0).max(1),
                playerConfidenceThreshold: zod.number().min(0).max(1),
                playerConfidenceHalfLifeDays: zod.number().positive(),
                playerLinkRadius: zod.number().positive(),
                playerLinkMinSightings: zod.number().int().positive(),
                playerLinkWindowMs: zod.number().int().positive(),
                permissionAskCooldownMs: zod.number().int().nonnegative(),
                permissionTimeoutMs: zod.number().int().positive(),
                permissionGrantTtlMs: zod.number().int().positive(),
            }),
        }),
        agency: zod.object({
            enabled: zod.boolean(),
            goalCadenceMilliseconds: zod.number().int().min(250),
            idleThresholdMilliseconds: zod.number().int().min(1000),
            chatRatePerMinute: zod.number().int().min(0).max(30),
            needDecayPerMinute: zod.number().min(0).max(1),
            needDecayByNeed: zod.record(zod.string(), zod.number().min(0).max(1)).optional(),
            committedGoalBonus: zod.number().min(0).max(1),
            goalDeadlines: zod.record(zod.string(), zod.number().positive()).optional(),
            progression: zod.object({
                enabled: zod.boolean(),
            }),
            workingMemory: zod.object({
                maxCommitments: zod.number().int().min(1).max(16),
                maxExperiences: zod.number().int().min(1).max(32),
            }),
            goalTieBreak: zod.object({
                enabled: zod.boolean(),
                closeScore: zod.number().min(0).max(1),
            }),
            reflection: zod.object({
                enabled: zod.boolean(),
                maxTraitDelta: zod.number().min(0).max(0.1),
            }),
            nightPrep: zod.object({
                enabled: zod.boolean(),
                duskLeadTicks: zod.number().int().nonnegative(),
                foodServings: zod.number().int().nonnegative(),
                minHealth: zod.number().min(0).max(20),
                homeRadius: zod.number().nonnegative(),
                buildWindowTicks: zod.number().int().nonnegative(),
                buildMaterialCount: zod.number().int().nonnegative(),
                woolTarget: zod.number().int().nonnegative(),
                allowShelterBuild: zod.boolean(),
                allowDigIn: zod.boolean(),
            }),
        }),
        building: zod.object({
            maxStructureBlocks: zod.number().int().positive(),
            maxWorkPackageBlocks: zod.number().int().positive(),
            allowRawBlockBlueprints: zod.boolean(),
        }),
        logging: zod.object({
            level: zod.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']),
        }),
        safety: zod.object({
            guardianHz: zod.number().int().min(1).max(100),
            interactionReach: zod.number().positive(),
            actionsPerSecond: zod.number().positive(),
        }),
        skills: zod.object({
            tickMilliseconds: zod.number().int().min(200).max(500),
        }),
        training: zod.object({
            traceEnabled: zod.boolean(),
        }),
    })
    .superRefine((config, context) => {
        if (config.botNames.length < config.botCount) {
            context.addIssue({
                code: 'custom',
                path: ['botNames'],
                message: `botNames has ${config.botNames.length} entries but botCount is ${config.botCount}`,
            });
        }
        if (new Set(config.botNames).size !== config.botNames.length) {
            context.addIssue({
                code: 'custom',
                path: ['botNames'],
                message: 'botNames must be unique',
            });
        }
        if (config.planner.enabled && !config.planner.baseUrl) {
            context.addIssue({
                code: 'custom',
                path: ['planner', 'baseUrl'],
                message: 'planner baseUrl is required when enabled',
            });
        }
        if (config.planner.enabled && !config.planner.apiKey) {
            context.addIssue({
                code: 'custom',
                path: ['planner', 'apiKey'],
                message: 'planner apiKey is required when enabled',
            });
        }
        if (config.building.maxWorkPackageBlocks > config.building.maxStructureBlocks) {
            context.addIssue({
                code: 'custom',
                path: ['building', 'maxWorkPackageBlocks'],
                message: 'maxWorkPackageBlocks must not exceed maxStructureBlocks',
            });
        }
    });

export type TicrafterConfig = zod.infer<typeof configSchema>;
export type HardwareProfile = zod.infer<typeof profileSchema>;
export type ExecutionProvider = zod.infer<typeof executionProvider>;

export class ConfigSchemaValidator {
    static validate(value: unknown): Result<TicrafterConfig, ConfigFailure> {
        const result = configSchema.safeParse(value);
        if (!result.success) {
            const issues = result.error.issues.map(
                (issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`,
            );
            return [null, { type: 'INVALID', issues }];
        }
        return [result.data, null];
    }
}
