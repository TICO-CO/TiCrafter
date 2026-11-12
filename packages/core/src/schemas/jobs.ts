import { z as zod } from 'zod';

import { inventoryItemSchema, positionSchema, roleSchema } from './shared.js';
import { type TaskAssignment, taskAssignmentSchema } from './tasks.js';

export const BOT_JOB_OFFERS = 'bot.job.offers';
export const BOT_JOB_OFFERS_RESPONSE = 'bot.job.offers.response';
export const BOT_JOB_DECIDE = 'bot.job.decide';
export const BOT_JOB_DECIDE_RESPONSE = 'bot.job.decide.response';

const jobOfferSchema = zod.object({
    taskId: zod.string().min(1),
    title: zod.string().min(1),
    priority: zod.number(),
    skillId: zod.string().min(1).nullable(),
    target: positionSchema.nullable(),
    requiredRole: roleSchema.nullable(),
    distance: zod.number().nullable(),
});

export const botJobOffersSchema = zod.object({
    botId: zod.string().min(1),
    at: zod.string().min(1),
    role: roleSchema.nullable(),
    position: positionSchema.nullable(),
    inventory: zod.array(inventoryItemSchema),
});

export const botJobOffersResponseSchema = zod.object({
    ok: zod.boolean(),
    offers: zod.array(jobOfferSchema),
    reason: zod.string().optional(),
});

export const botJobDecideSchema = zod.object({
    botId: zod.string().min(1),
    taskId: zod.string().min(1),
    decision: zod.enum(['accept', 'defer', 'decline']),
    reason: zod.string().min(1),
    role: roleSchema.nullable(),
    position: positionSchema.nullable(),
    inventory: zod.array(inventoryItemSchema),
});

export const botJobDecideResponseSchema = zod.object({
    ok: zod.boolean(),
    taskId: zod.string().min(1),
    offer: jobOfferSchema.nullable(),
    task: taskAssignmentSchema.nullable(),
    fencingToken: zod.number().int().nonnegative().nullable(),
    leaseUntil: zod.string().min(1).nullable(),
    reason: zod.string().optional(),
});

export type JobOfferPayload = zod.infer<typeof jobOfferSchema>;
export type BotJobOffers = zod.infer<typeof botJobOffersSchema>;
export type BotJobOffersResponse = zod.infer<typeof botJobOffersResponseSchema>;
export type BotJobDecide = zod.infer<typeof botJobDecideSchema>;
export type BotJobDecideResponse = zod.infer<typeof botJobDecideResponseSchema>;
export type JobTaskAssignment = TaskAssignment;
