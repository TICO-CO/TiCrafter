import { z as zod } from 'zod';

import type { ScenarioAssertion } from '../behavior-assertions/index.js';
import type { ScenarioBotRole } from '../scenario-runner/index.js';

const positionSchema = zod.object({
    x: zod.number(),
    y: zod.number(),
    z: zod.number(),
});

const blockSchema = zod
    .object({
        position: positionSchema,
        name: zod.string().min(1),
        properties: zod.record(zod.string(), zod.string()).optional(),
    })
    .strict();

const entitySchema = zod
    .object({
        id: zod.number().int().optional(),
        name: zod.string().min(1),
        position: positionSchema,
    })
    .strict();

const bboxSchema = zod
    .object({
        min: positionSchema,
        max: positionSchema,
    })
    .strict();

const worldSchema = zod
    .object({
        kind: zod.enum(['flat', 'uneven']),
        bounds: bboxSchema,
        groundY: zod.number(),
        maximumStep: zod.number().optional(),
        clearRegion: bboxSchema.optional(),
        blocks: zod.array(blockSchema).optional(),
        entities: zod.array(entitySchema).optional(),
    })
    .strict();

const playerSchema = zod
    .object({
        id: zod.string().min(1),
        username: zod.string().min(1),
        position: positionSchema,
    })
    .strict();

const claimSchema = zod
    .object({
        id: zod.string().min(1),
        ownerBotId: zod.string().min(1),
        resourceType: zod.enum([
            'structure',
            'work_package',
            'farm_plot',
            'container',
            'road_segment',
            'resource_area',
        ]),
        bbox: bboxSchema,
        expiresAt: zod.string().min(1).optional(),
    })
    .strict();

const homeSchema = zod
    .object({
        anchor: positionSchema,
        bbox: bboxSchema,
        status: zod.enum(['proposed', 'active', 'completed', 'abandoned', 'failed']),
        structureId: zod.string().min(1).nullable(),
    })
    .strict();

const landmarkSchema = zod
    .object({
        id: zod.string().min(1),
        type: zod.enum([
            'house',
            'farm',
            'storage',
            'path',
            'workstation',
            'wall',
            'bridge',
            'mineshaft',
        ]),
        bbox: bboxSchema,
        confidence: zod.number().min(0).max(1).optional(),
    })
    .strict();

const chatSchema = zod
    .object({
        atTick: zod.number().int().nonnegative(),
        playerId: zod.string().min(1),
        message: zod.string(),
    })
    .strict();

const villageConfigSchema = zod
    .object({
        allowedPlotRegions: zod
            .array(
                zod
                    .object({
                        id: zod.string().min(1),
                        min: positionSchema,
                        max: positionSchema,
                    })
                    .strict(),
            )
            .optional(),
        playerBaseLinks: zod
            .array(
                zod
                    .object({
                        playerId: zod.string().min(1),
                        username: zod.string().min(1),
                        baseId: zod.string().min(1),
                        confidence: zod.number().min(0).max(1).optional(),
                    })
                    .strict(),
            )
            .optional(),
        playerConfidenceInitial: zod.number().min(0).max(1).optional(),
        playerConfidenceThreshold: zod.number().min(0).max(1).optional(),
        playerConfidenceHalfLifeDays: zod.number().positive().optional(),
        playerLinkRadius: zod.number().positive().optional(),
        playerLinkMinSightings: zod.number().int().positive().optional(),
        playerLinkWindowMs: zod.number().int().positive().optional(),
        permissionAskCooldownMs: zod.number().int().nonnegative().optional(),
        permissionTimeoutMs: zod.number().int().positive().optional(),
        permissionGrantTtlMs: zod.number().int().positive().optional(),
    })
    .strict();

const botSchema = zod.object({
    name: zod.string().min(1),
    role: zod.string().min(1),
    traits: zod.record(zod.string(), zod.number()).optional(),
    needs: zod.record(zod.string(), zod.number()).optional(),
    inventory: zod.record(zod.string(), zod.number()).optional(),
    position: positionSchema.optional(),
});

const taskSchema = zod
    .object({
        id: zod.string().min(1),
        title: zod.string().min(1),
        skillId: zod.string().min(1),
        payload: zod.record(zod.string(), zod.unknown()).optional(),
        requiredRole: zod.string().min(1).nullable().optional(),
        target: positionSchema.nullable().optional(),
        delayMilliseconds: zod.number().int().nonnegative().optional(),
        dependsOn: zod.array(zod.string().min(1)).optional(),
    })
    .strict();

const faultSchema = zod.discriminatedUnion('type', [
    zod
        .object({
            atTick: zod.number().int().positive(),
            type: zod.literal('inventory-change'),
            botId: zod.string().min(1).optional(),
            itemName: zod.string().min(1),
            count: zod.number().int(),
        })
        .strict(),
    zod
        .object({
            atTick: zod.number().int().positive(),
            type: zod.literal('missing-material'),
            botId: zod.string().min(1).optional(),
            itemName: zod.string().min(1),
        })
        .strict(),
    zod
        .object({
            atTick: zod.number().int().positive(),
            type: zod.literal('missing-recipe'),
            botId: zod.string().min(1).optional(),
            itemName: zod.string().min(1),
        })
        .strict(),
    zod
        .object({
            atTick: zod.number().int().positive(),
            type: zod.literal('missing-gather-source'),
            blockName: zod.string().min(1),
        })
        .strict(),
    zod
        .object({
            atTick: zod.number().int().positive(),
            type: zod.literal('unreachable-target'),
            botId: zod.string().min(1).optional(),
            position: positionSchema,
        })
        .strict(),
    zod
        .object({
            atTick: zod.number().int().positive(),
            type: zod.literal('action-failure'),
            botId: zod.string().min(1).optional(),
            count: zod.number().int().positive().optional(),
            kinds: zod.array(zod.string().min(1)).optional(),
        })
        .strict(),
    zod
        .object({
            atTick: zod.number().int().positive(),
            type: zod.literal('action-delay'),
            botId: zod.string().min(1).optional(),
            milliseconds: zod.number().int().nonnegative(),
        })
        .strict(),
    zod
        .object({
            atTick: zod.number().int().positive(),
            type: zod.literal('block-mismatch'),
            position: positionSchema,
            blockId: zod.string().min(1),
            properties: zod.record(zod.string(), zod.string()).optional(),
        })
        .strict(),
    zod
        .object({
            atTick: zod.number().int().positive(),
            type: zod.literal('protected-zone'),
            min: positionSchema,
            max: positionSchema,
        })
        .strict(),
    zod
        .object({
            atTick: zod.number().int().positive(),
            type: zod.literal('claim-conflict'),
            claim: claimSchema,
        })
        .strict(),
    zod
        .object({
            atTick: zod.number().int().positive(),
            type: zod.literal('bot-disconnect'),
            botId: zod.string().min(1),
        })
        .strict(),
    zod
        .object({
            atTick: zod.number().int().positive(),
            type: zod.literal('coordinator-restart'),
        })
        .strict(),
]);

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
        clearRegion?: {
            min: { x: number; y: number; z: number };
            max: { x: number; y: number; z: number };
        };
        blocks?: readonly {
            position: { x: number; y: number; z: number };
            name: string;
            properties?: Readonly<Record<string, string>>;
        }[];
        entities?: readonly {
            id?: number;
            name: string;
            position: { x: number; y: number; z: number };
        }[];
    };
    players?: readonly {
        id: string;
        username: string;
        position: { x: number; y: number; z: number };
    }[];
    home?: {
        anchor: { x: number; y: number; z: number };
        bbox: {
            min: { x: number; y: number; z: number };
            max: { x: number; y: number; z: number };
        };
        status: 'proposed' | 'active' | 'completed' | 'abandoned' | 'failed';
        structureId: string | null;
    };
    landmarks?: readonly {
        id: string;
        type:
            'house' | 'farm' | 'storage' | 'path' | 'workstation' | 'wall' | 'bridge' | 'mineshaft';
        bbox: {
            min: { x: number; y: number; z: number };
            max: { x: number; y: number; z: number };
        };
        confidence?: number;
    }[];
    claims?: readonly {
        id: string;
        ownerBotId: string;
        resourceType:
            | 'structure'
            | 'work_package'
            | 'farm_plot'
            | 'container'
            | 'road_segment'
            | 'resource_area';
        bbox: {
            min: { x: number; y: number; z: number };
            max: { x: number; y: number; z: number };
        };
        expiresAt?: string;
    }[];
    chat?: readonly { atTick: number; playerId: string; message: string }[];
    recipes?: Readonly<Record<string, Readonly<Record<string, number>>>>;
    resourceSites?: readonly { kind: string; position: { x: number; y: number; z: number } }[];
    actionLatencyMilliseconds?: number;
    agencyOverrides?: {
        goalCadenceMilliseconds?: number;
        needDecayPerMinute?: number;
    };
    drops?: Readonly<Record<string, string>>;
    outputs?: Readonly<Record<string, number>>;
    village?: {
        allowedPlotRegions?: readonly {
            id: string;
            min: { x: number; y: number; z: number };
            max: { x: number; y: number; z: number };
        }[];
        playerBaseLinks?: readonly {
            playerId: string;
            username: string;
            baseId: string;
            confidence?: number;
        }[];
        playerConfidenceInitial?: number;
        playerConfidenceThreshold?: number;
        playerConfidenceHalfLifeDays?: number;
        playerLinkRadius?: number;
        playerLinkMinSightings?: number;
        playerLinkWindowMs?: number;
        permissionAskCooldownMs?: number;
        permissionTimeoutMs?: number;
        permissionGrantTtlMs?: number;
    };
    seeds?: readonly number[];
    stopOnAssertions?: boolean;
    assertionCheckAfterTick?: number;
    durationTicks?: number;
    bots: readonly {
        name: string;
        role: ScenarioBotRole;
        traits?: Readonly<Record<string, number>>;
        needs?: Readonly<Record<string, number>>;
        inventory?: Readonly<Record<string, number>>;
        position?: { x: number; y: number; z: number };
    }[];
    startTime: { timeOfDay: number };
    tasks?: readonly {
        id: string;
        title: string;
        skillId: string;
        payload?: Readonly<Record<string, unknown>>;
        requiredRole?: ScenarioBotRole | null;
        target?: { x: number; y: number; z: number } | null;
        delayMilliseconds?: number;
        dependsOn?: readonly string[];
    }[];
    assumptions?: {
        planner?: 'disabled' | 'fixture';
        goalTieBreak?: 'disabled' | 'enabled';
        laya?: 'deterministic' | 'fixture';
        agency?: 'disabled' | 'enabled';
        progression?: 'disabled' | 'enabled';
    };
    faults?: readonly ScenarioFault[];
    assertions: readonly ScenarioAssertion[];
    timeoutTicks: number;
    timeoutMilliseconds: number;
    artifacts?: { keepOnSuccess?: boolean; keepOnFailure?: boolean };
}

export type ScenarioFault =
    | {
          atTick: number;
          type: 'inventory-change';
          botId?: string;
          itemName: string;
          count: number;
      }
    | {
          atTick: number;
          type: 'missing-material';
          botId?: string;
          itemName: string;
      }
    | {
          atTick: number;
          type: 'missing-recipe';
          botId?: string;
          itemName: string;
      }
    | { atTick: number; type: 'missing-gather-source'; blockName: string }
    | {
          atTick: number;
          type: 'unreachable-target';
          botId?: string;
          position: { x: number; y: number; z: number };
      }
    | {
          atTick: number;
          type: 'action-failure';
          botId?: string;
          count?: number;
          kinds?: readonly string[];
      }
    | {
          atTick: number;
          type: 'action-delay';
          botId?: string;
          milliseconds: number;
      }
    | {
          atTick: number;
          type: 'block-mismatch';
          position: { x: number; y: number; z: number };
          blockId: string;
          properties?: Readonly<Record<string, string>>;
      }
    | {
          atTick: number;
          type: 'protected-zone';
          min: { x: number; y: number; z: number };
          max: { x: number; y: number; z: number };
      }
    | {
          atTick: number;
          type: 'claim-conflict';
          claim: NonNullable<BehaviorScenario['claims']>[number];
      }
    | { atTick: number; type: 'bot-disconnect'; botId: string }
    | { atTick: number; type: 'coordinator-restart' };

const behaviorScenarioSchema = zod
    .object({
        id: zod.string().min(1),
        title: zod.string().min(1),
        mode: zod.enum(['simulate', 'live', 'both']),
        seed: zod.number(),
        seeds: zod.array(zod.number()).optional(),
        stopOnAssertions: zod.boolean().optional(),
        assertionCheckAfterTick: zod.number().int().nonnegative().optional(),
        durationTicks: zod.number().int().positive().optional(),
        world: worldSchema,
        bots: zod.array(botSchema).min(1),
        players: zod.array(playerSchema).optional(),
        home: homeSchema.optional(),
        landmarks: zod.array(landmarkSchema).optional(),
        claims: zod.array(claimSchema).optional(),
        chat: zod.array(chatSchema).optional(),
        recipes: zod.record(zod.string(), zod.record(zod.string(), zod.number())).optional(),
        resourceSites: zod
            .array(
                zod
                    .object({
                        kind: zod.string().min(1),
                        position: positionSchema,
                    })
                    .strict(),
            )
            .optional(),
        actionLatencyMilliseconds: zod.number().int().nonnegative().optional(),
        agencyOverrides: zod
            .object({
                goalCadenceMilliseconds: zod.number().int().min(250).optional(),
                needDecayPerMinute: zod.number().min(0).max(1).optional(),
            })
            .strict()
            .optional(),
        drops: zod.record(zod.string(), zod.string()).optional(),
        outputs: zod.record(zod.string(), zod.number()).optional(),
        village: villageConfigSchema.optional(),
        startTime: zod.object({ timeOfDay: zod.number() }).strict(),
        tasks: zod.array(taskSchema).optional(),
        faults: zod.array(faultSchema).optional(),
        assumptions: zod
            .object({
                planner: zod.enum(['disabled', 'fixture']).optional(),
                goalTieBreak: zod.enum(['disabled', 'enabled']).optional(),
                laya: zod.enum(['deterministic', 'fixture']).optional(),
                agency: zod.enum(['disabled', 'enabled']).optional(),
                progression: zod.enum(['disabled', 'enabled']).optional(),
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
            .strict()
            .optional(),
    })
    .strict();

export class BehaviorScenarioParser {
    static parse(input: unknown): { scenario: BehaviorScenario | null; error: string | null } {
        const parsed = behaviorScenarioSchema.safeParse(input);
        if (!parsed.success) return { scenario: null, error: parsed.error.message };
        return { scenario: parsed.data as unknown as BehaviorScenario, error: null };
    }
}
