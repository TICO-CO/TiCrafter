import type {
    ActionOutcome,
    ActionRequest,
    HostileThreatObservation,
    Result,
    Vec3,
} from '@ticrafter/core';

export type SkillStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export type SkillFailureClass =
    | 'invalid-input'
    | 'unsupported'
    | 'unsafe'
    | 'no-path'
    | 'missing-item'
    | 'missing-tool'
    | 'target-missing'
    | 'timeout'
    | 'preempted'
    | 'cancelled'
    | 'execution-failed';

export interface SkillFailure {
    class: SkillFailureClass;
    message: string;
}

export interface SkillInventoryItem {
    name: string;
    count: number;
}

export interface SkillHostile extends HostileThreatObservation {
    entityId?: number;
}

export interface SkillBBox {
    min: Vec3;
    max: Vec3;
}

export interface SkillBlockState {
    name: string;
    properties: Record<string, string>;
}

export interface SkillBlock extends SkillBlockState {
    position: Vec3;
}

export interface SkillBuildTarget {
    position: Vec3;
    itemName: string;
    expectedBlockId?: string;
    properties?: Readonly<Record<string, string>>;
}

export type SkillConstructionPhase =
    | 'site-clear'
    | 'foundation'
    | 'scaffold'
    | 'walls'
    | 'floors'
    | 'roof'
    | 'openings'
    | 'access'
    | 'interior'
    | 'decoration'
    | 'scaffold-removal'
    | 'cleanup';

export interface SkillConstructionOperation {
    kind: 'place' | 'break';
    target: SkillBuildTarget;
    claimId?: string;
    grantId?: string;
    grant?: SkillGrant;
    grantFencingToken?: number;
    planId?: string;
    structureId?: string;
    blueprintId?: string;
    blueprintRevision?: number;
    workPackageId?: string;
    fencingToken?: number;
    phase?: SkillConstructionPhase;
}

export interface SkillConstructionPlan {
    blueprintId: string;
    blueprintRevision: number;
    planId: string;
    planRevision: number;
    workPackageId: string;
    phase: SkillConstructionPhase | null;
    operations: readonly SkillConstructionOperation[];
    scaffoldPositions: readonly Vec3[];
}

export interface SkillBuildPreparation {
    status: 'ready' | 'skipped';
    action: ActionRequest | null;
}

export interface SkillMaterialNeed {
    item: string;
    count: number;
}

export type SkillProcurementAction =
    | { kind: 'withdraw'; container: Vec3; item: string; count: number }
    | { kind: 'craft'; item: string; count: number; ingredients: readonly SkillMaterialNeed[] }
    | { kind: 'gather'; item: string; count: number; source: string }
    | { kind: 'smelt'; item: string; count: number; input: string; fuel: string };

export interface SkillProcurementPlan {
    actions: readonly SkillProcurementAction[];
    shortages: readonly SkillMaterialNeed[];
    blocked: boolean;
}

export interface SkillProcurementPort {
    plan(input: {
        needs: readonly SkillMaterialNeed[];
        inventory: readonly SkillInventoryItem[];
        position: Vec3;
    }): Result<SkillProcurementPlan, string>;
    record?(input: { action: SkillProcurementAction; status: 'completed' | 'failed' }): void;
}

export interface SkillGrant {
    id: string;
    expiresAt?: string;
    fencingToken?: number;
}

export interface SkillSchematicRef {
    id: string;
    anchor: Vec3;
    revision?: number;
    rotation?: number;
}

export interface SkillFarmPlot {
    id: string;
    bbox: SkillBBox;
    cropBlockIds?: readonly string[];
    seedItem?: string;
}

export interface SkillRepairDiff {
    missing: readonly SkillBuildTarget[];
    extra: readonly Vec3[];
    mismatched: readonly SkillBuildTarget[];
}

export interface SkillSpatialPort {
    isProtected(position: Vec3): Result<boolean, string>;
    route(from: Vec3, to: Vec3): Result<readonly Vec3[] | null, string>;
}

export interface SkillGrantPort {
    validate(grant: SkillGrant, botId: string): Result<boolean, string>;
}

export interface SkillFarmPlotSource {
    getPlot(plotId: string): Result<SkillFarmPlot | null, string>;
}

export interface SkillBlueprintSource {
    targets(input: SkillInput): Result<readonly SkillBuildTarget[], string>;
}

export interface SkillSchematicPipeline {
    prepare(reference: SkillSchematicRef): Result<readonly SkillBuildTarget[], string>;
}

export interface SkillRepairDiffSource {
    diff(input: SkillInput): Result<SkillRepairDiff, string>;
}

export interface SkillConstructionSource {
    resolve(context: SkillContext, input: SkillInput): Result<SkillConstructionPlan, string>;
}

export interface SkillBuildExecutionPort {
    prepare(
        context: SkillContext,
        operation: SkillConstructionOperation,
    ): Result<SkillBuildPreparation, string>;
    complete(
        context: SkillContext,
        operation: SkillConstructionOperation,
        action: ActionOutcome,
    ): Result<void, string>;
}

export interface SkillServices {
    spatial?: SkillSpatialPort;
    grants?: SkillGrantPort;
    farms?: SkillFarmPlotSource;
    blueprints?: SkillBlueprintSource;
    schematics?: SkillSchematicPipeline;
    repairDiff?: SkillRepairDiffSource;
    construction?: SkillConstructionSource;
    buildExecution?: SkillBuildExecutionPort;
    procurement?: SkillProcurementPort;
}

export interface SkillWorldView {
    blockAt(position: Vec3): string | null;
    nearestContainer(maxDistance: number): Vec3 | null;
    blockStateAt?(position: Vec3): SkillBlockState | null;
    blocksInBox?(bbox: SkillBBox): readonly SkillBlock[];
    nearestBlock?(names: readonly string[], maxDistance: number): Vec3 | null;
    entities?(): readonly { id?: number; name: string; position: Vec3 }[];
}

export interface SkillContext {
    botId: string;
    taskId?: string;
    at: string;
    position: Vec3;
    health: number;
    food: number;
    timeOfDay?: number;
    isSleeping?: boolean;
    inventory: readonly SkillInventoryItem[];
    world: SkillWorldView;
    hostiles: readonly SkillHostile[];
    nearestHostile: SkillHostile | null;
    services?: SkillServices;
    lastAction: ActionOutcome | null;
}

export interface SkillInput {
    target?: Vec3;
    waypoints?: readonly Vec3[];
    itemName?: string;
    count?: number;
    radius?: number;
    range?: number;
    threshold?: number;
    container?: Vec3;
    taskId?: string;
    blocks?: readonly SkillBuildTarget[];
    blockIds?: readonly string[];
    bbox?: SkillBBox;
    material?: string;
    direction?: Vec3;
    end?: Vec3;
    width?: number;
    maxLength?: number;
    furnace?: Vec3;
    fuelItem?: string;
    outputItem?: string;
    bed?: Vec3;
    center?: Vec3;
    maxSteps?: number;
    seedItem?: string;
    maintainWater?: boolean;
    plot?: SkillFarmPlot;
    plotId?: string;
    schematic?: SkillSchematicRef;
    grant?: SkillGrant;
    blueprintId?: string;
    blueprintRevision?: number;
    workPackageId?: string;
    structureId?: string;
    planId?: string;
    planRevision?: number;
    claimId?: string;
    fencingToken?: number;
    grantFencingToken?: number;
}

export interface SkillProgress {
    done: number;
    total: number;
    label: string;
}

export interface SkillRun {
    skillId: string;
    state: Record<string, unknown>;
}

export interface SkillStep {
    run: SkillRun;
    status: SkillStatus;
    action: ActionRequest | null;
    progress: SkillProgress;
    failure: SkillFailure | null;
}

export interface SkillCheckpoint {
    botId: string;
    taskId: string;
    skillId: string;
    state: Record<string, unknown>;
    updatedAt: string;
}

export interface Skill {
    id: string;
    canRun(context: SkillContext, input: SkillInput): Result<boolean, string>;
    plan(context: SkillContext, input: SkillInput): Result<SkillInput, string>;
    start(context: SkillContext, input: SkillInput): Result<SkillStep, string>;
    step(context: SkillContext, run: SkillRun): Result<SkillStep, string>;
    cancel(context: SkillContext, run: SkillRun, reason: string): Result<SkillStep, string>;
    checkpoint(context: SkillContext, run: SkillRun): Result<SkillCheckpoint, string>;
    restore(context: SkillContext, checkpoint: SkillCheckpoint): Result<SkillRun, string>;
}

export interface SkillContextSource {
    read(): Result<Omit<SkillContext, 'lastAction'>, string>;
}

export interface SkillProgressEvent {
    botId: string;
    taskId?: string;
    at: string;
    skillId: string;
    status: SkillStatus;
    progress: SkillProgress;
    failureClass?: string;
}

export interface SkillProgressSink {
    report(event: SkillProgressEvent): Result<void, string>;
}
