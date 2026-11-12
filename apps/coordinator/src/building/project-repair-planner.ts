import {
    type ConstructionChange,
    RepairPlanPlanner,
    type WorldBlockQueryPort,
} from '@ticrafter/building';
import type { Result, Vec3 } from '@ticrafter/core';

import type { ProjectConstructionArtifacts } from '../projects/index.js';
import type { BlueprintDocumentService } from './blueprint-document-service.js';
import type { ConstructionPlanDocumentService } from './construction-plan-document-service.js';

export interface ProjectRepairInput {
    projectId: string;
    structureId: string;
    botId: string;
    anchor: Vec3;
    bbox: { min: Vec3; max: Vec3 };
}

export interface ProjectRepairPlannerOptions {
    world: WorldBlockQueryPort;
    blueprints: BlueprintDocumentService;
    plans: ConstructionPlanDocumentService;
    maxWorkPackageBlocks: number;
}

export class ProjectRepairPlanner {
    constructor(private readonly options: ProjectRepairPlannerOptions) {}

    prepare(input: ProjectRepairInput): Result<ProjectConstructionArtifacts | null, string> {
        const [blueprintDocument, blueprintError] = this.options.blueprints.latest(
            `blueprint.project.${input.projectId}`,
        );
        if (blueprintError) return [null, blueprintError.type];
        if (blueprintDocument === null) return [null, 'repair blueprint is missing'];
        const [latestPlan, planError] = this.options.plans.latest(`plan.${input.structureId}`);
        if (planError) return [null, planError.type];
        if (latestPlan === null) return [null, 'repair construction plan is missing'];
        const planId = `repair.${input.structureId}`;
        const [plan, repairError] = new RepairPlanPlanner({
            planId,
            maxBlocks: this.options.maxWorkPackageBlocks,
        }).plan(blueprintDocument.blueprint, latestPlan.plan, this.options.world);
        if (repairError) {
            if (
                repairError.type === 'INVALID_CONSTRUCTION_PLAN' &&
                repairError.message === 'repair has no changes'
            ) {
                return [null, null];
            }
            return [null, repairError.type];
        }
        if (plan === null) return [null, 'repair plan returned null'];
        const [planDocument, planDocumentError] = this.options.plans.commit({
            id: planId,
            structureId: input.structureId,
            blueprintId: blueprintDocument.id,
            blueprintRevision: blueprintDocument.revision,
            purpose: 'repair',
            plan,
        });
        if (planDocumentError) return [null, planDocumentError.type];
        if (planDocument === null) return [null, 'repair plan document missing'];
        return [
            {
                blueprint: blueprintDocument,
                plan: planDocument,
                bbox: ProjectRepairPlanner.bounds(input.bbox, plan.changes),
            },
            null,
        ];
    }

    private static bounds(
        proposed: { min: Vec3; max: Vec3 },
        changes: readonly ConstructionChange[],
    ): { min: Vec3; max: Vec3 } {
        return changes.reduce(
            (bounds, change) => ({
                min: {
                    x: Math.min(bounds.min.x, change.block.x),
                    y: Math.min(bounds.min.y, change.block.y),
                    z: Math.min(bounds.min.z, change.block.z),
                },
                max: {
                    x: Math.max(bounds.max.x, change.block.x),
                    y: Math.max(bounds.max.y, change.block.y),
                    z: Math.max(bounds.max.z, change.block.z),
                },
            }),
            proposed,
        );
    }
}
