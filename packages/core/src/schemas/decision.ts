import { z as zod } from 'zod';

import { positionSchema } from './shared.js';
import { strategicConstraintSchema, strategicGoalKindSchema } from './strategic-intent.js';

export const DECISION_REQUEST = 'decision.request';
export const DECISION_RESPONSE = 'decision.response';
export const DECISION_TRACE = 'decision.trace';

const decisionDigestSchema = zod.object({
    health: zod.number(),
    food: zod.number(),
    position: positionSchema,
    inventoryCount: zod.number().int().nonnegative(),
    currentSkill: zod.string().optional(),
    inventorySummary: zod
        .array(zod.object({ name: zod.string(), count: zod.number().int().nonnegative() }))
        .optional(),
    hazards: zod.array(zod.string()).optional(),
    taskId: zod.string().optional(),
    taskProgress: zod.number().min(0).max(1).optional(),
    lastResult: zod.string().optional(),
    workingMemoryRevision: zod.number().int().nonnegative().optional(),
    decisionKind: zod.enum(['task', 'goal']).optional(),
    focus: zod
        .object({
            kind: zod.enum(['agency', 'project', 'task']),
            id: zod.string().min(1),
            label: zod.string().min(1),
        })
        .nullable()
        .optional(),
    commitments: zod
        .array(
            zod.object({
                id: zod.string().min(1),
                description: zod.string().min(1),
                priority: zod.number(),
            }),
        )
        .optional(),
    recentExperiences: zod
        .array(
            zod.object({
                event: zod.string().min(1),
                outcome: zod.string().min(1),
                at: zod.string().min(1),
            }),
        )
        .optional(),
    interruption: zod
        .object({
            reason: zod.string().min(1),
            resumeCondition: zod.string().min(1),
            interruptedFocusId: zod.string().min(1),
        })
        .nullable()
        .optional(),
    strategicGoal: zod
        .object({
            kind: strategicGoalKindSchema,
            weight: zod.number().min(0).max(1),
        })
        .nullable()
        .optional(),
    strategicConstraints: zod.array(strategicConstraintSchema).optional(),
});

const decisionAffordanceSchema = zod.object({
    id: zod.string().min(1),
    skillId: zod.string().min(1),
    label: zod.string().min(1),
    priority: zod.number().optional(),
});

export const decisionRequestSchema = zod.object({
    botId: zod.string().min(1),
    at: zod.string().min(1),
    digest: decisionDigestSchema,
    affordances: zod.array(decisionAffordanceSchema).min(1).max(16),
});

export const decisionResponseSchema = zod.object({
    botId: zod.string().min(1),
    at: zod.string().min(1),
    choiceId: zod.string().min(1).nullable(),
    probabilities: zod.record(zod.string(), zod.number()),
    answerConfidence: zod.number().min(0).max(1),
    danger: zod.boolean(),
    shouldContinue: zod.boolean(),
    latencyMilliseconds: zod.number().nonnegative(),
    source: zod.enum(['laya', 'fallback']),
    reason: zod.string().optional(),
});

export type DecisionRequest = zod.infer<typeof decisionRequestSchema>;
export type DecisionResponse = zod.infer<typeof decisionResponseSchema>;
export type DecisionAffordance = zod.infer<typeof decisionAffordanceSchema>;
export type DecisionDigest = zod.infer<typeof decisionDigestSchema>;
