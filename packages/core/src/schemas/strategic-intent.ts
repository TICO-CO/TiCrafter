import { z as zod } from 'zod';

export const PLANNER_STRATEGIC_INTENT_EVENT = 'planner.strategic.intent';

export const STRATEGIC_GOAL_KINDS = [
    'survive',
    'eat',
    'rest',
    'gather',
    'craft',
    'shelter',
    'explore',
    'social',
    'return-home',
    'deposit',
    'leisure',
    'prepare-night',
    'build-shelter',
    'dig-shelter',
    'secure-bed',
    'gather-wool',
    'gather-food',
    'equip-gear',
] as const;

export const strategicGoalKindSchema = zod.enum(STRATEGIC_GOAL_KINDS);

export const strategicProjectKindSchema = zod.enum(['home', 'storage', 'build']);

export const STRATEGIC_CONSTRAINTS = [
    'avoid-caves',
    'avoid-combat',
    'avoid-lava',
    'prefer-local-work',
    'prioritize-safety',
    'return-home-before-night',
] as const;

export const strategicConstraintSchema = zod.enum(STRATEGIC_CONSTRAINTS);

const strategicGoalPrioritySchema = zod.number().min(-1).max(1);

const strategicGoalSchema = zod.strictObject({
    kind: strategicGoalKindSchema,
    weight: zod.number().min(0).max(1),
    projectKind: strategicProjectKindSchema.optional(),
    blueprintRef: zod.string().min(1).optional(),
});

const strategicPriorityModifiersSchema = zod.strictObject({
    survive: strategicGoalPrioritySchema.optional(),
    eat: strategicGoalPrioritySchema.optional(),
    rest: strategicGoalPrioritySchema.optional(),
    gather: strategicGoalPrioritySchema.optional(),
    craft: strategicGoalPrioritySchema.optional(),
    shelter: strategicGoalPrioritySchema.optional(),
    explore: strategicGoalPrioritySchema.optional(),
    social: strategicGoalPrioritySchema.optional(),
    'return-home': strategicGoalPrioritySchema.optional(),
    deposit: strategicGoalPrioritySchema.optional(),
    leisure: strategicGoalPrioritySchema.optional(),
    'prepare-night': strategicGoalPrioritySchema.optional(),
    'build-shelter': strategicGoalPrioritySchema.optional(),
    'dig-shelter': strategicGoalPrioritySchema.optional(),
    'secure-bed': strategicGoalPrioritySchema.optional(),
    'gather-wool': strategicGoalPrioritySchema.optional(),
    'gather-food': strategicGoalPrioritySchema.optional(),
    'equip-gear': strategicGoalPrioritySchema.optional(),
});

const strategicBotOverrideSchema = zod.strictObject({
    botId: zod.string().min(1),
    priorityModifiers: strategicPriorityModifiersSchema,
    constraints: zod.array(strategicConstraintSchema),
});

export const strategicIntentSchema = zod.strictObject({
    planId: zod.string().min(1),
    primaryGoal: strategicGoalSchema,
    secondaryGoals: zod.array(strategicGoalSchema).max(4),
    constraints: zod.array(strategicConstraintSchema),
    perBot: zod.array(strategicBotOverrideSchema),
});

export const plannerStrategicIntentEventSchema = zod.strictObject({
    intent: strategicIntentSchema,
});

export type StrategicGoalKind = zod.infer<typeof strategicGoalKindSchema>;
export type StrategicProjectKind = zod.infer<typeof strategicProjectKindSchema>;
export type StrategicConstraint = zod.infer<typeof strategicConstraintSchema>;
export type StrategicGoal = zod.infer<typeof strategicGoalSchema>;
export type StrategicBotOverride = zod.infer<typeof strategicBotOverrideSchema>;
export type StrategicIntent = zod.infer<typeof strategicIntentSchema>;
export type PlannerStrategicIntentEvent = zod.infer<typeof plannerStrategicIntentEventSchema>;
