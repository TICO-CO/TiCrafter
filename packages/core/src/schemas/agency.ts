import { z as zod } from 'zod';

import { progressionPlanSchema } from './progression.js';
import { positionSchema } from './shared.js';
import { strategicIntentSchema } from './strategic-intent.js';

export const BOT_AUTONOMY_PAUSE = 'bot.autonomy.pause';
export const BOT_AUTONOMY_RESUME = 'bot.autonomy.resume';

export const AGENCY_STATE_EVENT = 'bot.agency.state';
export const AGENCY_EPISODE_EVENT = 'bot.agency.episode';

export const agencyTraitsSchema = zod.object({
    curiosity: zod.number().min(0).max(1),
    industriousness: zod.number().min(0).max(1),
    caution: zod.number().min(0).max(1),
    sociability: zod.number().min(0).max(1),
    ambition: zod.number().min(0).max(1),
    orderliness: zod.number().min(0).max(1),
    patience: zod.number().min(0).max(1),
});

export const agencyNeedsSchema = zod.object({
    safety: zod.number().min(0).max(1),
    hunger: zod.number().min(0).max(1),
    rest: zod.number().min(0).max(1),
    materials: zod.number().min(0).max(1),
    tools: zod.number().min(0).max(1),
    shelter: zod.number().min(0).max(1),
    social: zod.number().min(0).max(1),
    novelty: zod.number().min(0).max(1),
    achievement: zod.number().min(0).max(1),
});

export const agencyIntentionSchema = zod.object({
    goalId: zod.string().min(1),
    label: zod.string().min(1),
    stepIndex: zod.number().int().nonnegative(),
    createdAt: zod.string().min(1),
    deadline: zod.string().min(1).nullable(),
    deadlineExtended: zod.boolean().optional(),
    attempts: zod.number().int().nonnegative(),
});

export const agencyRoutineSchema = zod.object({
    phase: zod.enum(['morning', 'day', 'evening', 'night']),
    lastMealAt: zod.string().min(1).nullable(),
    lastRestAt: zod.string().min(1).nullable(),
});

export const workingMemoryFocusSchema = zod.object({
    kind: zod.enum(['agency', 'project', 'task']),
    id: zod.string().min(1),
    label: zod.string().min(1),
    startedAt: zod.string().min(1),
});

export const workingMemoryCommitmentSchema = zod.object({
    id: zod.string().min(1),
    description: zod.string().min(1),
    priority: zod.number(),
    createdAt: zod.string().min(1),
    expiresAt: zod.string().min(1).nullable(),
});

export const workingMemoryInterruptionSchema = zod.object({
    reason: zod.string().min(1),
    resumeCondition: zod.string().min(1),
    interruptedFocusId: zod.string().min(1),
    at: zod.string().min(1),
});

export const workingMemoryExperienceSchema = zod.object({
    event: zod.string().min(1),
    outcome: zod.string().min(1),
    at: zod.string().min(1),
});

export const workingMemoryTacticalDecisionSchema = zod.object({
    choiceId: zod.string().min(1),
    source: zod.enum(['laya', 'fallback', 'deterministic']),
    at: zod.string().min(1),
    revision: zod.number().int().nonnegative(),
});

export const workingMemorySchema = zod.object({
    revision: zod.number().int().nonnegative(),
    focus: workingMemoryFocusSchema.nullable(),
    commitments: zod.array(workingMemoryCommitmentSchema).max(16),
    interruption: workingMemoryInterruptionSchema.nullable(),
    recentExperiences: zod.array(workingMemoryExperienceSchema).max(32),
    lastTacticalDecision: workingMemoryTacticalDecisionSchema.nullable(),
    strategicIntent: strategicIntentSchema.nullable().optional(),
    progressionPlan: progressionPlanSchema.nullable().optional(),
});

export const agencyStateSchema = zod.object({
    traits: agencyTraitsSchema,
    needs: agencyNeedsSchema,
    intention: agencyIntentionSchema.nullable(),
    routine: agencyRoutineSchema,
    homeStructureId: zod.string().min(1).nullable(),
    personalStorageId: zod.string().min(1).nullable(),
    mood: zod.string().min(1),
    lastDeliberationAt: zod.string().min(1).nullable(),
    workingMemory: workingMemorySchema.optional(),
});

export const botAgencyStateSchema = zod.object({
    botId: zod.string().min(1),
    at: zod.string().min(1),
    state: agencyStateSchema,
});

export const botAgencyEpisodeSchema = zod.object({
    botId: zod.string().min(1),
    at: zod.string().min(1),
    episode: zod.object({
        id: zod.string().min(1),
        goalId: zod.string().min(1).nullable(),
        kind: zod.string().min(1),
        summary: zod.string().min(1),
        position: positionSchema.nullable(),
        relatedBotId: zod.string().min(1).nullable(),
        payload: zod.unknown(),
    }),
});

export const botAutonomyPauseSchema = zod.object({
    reason: zod.string().min(1).optional(),
});

export const botAutonomyResumeSchema = zod.object({
    reason: zod.string().min(1).optional(),
});

export type AgencyTraitsPayload = zod.infer<typeof agencyTraitsSchema>;
export type AgencyNeedsPayload = zod.infer<typeof agencyNeedsSchema>;
export type AgencyIntentionPayload = zod.infer<typeof agencyIntentionSchema>;
export type AgencyRoutinePayload = zod.infer<typeof agencyRoutineSchema>;
export type WorkingMemoryPayload = zod.infer<typeof workingMemorySchema>;
export type AgencyStatePayload = zod.infer<typeof agencyStateSchema>;
export type BotAgencyStateMessage = zod.infer<typeof botAgencyStateSchema>;
export type BotAgencyEpisodeMessage = zod.infer<typeof botAgencyEpisodeSchema>;
export type BotAutonomyPauseMessage = zod.infer<typeof botAutonomyPauseSchema>;
export type BotAutonomyResumeMessage = zod.infer<typeof botAutonomyResumeSchema>;
