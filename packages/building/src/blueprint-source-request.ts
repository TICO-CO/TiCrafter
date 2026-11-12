import type { Vec3 } from '@ticrafter/core';

import type { BuildingBrief } from './blueprint-document.js';
import type {
    BlueprintBlock,
    BlueprintBoundingBox,
    BlueprintConstraint,
    BlueprintMaterialNeed,
    BlueprintRotation,
} from './blueprint-ir.js';

export interface TemplateSourceRequest {
    id: string;
    source: 'template';
    anchor: Vec3;
    rotation: BlueprintRotation;
    template: string;
    parameters?: Readonly<Record<string, unknown>>;
}

export interface ComposedSourceRequest {
    id: string;
    source: 'composed';
    brief: BuildingBrief;
}

export interface SchematicSourceRequest {
    id: string;
    source: 'schematic';
    anchor: Vec3;
    rotation: BlueprintRotation;
    buffer: Buffer;
    version?: string;
}

export interface ObservedSourceRequest {
    id: string;
    source: 'observed';
    bounds: BlueprintBoundingBox;
}

export interface BlocksSourceRequest {
    id: string;
    source: 'blocks';
    anchor: Vec3;
    rotation: BlueprintRotation;
    blocks: readonly BlueprintBlock[];
    materials?: readonly BlueprintMaterialNeed[];
    constraints?: readonly BlueprintConstraint[];
}

export type BlueprintSourceRequest =
    | TemplateSourceRequest
    | ComposedSourceRequest
    | SchematicSourceRequest
    | ObservedSourceRequest
    | BlocksSourceRequest;
