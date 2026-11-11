import type { ActionOutcome, ActionRequest, Result, Vec3 } from '@ticrafter/core';

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

export interface SkillHostile {
    entityId?: number;
    name: string;
    position: Vec3;
    distance: number;
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
}

export interface SkillGrant {
    id: string;
    expiresAt?: string;
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

export interface SkillServices {
    spatial?: SkillSpatialPort;
    grants?: SkillGrantPort;
    farms?: SkillFarmPlotSource;
    blueprints?: SkillBlueprintSource;
    schematics?: SkillSchematicPipeline;
    repairDiff?: SkillRepairDiffSource;
}

export interface SkillWorldView {
    blockAt(position: Vec3): string | null;
    nearestContainer(maxDistance: number): Vec3 | null;
    blockStateAt?(position: Vec3): SkillBlockState | null;
    blocksInBox?(bbox: SkillBBox): readonly SkillBlock[];
    nearestBlock?(names: readonly string[], maxDistance: number): Vec3 | null;
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
