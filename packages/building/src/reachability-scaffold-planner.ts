import type { Result, Vec3 } from '@ticrafter/core';

import { type BlueprintBlock, BlueprintIr } from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';
import type { WorldBlockQueryPort } from './schematic-diff.js';

export interface ScaffoldBlock {
    position: Vec3;
    stateName: string;
}

export interface ReachabilityStep {
    block: BlueprintBlock;
    standingPosition: Vec3;
    direct: boolean;
    scaffold: readonly ScaffoldBlock[];
}

export interface ReachabilityPlan {
    steps: readonly ReachabilityStep[];
    unreachable: readonly BlueprintBlock[];
}

export interface ReachabilityOptions {
    maxReach?: number;
    scaffoldMaterial?: string;
}

export class ReachabilityScaffoldPlanner {
    private readonly maxReach: number;
    private readonly scaffoldMaterial: string;

    constructor(
        private readonly world: WorldBlockQueryPort,
        options: ReachabilityOptions = {},
    ) {
        this.maxReach = options.maxReach ?? 4.5;
        this.scaffoldMaterial = options.scaffoldMaterial ?? 'dirt';
    }

    plan(
        blocks: readonly BlueprintBlock[],
        botPosition: Vec3,
    ): Result<ReachabilityPlan, BuildingFailure> {
        const steps: ReachabilityStep[] = [];
        const unreachable: BlueprintBlock[] = [];
        for (const block of blocks) {
            const [step, stepError] = this.planBlock(block, botPosition);
            if (stepError) return [null, stepError];
            if (step === null) {
                unreachable.push(block);
                continue;
            }
            steps.push(step);
        }
        return [{ steps, unreachable }, null];
    }

    private planBlock(
        block: BlueprintBlock,
        botPosition: Vec3,
    ): Result<ReachabilityStep | null, BuildingFailure> {
        const target = BlueprintIr.position(block);
        if (this.distance(botPosition, target) <= this.maxReach) {
            return [{ block, standingPosition: botPosition, direct: true, scaffold: [] }, null];
        }
        const candidates = this.candidates(target);
        for (const candidate of candidates) {
            const [step, stepError] = this.candidateStep(block, candidate);
            if (stepError) return [null, stepError];
            if (step !== null) return [step, null];
        }
        return [null, null];
    }

    private candidateStep(
        block: BlueprintBlock,
        candidate: Vec3,
    ): Result<ReachabilityStep | null, BuildingFailure> {
        const supportPosition = { x: candidate.x, y: candidate.y - 1, z: candidate.z };
        const [foot, footError] = this.world.blockAt(candidate);
        if (footError) return [null, footError];
        if (foot !== null && !BlueprintIr.isAir(foot.name)) return [null, null];
        const [head, headError] = this.world.blockAt({
            x: candidate.x,
            y: candidate.y + 1,
            z: candidate.z,
        });
        if (headError) return [null, headError];
        if (head !== null && !BlueprintIr.isAir(head.name)) return [null, null];
        const [support, supportError] = this.world.blockAt(supportPosition);
        if (supportError) return [null, supportError];
        if (support !== null && !BlueprintIr.isAir(support.name)) {
            return [{ block, standingPosition: candidate, direct: false, scaffold: [] }, null];
        }
        return [
            {
                block,
                standingPosition: candidate,
                direct: false,
                scaffold: [{ position: supportPosition, stateName: this.scaffoldMaterial }],
            },
            null,
        ];
    }

    private candidates(target: Vec3): readonly Vec3[] {
        return [
            { x: target.x + 1, y: target.y, z: target.z },
            { x: target.x - 1, y: target.y, z: target.z },
            { x: target.x, y: target.y, z: target.z + 1 },
            { x: target.x, y: target.y, z: target.z - 1 },
        ].filter((candidate) => this.distance(candidate, target) <= this.maxReach);
    }

    private distance(left: Vec3, right: Vec3): number {
        return Math.sqrt(
            (left.x - right.x) ** 2 + (left.y - right.y) ** 2 + (left.z - right.z) ** 2,
        );
    }
}
