import { type ConstructionPlan, ConstructionPlanDocumentHash } from '@ticrafter/building';
import type {
    ConstructionPlanDocumentPayload,
    Envelope,
    Result,
    TransportFailure,
} from '@ticrafter/core';
import type { SkillBBox, SkillBlock, SkillBlockState, SkillContext } from '@ticrafter/skills';
import { describe, expect, it } from 'bun:test';

import type { BuildingWorldView } from './building-services.js';
import { ConstructionPlanFetchClient } from './construction-plan-fetch-client.js';
import { ConstructionSource } from './construction-source.js';

class FakeTransport {
    response: Envelope | null = null;

    async request(_type: string, _payload: unknown): Promise<Result<Envelope, TransportFailure>> {
        return [this.response, null];
    }
}

class FakeWorld implements BuildingWorldView {
    readonly placed = new Map<string, SkillBlockState>();

    blockStateAt(position: { x: number; y: number; z: number }): SkillBlockState | null {
        const placed = this.placed.get(`${position.x},${position.y},${position.z}`);
        if (placed !== undefined) return placed;
        if (position.y <= 63) return { name: 'stone', properties: {} };
        return null;
    }

    blocksInBox(bbox: SkillBBox): readonly SkillBlock[] {
        const blocks: SkillBlock[] = [];
        for (let x = bbox.min.x; x <= bbox.max.x; x += 1) {
            for (let y = bbox.min.y; y <= bbox.max.y; y += 1) {
                for (let z = bbox.min.z; z <= bbox.max.z; z += 1) {
                    const state = this.blockStateAt({ x, y, z });
                    if (state === null) continue;
                    blocks.push({ ...state, position: { x, y, z } });
                }
            }
        }
        return blocks;
    }
}

const plan: ConstructionPlan = {
    id: 'plan.structure.home',
    blueprintId: 'blueprint.home',
    anchor: { x: 0, y: 64, z: 0 },
    rotation: 0,
    translation: { x: 0, y: 0, z: 0 },
    site: {
        anchor: { x: 0, y: 64, z: 0 },
        translation: { x: 0, y: 0, z: 0 },
        rotation: 0,
        bounds: { min: { x: 0, y: 64, z: 0 }, max: { x: 0, y: 65, z: 0 } },
        clearance: [],
        access: { kind: 'none', from: null, to: { x: 0, y: 64, z: 0 }, length: 0 },
        foundationMode: 'level',
        foundationFillDepth: 0,
        foundationCutDepth: 0,
        score: 100,
        rationale: [],
    },
    foundation: {
        mode: 'level',
        targetY: 64,
        maximumFillDepth: 0,
        changes: [],
        materials: [],
        rationale: [],
    },
    changes: [
        {
            kind: 'place',
            block: { x: 0, y: 64, z: 0, state: { name: 'oak_planks' }, priority: 1 },
            phase: 'walls',
            reason: 'blueprint',
            dependsOn: [],
        },
        {
            kind: 'place',
            block: { x: 0, y: 65, z: 0, state: { name: 'oak_planks' }, priority: 1 },
            phase: 'walls',
            reason: 'blueprint',
            dependsOn: ['0,64,0'],
        },
    ],
    order: ['0,64,0', '0,65,0'],
    dependencies: [],
    scaffolds: [],
    unreachable: [],
    phases: ['walls'],
    materials: [{ item: 'oak_planks', count: 2 }],
    workPackages: [
        {
            id: 'plan.structure.home:layers:walls:0',
            bbox: { min: { x: 0, y: 64, z: 0 }, max: { x: 0, y: 65, z: 0 } },
            blockKeys: ['0,64,0', '0,65,0'],
            strategy: 'layers',
            status: 'planned',
            phase: 'walls',
            materials: [{ item: 'oak_planks', count: 2 }],
            scaffoldPositions: [],
            predecessorIds: [],
        },
    ],
};

const content = {
    id: 'plan.structure.home',
    revision: 4,
    structureId: 'structure.home',
    blueprintId: 'blueprint.home',
    blueprintRevision: 4,
    plan,
    createdAt: '2026-11-12T10:00:00.000Z',
};

const document = {
    ...content,
    hash: ConstructionPlanDocumentHash.of(content),
} satisfies ConstructionPlanDocumentPayload;

function response(documentPayload: ConstructionPlanDocumentPayload): Envelope {
    return {
        v: 1,
        id: 'response-1',
        kind: 'response',
        type: 'bot.constructionPlan.response',
        payload: { ok: true, document: documentPayload },
        timestamp: '2026-11-12T10:00:00.000Z',
    };
}

function context(world: BuildingWorldView): SkillContext {
    return {
        botId: 'bot.builder',
        at: '2026-11-12T12:00:00.000Z',
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        food: 20,
        inventory: [],
        world: {
            blockAt: (position) => world.blockStateAt(position)?.name ?? null,
            nearestContainer: () => null,
            blockStateAt: (position) => world.blockStateAt(position),
            blocksInBox: (bbox) => world.blocksInBox(bbox),
        },
        hostiles: [],
        nearestHostile: null,
        lastAction: null,
    };
}

describe('ConstructionSource', () => {
    it('resolves a cached exact plan revision into package operations', async () => {
        const transport = new FakeTransport();
        transport.response = response(document);
        const plans = new ConstructionPlanFetchClient(transport, 'bot.one');
        await plans.fetch('plan.structure.home', 4);
        const world = new FakeWorld();
        const source = new ConstructionSource({ plans, world });

        const [resolved, resolveError] = source.resolve(context(world), {
            blueprintId: 'blueprint.home',
            blueprintRevision: 4,
            planId: 'plan.structure.home',
            planRevision: 4,
            workPackageId: 'plan.structure.home:layers:walls:0',
        });
        expect(resolveError).toBeNull();
        expect(resolved?.planRevision).toBe(4);
        expect(resolved?.operations.some((operation) => operation.kind === 'place')).toBe(true);
        expect(resolved?.operations[0]?.target.position.y).toBe(64);
    });

    it('fails when the exact plan revision is not cached', () => {
        const transport = new FakeTransport();
        const plans = new ConstructionPlanFetchClient(transport, 'bot.one');
        const source = new ConstructionSource({ plans, world: new FakeWorld() });

        const [resolved, resolveError] = source.resolve(context(new FakeWorld()), {
            blueprintId: 'blueprint.home',
            blueprintRevision: 4,
            planId: 'plan.structure.home',
            planRevision: 4,
            workPackageId: 'plan.structure.home:layers:walls:0',
        });
        expect(resolved).toBeNull();
        expect(resolveError?.includes('is not cached')).toBe(true);
    });
});
