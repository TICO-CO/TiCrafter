import type { Result } from '@ticrafter/core';

import type { ComposerRoom, RoomDemand } from './composer-layout-types.js';
import { defaultRoomMinimumSize } from './composer-layout-types.js';
import type { BuildingFailure } from './failures.js';
import { BuildingFailures } from './failures.js';

export class ComposerRoomAllocator {
    static corridor(interiorDepth: number, roomCount: number): number | null {
        if (roomCount <= 3 || interiorDepth < 6) return null;
        return 1 + Math.floor(interiorDepth / 2);
    }

    static rows(
        demands: readonly RoomDemand[],
        corridorZ: number | null,
    ): { top: RoomDemand[]; bottom: RoomDemand[] } {
        if (corridorZ === null) return { top: [...demands], bottom: [] };
        const topCount = Math.ceil(demands.length / 2);
        return { top: demands.slice(0, topCount), bottom: demands.slice(topCount) };
    }

    static rowBounds(
        interiorDepth: number,
        corridorZ: number | null,
    ): { topStart: number; topDepth: number; bottomStart: number; bottomDepth: number } {
        if (corridorZ === null) {
            return { topStart: 1, topDepth: interiorDepth, bottomStart: 1, bottomDepth: 0 };
        }
        return {
            topStart: 1,
            topDepth: corridorZ - 1,
            bottomStart: corridorZ + 1,
            bottomDepth: interiorDepth - corridorZ,
        };
    }

    static allocate(
        demands: readonly RoomDemand[],
        startX: number,
        width: number,
        startZ: number,
        depth: number,
    ): Result<ComposerRoom[], BuildingFailure> {
        if (demands.length === 0) return [[], null];
        if (depth < defaultRoomMinimumSize) {
            return [null, BuildingFailures.composeFailed('room row is too shallow')];
        }
        const rooms: ComposerRoom[] = [];
        let currentX = startX;
        for (const [index, demand] of demands.entries()) {
            const remaining = demands.length - index;
            const allocated =
                index === demands.length - 1
                    ? startX + width - currentX
                    : Math.floor((startX + width - currentX) / remaining);
            if (allocated < demand.minimumSize) {
                return [
                    null,
                    BuildingFailures.composeFailed(
                        `room ${demand.kind} needs at least ${demand.minimumSize} blocks of width`,
                    ),
                ];
            }
            rooms.push({
                kind: demand.kind,
                x: currentX,
                z: startZ,
                width: allocated,
                depth,
            });
            currentX += allocated;
        }
        return [rooms, null];
    }
}
