import type { Result } from '@ticrafter/core';

import type { BlueprintBoundingBox } from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';
import type { WorldBlockQueryPort, WorldBlockState } from './schematic-diff.js';

export interface TerrainColumn {
    x: number;
    z: number;
    groundY: number | null;
    topState: WorldBlockState | null;
    hazard: boolean;
}

export interface TerrainSamplingOptions {
    probeDepth: number;
    probeHeight: number;
}

const LIQUID_BLOCKS: ReadonlySet<string> = new Set([
    'water',
    'flowing_water',
    'lava',
    'flowing_lava',
]);

export class SiteTerrain {
    constructor(
        private readonly world: WorldBlockQueryPort,
        private readonly options: TerrainSamplingOptions,
    ) {}

    sample(
        bounds: BlueprintBoundingBox,
        referenceY: number,
    ): Result<readonly TerrainColumn[], BuildingFailure> {
        const columns: TerrainColumn[] = [];
        for (let x = bounds.min.x; x <= bounds.max.x; x += 1) {
            for (let z = bounds.min.z; z <= bounds.max.z; z += 1) {
                const [column, columnError] = this.column(x, z, referenceY);
                if (columnError) return [null, columnError];
                if (column === null) continue;
                columns.push(column);
            }
        }
        return [columns, null];
    }

    private column(
        x: number,
        z: number,
        referenceY: number,
    ): Result<TerrainColumn | null, BuildingFailure> {
        const highest = referenceY + this.options.probeHeight;
        const lowest = referenceY - this.options.probeDepth;
        for (let y = highest; y >= lowest; y -= 1) {
            const [state, stateError] = this.world.blockAt({ x, y, z });
            if (stateError) return [null, stateError];
            if (state === null) continue;
            if (SiteTerrain.isLiquid(state.name)) {
                return [{ x, z, groundY: null, topState: state, hazard: true }, null];
            }
            if (SiteTerrain.isAir(state.name)) continue;
            return [{ x, z, groundY: y, topState: state, hazard: false }, null];
        }
        return [{ x, z, groundY: null, topState: null, hazard: false }, null];
    }

    private static isLiquid(name: string): boolean {
        return LIQUID_BLOCKS.has(name);
    }

    private static isAir(name: string): boolean {
        return name === 'air' || name === 'cave_air' || name === 'void_air';
    }
}
