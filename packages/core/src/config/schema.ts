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
        }),
        planner: zod.object({
            enabled: zod.boolean(),
            baseUrl: zod.string(),
            apiKey: zod.string(),
        }),
        logging: zod.object({
            level: zod.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']),
        }),
        safety: zod.object({
            guardianHz: zod.number().int().min(1).max(100),
        }),
        skills: zod.object({
            tickMilliseconds: zod.number().int().min(200).max(500),
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
