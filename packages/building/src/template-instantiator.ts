import type { Result } from '@ticrafter/core';

import { type Blueprint, BlueprintIr } from './blueprint-ir.js';
import { BlueprintValidator } from './blueprint-validator.js';
import type { BuildingFailure } from './failures.js';
import type { TemplateRegistry, TemplateRequest } from './template-registry.js';

export interface InstantiationRequest extends TemplateRequest {
    id?: string;
}

export class TemplateInstantiator {
    constructor(private readonly registry: TemplateRegistry) {}

    instantiate(request: InstantiationRequest): Result<Blueprint, BuildingFailure> {
        const [template, templateError] = this.registry.resolve(request.type);
        if (templateError) return [null, templateError];
        if (template === null) {
            return [null, { type: 'UNKNOWN_TEMPLATE', templateType: request.type }];
        }
        const [draft, draftError] = template.build(request);
        if (draftError) return [null, draftError];
        if (draft === null) {
            return [
                null,
                {
                    type: 'TEMPLATE_FAILED',
                    templateType: request.type,
                    message: 'template returned no draft',
                },
            ];
        }
        const blocks = draft.blocks.map((block) =>
            BlueprintIr.transform(block, request.anchor, request.rotation),
        );
        const blueprint: Blueprint = {
            id: request.id ?? this.identifier(request),
            anchor: request.anchor,
            rotation: request.rotation,
            blocks,
            materials: draft.materials,
            constraints: draft.constraints,
        };
        return BlueprintValidator.validate(blueprint);
    }

    private identifier(request: TemplateRequest): string {
        const anchor = request.anchor;
        return `${request.type}:${anchor.x},${anchor.y},${anchor.z}:${request.rotation}`;
    }
}
