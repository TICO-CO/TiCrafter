import {
    BlueprintIr,
    type ConstructionChange,
    type ConstructionPlan,
    RollbackPlanPlanner,
    type RollbackPlanRecord,
    type WorldBlockState,
} from '@ticrafter/building';
import type { Result, Vec3 } from '@ticrafter/core';
import type { StorageFailure, StoredBlockChange } from '@ticrafter/memory';

import type { ProjectConstructionArtifacts } from '../projects/index.js';
import type { BlueprintDocumentService } from './blueprint-document-service.js';
import type { ConstructionPlanDocumentService } from './construction-plan-document-service.js';

export interface ProjectRollbackInput {
    projectId: string;
    structureId: string;
    botId: string;
    anchor: Vec3;
    bbox: { min: Vec3; max: Vec3 };
}

export interface ConstructionChangelogPort {
    listByStructure(
        structureId: string,
        limit?: number,
    ): Result<readonly StoredBlockChange[], StorageFailure>;
}

export interface ProjectRollbackPlannerOptions {
    blueprints: BlueprintDocumentService;
    plans: ConstructionPlanDocumentService;
    changelog: ConstructionChangelogPort;
    maxWorkPackageBlocks: number;
}

export class ProjectRollbackPlanner {
    constructor(private readonly options: ProjectRollbackPlannerOptions) {}

    prepare(input: ProjectRollbackInput): Result<ProjectConstructionArtifacts | null, string> {
        const [blueprint, blueprintError] = this.options.blueprints.latest(
            `blueprint.project.${input.projectId}`,
        );
        if (blueprintError) return [null, blueprintError.type];
        if (blueprint === null) return [null, 'rollback blueprint is missing'];
        const basePlanId = `plan.${input.structureId}`;
        const [base, baseError] = this.options.plans.latest(basePlanId);
        if (baseError) return [null, baseError.type];
        if (base === null) return [null, 'rollback construction plan is missing'];
        const [changes, changesError] = this.options.changelog.listByStructure(input.structureId);
        if (changesError) return [null, changesError.type];
        if (changes === null) return [null, 'block changelog is missing'];
        const [records, recordsError] = ProjectRollbackPlanner.records(changes);
        if (recordsError) return [null, recordsError];
        if (records === null) return [null, 'rollback records missing'];
        const planId = `${basePlanId}:rollback`;
        const [plan, planError] = new RollbackPlanPlanner({
            planId,
            maxBlocks: this.options.maxWorkPackageBlocks,
        }).plan(base.plan, records);
        if (planError) {
            if (
                planError.type === 'INVALID_CONSTRUCTION_PLAN' &&
                planError.message === 'rollback has no changes'
            ) {
                return [null, null];
            }
            return [null, planError.type];
        }
        if (plan === null) return [null, 'rollback plan returned null'];
        const [document, documentError] = this.options.plans.commit({
            id: planId,
            structureId: input.structureId,
            blueprintId: blueprint.id,
            blueprintRevision: blueprint.revision,
            purpose: 'rollback',
            plan,
        });
        if (documentError) return [null, documentError.type];
        if (document === null) return [null, 'rollback construction plan document is missing'];
        return [
            {
                blueprint,
                plan: document,
                bbox: ProjectRollbackPlanner.bounds(input.bbox, plan.changes),
            },
            null,
        ];
    }

    private static records(
        changes: readonly StoredBlockChange[],
    ): Result<readonly RollbackPlanRecord[], string> {
        const records: RollbackPlanRecord[] = [];
        for (const change of changes) {
            const before = ProjectRollbackPlanner.state(change.before, true);
            const after = ProjectRollbackPlanner.state(change.after, false);
            if (before === undefined || after === undefined || after === null) {
                return [null, `block change ${change.id} has invalid state`];
            }
            records.push({ position: change.position, before, after });
        }
        return [records, null];
    }

    private static state(value: unknown, allowNull: boolean): WorldBlockState | null | undefined {
        if (value === null) return allowNull ? null : undefined;
        if (!ProjectRollbackPlanner.isRecord(value)) return undefined;
        const name = value.name;
        if (typeof name !== 'string' || name.length === 0) return undefined;
        const properties = value.properties;
        if (properties === undefined) return { name };
        if (!ProjectRollbackPlanner.isRecord(properties)) return undefined;
        const entries = Object.entries(properties);
        if (entries.some(([, property]) => typeof property !== 'string')) return undefined;
        return { name, properties: Object.fromEntries(entries) as Record<string, string> };
    }

    private static isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }

    private static bounds(
        proposed: { min: Vec3; max: Vec3 },
        changes: readonly ConstructionChange[],
    ): { min: Vec3; max: Vec3 } {
        const bounds = changes.reduce(
            (current, change) => ({
                min: {
                    x: Math.min(current.min.x, change.block.x),
                    y: Math.min(current.min.y, change.block.y),
                    z: Math.min(current.min.z, change.block.z),
                },
                max: {
                    x: Math.max(current.max.x, change.block.x),
                    y: Math.max(current.max.y, change.block.y),
                    z: Math.max(current.max.z, change.block.z),
                },
            }),
            proposed,
        );
        const [blueprintBounds, blueprintBoundsError] = BlueprintIr.boundingBox(
            changes.map((change) => change.block),
        );
        if (blueprintBoundsError || blueprintBounds === null) return bounds;
        return {
            min: {
                x: Math.min(bounds.min.x, blueprintBounds.min.x),
                y: Math.min(bounds.min.y, blueprintBounds.min.y),
                z: Math.min(bounds.min.z, blueprintBounds.min.z),
            },
            max: {
                x: Math.max(bounds.max.x, blueprintBounds.max.x),
                y: Math.max(bounds.max.y, blueprintBounds.max.y),
                z: Math.max(bounds.max.z, blueprintBounds.max.z),
            },
        };
    }
}
