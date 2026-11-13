import { z as zod } from 'zod';

export const progressionMilestoneSchema = zod.object({
    id: zod.string().min(1),
    kind: zod.string().min(1),
    label: zod.string().min(1),
    attempts: zod.number().int().nonnegative(),
    blocked: zod.boolean(),
    completedAt: zod.string().min(1).nullable(),
    count: zod.number().int().nonnegative().optional(),
    targetCount: zod.number().int().positive().optional(),
});

export const progressionPlanSchema = zod.object({
    id: zod.string().min(1),
    version: zod.number().int().positive(),
    revision: zod.number().int().nonnegative(),
    milestoneIndex: zod.number().int().nonnegative(),
    milestones: zod.array(progressionMilestoneSchema).min(1).max(32),
    updatedAt: zod.string().min(1),
});

export type ProgressionMilestone = zod.infer<typeof progressionMilestoneSchema>;
export type ProgressionPlan = zod.infer<typeof progressionPlanSchema>;
