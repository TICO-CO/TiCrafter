import { assertNever, type Result } from '@ticrafter/core';

import { BlueprintComposer } from './blueprint-composer.js';
import { type Blueprint, BlueprintIr } from './blueprint-ir.js';
import type { BlocksSourceRequest, BlueprintSourceRequest } from './blueprint-source-request.js';
import { BlueprintSupportValidator } from './blueprint-support.js';
import { BlueprintValidator } from './blueprint-validator.js';
import type { BuildingFailure } from './failures.js';
import { BuildingFailures } from './failures.js';
import { ObservedBlueprintCapture } from './observed-blueprint.js';
import { SchematicParser } from './schematic-parser.js';
import { TemplateInstantiator } from './template-instantiator.js';

export type {
    BlocksSourceRequest,
    BlueprintSourceRequest,
    ComposedSourceRequest,
    ObservedSourceRequest,
    SchematicSourceRequest,
    TemplateSourceRequest,
} from './blueprint-source-request.js';

export interface BlueprintSourceResolverOptions {
    templates: TemplateInstantiator;
    composer: BlueprintComposer;
    schematics: SchematicParser;
    observation: ObservedBlueprintCapture;
    allowRawBlockBlueprints: boolean;
    maxBlocks?: number;
}

const defaultMaxBlocks = 4000;

export class BlueprintSourceResolver {
    private readonly maxBlocks: number;

    constructor(private readonly options: BlueprintSourceResolverOptions) {
        this.maxBlocks = options.maxBlocks ?? defaultMaxBlocks;
    }

    async resolve(request: BlueprintSourceRequest): Promise<Result<Blueprint, BuildingFailure>> {
        const [blueprint, error] = await this.resolveSource(request);
        if (error) return [null, error];
        if (blueprint === null) {
            return [null, BuildingFailures.composeFailed('blueprint source returned no blueprint')];
        }
        if (blueprint.blocks.length > this.maxBlocks) {
            return [
                null,
                BuildingFailures.composeFailed(
                    `blueprint has ${blueprint.blocks.length} blocks, limit is ${this.maxBlocks}`,
                ),
            ];
        }
        return [blueprint, null];
    }

    private async resolveSource(
        request: BlueprintSourceRequest,
    ): Promise<Result<Blueprint, BuildingFailure>> {
        switch (request.source) {
            case 'template':
                return this.options.templates.instantiate({
                    id: request.id,
                    type: request.template,
                    anchor: request.anchor,
                    rotation: request.rotation,
                    options: this.templateOptions(request.parameters),
                });
            case 'composed':
                return this.options.composer.compose({ id: request.id, brief: request.brief });
            case 'schematic':
                return this.options.schematics.parse(request.buffer, {
                    id: request.id,
                    anchor: request.anchor,
                    rotation: request.rotation,
                    version: request.version,
                });
            case 'observed':
                return this.options.observation.capture({
                    id: request.id,
                    bounds: request.bounds,
                });
            case 'blocks':
                return this.rawBlocks(request);
            default:
                return assertNever(request);
        }
    }

    private rawBlocks(request: BlocksSourceRequest): Result<Blueprint, BuildingFailure> {
        if (!this.options.allowRawBlockBlueprints) {
            return [null, BuildingFailures.rawBlueprintsDisabled()];
        }
        if (request.blocks.length > this.maxBlocks) {
            return [
                null,
                BuildingFailures.composeFailed(
                    `raw blueprint has ${request.blocks.length} blocks, limit is ${this.maxBlocks}`,
                ),
            ];
        }
        const blueprint: Blueprint = {
            id: request.id,
            anchor: request.anchor,
            rotation: request.rotation,
            blocks: request.blocks,
            materials: request.materials ?? BlueprintIr.materialNeeds(request.blocks),
            constraints: request.constraints ?? [],
        };
        const [validated, validationError] = BlueprintValidator.validate(blueprint);
        if (validationError) return [null, validationError];
        if (validated === null) {
            return [null, BuildingFailures.composeFailed('raw blueprint validation failed')];
        }
        const [, supportError] = BlueprintSupportValidator.validate(validated);
        if (supportError) return [null, supportError];
        return [validated, null];
    }

    private templateOptions(
        parameters: Readonly<Record<string, unknown>> | undefined,
    ): Readonly<Record<string, string | number | boolean>> | undefined {
        if (parameters === undefined) return undefined;
        return Object.fromEntries(
            Object.entries(parameters).filter(
                (entry): entry is [string, string | number | boolean] =>
                    typeof entry[1] === 'string' ||
                    typeof entry[1] === 'number' ||
                    typeof entry[1] === 'boolean',
            ),
        );
    }
}
