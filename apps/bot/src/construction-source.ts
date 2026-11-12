import {
    type BlueprintBlock,
    BlueprintIr,
    type ConstructionChange,
    type ConstructionPlan,
    type PlannedWorkPackage,
} from '@ticrafter/building';
import type { Result, Vec3 } from '@ticrafter/core';
import type {
    SkillBlock,
    SkillBlockState,
    SkillBuildTarget,
    SkillConstructionOperation,
    SkillConstructionPhase,
    SkillConstructionPlan,
    SkillConstructionSource,
    SkillContext,
    SkillInput,
} from '@ticrafter/skills';

import type { BuildingWorldView } from './building-services.js';
import type { ConstructionPlanFetchClient } from './construction-plan-fetch-client.js';

export interface ConstructionSourceOptions {
    plans: ConstructionPlanFetchClient;
    world: BuildingWorldView;
}

interface SelectedScope {
    id: string;
    phase: SkillConstructionPhase | null;
    blockKeys: readonly string[];
    cleanup: boolean;
}

export class ConstructionSource implements SkillConstructionSource {
    constructor(private readonly options: ConstructionSourceOptions) {}

    resolve(context: SkillContext, input: SkillInput): Result<SkillConstructionPlan, string> {
        if (input.planId === undefined) return [null, 'construction requires a plan id'];
        if (input.planRevision === undefined) {
            return [null, 'construction requires a plan revision'];
        }
        if (input.workPackageId === undefined) {
            return [null, 'construction requires a work package id'];
        }
        const document = this.options.plans.cached(input.planId, input.planRevision);
        if (document === null) {
            return [
                null,
                `construction plan ${input.planId} revision ${input.planRevision} is not cached`,
            ];
        }
        if (input.blueprintId !== undefined && input.blueprintId !== document.blueprintId) {
            return [null, 'construction plan blueprint mismatch'];
        }
        if (
            input.blueprintRevision !== undefined &&
            input.blueprintRevision !== document.blueprintRevision
        ) {
            return [null, 'construction plan blueprint revision mismatch'];
        }
        const scope = this.scopeFor(document.plan, input.workPackageId);
        if (scope === null) return [null, 'construction work package is missing'];
        const operations = this.operations(document.plan, scope, input);
        if (operations.length === 0) return [null, 'construction has no operations'];
        return [
            {
                blueprintId: document.blueprintId,
                blueprintRevision: document.blueprintRevision,
                planId: document.id,
                planRevision: document.revision,
                workPackageId: scope.id,
                phase: scope.phase,
                operations,
                scaffoldPositions: document.plan.scaffolds.map((scaffold) => scaffold.position),
            },
            null,
        ];
    }

    private scopeFor(plan: ConstructionPlan, workPackageId: string): SelectedScope | null {
        if (workPackageId === `${plan.id}:cleanup`) {
            return { id: workPackageId, phase: 'cleanup', blockKeys: [], cleanup: true };
        }
        const selected = plan.workPackages.find(
            (entry: PlannedWorkPackage) => entry.id === workPackageId,
        );
        if (selected === undefined) return null;
        return {
            id: selected.id,
            phase: selected.phase,
            blockKeys: selected.blockKeys,
            cleanup: false,
        };
    }

    private operations(
        plan: ConstructionPlan,
        scope: SelectedScope,
        input: SkillInput,
    ): SkillConstructionOperation[] {
        if (scope.cleanup) return this.cleanupOperations(plan, input);
        const selected = new Set(scope.blockKeys);
        return plan.changes
            .filter((change: ConstructionChange) =>
                selected.has(BlueprintIr.blockKey(change.block)),
            )
            .flatMap((change) => this.appendChange(change, input));
    }

    private cleanupOperations(
        plan: ConstructionPlan,
        input: SkillInput,
    ): SkillConstructionOperation[] {
        return plan.scaffolds.map((scaffold) =>
            this.operation(
                'break',
                {
                    position: scaffold.position,
                    itemName: scaffold.stateName,
                    expectedBlockId: scaffold.stateName,
                },
                input,
            ),
        );
    }

    private appendChange(
        change: ConstructionChange,
        input: SkillInput,
    ): SkillConstructionOperation[] {
        const target = this.targetFor(change.block);
        const operations: SkillConstructionOperation[] = [];
        const actual = this.options.world.blockStateAt(target.position);
        if (change.kind === 'place' && actual !== null && !this.matches(target, actual)) {
            operations.push(
                this.operation('break', this.breakTarget(target.position, actual), input),
            );
        }
        operations.push(this.operation(change.kind, target, input));
        return operations;
    }

    private targetFor(block: BlueprintBlock): SkillBuildTarget {
        return {
            position: BlueprintIr.position(block),
            itemName: block.state.name,
            expectedBlockId: block.state.name,
            ...(block.state.properties === undefined ? {} : { properties: block.state.properties }),
        };
    }

    private breakTarget(position: Vec3, actual: SkillBlockState): SkillBuildTarget {
        return {
            position,
            itemName: actual.name,
            expectedBlockId: actual.name,
            ...(actual.properties === undefined ? {} : { properties: actual.properties }),
        };
    }

    private matches(target: SkillBuildTarget, actual: SkillBlockState): boolean {
        const expected = target.expectedBlockId ?? target.itemName;
        if (actual.name !== expected) return false;
        if (target.properties === undefined) return true;
        return Object.entries(target.properties).every(
            ([key, value]) => actual.properties[key] === value,
        );
    }

    private operation(
        kind: 'place' | 'break',
        target: SkillBuildTarget,
        input: SkillInput,
    ): SkillConstructionOperation {
        return {
            kind,
            target,
            ...(input.claimId === undefined ? {} : { claimId: input.claimId }),
            ...(input.grant === undefined ? {} : { grantId: input.grant.id, grant: input.grant }),
            ...(input.grant?.fencingToken === undefined
                ? {}
                : { grantFencingToken: input.grant.fencingToken }),
            ...(input.structureId === undefined ? {} : { structureId: input.structureId }),
            ...(input.blueprintId === undefined ? {} : { blueprintId: input.blueprintId }),
            ...(input.blueprintRevision === undefined
                ? {}
                : { blueprintRevision: input.blueprintRevision }),
            ...(input.planId === undefined ? {} : { planId: input.planId }),
            ...(input.fencingToken === undefined ? {} : { fencingToken: input.fencingToken }),
        };
    }
}
