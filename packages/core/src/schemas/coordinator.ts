import { z as zod } from 'zod';

export const coordinatorPingSchema = zod.object({});

export const coordinatorPingResponseSchema = zod.object({
    pong: zod.literal(true),
    at: zod.string(),
});

export const coordinatorStatusSchema = zod.object({});

export const coordinatorStatusResponseSchema = zod.object({
    epoch: zod.number().int().nonnegative(),
    sessions: zod.array(
        zod.object({
            botId: zod.string(),
            name: zod.string(),
            connectedAt: zod.string(),
            lastSeen: zod.string(),
        }),
    ),
});

export const coordinatorErrorSchema = zod.object({
    code: zod.string().min(1),
    message: zod.string().min(1),
});

export type CoordinatorStatusResponse = zod.infer<typeof coordinatorStatusResponseSchema>;
