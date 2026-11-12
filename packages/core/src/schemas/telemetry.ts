import { z as zod } from 'zod';

import { positionSchema } from './shared.js';

export const botHeartbeatSchema = zod.object({
    botId: zod.string().min(1),
    at: zod.string(),
    digest: zod.object({
        health: zod.number(),
        food: zod.number(),
        position: positionSchema,
        inventoryCount: zod.number().int().nonnegative(),
        currentSkill: zod.string().optional(),
        inventorySummary: zod
            .array(zod.object({ name: zod.string(), count: zod.number().int().nonnegative() }))
            .optional(),
        hazards: zod.array(zod.string()).optional(),
    }),
});

export const botEventSchema = zod.object({
    botId: zod.string().min(1),
    event: zod.string().min(1),
    at: zod.string(),
    data: zod.unknown().optional(),
});

export type BotHeartbeat = zod.infer<typeof botHeartbeatSchema>;
export type BotEvent = zod.infer<typeof botEventSchema>;
