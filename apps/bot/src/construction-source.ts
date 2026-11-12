import {
    type Blueprint,
    type BlueprintBlock,
    BlueprintIr,
    type BuildingFailure,
    BuildingFailures,
    type ConstructionChange,
    type ConstructionPlan,
    ConstructionPlanPlanner,
    type PlannedWorkPackage,
    type PositionedWorldBlock,
    SitePlanner,
    type WorldBlockQueryPort,
    type WorldBlockState,
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

import type { BlueprintFetchClient } from './blueprint-fetch-client.js';
import type { BuildingWorldView } from './building-services.js';

export interface ConstructionSourceOptions {
    documents: BlueprintFetchClient;
    world: BuildingWorldView;
    maxWorkPackageBlocks: number;
}

interface SelectedScope {
    id: string;
    phase: SkillConstructionPhase | null;
    blockKeys: readonly string[];
    all: boolean;
}

class ConstructionWorldPort implements WorldBlockQueryPort {
    constructor(private readonly world: BuildingWorldView) {}

    blockAt(position: Vec3): Result<WorldBlockState | null, BuildingFailure> {
        return [this.world.blockStateAt(position), null];
    }

    blocksInBox(bounds: {
        min: Vec3;
        max: Vec3;
    }): Result<readonly PositionedWorldBlock[], BuildingFailure> {
        const blocks = this.world.blocksInBox(bounds).map((block: SkillBlock) => ({
            name: block.name,
            properties: block.properties,
            position: block.position,
        }));
        return [blocks, null];
    }
}

export class ConstructionSource implements SkillConstructionSource {
    constructor(private readonly options: ConstructionSourceOptions) {}

    resolve(context: SkillContext, input: SkillInput): Result<SkillConstructionPlan, string> {
        if (input.blueprintId === undefined) return [null, 'construction requires a blueprint id'];
        if (input.blueprintRevision === undefined) {
            return [null, 'construction requires a blueprint revision'];
        }
        const document = this.options.documents.cached(input.blueprintId, input.blueprintRevision);
        if (document === null) {
            return [
                null,
                `blueprint ${input.blueprintId} revision ${input.blueprintRevision} is not cached`,
            ];
        }
        const blueprint: Blueprint = document.blueprint;
        const world = new ConstructionWorldPort(this.options.world);
        const [site, siteError] = new SitePlanner({ world }).plan(blueprint, context.position, {
            requestedAnchor: input.target ?? context.position,
            maximumSlope: 3,
            connection: 'none',
        });
        if (siteError) return [null, BuildingFailures.describe(siteError)];
        if (site === null) return [null, 'site planning returned null'];
        const [plan, planError] = new ConstructionPlanPlanner({
            maxBlocks: this.options.maxWorkPackageBlocks,
        }).plan(blueprint, site, world, context.position);
        if (planError) return [null, BuildingFailures.describe(planError)];
        if (plan === null) return [null, 'construction planning returned null'];
        const scope = this.scopeFor(plan, input.workPackageId);
        if (scope === null) return [null, 'construction work package is missing'];
        const operations = this.operations(plan, scope, input);
        if (operations.length === 0) return [null, 'construction has no operations'];
        const scaffoldPositions = scope.all
            ? plan.scaffolds.map((scaffold) => scaffold.position)
            : this.packageScaffolds(plan, scope);
        return [
            {
                blueprintId: document.id,
                blueprintRevision: document.revision,
                workPackageId: scope.id,
                phase: scope.phase,
                operations,
                scaffoldPositions,
            },
            null,
        ];
    }

    private scopeFor(
        plan: ConstructionPlan,
        workPackageId: string | undefined,
    ): SelectedScope | null {
        if (workPackageId === undefined) {
            return {
                id: `${plan.id}:all`,
                phase: null,
                blockKeys: plan.changes.map((change) => BlueprintIr.blockKey(change.block)),
                all: true,
            };
        }
        const selected = plan.workPackages.find(
            (entry: PlannedWorkPackage) => entry.id === workPackageId,
        );
        if (selected === undefined) return null;
        return {
            id: selected.id,
            phase: selected.phase,
            blockKeys: selected.blockKeys,
            all: false,
        };
    }

    private operations(
        plan: ConstructionPlan,
        scope: SelectedScope,
        input: SkillInput,
    ): SkillConstructionOperation[] {
        const selected = new Set(scope.blockKeys);
        const operations: SkillConstructionOperation[] = [];
        plan.changes
            .filter((change: ConstructionChange) =>
                selected.has(BlueprintIr.blockKey(change.block)),
            )
            .forEach((change) => this.appendChange(change, input, operations));
        this.scaffoldRemovals(plan, selected, scope.all, input).forEach((operation) =>
            operations.push(operation),
        );
        return operations;
    }

    private appendChange(
        change: ConstructionChange,
        input: SkillInput,
        operations: SkillConstructionOperation[],
    ): void {
        const target = this.targetFor(change.block);
        const actual = this.options.world.blockStateAt(target.position);
        if (change.kind === 'place' && actual !== null && !this.matches(target, actual)) {
            operations.push(
                this.operation('break', this.breakTarget(target.position, actual), input),
            );
        }
        operations.push(this.operation(change.kind, target, input));
    }

    private scaffoldRemovals(
        plan: ConstructionPlan,
        selected: ReadonlySet<string>,
        all: boolean,
        input: SkillInput,
    ): SkillConstructionOperation[] {
        return plan.scaffolds
            .filter((scaffold) => all || scaffold.targetKeys.every((key) => selected.has(key)))
            .filter((scaffold) => !selected.has(BlueprintIr.positionKey(scaffold.position)))
            .map((scaffold) =>
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

    private packageScaffolds(plan: ConstructionPlan, scope: SelectedScope): readonly Vec3[] {
        const selected = new Set(scope.blockKeys);
        return plan.scaffolds
            .filter((scaffold) => scaffold.targetKeys.every((key) => selected.has(key)))
            .map((scaffold) => scaffold.position);
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
            ...(input.structureId === undefined ? {} : { structureId: input.structureId }),
            ...(input.blueprintId === undefined ? {} : { blueprintId: input.blueprintId }),
            ...(input.blueprintRevision === undefined
                ? {}
                : { blueprintRevision: input.blueprintRevision }),
            ...(input.fencingToken === undefined ? {} : { fencingToken: input.fencingToken }),
        };
    }
}
