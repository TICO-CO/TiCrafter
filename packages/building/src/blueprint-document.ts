import { createHash } from 'node:crypto';

import type { Vec3 } from '@ticrafter/core';

import type { Blueprint } from './blueprint-ir.js';

export type BlueprintSource = 'template' | 'composed' | 'schematic' | 'observed' | 'blocks';

const BLUEPRINT_SOURCES: ReadonlySet<string> = new Set([
    'template',
    'composed',
    'schematic',
    'observed',
    'blocks',
]);

export class BlueprintSources {
    static isSource(value: string): value is BlueprintSource {
        return BLUEPRINT_SOURCES.has(value);
    }
}

export type BuildingBriefKind =
    | 'house'
    | 'shelter'
    | 'storage'
    | 'workshop'
    | 'farm'
    | 'wall'
    | 'road'
    | 'bridge'
    | 'watchtower'
    | 'compound';

export interface StyleProfile {
    palette: string;
    roof: string;
    symmetry: number;
    decoration: number;
}

export interface BuildingRoomRequirement {
    kind: string;
    count: number;
    minimumSize?: number;
}

export interface BuildingBrief {
    kind: BuildingBriefKind;
    size: {
        width: number;
        depth: number;
        storeys: number;
    };
    program: {
        rooms: readonly BuildingRoomRequirement[];
        amenities: readonly string[];
    };
    style: StyleProfile;
    site: {
        anchor?: Vec3;
        rotation?: 0 | 90 | 180 | 270;
        maximumSlope?: number;
        connection?: 'road' | 'path' | 'none';
    };
    seed: number;
    notes?: string;
}

export type PlannerBlueprintSource = 'template' | 'composed' | 'schematic';

export interface PlannerBlueprintRequest {
    id: string;
    source: PlannerBlueprintSource;
    anchor: Vec3;
    rotation: 0 | 90 | 180 | 270;
    brief?: BuildingBrief;
    template?: string;
    parameters?: Readonly<Record<string, unknown>>;
    schematicRef?: string;
}

export type ConstructionPhase =
    | 'site-clear'
    | 'foundation'
    | 'walls'
    | 'floors'
    | 'roof'
    | 'openings'
    | 'access'
    | 'interior'
    | 'decoration'
    | 'scaffold-removal'
    | 'cleanup';

export interface BlueprintProvenance {
    createdBy: string;
    createdAt: string;
    briefId?: string;
    landmarkId?: string;
    plannerPlanId?: string;
    confidence?: number;
}

export interface BlueprintDocument {
    id: string;
    revision: number;
    hash: string;
    source: BlueprintSource;
    provenance: BlueprintProvenance;
    blueprint: Blueprint;
}

export type BlueprintDocumentContent = Omit<BlueprintDocument, 'hash'>;

export class BlueprintDocumentHash {
    static of(document: BlueprintDocumentContent): string {
        return createHash('sha256')
            .update(BlueprintDocumentHash.canonicalJson(document))
            .digest('hex');
    }

    static canonicalJson(value: unknown): string {
        return JSON.stringify(BlueprintDocumentHash.canonicalize(value));
    }

    private static canonicalize(value: unknown): unknown {
        if (Array.isArray(value)) {
            return value.map((entry) => BlueprintDocumentHash.canonicalize(entry));
        }
        if (value === null || typeof value !== 'object') return value;
        const record = value as Readonly<Record<string, unknown>>;
        const entries = Object.keys(record)
            .sort()
            .filter((key) => record[key] !== undefined)
            .map((key) => [key, BlueprintDocumentHash.canonicalize(record[key])] as const);
        return Object.fromEntries(entries);
    }
}
