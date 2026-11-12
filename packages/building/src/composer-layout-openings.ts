import type { Result } from '@ticrafter/core';

import type { ComposerOpening, ComposerRoom } from './composer-layout-types.js';
import type { BuildingFailure } from './failures.js';
import type { MotifFacing } from './motif-library.js';

export class ComposerLayoutOpenings {
    static build(
        rooms: readonly ComposerRoom[],
        corridorZ: number | null,
        storeys: number,
        storeyHeight: number,
        entrance: { x: number; z: number; facing: MotifFacing },
        width: number,
        depth: number,
    ): Result<ComposerOpening[], BuildingFailure> {
        const openings: ComposerOpening[] = [];
        const keys = new Set<string>();
        const include = (opening: ComposerOpening): void => {
            const key = `${opening.x},${opening.y},${opening.z}`;
            if (keys.has(key)) return;
            keys.add(key);
            openings.push(opening);
        };
        for (let storey = 0; storey < storeys; storey += 1) {
            const base = storey * storeyHeight;
            if (storey === 0) {
                include({ ...entrance, kind: 'door', y: base + 1 });
                include({ ...entrance, kind: 'door', y: base + 2 });
            }
            ComposerLayoutOpenings.windows(width, depth, base).forEach(include);
            ComposerLayoutOpenings.interiorDoors(rooms, corridorZ, base).forEach(include);
        }
        return [openings, null];
    }

    private static windows(width: number, depth: number, base: number): ComposerOpening[] {
        const windows: ComposerOpening[] = [];
        if (width >= 5) {
            windows.push(
                { kind: 'window', x: 1, y: base + 2, z: 0, facing: 'south' },
                { kind: 'window', x: width - 2, y: base + 2, z: 0, facing: 'south' },
                { kind: 'window', x: 1, y: base + 2, z: depth - 1, facing: 'north' },
                { kind: 'window', x: width - 2, y: base + 2, z: depth - 1, facing: 'north' },
            );
        }
        if (depth >= 5) {
            windows.push(
                { kind: 'window', x: 0, y: base + 2, z: 1, facing: 'east' },
                { kind: 'window', x: 0, y: base + 2, z: depth - 2, facing: 'east' },
                { kind: 'window', x: width - 1, y: base + 2, z: 1, facing: 'west' },
                { kind: 'window', x: width - 1, y: base + 2, z: depth - 2, facing: 'west' },
            );
        }
        return windows;
    }

    private static interiorDoors(
        rooms: readonly ComposerRoom[],
        corridorZ: number | null,
        base: number,
    ): ComposerOpening[] {
        const openings: ComposerOpening[] = [];
        const add = (x: number, z: number, facing: MotifFacing): void => {
            openings.push({ kind: 'interior-door', x, y: base + 1, z, facing });
            openings.push({ kind: 'interior-door', x, y: base + 2, z, facing });
        };
        for (const [index, room] of rooms.entries()) {
            const next = rooms[index + 1];
            const sameRow = next !== undefined && next.z === room.z && next.depth === room.depth;
            if (sameRow) add(room.x + room.width, room.z + Math.floor(room.depth / 2), 'east');
            if (corridorZ === null) continue;
            const center = room.x + Math.floor(room.width / 2);
            if (room.z < corridorZ) add(center, corridorZ - 1, 'south');
            if (room.z > corridorZ) add(center, corridorZ + 1, 'north');
        }
        return openings;
    }
}
