import { z } from 'zod';
import type { Result } from '../result.js';
import type { ConfigFailure } from './failures.js';

const executionProvider = z.enum(['cpu', 'webgpu']);

export const profileSchema = z.enum(['home-min', 'home-full']);

export const configSchema = z
    .object({
        hardwareProfile: profileSchema,
        botCount: z.number().int().min(1).max(8),
        botNames: z.array(z.string().min(1)).min(1),
        autoSpawnBots: z.boolean(),
        lan: z.object({
            host: z.string().min(1),
            port: z.number().int().min(1).max(65535),
        }),
        transport: z.object({
            host: z.string().min(1),
            port: z.number().int().min(1).max(65535),
        }),
        ops: z.object({
            host: z.string().min(1),
            port: z.number().int().min(1).max(65535),
        }),
        dataDir: z.string().min(1),
        laya: z.object({
            executionProviders: z.array(executionProvider).min(1),
            threads: z.number().int().min(1),
        }),
        planner: z.object({
            enabled: z.boolean(),
            baseUrl: z.string(),
            apiKey: z.string(),
        }),
        logging: z.object({
            level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']),
        }),
        safety: z.object({
            guardianHz: z.number().int().min(1).max(100),
        }),
    })
    .superRefine((config, ctx) => {
        if (config.botNames.length < config.botCount) {
            ctx.addIssue({
                code: 'custom',
                path: ['botNames'],
                message: `botNames has ${config.botNames.length} entries but botCount is ${config.botCount}`,
            });
        }
        if (new Set(config.botNames).size !== config.botNames.length) {
            ctx.addIssue({ code: 'custom', path: ['botNames'], message: 'botNames must be unique' });
        }
        if (config.planner.enabled && !config.planner.baseUrl) {
            ctx.addIssue({
                code: 'custom',
                path: ['planner', 'baseUrl'],
                message: 'planner baseUrl is required when enabled',
            });
        }
        if (config.planner.enabled && !config.planner.apiKey) {
            ctx.addIssue({
                code: 'custom',
                path: ['planner', 'apiKey'],
                message: 'planner apiKey is required when enabled',
            });
        }
    });

export type TicrafterConfig = z.infer<typeof configSchema>;
export type HardwareProfile = z.infer<typeof profileSchema>;
export type ExecutionProvider = z.infer<typeof executionProvider>;

export class ConfigSchemaValidator {
    static validate(value: unknown): Result<TicrafterConfig, ConfigFailure> {
        const result = configSchema.safeParse(value);
        if (!result.success) {
            const issues = result.error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`);
            return [null, { type: 'INVALID', issues }];
        }
        return [result.data, null];
    }
}
