import type { Result, Vec3 } from '@ticrafter/core';

import type { Blueprint } from './blueprint-ir.js';
import type { SitePlan } from './construction-types.js';
import { type BuildingFailure, BuildingFailures } from './failures.js';
import type { WorldBlockQueryPort } from './schematic-diff.js';
import { type SiteConstraintPort, type SiteEvaluation, SiteEvaluator } from './site-evaluator.js';

export type { SiteConstraintPort } from './site-evaluator.js';

export interface SitePlannerOptions {
    world: WorldBlockQueryPort;
    constraints?: SiteConstraintPort;
    probeDepth?: number;
    probeHeight?: number;
}

export interface SitePlanningRequest {
    requestedAnchor?: Vec3;
    candidateRadius?: number;
    maximumSlope?: number;
    connection?: 'road' | 'path' | 'none';
}

export class SitePlanner {
    private readonly evaluator: SiteEvaluator;

    constructor(options: SitePlannerOptions) {
        this.evaluator = new SiteEvaluator(
            options.world,
            options.constraints,
            options.probeDepth ?? 8,
            options.probeHeight ?? 8,
        );
    }

    plan(
        blueprint: Blueprint,
        botPosition: Vec3,
        request: SitePlanningRequest = {},
    ): Result<SitePlan, BuildingFailure> {
        const candidates = this.candidates(blueprint, botPosition, request);
        const reasons: string[] = [];
        let best: SitePlan | null = null;
        for (const anchor of candidates) {
            const [evaluation, evaluationError] = this.evaluator.evaluate({
                blueprint,
                anchor,
                botPosition,
                maximumSlope: request.maximumSlope ?? 3,
                connection: request.connection ?? 'none',
            });
            if (evaluationError) return [null, evaluationError];
            if (evaluation === null) continue;
            reasons.push(...evaluation.reasons);
            if (evaluation.plan === null) continue;
            best = SitePlanner.better(best, evaluation.plan);
        }
        if (best === null) {
            const detail = reasons.length === 0 ? 'no candidate sites' : reasons.join('; ');
            return [null, BuildingFailures.siteRejected(detail)];
        }
        return [best, null];
    }

    private candidates(
        blueprint: Blueprint,
        botPosition: Vec3,
        request: SitePlanningRequest,
    ): readonly Vec3[] {
        const anchors = new Map<string, Vec3>();
        const requested = request.requestedAnchor ?? botPosition;
        const radius = Math.max(0, request.candidateRadius ?? 4);
        const step = radius === 0 ? 1 : Math.max(1, Math.floor(radius / 2));
        for (let xOffset = -radius; xOffset <= radius; xOffset += step) {
            for (let zOffset = -radius; zOffset <= radius; zOffset += step) {
                const anchor = {
                    x: requested.x + xOffset,
                    y: requested.y,
                    z: requested.z + zOffset,
                };
                anchors.set(`${anchor.x},${anchor.y},${anchor.z}`, anchor);
            }
        }
        anchors.set(`${blueprint.anchor.x},${requested.y},${blueprint.anchor.z}`, {
            x: blueprint.anchor.x,
            y: requested.y,
            z: blueprint.anchor.z,
        });
        return [...anchors.values()].sort((left, right) => {
            const leftDistance = SitePlanner.distance(left, botPosition);
            const rightDistance = SitePlanner.distance(right, botPosition);
            if (leftDistance !== rightDistance) return leftDistance - rightDistance;
            if (left.x !== right.x) return left.x - right.x;
            return left.z - right.z;
        });
    }

    private static better(current: SitePlan | null, candidate: SitePlan): SitePlan {
        if (current === null) return candidate;
        if (candidate.score !== current.score)
            return candidate.score > current.score ? candidate : current;
        if (candidate.foundationFillDepth !== current.foundationFillDepth) {
            return candidate.foundationFillDepth < current.foundationFillDepth
                ? candidate
                : current;
        }
        if (candidate.anchor.x !== current.anchor.x) {
            return candidate.anchor.x < current.anchor.x ? candidate : current;
        }
        return candidate.anchor.z < current.anchor.z ? candidate : current;
    }

    private static distance(left: Vec3, right: Vec3): number {
        return Math.sqrt(
            (left.x - right.x) ** 2 + (left.y - right.y) ** 2 + (left.z - right.z) ** 2,
        );
    }
}
