import type { Vec3 } from '@ticrafter/core';

import type { ConstructionPhase } from './blueprint-document.js';
import type {
    BlueprintBlock,
    BlueprintBoundingBox,
    BlueprintMaterialNeed,
    BlueprintRotation,
    BlueprintWorkPackage,
} from './blueprint-ir.js';

export const CONSTRUCTION_PHASE_ORDER: readonly ConstructionPhase[] = [
    'site-clear',
    'foundation',
    'scaffold',
    'walls',
    'floors',
    'roof',
    'openings',
    'access',
    'interior',
    'decoration',
    'scaffold-removal',
    'cleanup',
];

export type FoundationMode = 'level' | 'terrace' | 'retaining-wall' | 'stilts';

export type SiteAccessKind = 'none' | 'path' | 'stairs' | 'bridge';

export type ConstructionChangeReason =
    'blueprint' | 'clearance' | 'foundation' | 'scaffold' | 'cleanup';

export interface SiteAccessPlan {
    kind: SiteAccessKind;
    from: Vec3 | null;
    to: Vec3;
    length: number;
}

export interface SitePlan {
    anchor: Vec3;
    translation: Vec3;
    rotation: BlueprintRotation;
    bounds: BlueprintBoundingBox;
    clearance: readonly Vec3[];
    access: SiteAccessPlan;
    foundationMode: FoundationMode;
    foundationFillDepth: number;
    foundationCutDepth: number;
    score: number;
    rationale: readonly string[];
}

export interface ConstructionChange {
    kind: 'place' | 'break';
    block: BlueprintBlock;
    phase: ConstructionPhase;
    reason: ConstructionChangeReason;
    dependsOn: readonly string[];
}

export interface FoundationPlan {
    mode: FoundationMode;
    targetY: number;
    maximumFillDepth: number;
    changes: readonly ConstructionChange[];
    materials: readonly BlueprintMaterialNeed[];
    rationale: readonly string[];
}

export interface ConstructionDependency {
    key: string;
    phase: ConstructionPhase;
    dependsOn: readonly string[];
}

export interface ConstructionGraph {
    dependencies: readonly ConstructionDependency[];
    order: readonly string[];
}

export interface ConstructionScaffold {
    position: Vec3;
    stateName: string;
    targetKeys: readonly string[];
    removalPhase: ConstructionPhase;
}

export interface PlannedWorkPackage extends BlueprintWorkPackage {
    phase: ConstructionPhase;
    materials: readonly BlueprintMaterialNeed[];
    scaffoldPositions: readonly Vec3[];
    predecessorIds: readonly string[];
}

export interface ConstructionPlan {
    id: string;
    blueprintId: string;
    anchor: Vec3;
    rotation: BlueprintRotation;
    translation: Vec3;
    site: SitePlan;
    foundation: FoundationPlan;
    changes: readonly ConstructionChange[];
    order: readonly string[];
    dependencies: readonly ConstructionDependency[];
    scaffolds: readonly ConstructionScaffold[];
    unreachable: readonly BlueprintBlock[];
    phases: readonly ConstructionPhase[];
    materials: readonly BlueprintMaterialNeed[];
    workPackages: readonly PlannedWorkPackage[];
}
