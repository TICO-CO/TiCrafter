import type { Result } from '@ticrafter/core';

import { type Blueprint, BlueprintIr } from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';
import { BuildingFailures } from './failures.js';

export class BlueprintSupportValidator {
    static validate(blueprint: Blueprint): Result<void, BuildingFailure> {
        const [bounds, boundsError] = BlueprintIr.boundingBox(blueprint.blocks);
        if (boundsError) return [null, boundsError];
        if (bounds === null) {
            return [null, BuildingFailures.composeFailed('blueprint has no blocks')];
        }
        const occupied = new Set(
            blueprint.blocks
                .filter((block) => !BlueprintIr.isAir(block.state.name))
                .map((block) => BlueprintIr.blockKey(block)),
        );
        const supported = BlueprintSupportValidator.reachableFromGround(occupied, bounds.min.y);
        for (const block of blueprint.blocks) {
            if (BlueprintIr.isAir(block.state.name)) continue;
            if (supported.has(BlueprintIr.blockKey(block))) continue;
            return [
                null,
                BuildingFailures.structuralFailure({ x: block.x, y: block.y, z: block.z }),
            ];
        }
        return [undefined, null];
    }

    private static reachableFromGround(
        occupied: ReadonlySet<string>,
        minimumY: number,
    ): ReadonlySet<string> {
        const positions = [...occupied].map((key) => BlueprintSupportValidator.parse(key));
        const queue = positions.filter((position) => position.y === minimumY);
        const visited = new Set(queue.map((position) => BlueprintIr.positionKey(position)));
        for (let index = 0; index < queue.length; index += 1) {
            const current = queue[index];
            if (current === undefined) continue;
            for (const neighbor of BlueprintSupportValidator.neighbors(current)) {
                const key = BlueprintIr.positionKey(neighbor);
                if (!occupied.has(key) || visited.has(key)) continue;
                visited.add(key);
                queue.push(neighbor);
            }
        }
        return visited;
    }

    private static neighbors(position: { x: number; y: number; z: number }): readonly {
        x: number;
        y: number;
        z: number;
    }[] {
        return [
            { x: position.x + 1, y: position.y, z: position.z },
            { x: position.x - 1, y: position.y, z: position.z },
            { x: position.x, y: position.y + 1, z: position.z },
            { x: position.x, y: position.y - 1, z: position.z },
            { x: position.x, y: position.y, z: position.z + 1 },
            { x: position.x, y: position.y, z: position.z - 1 },
        ];
    }

    private static parse(key: string): { x: number; y: number; z: number } {
        const [x, y, z] = key.split(',').map((value) => Number(value));
        return { x: x ?? 0, y: y ?? 0, z: z ?? 0 };
    }
}
