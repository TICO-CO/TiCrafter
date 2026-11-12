import { assertNever, type Result } from '@ticrafter/core';

import type { BuildingBrief } from './blueprint-document.js';
import { type Blueprint, type BlueprintDraft, BlueprintIr } from './blueprint-ir.js';
import { BlueprintSupportValidator } from './blueprint-support.js';
import { BlueprintValidator } from './blueprint-validator.js';
import { ComposerInterior } from './composer-interior.js';
import { ComposerLayoutPlanner } from './composer-layout.js';
import { ComposerOpenings } from './composer-openings.js';
import { ComposerOutdoor } from './composer-outdoor.js';
import { ComposerRoof } from './composer-roof.js';
import { ComposerShell } from './composer-shell.js';
import type { BuildingFailure } from './failures.js';
import { BuildingFailures } from './failures.js';
import { SeededRandom } from './seeded-random.js';
import { type PaletteMaterials, StylePalette } from './style-palette.js';

export interface ComposeBlueprintRequest {
    id: string;
    brief: BuildingBrief;
}

export interface BlueprintComposerOptions {
    maxBlocks?: number;
}

const defaultMaxBlocks = 4000;

export class BlueprintComposer {
    private readonly maxBlocks: number;

    constructor(options: BlueprintComposerOptions = {}) {
        this.maxBlocks = options.maxBlocks ?? defaultMaxBlocks;
    }

    compose(request: ComposeBlueprintRequest): Result<Blueprint, BuildingFailure> {
        if (request.id.trim().length === 0) {
            return [null, BuildingFailures.composeFailed('blueprint id is empty')];
        }
        const palette = StylePalette.resolve(request.brief.style);
        const [draft, draftError] = this.draft(request.brief, palette);
        if (draftError) return [null, draftError];
        if (draft === null) {
            return [null, BuildingFailures.composeFailed('composer returned no draft')];
        }
        const blocks = draft.blocks.map((block) =>
            BlueprintIr.transform(
                block,
                request.brief.site.anchor ?? { x: 0, y: 0, z: 0 },
                request.brief.site.rotation ?? 0,
            ),
        );
        if (blocks.length > this.maxBlocks) {
            return [
                null,
                BuildingFailures.composeFailed(
                    `blueprint has ${blocks.length} blocks, limit is ${this.maxBlocks}`,
                ),
            ];
        }
        const blueprint: Blueprint = {
            id: request.id,
            anchor: request.brief.site.anchor ?? { x: 0, y: 0, z: 0 },
            rotation: request.brief.site.rotation ?? 0,
            blocks,
            materials: BlueprintIr.materialNeeds(blocks),
            constraints: draft.constraints,
        };
        const [validated, validationError] = BlueprintValidator.validate(blueprint);
        if (validationError) return [null, validationError];
        if (validated === null) return [null, BuildingFailures.composeFailed('validation failed')];
        const [, supportError] = BlueprintSupportValidator.validate(validated);
        if (supportError) return [null, supportError];
        return [validated, null];
    }

    private draft(
        brief: BuildingBrief,
        palette: PaletteMaterials,
    ): Result<BlueprintDraft, BuildingFailure> {
        switch (brief.kind) {
            case 'farm':
            case 'wall':
            case 'road':
            case 'bridge':
                return ComposerOutdoor.build({ kind: brief.kind, brief, palette });
            case 'house':
            case 'shelter':
            case 'storage':
            case 'workshop':
            case 'watchtower':
            case 'compound':
                return this.roomDraft(brief, palette);
            default:
                return assertNever(brief.kind);
        }
    }

    private roomDraft(
        brief: BuildingBrief,
        palette: PaletteMaterials,
    ): Result<BlueprintDraft, BuildingFailure> {
        const [layout, layoutError] = ComposerLayoutPlanner.plan(brief);
        if (layoutError) return [null, layoutError];
        if (layout === null) {
            return [null, BuildingFailures.composeFailed('layout planner returned no layout')];
        }
        const random = new SeededRandom(brief.seed);
        const blocks = new Map(ComposerShell.build(layout, palette));
        ComposerRoof.build(layout, palette, brief.style).forEach((block) =>
            blocks.set(BlueprintIr.blockKey(block), block),
        );
        ComposerOpenings.apply(blocks, layout, palette);
        ComposerInterior.apply(blocks, layout, palette, brief, random);
        const values = [...blocks.values()];
        return [
            { blocks: values, materials: BlueprintIr.materialNeeds(values), constraints: [] },
            null,
        ];
    }
}
