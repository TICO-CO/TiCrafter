import { z as zod } from 'zod';

import type { ScenarioAssertion } from '../behavior-assertions/index.js';
import type { ScenarioBotRole } from '../scenario-runner/index.js';

const positionSchema = zod.object({
    x: zod.number(),
    y: zod.number(),
    z: zod.number(),
});

const worldSchema = zod.object({
    kind: zod.enum(['flat', 'uneven']),
    bounds: zod.object({ min: positionSchema, max: positionSchema }),
    groundY: zod.number(),
    maximumStep: zod.number().optional(),
});

const botSchema = zod.object({
    name: zod.string().min(1),
    role: zod.string().min(1),
    traits: zod.record(zod.string(), zod.number()).optional(),
    inventory: zod.record(zod.string(), zod.number()).optional(),
});

const taskSchema = zod.object({
    id: zod.string().min(1),
    title: zod.string().min(1),
    skillId: zod.string().min(1),
    payload: zod.record(zod.string(), zod.unknown()).optional(),
    requiredRole: zod.string().min(1).nullable().optional(),
    target: positionSchema.nullable().optional(),
});

export interface BehaviorScenario {
    id: string;
    title: string;
    mode: 'simulate' | 'live' | 'both';
    seed: number;
    world: {
        kind: 'flat' | 'uneven';
        bounds: {
            min: { x: number; y: number; z: number };
            max: { x: number; y: number; z: number };
        };
        groundY: number;
        maximumStep?: number;
    };
    bots: readonly {
        name: string;
        role: ScenarioBotRole;
        traits?: Readonly<Record<string, number>>;
        inventory?: Readonly<Record<string, number>>;
    }[];
    startTime: { timeOfDay: number };
    tasks?: readonly {
        id: string;
        title: string;
        skillId: string;
        payload?: Readonly<Record<string, unknown>>;
        requiredRole?: ScenarioBotRole | null;
        target?: { x: number; y: number; z: number } | null;
    }[];
    assumptions?: {
        planner?: 'disabled' | 'fixture';
        goalTieBreak?: 'disabled' | 'enabled';
        laya?: 'deterministic' | 'fixture';
        agency?: 'disabled' | 'enabled';
    };
    assertions: readonly ScenarioAssertion[];
    timeoutTicks: number;
    timeoutMilliseconds: number;
    artifacts?: { keepOnSuccess?: boolean; keepOnFailure?: boolean };
}

const behaviorScenarioSchema = zod.object({
    id: zod.string().min(1),
    title: zod.string().min(1),
    mode: zod.enum(['simulate', 'live', 'both']),
    seed: zod.number(),
    world: worldSchema,
    bots: zod.array(botSchema).min(1),
    startTime: zod.object({ timeOfDay: zod.number() }),
    tasks: zod.array(taskSchema).optional(),
    assumptions: zod
        .object({
            planner: zod.enum(['disabled', 'fixture']).optional(),
            goalTieBreak: zod.enum(['disabled', 'enabled']).optional(),
            laya: zod.enum(['deterministic', 'fixture']).optional(),
            agency: zod.enum(['disabled', 'enabled']).optional(),
        })
        .optional(),
    assertions: zod.array(zod.unknown()).min(1),
    timeoutTicks: zod.number().int().positive(),
    timeoutMilliseconds: zod.number().int().positive(),
    artifacts: zod
        .object({
            keepOnSuccess: zod.boolean().optional(),
            keepOnFailure: zod.boolean().optional(),
        })
        .optional(),
});

export class BehaviorScenarioParser {
    static parse(input: unknown): { scenario: BehaviorScenario | null; error: string | null } {
        const parsed = behaviorScenarioSchema.safeParse(input);
        if (!parsed.success) return { scenario: null, error: parsed.error.message };
        return { scenario: parsed.data as unknown as BehaviorScenario, error: null };
    }
}
