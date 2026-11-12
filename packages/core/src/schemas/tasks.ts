import { z as zod } from 'zod';

import { inventoryItemSchema, positionSchema, roleSchema } from './shared.js';

export const TASK_CLAIM = 'bot.task.claim';
export const TASK_RENEW = 'bot.task.renew';
export const TASK_COMPLETE = 'bot.task.complete';
export const TASK_FAIL = 'bot.task.fail';
export const TASK_RESPONSE = 'bot.task.response';

export const taskFailureClassSchema = zod.enum([
    'transient',
    'precondition',
    'blocked',
    'invalid',
    'fatal',
]);

export const taskAssignmentSchema = zod.object({
    id: zod.string().min(1),
    title: zod.string().min(1),
    priority: zod.number(),
    payload: zod.record(zod.string(), zod.unknown()),
    target: positionSchema.nullable(),
    requiredRole: roleSchema.nullable(),
});

export const botTaskClaimSchema = zod.object({
    botId: zod.string().min(1),
    at: zod.string().min(1),
    position: positionSchema,
    inventory: zod.array(inventoryItemSchema),
    role: roleSchema.nullable().optional(),
});

export const botTaskRenewSchema = zod.object({
    botId: zod.string().min(1),
    taskId: zod.string().min(1),
    fencingToken: zod.number().int().nonnegative(),
});

export const botTaskCompleteSchema = zod.object({
    botId: zod.string().min(1),
    taskId: zod.string().min(1),
    fencingToken: zod.number().int().nonnegative(),
});

export const botTaskFailSchema = zod.object({
    botId: zod.string().min(1),
    taskId: zod.string().min(1),
    fencingToken: zod.number().int().nonnegative(),
    failureClass: taskFailureClassSchema,
    reason: zod.string().min(1),
});

export const botTaskResponseSchema = zod.object({
    ok: zod.boolean(),
    taskId: zod.string().min(1).optional(),
    task: taskAssignmentSchema.nullable(),
    fencingToken: zod.number().int().nonnegative().nullable(),
    leaseUntil: zod.string().min(1).nullable(),
    reason: zod.string().optional(),
});

export type TaskAssignment = zod.infer<typeof taskAssignmentSchema>;
export type BotTaskClaim = zod.infer<typeof botTaskClaimSchema>;
export type BotTaskRenew = zod.infer<typeof botTaskRenewSchema>;
export type BotTaskComplete = zod.infer<typeof botTaskCompleteSchema>;
export type BotTaskFail = zod.infer<typeof botTaskFailSchema>;
export type BotTaskResponse = zod.infer<typeof botTaskResponseSchema>;
