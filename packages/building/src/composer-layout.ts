import type { Result } from '@ticrafter/core';

import type { BuildingBrief } from './blueprint-document.js';
import { ComposerLayoutOpenings } from './composer-layout-openings.js';
import { ComposerRoomAllocator } from './composer-layout-rooms.js';
import type { ComposerLayout, ComposerRoom, RoomDemand } from './composer-layout-types.js';
import { defaultRoomMinimumSize } from './composer-layout-types.js';
import type { BuildingFailure } from './failures.js';
import { BuildingFailures } from './failures.js';

export type { ComposerLayout, ComposerOpening, ComposerRoom } from './composer-layout-types.js';

const storeyHeight = 4;
const wallHeight = 3;

export class ComposerLayoutPlanner {
    static plan(brief: BuildingBrief): Result<ComposerLayout, BuildingFailure> {
        const width = Math.floor(brief.size.width);
        const depth = Math.floor(brief.size.depth);
        const storeys = Math.floor(brief.size.storeys);
        const sizeError = ComposerLayoutPlanner.validateSize(width, depth, storeys);
        if (sizeError) return [null, sizeError];

        const demands = ComposerLayoutPlanner.demands(brief);
        const interiorWidth = width - 2;
        const interiorDepth = depth - 2;
        const corridorZ = ComposerRoomAllocator.corridor(interiorDepth, demands.length);
        const rows = ComposerRoomAllocator.rows(demands, corridorZ);
        const rowBounds = ComposerRoomAllocator.rowBounds(interiorDepth, corridorZ);
        const topRooms = ComposerRoomAllocator.allocate(
            rows.top,
            1,
            interiorWidth,
            rowBounds.topStart,
            rowBounds.topDepth,
        );
        if (topRooms[1]) return [null, topRooms[1]];
        const bottomRooms = ComposerRoomAllocator.allocate(
            rows.bottom,
            1,
            interiorWidth,
            rowBounds.bottomStart,
            rowBounds.bottomDepth,
        );
        if (bottomRooms[1]) return [null, bottomRooms[1]];
        const top = topRooms[0];
        const bottom = bottomRooms[0];
        if (top === null || bottom === null) {
            return [null, BuildingFailures.composeFailed('room layout returned no rooms')];
        }

        const rooms = [...top, ...bottom];
        const entrance = {
            x: Math.floor(width / 2),
            z: depth - 1,
            facing: 'north' as const,
        };
        const stairwell =
            storeys > 1 ? { x: width - 2, z: corridorZ ?? Math.min(1, interiorDepth) } : null;
        const openings = ComposerLayoutOpenings.build(
            rooms,
            corridorZ,
            storeys,
            storeyHeight,
            entrance,
            width,
            depth,
        );
        if (openings[1]) return [null, openings[1]];
        return [
            {
                width,
                depth,
                storeys,
                wallHeight,
                storeyHeight,
                rooms,
                corridorZ,
                entrance,
                stairwell,
                openings: openings[0] ?? [],
            },
            null,
        ];
    }

    private static validateSize(
        width: number,
        depth: number,
        storeys: number,
    ): BuildingFailure | null {
        if (width < 3 || depth < 3 || storeys < 1) {
            return BuildingFailures.composeFailed(
                'building needs width and depth of at least three and one storey',
            );
        }
        return null;
    }

    private static demands(brief: BuildingBrief): RoomDemand[] {
        const declared = brief.program.rooms.flatMap((room) =>
            Array.from({ length: Math.max(0, Math.floor(room.count)) }, () => ({
                kind: room.kind,
                minimumSize: Math.max(
                    defaultRoomMinimumSize,
                    Math.floor(room.minimumSize ?? defaultRoomMinimumSize),
                ),
            })),
        );
        if (declared.length > 0) return declared;
        return [{ kind: 'main', minimumSize: defaultRoomMinimumSize }];
    }
}
