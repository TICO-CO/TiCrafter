import type { Result, Vec3 } from '@ticrafter/core';

import { type Blueprint, type BlueprintBoundingBox, BlueprintIr } from './blueprint-ir.js';
import type { FoundationMode, SiteAccessPlan, SitePlan } from './construction-types.js';
import { type BuildingFailure, BuildingFailures } from './failures.js';
import type { WorldBlockQueryPort } from './schematic-diff.js';
import { SiteTerrain, type TerrainColumn } from './site-terrain.js';

export interface SiteConstraintPort {
    isProtected(position: Vec3): Result<boolean, BuildingFailure>;
    intersectsActiveStructure(bounds: BlueprintBoundingBox): Result<boolean, BuildingFailure>;
}

export interface SiteEvaluationRequest {
    blueprint: Blueprint;
    anchor: Vec3;
    botPosition: Vec3;
    maximumSlope: number;
    connection: 'road' | 'path' | 'none';
}

export interface SiteEvaluation {
    plan: SitePlan | null;
    reasons: readonly string[];
}

export class SiteEvaluator {
    private readonly terrain: SiteTerrain;

    constructor(
        private readonly world: WorldBlockQueryPort,
        private readonly constraints: SiteConstraintPort | undefined,
        probeDepth: number,
        probeHeight: number,
    ) {
        this.terrain = new SiteTerrain(world, { probeDepth, probeHeight });
    }

    evaluate(request: SiteEvaluationRequest): Result<SiteEvaluation, BuildingFailure> {
        const translationX = request.anchor.x - request.blueprint.anchor.x;
        const translationZ = request.anchor.z - request.blueprint.anchor.z;
        const translated = request.blueprint.blocks.map((block) => ({
            ...block,
            x: block.x + translationX,
            z: block.z + translationZ,
        }));
        const [bounds, boundsError] = BlueprintIr.boundingBox(translated);
        if (boundsError) return [null, boundsError];
        if (bounds === null) return [{ plan: null, reasons: ['blueprint has no bounds'] }, null];
        const [columns, columnError] = this.terrain.sample(bounds, request.anchor.y);
        if (columnError) return [null, columnError];
        if (columns === null) {
            return [null, BuildingFailures.worldQueryFailed('terrain sampling returned null')];
        }
        if (columns.length === 0) {
            return [{ plan: null, reasons: ['no terrain columns'] }, null];
        }
        const [rejection, rejectionError] = this.rejection(columns);
        if (rejectionError) return [null, rejectionError];
        if (rejection !== null) return [{ plan: null, reasons: [rejection] }, null];
        const grounds = columns.flatMap((column) =>
            column.groundY === null ? [] : [column.groundY],
        );
        if (grounds.length !== columns.length) {
            return [{ plan: null, reasons: ['void or unloaded terrain'] }, null];
        }
        const minimumGround = Math.min(...grounds);
        const maximumGround = Math.max(...grounds);
        const slope = maximumGround - minimumGround;
        if (slope > request.maximumSlope) {
            return [
                {
                    plan: null,
                    reasons: [`slope ${slope} exceeds maximum ${request.maximumSlope}`],
                },
                null,
            ];
        }
        const targetY = maximumGround + 1;
        const minimumBlockY = Math.min(...translated.map((block) => block.y));
        const translationY = targetY - minimumBlockY;
        const translation: Vec3 = { x: translationX, y: translationY, z: translationZ };
        const blocks = translated.map((block) => ({
            ...block,
            y: block.y + translationY,
        }));
        const [finalBounds, finalBoundsError] = BlueprintIr.boundingBox(blocks);
        if (finalBoundsError) return [null, finalBoundsError];
        if (finalBounds === null)
            return [{ plan: null, reasons: ['blueprint has no bounds'] }, null];
        const [rulesRejection, rulesError] = this.rules(finalBounds, blocks);
        if (rulesError) return [null, rulesError];
        if (rulesRejection !== null) return [{ plan: null, reasons: [rulesRejection] }, null];
        const [clearance, clearanceError] = this.clearance(finalBounds, blocks);
        if (clearanceError) return [null, clearanceError];
        if (clearance === null) {
            return [null, BuildingFailures.worldQueryFailed('clearance query returned null')];
        }
        const fillDepth = Math.max(
            ...columns.map((column) => targetY - (column.groundY ?? targetY) - 1),
        );
        const mode = SiteEvaluator.foundationMode(slope, request.maximumSlope);
        const access = SiteEvaluator.access(request, finalBounds, targetY);
        const anchor = {
            x: request.blueprint.anchor.x + translationX,
            y: request.blueprint.anchor.y + translationY,
            z: request.blueprint.anchor.z + translationZ,
        };
        const score = SiteEvaluator.score(
            slope,
            fillDepth,
            clearance.length,
            SiteEvaluator.distance(request.botPosition, anchor),
        );
        return [
            {
                plan: {
                    anchor,
                    translation,
                    rotation: request.blueprint.rotation,
                    bounds: finalBounds,
                    clearance,
                    access,
                    foundationMode: mode,
                    foundationFillDepth: fillDepth,
                    foundationCutDepth: 0,
                    score,
                    rationale: [
                        `slope ${slope}`,
                        `fill depth ${fillDepth}`,
                        `clearance blocks ${clearance.length}`,
                    ],
                },
                reasons: [],
            },
            null,
        ];
    }

    private rejection(columns: readonly TerrainColumn[]): Result<string | null, BuildingFailure> {
        if (columns.some((column) => column.hazard)) return ['water or lava in footprint', null];
        return [null, null];
    }

    private rules(
        bounds: BlueprintBoundingBox,
        blocks: readonly { x: number; y: number; z: number }[],
    ): Result<string | null, BuildingFailure> {
        if (this.constraints === undefined) return [null, null];
        const [active, activeError] = this.constraints.intersectsActiveStructure(bounds);
        if (activeError) return [null, activeError];
        if (active) return ['footprint intersects an active structure', null];
        for (const block of blocks) {
            const [protectedBlock, protectedError] = this.constraints.isProtected(block);
            if (protectedError) return [null, protectedError];
            if (protectedBlock) {
                return [`protected position ${block.x},${block.y},${block.z}`, null];
            }
        }
        return [null, null];
    }

    private clearance(
        bounds: BlueprintBoundingBox,
        blocks: readonly { x: number; y: number; z: number }[],
    ): Result<readonly Vec3[], BuildingFailure> {
        if (this.world.blocksInBox === undefined) return [[], null];
        const [observed, observedError] = this.world.blocksInBox(bounds);
        if (observedError) return [null, observedError];
        if (observed === null) return [[], null];
        const expected = new Set(blocks.map((block) => `${block.x},${block.y},${block.z}`));
        return [
            observed
                .filter((block) => !BlueprintIr.isAir(block.name))
                .filter((block) => block.position.y >= bounds.min.y)
                .filter((block) => !expected.has(BlueprintIr.positionKey(block.position)))
                .map((block) => block.position),
            null,
        ];
    }

    private static foundationMode(slope: number, maximumSlope: number): FoundationMode {
        if (slope === 0) return 'level';
        if (slope <= Math.max(1, maximumSlope / 2)) return 'terrace';
        return 'retaining-wall';
    }

    private static access(
        request: SiteEvaluationRequest,
        bounds: BlueprintBoundingBox,
        targetY: number,
    ): SiteAccessPlan {
        const to = {
            x: bounds.min.x + Math.floor((bounds.max.x - bounds.min.x) / 2),
            y: targetY,
            z: bounds.min.z,
        };
        if (request.connection === 'none') return { kind: 'none', from: null, to, length: 0 };
        return {
            kind: 'path',
            from: request.botPosition,
            to,
            length: SiteEvaluator.distance(request.botPosition, to),
        };
    }

    private static score(
        slope: number,
        fillDepth: number,
        clearance: number,
        distance: number,
    ): number {
        const raw = 100 - slope * 8 - fillDepth * 2 - clearance - distance * 0.5;
        return Math.max(0, Math.round(raw * 100) / 100);
    }

    private static distance(left: Vec3, right: Vec3): number {
        return Math.sqrt(
            (left.x - right.x) ** 2 + (left.y - right.y) ** 2 + (left.z - right.z) ** 2,
        );
    }
}
