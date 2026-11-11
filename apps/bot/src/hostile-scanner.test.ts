import type { Vec3 } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';
import type { Bot } from 'mineflayer';

import { HostileScanner, type HostileScannerWorld } from './hostile-scanner.js';

interface FakeEntity {
    id: number;
    name: string;
    position: Vec3;
}

class FakeWorld implements HostileScannerWorld {
    constructor(private readonly occluders: ReadonlySet<string> = new Set()) {}

    blockAt(position: Vec3): string | null {
        if (this.occluders.has(`${position.x},${position.y},${position.z}`)) return 'stone';
        return 'air';
    }
}

function scanner(entities: readonly FakeEntity[], world: HostileScannerWorld): HostileScanner {
    const bot = {
        entities: Object.fromEntries(entities.map((entity) => [String(entity.id), entity])),
    } as unknown as Bot;
    return new HostileScanner(bot, world);
}

describe('HostileScanner', () => {
    it('returns ranged attack geometry and line of sight', () => {
        const skeletons = scanner(
            [{ id: 7, name: 'skeleton', position: { x: 14, y: 64, z: 0 } }],
            new FakeWorld(),
        ).scan({ x: 0, y: 64, z: 0 });

        expect(skeletons).toEqual([
            {
                entityId: 7,
                name: 'skeleton',
                position: { x: 14, y: 64, z: 0 },
                distance: 14,
                ranged: true,
                attackRange: 15,
                hasLineOfSight: true,
            },
        ]);
    });

    it('reports no line of sight when a block occludes the ray', () => {
        const [skeleton] = scanner(
            [{ id: 7, name: 'skeleton', position: { x: 14, y: 64, z: 0 } }],
            new FakeWorld(new Set(['5,65,0'])),
        ).scan({ x: 0, y: 64, z: 0 });

        expect(skeleton?.hasLineOfSight).toBe(false);
    });

    it('does not treat melee mobs as ranged threats', () => {
        const [zombie] = scanner(
            [{ id: 8, name: 'zombie', position: { x: 2, y: 64, z: 0 } }],
            new FakeWorld(),
        ).scan({ x: 0, y: 64, z: 0 });

        expect(zombie).toMatchObject({
            name: 'zombie',
            distance: 2,
            ranged: false,
            attackRange: 3,
            hasLineOfSight: false,
        });
    });

    it('ignores non-hostile entities', () => {
        const hostiles = scanner(
            [{ id: 9, name: 'cow', position: { x: 2, y: 64, z: 0 } }],
            new FakeWorld(),
        ).scan({ x: 0, y: 64, z: 0 });

        expect(hostiles).toEqual([]);
    });
});
