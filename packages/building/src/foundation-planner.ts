import type { Result, Vec3 } from '@ticrafter/core';

import { type Blueprint, type BlueprintBlock, BlueprintIr } from './blueprint-ir.js';
import type {
    ConstructionChange,
    FoundationMode,
    FoundationPlan,
    SitePlan,
} from './construction-types.js';
import { type BuildingFailure, BuildingFailures } from './failures.js';
import type { WorldBlockQueryPort } from './schematic-diff.js';
import type { TerrainColumn } from './site-terrain.js';
import { SiteTerrain } from './site-terrain.js';

export interface FoundationPlannerOptions {
    material?: string;
    maximumDepth?: number;
    mode?: FoundationMode;
}

export class FoundationPlanner {
    private readonly material: string;
    private readonly maximumDepth: number;
    private readonly mode: FoundationMode | undefined;

    constructor(options: FoundationPlannerOptions = {}) {
        this.material = options.material ?? 'cobblestone';
        this.maximumDepth = options.maximumDepth ?? 4;
        this.mode = options.mode;
    }

    plan(
        blueprint: Blueprint,
        site: SitePlan,
        world: WorldBlockQueryPort,
    ): Result<FoundationPlan, BuildingFailure> {
        const blocks = blueprint.blocks.map((block) => ({
            ...block,
            x: block.x + site.translation.x,
            y: block.y + site.translation.y,
            z: block.z + site.translation.z,
        }));
        const targetY = Math.min(...blocks.map((block) => block.y));
        const [bounds, boundsError] = BlueprintIr.boundingBox(blocks);
        if (boundsError) return [null, boundsError];
        if (bounds === null) return [null, BuildingFailures.foundationFailed('no footprint')];
        const terrain = new SiteTerrain(world, {
            probeDepth: this.maximumDepth + 4,
            probeHeight: 8,
        });
        const [columns, columnError] = terrain.sample(bounds, targetY);
        if (columnError) return [null, columnError];
        if (columns === null) {
            return [null, BuildingFailures.worldQueryFailed('terrain sampling returned null')];
        }
        if (columns.length === 0) {
            return [null, BuildingFailures.foundationFailed('no terrain columns')];
        }
        if (columns.some((column) => column.groundY === null)) {
            return [null, BuildingFailures.foundationFailed('terrain column has no ground')];
        }
        const selectedColumns = this.columns(columns, blocks, this.mode ?? site.foundationMode);
        const fillDepth = selectedColumns.map((column) => targetY - (column.groundY ?? targetY));
        const maximumFillDepth = Math.max(0, ...fillDepth.map((depth) => depth - 1));
        if (maximumFillDepth > this.maximumDepth) {
            return [
                null,
                BuildingFailures.foundationFailed(
                    `fill depth ${maximumFillDepth} exceeds maximum ${this.maximumDepth}`,
                ),
            ];
        }
        const fills = selectedColumns.flatMap((column) =>
            this.fills(column, targetY, this.material),
        );
        const expected = new Set(blocks.map((block) => BlueprintIr.blockKey(block)));
        const cuts = selectedColumns.flatMap((column) => this.cuts(column, targetY, expected));
        const [clearance, clearanceError] = this.clearance(world, bounds, blocks, site);
        if (clearanceError) return [null, clearanceError];
        if (clearance === null) {
            return [null, BuildingFailures.worldQueryFailed('clearance query returned null')];
        }
        const changes = this.unique([...clearance, ...cuts, ...fills]);
        const materials = fills.length === 0 ? [] : [{ item: this.material, count: fills.length }];
        return [
            {
                mode: this.mode ?? site.foundationMode,
                targetY,
                maximumFillDepth,
                changes,
                materials,
                rationale: [
                    `target level ${targetY}`,
                    `maximum fill depth ${maximumFillDepth}`,
                    `clearance blocks ${clearance.length}`,
                ],
            },
            null,
        ];
    }

    private columns(
        columns: readonly TerrainColumn[],
        blocks: readonly BlueprintBlock[],
        mode: FoundationMode,
    ): readonly TerrainColumn[] {
        if (mode !== 'stilts') return columns;
        const supportColumns = new Set(blocks.map((block) => `${block.x},${block.z}`));
        return columns.filter((column) => supportColumns.has(`${column.x},${column.z}`));
    }

    private fills(column: TerrainColumn, targetY: number, material: string): ConstructionChange[] {
        const groundY = column.groundY;
        if (groundY === null) return [];
        const changes: ConstructionChange[] = [];
        for (let y = groundY + 1; y < targetY; y += 1) {
            changes.push(
                this.change('place', { x: column.x, y, z: column.z }, material, 'foundation'),
            );
        }
        return changes;
    }

    private cuts(
        column: TerrainColumn,
        targetY: number,
        expected: ReadonlySet<string>,
    ): ConstructionChange[] {
        const groundY = column.groundY;
        if (groundY === null || groundY < targetY) return [];
        const name = column.topState?.name ?? 'air';
        const changes: ConstructionChange[] = [];
        for (let y = targetY; y <= groundY; y += 1) {
            const position = { x: column.x, y, z: column.z };
            if (expected.has(BlueprintIr.positionKey(position))) continue;
            changes.push(this.change('break', position, name, 'clearance'));
        }
        return changes;
    }

    private clearance(
        world: WorldBlockQueryPort,
        bounds: { min: Vec3; max: Vec3 },
        blocks: readonly BlueprintBlock[],
        site: SitePlan,
    ): Result<readonly ConstructionChange[], BuildingFailure> {
        const expected = new Set(blocks.map((block) => BlueprintIr.blockKey(block)));
        if (world.blocksInBox !== undefined) {
            const [observed, observedError] = world.blocksInBox(bounds);
            if (observedError) return [null, observedError];
            if (observed !== null) {
                return [
                    observed
                        .filter((block) => !BlueprintIr.isAir(block.name))
                        .filter((block) => !expected.has(BlueprintIr.positionKey(block.position)))
                        .map((block) =>
                            this.change('break', block.position, block.name, 'clearance'),
                        ),
                    null,
                ];
            }
        }
        const changes: ConstructionChange[] = [];
        for (const position of site.clearance) {
            const [state, stateError] = world.blockAt(position);
            if (stateError) return [null, stateError];
            if (state === null) continue;
            changes.push(this.change('break', position, state.name, 'clearance'));
        }
        return [changes, null];
    }

    private unique(changes: readonly ConstructionChange[]): readonly ConstructionChange[] {
        const entries = new Map<string, ConstructionChange>();
        changes.forEach((change) => {
            const key = `${change.kind}:${BlueprintIr.blockKey(change.block)}`;
            if (!entries.has(key)) entries.set(key, change);
        });
        return [...entries.values()];
    }

    private change(
        kind: 'place' | 'break',
        position: Vec3,
        name: string,
        reason: 'foundation' | 'clearance',
    ): ConstructionChange {
        return {
            kind,
            block: {
                ...position,
                state: { name },
                priority: 0,
            },
            phase: reason === 'foundation' ? 'foundation' : 'site-clear',
            reason,
            dependsOn: [],
        };
    }
}
