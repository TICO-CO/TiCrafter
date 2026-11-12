import { BlueprintDocumentHash } from '@ticrafter/building';
import type { BlueprintDocumentPayload, Envelope, Result, TransportFailure } from '@ticrafter/core';
import type { SkillBBox, SkillBlock, SkillBlockState, SkillContext } from '@ticrafter/skills';
import { describe, expect, it } from 'bun:test';

import { BlueprintFetchClient } from './blueprint-fetch-client.js';
import type { BuildingWorldView } from './building-services.js';
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

const content = {
    id: 'blueprint.home',
    revision: 4,
    source: 'template' as const,
    provenance: { createdBy: 'bot.one', createdAt: '2026-11-12T10:00:00.000Z' },
    blueprint: {
        id: 'blueprint.home',
        anchor: { x: 0, y: 64, z: 0 },
        rotation: 0 as const,
        blocks: [
            { x: 0, y: 64, z: 0, state: { name: 'oak_planks' }, priority: 1 },
            { x: 0, y: 65, z: 0, state: { name: 'oak_planks' }, priority: 1 },
        ],
        materials: [{ item: 'oak_planks', count: 2 }],
        constraints: [],
    },
} as const;

const document = {
    ...content,
    hash: BlueprintDocumentHash.of(content),
} satisfies BlueprintDocumentPayload;

function response(documentPayload: BlueprintDocumentPayload): Envelope {
    return {
        v: 1,
        id: 'response-1',
        kind: 'response',
        type: 'bot.blueprint.response',
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
    it('resolves a cached exact revision into ordered operations', async () => {
        const transport = new FakeTransport();
        transport.response = response(document);
        const documents = new BlueprintFetchClient(transport, 'bot.one');
        await documents.fetch('blueprint.home', 4);
        const world = new FakeWorld();
        const source = new ConstructionSource({
            documents,
            world,
            maxWorkPackageBlocks: 128,
        });

        const [plan, resolveError] = source.resolve(context(world), {
            blueprintId: 'blueprint.home',
            blueprintRevision: 4,
        });
        expect(resolveError).toBeNull();
        expect(plan?.blueprintRevision).toBe(4);
        expect(plan?.operations.some((operation) => operation.kind === 'place')).toBe(true);
        expect(plan?.operations[0]?.target.position.y).toBe(64);
    });

    it('fails when the exact revision is not cached', () => {
        const transport = new FakeTransport();
        const documents = new BlueprintFetchClient(transport, 'bot.one');
        const source = new ConstructionSource({
            documents,
            world: new FakeWorld(),
            maxWorkPackageBlocks: 128,
        });

        const [plan, resolveError] = source.resolve(context(new FakeWorld()), {
            blueprintId: 'blueprint.home',
            blueprintRevision: 4,
        });
        expect(plan).toBeNull();
        expect(resolveError?.includes('is not cached')).toBe(true);
    });
});
