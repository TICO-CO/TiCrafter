import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
    type Blueprint,
    type BlueprintBlock,
    BlueprintIr,
    type BlueprintRotation,
    BuildingFailures,
    BuiltInTemplates,
    type SchematicDiff,
    SchematicDiffCalculator,
    SchematicParser,
    TemplateInstantiator,
    type WorldBlockQueryPort,
} from '@ticrafter/building';
import { attempt, type Result, type Vec3 } from '@ticrafter/core';
import type {
    SkillBBox,
    SkillBlock,
    SkillBlockState,
    SkillBlueprintSource,
    SkillBuildExecutionPort,
    SkillBuildTarget,
    SkillConstructionSource,
    SkillInput,
    SkillProcurementPort,
    SkillRepairDiff,
    SkillRepairDiffSource,
    SkillSchematicPipeline,
    SkillSchematicRef,
    SkillServices,
} from '@ticrafter/skills';

import type { BlueprintFetchClient } from './blueprint-fetch-client.js';
import type { ConstructionPlanFetchClient } from './construction-plan-fetch-client.js';
import { ConstructionSource } from './construction-source.js';
import type { ContainerScanner } from './container-scanner.js';

const TEMPLATE_PREFIX = 'template:';
const SCHEMATIC_EXTENSION = '.schem';

export interface BuildingWorldView {
    blockStateAt(position: Vec3): SkillBlockState | null;
    blocksInBox(bbox: SkillBBox): readonly SkillBlock[];
}

class CatalogBlueprintSource implements SkillBlueprintSource {
    constructor(private readonly catalog: BuildingBlueprintCatalog) {}

    targets(input: SkillInput): Result<readonly SkillBuildTarget[], string> {
        if (input.schematic === undefined) {
            return [null, 'blueprint source requires a schematic reference'];
        }
        return this.catalog.targets(input.schematic);
    }
}

class CatalogSchematicPipeline implements SkillSchematicPipeline {
    constructor(private readonly catalog: BuildingBlueprintCatalog) {}

    prepare(reference: SkillSchematicRef): Result<readonly SkillBuildTarget[], string> {
        return this.catalog.targets(reference);
    }
}

class CatalogRepairDiffSource implements SkillRepairDiffSource {
    constructor(
        private readonly catalog: BuildingBlueprintCatalog,
        private readonly world: BuildingWorldView,
    ) {}

    diff(input: SkillInput): Result<SkillRepairDiff, string> {
        if (input.schematic === undefined) {
            return [null, 'repair diff source requires a schematic reference'];
        }
        return this.catalog.repairDiff(input.schematic, this.world);
    }
}

export interface BuildingSkillServicesOptions {
    documents?: BlueprintFetchClient;
    plans?: ConstructionPlanFetchClient;
    buildExecution?: SkillBuildExecutionPort;
    procurement?: SkillProcurementPort;
    containers?: ContainerScanner;
}

export class BuildingSkillServices implements SkillServices {
    readonly blueprints: SkillBlueprintSource;
    readonly schematics: SkillSchematicPipeline;
    readonly repairDiff: SkillRepairDiffSource;
    readonly construction: SkillConstructionSource | undefined;
    readonly buildExecution: SkillBuildExecutionPort | undefined;
    readonly procurement: SkillProcurementPort | undefined;
    private readonly documents: BlueprintFetchClient | undefined;
    private readonly plans: ConstructionPlanFetchClient | undefined;
    private readonly containers: ContainerScanner | undefined;

    private constructor(
        catalog: BuildingBlueprintCatalog,
        world: BuildingWorldView,
        options: BuildingSkillServicesOptions,
    ) {
        this.blueprints = new CatalogBlueprintSource(catalog);
        this.schematics = new CatalogSchematicPipeline(catalog);
        this.repairDiff = new CatalogRepairDiffSource(catalog, world);
        this.construction =
            options.plans === undefined
                ? undefined
                : new ConstructionSource({
                      plans: options.plans,
                      world,
                  });
        this.buildExecution = options.buildExecution;
        this.procurement = options.procurement;
        this.documents = options.documents;
        this.plans = options.plans;
        this.containers = options.containers;
    }

    async prefetch(input: SkillInput, skillId?: string): Promise<Result<void, string>> {
        if (input.planId === undefined || input.planRevision === undefined) {
            return [null, 'construction requires a plan id and revision'];
        }
        if (this.plans === undefined) {
            return [null, 'construction plan fetch client is unavailable'];
        }
        const [document, fetchError] = await this.plans.fetch(input.planId, input.planRevision);
        if (fetchError !== null) return [null, fetchError];
        if (document === null) return [null, 'construction plan document returned null'];
        if (skillId === 'procurement' && this.containers !== undefined) {
            const [, containerError] = await this.containers.refresh();
            if (containerError !== null) return [null, containerError];
        }
        return [undefined, null];
    }

    static async create(
        dataDirectory: string,
        world: BuildingWorldView,
        options: BuildingSkillServicesOptions = {},
    ): Promise<Result<BuildingSkillServices, string>> {
        const [catalog, catalogError] = await BuildingBlueprintCatalog.load(dataDirectory);
        if (catalogError) return [null, catalogError];
        if (catalog === null) return [null, 'building blueprint catalog returned null'];
        return [new BuildingSkillServices(catalog, world, options), null];
    }
}

class BuildingBlueprintCatalog {
    private constructor(
        private readonly instantiator: TemplateInstantiator,
        private readonly blueprints: ReadonlyMap<string, Blueprint>,
    ) {}

    static async load(dataDirectory: string): Promise<Result<BuildingBlueprintCatalog, string>> {
        const [registry, registryError] = BuiltInTemplates.createRegistry();
        if (registryError) return [null, BuildingFailures.describe(registryError)];
        if (registry === null) return [null, 'template registry returned null'];
        const schematicDirectory = path.join(dataDirectory, 'schematics');
        const [files, filesError] = existsSync(schematicDirectory)
            ? attempt(() =>
                  readdirSync(schematicDirectory).filter((file) =>
                      file.endsWith(SCHEMATIC_EXTENSION),
                  ),
              )
            : [[], null];
        if (filesError) {
            return [
                null,
                `schematics directory unavailable: ${BuildingBlueprintCatalog.describe(filesError)}`,
            ];
        }
        if (files === null) return [null, 'schematic directory returned null'];
        const parser = new SchematicParser();
        const blueprints = new Map<string, Blueprint>();
        for (const file of files) {
            const identifier = path.basename(file, SCHEMATIC_EXTENSION);
            const [buffer, bufferError] = attempt(() =>
                readFileSync(path.join(schematicDirectory, file)),
            );
            if (bufferError || buffer === null) continue;
            const [blueprint, parseError] = await parser.parse(buffer, {
                id: identifier,
                anchor: { x: 0, y: 0, z: 0 },
            });
            if (parseError || blueprint === null) continue;
            blueprints.set(identifier, blueprint);
        }
        return [new BuildingBlueprintCatalog(new TemplateInstantiator(registry), blueprints), null];
    }

    targets(reference: SkillSchematicRef): Result<readonly SkillBuildTarget[], string> {
        const [blueprint, blueprintError] = this.resolve(reference);
        if (blueprintError) return [null, blueprintError];
        if (blueprint === null) return [null, `unknown blueprint ${reference.id}`];
        return [this.toTargets(blueprint), null];
    }

    repairDiff(
        reference: SkillSchematicRef,
        world: BuildingWorldView,
    ): Result<SkillRepairDiff, string> {
        const [blueprint, blueprintError] = this.resolve(reference);
        if (blueprintError) return [null, blueprintError];
        if (blueprint === null) return [null, `unknown blueprint ${reference.id}`];
        const [diff, diffError] = new SchematicDiffCalculator().diff(
            blueprint,
            this.worldPort(world),
        );
        if (diffError) return [null, BuildingFailures.describe(diffError)];
        if (diff === null) return [null, 'schematic diff returned null'];
        return [this.toRepairDiff(diff), null];
    }

    private resolve(reference: SkillSchematicRef): Result<Blueprint | null, string> {
        if (reference.id.startsWith(TEMPLATE_PREFIX)) {
            const [blueprint, instantiateError] = this.instantiator.instantiate({
                id: reference.id,
                type: reference.id.slice(TEMPLATE_PREFIX.length),
                anchor: reference.anchor,
                rotation: this.rotation(reference.rotation),
            });
            if (instantiateError) return [null, BuildingFailures.describe(instantiateError)];
            return [blueprint, null];
        }
        const blueprint = this.blueprints.get(reference.id);
        if (blueprint === undefined) return [null, null];
        return [this.transform(blueprint, reference), null];
    }

    private transform(blueprint: Blueprint, reference: SkillSchematicRef): Blueprint {
        const rotation = this.rotation(reference.rotation);
        return {
            ...blueprint,
            anchor: reference.anchor,
            rotation,
            blocks: blueprint.blocks.map((block) =>
                BlueprintIr.transform(block, reference.anchor, rotation),
            ),
        };
    }

    private rotation(value: number | undefined): BlueprintRotation {
        if (value === 90 || value === 180 || value === 270) return value;
        return 0;
    }

    private toTargets(blueprint: Blueprint): readonly SkillBuildTarget[] {
        return blueprint.blocks
            .filter((block) => !BlueprintIr.isAir(block.state.name))
            .map((block) => ({
                position: BlueprintIr.position(block),
                itemName: block.state.name,
                expectedBlockId: block.state.name,
                ...(block.state.properties === undefined
                    ? {}
                    : { properties: block.state.properties }),
            }));
    }

    private toRepairDiff(diff: SchematicDiff): SkillRepairDiff {
        return {
            missing: diff.missing.map((block) => this.toTarget(block)),
            extra: diff.extra,
            mismatched: diff.mismatched.map((block) => this.toTarget(block)),
        };
    }

    private toTarget(block: BlueprintBlock): SkillBuildTarget {
        return {
            position: BlueprintIr.position(block),
            itemName: block.state.name,
            expectedBlockId: block.state.name,
            ...(block.state.properties === undefined ? {} : { properties: block.state.properties }),
        };
    }

    private worldPort(world: BuildingWorldView): WorldBlockQueryPort {
        return {
            blockAt: (position: Vec3) => {
                const state = world.blockStateAt(position);
                return [state, null];
            },
            blocksInBox: (bounds) => {
                const blocks = world.blocksInBox(bounds).map((block) => ({
                    name: block.name,
                    properties: block.properties,
                    position: block.position,
                }));
                return [blocks, null];
            },
        };
    }

    private static describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
