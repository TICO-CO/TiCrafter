import type { Result, Vec3 } from '@ticrafter/core';

import type { SkillInput } from './types.js';
import { WorldScan } from './world-scan.js';

export interface BridgePlan {
    positions: readonly Vec3[];
    width: number;
}

export class BridgePlanner {
    static plan(input: SkillInput): Result<BridgePlan, string> {
        if (input.target === undefined) return [null, 'bridge requires a start position'];
        const width = input.width ?? 1;
        if (!Number.isInteger(width) || width < 1) {
            return [null, 'bridge width must be a positive integer'];
        }
        const [vector, directionError] = BridgePlanner.readDirection(input);
        if (directionError) return [null, directionError];
        if (vector === null) return [null, 'bridge direction is unavailable'];
        const positions = BridgePlanner.deckPositions(
            input.target,
            vector.direction,
            vector.length,
            width,
        );
        if (positions.length === 0) return [null, 'bridge produced no deck positions'];
        return [{ positions, width }, null];
    }

    private static readDirection(
        input: SkillInput,
    ): Result<{ direction: Vec3; length: number }, string> {
        if (input.target === undefined) return [null, 'bridge requires a start position'];
        if (input.end !== undefined) return BridgePlanner.directionToEnd(input.target, input.end);
        if (input.direction === undefined) {
            return [null, 'bridge requires an end or direction with maxLength'];
        }
        const length = input.maxLength;
        if (length === undefined || !Number.isInteger(length) || length < 1) {
            return [null, 'bridge maxLength must be a positive integer'];
        }
        const magnitude = Math.sqrt(input.direction.x ** 2 + input.direction.z ** 2);
        if (magnitude === 0) return [null, 'bridge direction must be horizontal'];
        return [
            {
                direction: {
                    x: input.direction.x / magnitude,
                    y: input.direction.y,
                    z: input.direction.z / magnitude,
                },
                length,
            },
            null,
        ];
    }

    private static directionToEnd(
        start: Vec3,
        end: Vec3,
    ): Result<{ direction: Vec3; length: number }, string> {
        const differenceX = end.x - start.x;
        const differenceZ = end.z - start.z;
        const length = Math.max(Math.abs(differenceX), Math.abs(differenceZ));
        if (length === 0) return [null, 'bridge end must differ from start'];
        return [
            {
                direction: {
                    x: differenceX / length,
                    y: end.y - start.y,
                    z: differenceZ / length,
                },
                length,
            },
            null,
        ];
    }

    private static deckPositions(
        start: Vec3,
        direction: Vec3,
        length: number,
        width: number,
    ): readonly Vec3[] {
        const positions: Vec3[] = [];
        const seen = new Set<string>();
        const perpendicular = { x: -direction.z, z: direction.x };
        const perpendicularMagnitude = Math.sqrt(perpendicular.x ** 2 + perpendicular.z ** 2);
        const unitPerpendicular =
            perpendicularMagnitude === 0
                ? { x: 0, z: 0 }
                : {
                      x: perpendicular.x / perpendicularMagnitude,
                      z: perpendicular.z / perpendicularMagnitude,
                  };
        const firstOffset = -Math.floor((width - 1) / 2);
        for (let distance = 0; distance <= length; distance += 1) {
            const center = {
                x: Math.round(start.x + direction.x * distance),
                y: Math.round(start.y + direction.y * (distance / length)),
                z: Math.round(start.z + direction.z * distance),
            };
            for (let offset = firstOffset; offset < firstOffset + width; offset += 1) {
                const position = {
                    x: Math.round(center.x + unitPerpendicular.x * offset),
                    y: center.y,
                    z: Math.round(center.z + unitPerpendicular.z * offset),
                };
                const key = WorldScan.key(position);
                if (seen.has(key)) continue;
                seen.add(key);
                positions.push(position);
            }
        }
        return positions;
    }
}
