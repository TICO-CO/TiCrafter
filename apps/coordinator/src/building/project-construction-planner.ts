import {
    type Blueprint,
    BlueprintComposer,
    type BlueprintDocument,
    type BuildingBrief,
    type BuildingBriefKind,
    BuildingFailures,
    type ConstructionPlanDocument,
    ConstructionPlanPlanner,
    SitePlanner,
    StylePalette,
    type WorldBlockQueryPort,
} from '@ticrafter/building';
import type { Result, Vec3 } from '@ticrafter/core';

import type { BlueprintDocumentService } from './blueprint-document-service.js';
import type { ConstructionPlanDocumentService } from './construction-plan-document-service.js';
import {
    type ProjectConstructionFailure,
    ProjectConstructionFailures,
} from './project-construction-failures.js';

export interface ProjectConstructionInput {
    projectId: string;
    structureId: string;
    botId: string;
    kind: 'home' | 'storage' | 'build';
    anchor: Vec3;
    bbox: { min: Vec3; max: Vec3 };
}

export interface ProjectConstructionResult {
    blueprint: BlueprintDocument;
    plan: ConstructionPlanDocument;
    bbox: { min: Vec3; max: Vec3 };
}

export interface ProjectConstructionPlannerOptions {
    world: WorldBlockQueryPort;
    blueprints: BlueprintDocumentService;
    plans: ConstructionPlanDocumentService;
    maxStructureBlocks: number;
    maxWorkPackageBlocks: number;
}

export class ProjectConstructionPlanner {
    private readonly composer: BlueprintComposer;

    constructor(private readonly options: ProjectConstructionPlannerOptions) {
        this.composer = new BlueprintComposer({ maxBlocks: options.maxStructureBlocks });
    }

    prepare(
        input: ProjectConstructionInput,
    ): Result<ProjectConstructionResult, ProjectConstructionFailure> {
        const brief = ProjectConstructionPlanner.brief(input);
        const [blueprint, composeError] = this.composer.compose({
            id: `blueprint.project.${input.projectId}`,
            brief,
        });
        if (composeError) {
            return [null, ProjectConstructionFailures.blueprintFailed(composeError)];
        }
        if (blueprint === null) {
            return [
                null,
                ProjectConstructionFailures.blueprintFailed(
                    BuildingFailures.composeFailed('blueprint composition returned null'),
                ),
            ];
        }
        const [blueprintDocument, blueprintError] = this.options.blueprints.commit({
            id: blueprint.id,
            source: 'composed',
            provenance: {
                createdBy: input.botId,
                briefId: `project.${input.projectId}`,
            },
            blueprint,
        });
        if (blueprintError) {
            const failure =
                blueprintError.type === 'INVALID_BLUEPRINT'
                    ? blueprintError.failure
                    : BuildingFailures.composeFailed(blueprintError.type);
            return [null, ProjectConstructionFailures.blueprintFailed(failure)];
        }
        if (blueprintDocument === null) {
            return [
                null,
                ProjectConstructionFailures.blueprintFailed(
                    BuildingFailures.composeFailed('blueprint document missing'),
                ),
            ];
        }
        const [site, siteError] = new SitePlanner({ world: this.options.world }).plan(
            blueprint,
            input.anchor,
            {
                requestedAnchor: input.anchor,
                candidateRadius: 0,
                maximumSlope: 3,
                connection: 'none',
            },
        );
        if (siteError) {
            return [
                null,
                ProjectConstructionFailures.siteUnavailable(BuildingFailures.describe(siteError)),
            ];
        }
        if (site === null) {
            return [
                null,
                ProjectConstructionFailures.siteUnavailable('site planning returned null'),
            ];
        }
        const planId = `plan.${input.structureId}`;
        const [plan, planError] = new ConstructionPlanPlanner({
            maxBlocks: this.options.maxWorkPackageBlocks,
            planId,
        }).plan(blueprint, site, this.options.world, input.anchor);
        if (planError) {
            return [null, ProjectConstructionFailures.planFailed(planError)];
        }
        if (plan === null) {
            return [
                null,
                ProjectConstructionFailures.planFailed(
                    BuildingFailures.invalidConstructionPlan('plan returned null'),
                ),
            ];
        }
        const [planDocument, planDocumentError] = this.options.plans.commit({
            id: planId,
            structureId: input.structureId,
            blueprintId: blueprintDocument.id,
            blueprintRevision: blueprintDocument.revision,
            plan,
        });
        if (planDocumentError) {
            return [null, ProjectConstructionFailures.storage(planDocumentError.type)];
        }
        if (planDocument === null) {
            return [
                null,
                ProjectConstructionFailures.storage('construction plan document missing'),
            ];
        }
        return [
            {
                blueprint: blueprintDocument,
                plan: planDocument,
                bbox: ProjectConstructionPlanner.effectiveBbox(input.bbox, plan),
            },
            null,
        ];
    }

    private static brief(input: ProjectConstructionInput): BuildingBrief {
        const kind = ProjectConstructionPlanner.briefKind(input.kind);
        const seed = ProjectConstructionPlanner.seed(input.projectId);
        const palettes = StylePalette.names();
        const palette = palettes[seed % palettes.length] ?? 'oak_and_cobblestone';
        return {
            kind,
            size: {
                width: input.bbox.max.x - input.bbox.min.x + 1,
                depth: input.bbox.max.z - input.bbox.min.z + 1,
                storeys: 1,
            },
            program: {
                rooms: [{ kind: 'main', count: 1, minimumSize: 3 }],
                amenities: ProjectConstructionPlanner.amenities(kind),
            },
            style: {
                palette,
                roof: 'gable',
                symmetry: 0.8,
                decoration: 0.5,
            },
            site: {
                anchor: input.anchor,
                rotation: 0,
                maximumSlope: 3,
                connection: 'none',
            },
            seed,
        };
    }

    private static briefKind(kind: ProjectConstructionInput['kind']): BuildingBriefKind {
        switch (kind) {
            case 'home':
            case 'build':
                return 'house';
            case 'storage':
                return 'storage';
        }
    }

    private static amenities(kind: BuildingBriefKind): readonly string[] {
        if (kind === 'storage') return ['chest', 'torch'];
        return ['bed', 'chest', 'crafting_table', 'furnace', 'torch'];
    }

    private static seed(projectId: string): number {
        return [...projectId].reduce((value, character) => value + character.charCodeAt(0), 0);
    }

    private static effectiveBbox(
        proposed: { min: Vec3; max: Vec3 },
        plan: { changes: readonly { block: Vec3 }[] },
    ): { min: Vec3; max: Vec3 } {
        return plan.changes.reduce(
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
