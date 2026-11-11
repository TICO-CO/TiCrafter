import type { Result, Vec3 } from '@ticrafter/core';

import {
    type BlueprintBlock,
    type BlueprintDraft,
    BlueprintIr,
    type BlueprintRotation,
} from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';

export interface TemplateSize {
    width?: number;
    height?: number;
    depth?: number;
    length?: number;
}

export interface TemplateMaterials {
    primary?: string;
    secondary?: string;
    roof?: string;
    glass?: string;
    water?: string;
    crop?: string;
    support?: string;
    rail?: string;
    container?: string;
}

export interface TemplateRequest {
    type: string;
    anchor: Vec3;
    rotation: BlueprintRotation;
    size?: TemplateSize;
    materials?: TemplateMaterials;
    options?: Readonly<Record<string, string | number | boolean>>;
}

export interface BuildingTemplate {
    readonly type: string;
    build(request: TemplateRequest): Result<BlueprintDraft, BuildingFailure>;
}

export class TemplateRegistry {
    private readonly templates: ReadonlyMap<string, BuildingTemplate>;

    private constructor(templates: ReadonlyMap<string, BuildingTemplate>) {
        this.templates = templates;
    }

    static create(
        templates: readonly BuildingTemplate[],
    ): Result<TemplateRegistry, BuildingFailure> {
        const registered = new Map<string, BuildingTemplate>();
        for (const template of templates) {
            if (template.type.trim().length === 0) {
                return [null, { type: 'TEMPLATE_FAILED', templateType: '', message: 'empty type' }];
            }
            if (registered.has(template.type)) {
                return [
                    null,
                    {
                        type: 'TEMPLATE_FAILED',
                        templateType: template.type,
                        message: `template ${template.type} is registered twice`,
                    },
                ];
            }
            registered.set(template.type, template);
        }
        return [new TemplateRegistry(registered), null];
    }

    resolve(templateType: string): Result<BuildingTemplate, BuildingFailure> {
        const template = this.templates.get(templateType);
        if (template === undefined) return [null, { type: 'UNKNOWN_TEMPLATE', templateType }];
        return [template, null];
    }

    types(): readonly string[] {
        return [...this.templates.keys()].sort();
    }
}

export class TemplateGeometry {
    static block(
        x: number,
        y: number,
        z: number,
        stateName: string,
        priority: number,
        properties?: Readonly<Record<string, string>>,
    ): BlueprintBlock {
        return {
            x,
            y,
            z,
            state: properties === undefined ? { name: stateName } : { name: stateName, properties },
            priority,
        };
    }

    static materials(blocks: readonly BlueprintBlock[]) {
        return BlueprintIr.materialNeeds(blocks);
    }

    static width(request: TemplateRequest, fallback: number): number {
        return TemplateGeometry.positiveInteger(request.size?.width, fallback);
    }

    static height(request: TemplateRequest, fallback: number): number {
        return TemplateGeometry.positiveInteger(request.size?.height, fallback);
    }

    static depth(request: TemplateRequest, fallback: number): number {
        return TemplateGeometry.positiveInteger(request.size?.depth, fallback);
    }

    static length(request: TemplateRequest, fallback: number): number {
        return TemplateGeometry.positiveInteger(request.size?.length, fallback);
    }

    static material(
        request: TemplateRequest,
        selected: keyof TemplateMaterials,
        fallback: string,
    ): string {
        return request.materials?.[selected] ?? fallback;
    }

    private static positiveInteger(value: number | undefined, fallback: number): number {
        if (value === undefined || !Number.isInteger(value) || value <= 0) return fallback;
        return value;
    }
}
