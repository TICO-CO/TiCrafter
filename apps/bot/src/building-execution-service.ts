import {
    type BlockChange,
    type BlockChangelogPort,
    type BlockChangeRecord,
    BlockExecutor,
    BlockVerifier,
    type BuildingFailure,
    type PositionedWorldBlock,
    RollbackJournal,
    type WorldBlockQueryPort,
    type WorldBlockState,
} from '@ticrafter/building';
import type {
    ActionDispatchPort,
    ActionOutcome,
    ActionRequest,
    BlockUpdateAttribution,
    Result,
} from '@ticrafter/core';
import type { SafetyDecision, SafetySnapshot } from '@ticrafter/safety';
import type {
    SkillBuildExecutionPort,
    SkillBuildPreparation,
    SkillConstructionOperation,
    SkillContext,
} from '@ticrafter/skills';

import type { WorldCacheAdapter } from './world-cache.js';

class BotBuildingWorld implements WorldBlockQueryPort {
    constructor(private readonly world: WorldCacheAdapter) {}

    blockAt(position: {
        x: number;
        y: number;
        z: number;
    }): Result<WorldBlockState | null, BuildingFailure> {
        return [this.world.blockStateAt(position), null];
    }

    blocksInBox(bounds: {
        min: { x: number; y: number; z: number };
        max: { x: number; y: number; z: number };
    }): Result<readonly PositionedWorldBlock[], BuildingFailure> {
        const blocks = this.world.blocksInBox(bounds).map((block) => ({
            name: block.name,
            properties: block.properties,
            position: block.position,
        }));
        return [blocks, null];
    }
}

class UnavailableDispatcher implements ActionDispatchPort {
    dispatch(): Result<string, string> {
        return [null, 'building execution dispatch is handled by the skill host'];
    }

    poll(): Result<ActionOutcome | null, string> {
        return [null, 'building execution polling is unavailable'];
    }

    cancel(): Result<void, string> {
        return [null, 'building execution cancellation is unavailable'];
    }
}

class MemoryBlockChangelog implements BlockChangelogPort {
    private readonly records: BlockChangeRecord[] = [];

    append(record: BlockChangeRecord): Result<number, string> {
        this.records.push(record);
        return [this.records.length, null];
    }

    list(): readonly BlockChangeRecord[] {
        return this.records;
    }
}

interface PositionedAttribution {
    attribution: BlockUpdateAttribution;
    expiresAt: number;
}

const ATTRIBUTION_TTL_MILLISECONDS = 60_000;

export interface BuildingExecutionServiceOptions {
    world: WorldCacheAdapter;
    snapshot: () => Result<SafetySnapshot, string>;
    safety: { evaluate(request: ActionRequest): SafetyDecision };
    clock?: { now(): number };
}

export class BuildingExecutionService implements SkillBuildExecutionPort {
    private readonly verifier: BlockVerifier;
    private readonly journal: MemoryBlockChangelog;
    private readonly executor: BlockExecutor;
    private readonly attributions = new Map<string, PositionedAttribution>();

    constructor(private readonly options: BuildingExecutionServiceOptions) {
        this.verifier = new BlockVerifier(new BotBuildingWorld(options.world));
        this.journal = new MemoryBlockChangelog();
        const journal = new RollbackJournal(this.journal);
        const safety = {
            evaluate: (_snapshot: SafetySnapshot, request: ActionRequest): SafetyDecision =>
                options.safety.evaluate(request),
        };
        this.executor = new BlockExecutor(
            this.verifier,
            new UnavailableDispatcher(),
            safety,
            journal,
            options.clock === undefined ? {} : { clock: options.clock },
        );
    }

    prepare(
        context: SkillContext,
        operation: SkillConstructionOperation,
    ): Result<SkillBuildPreparation, string> {
        const validationError = this.validate(operation);
        if (validationError !== null) return [null, validationError];
        const [snapshot, snapshotError] = this.options.snapshot();
        if (snapshotError) return [null, snapshotError];
        if (snapshot === null) return [null, 'safety snapshot returned null'];
        const change = this.changeFor(context, operation);
        const [prepared, prepareError] = this.executor.prepare(change, snapshot);
        if (prepareError) return [null, BuildingExecutionService.describe(prepareError)];
        if (prepared === null) return [null, 'block prepare returned null'];
        if (prepared.status === 'skipped' || prepared.execution === null) {
            return [{ status: 'skipped', action: null }, null];
        }
        this.remember(context, operation, change);
        return [{ status: 'ready', action: prepared.execution.action }, null];
    }

    complete(
        context: SkillContext,
        operation: SkillConstructionOperation,
        action: ActionOutcome,
    ): Result<void, string> {
        const change = this.changeFor(context, operation);
        const [completion, completionError] = this.executor.complete(
            {
                change,
                action: action.request,
                before: null,
            },
            action,
        );
        if (completionError) return [null, BuildingExecutionService.describe(completionError)];
        if (completion === null) return [null, 'block completion returned null'];
        this.remember(context, operation, change);
        return [undefined, null];
    }

    get changelog(): readonly BlockChangeRecord[] {
        return this.journal.list();
    }

    attributionFor(position: { x: number; y: number; z: number }): BlockUpdateAttribution | null {
        const key = BuildingExecutionService.key(position);
        const entry = this.attributions.get(key);
        if (entry === undefined) return null;
        if (entry.expiresAt < Date.now()) {
            this.attributions.delete(key);
            return null;
        }
        return entry.attribution;
    }

    private remember(
        context: SkillContext,
        operation: SkillConstructionOperation,
        change: BlockChange,
    ): void {
        this.attributions.set(BuildingExecutionService.key(change.target), {
            attribution: {
                ...(change.structureId === undefined ? {} : { structureId: change.structureId }),
                ...(context.taskId === undefined ? {} : { taskId: context.taskId }),
                ...(change.claimId === undefined ? {} : { claimId: change.claimId }),
                ...(change.grantId === undefined ? {} : { grantId: change.grantId }),
                ...(change.grantFencingToken === undefined
                    ? {}
                    : { grantFencingToken: change.grantFencingToken }),
                ...(change.blueprintId === undefined ? {} : { blueprintId: change.blueprintId }),
                ...(change.blueprintRevision === undefined
                    ? {}
                    : { blueprintRevision: change.blueprintRevision }),
                ...(change.workPackageId === undefined
                    ? {}
                    : { workPackageId: change.workPackageId }),
                ...(change.planId === undefined ? {} : { planId: change.planId }),
                ...(change.fencingToken === undefined ? {} : { fencingToken: change.fencingToken }),
                ...(operation.phase === undefined ? {} : { phase: operation.phase }),
            },
            expiresAt: Date.now() + ATTRIBUTION_TTL_MILLISECONDS,
        });
    }

    private static key(position: { x: number; y: number; z: number }): string {
        return `${position.x},${position.y},${position.z}`;
    }

    private validate(operation: SkillConstructionOperation): string | null {
        if (operation.claimId !== undefined && operation.fencingToken === undefined) {
            return 'claim fencing token is required';
        }
        if (operation.grantId !== undefined) {
            if (operation.grant === undefined || operation.grant.id !== operation.grantId) {
                return 'construction grant is invalid';
            }
            if (
                operation.grant.expiresAt !== undefined &&
                Date.parse(operation.grant.expiresAt) <= Date.now()
            ) {
                return 'construction grant is expired';
            }
            if (operation.grant.fencingToken === undefined) {
                return 'construction grant fencing token is required';
            }
            if (operation.grantFencingToken !== operation.grant.fencingToken) {
                return 'construction grant fencing token mismatch';
            }
        }
        return null;
    }

    private changeFor(context: SkillContext, operation: SkillConstructionOperation): BlockChange {
        const target = operation.target;
        return {
            kind: operation.kind,
            botId: context.botId,
            target: {
                x: target.position.x,
                y: target.position.y,
                z: target.position.z,
                state: {
                    name: target.expectedBlockId ?? target.itemName,
                    ...(target.properties === undefined ? {} : { properties: target.properties }),
                },
                priority: 0,
            },
            ...(operation.claimId === undefined ? {} : { claimId: operation.claimId }),
            ...(operation.grantId === undefined ? {} : { grantId: operation.grantId }),
            ...(operation.grantFencingToken === undefined
                ? {}
                : { grantFencingToken: operation.grantFencingToken }),
            ...(operation.planId === undefined ? {} : { planId: operation.planId }),
            ...(operation.structureId === undefined ? {} : { structureId: operation.structureId }),
            ...(operation.blueprintId === undefined ? {} : { blueprintId: operation.blueprintId }),
            ...(operation.blueprintRevision === undefined
                ? {}
                : { blueprintRevision: operation.blueprintRevision }),
            ...(operation.workPackageId === undefined
                ? {}
                : { workPackageId: operation.workPackageId }),
            ...(operation.fencingToken === undefined
                ? {}
                : { fencingToken: operation.fencingToken }),
            ...(operation.phase === undefined ? {} : { phase: operation.phase }),
        };
    }

    private static describe(failure: BuildingFailure): string {
        switch (failure.type) {
            case 'INVALID_BLUEPRINT':
            case 'INVALID_BLOCK':
            case 'INVALID_MATERIAL':
            case 'INVALID_CONSTRAINT':
            case 'PARSE_FAILED':
            case 'WORLD_QUERY_FAILED':
            case 'INVALID_PACKAGE':
            case 'UNREACHABLE':
            case 'ACTION_FAILED':
            case 'ACTION_REJECTED':
            case 'RATE_LIMITED':
            case 'JOURNAL_FAILED':
            case 'VERIFICATION_FAILED':
            case 'TEMPLATE_FAILED':
            case 'COMPOSE_FAILED':
            case 'OBSERVATION_FAILED':
            case 'SITE_REJECTED':
            case 'FOUNDATION_FAILED':
            case 'INVALID_CONSTRUCTION_PLAN':
                return failure.message;
            case 'INVALID_ROTATION':
                return `invalid blueprint rotation ${failure.value}`;
            case 'DUPLICATE_POSITION':
                return `duplicate block at ${failure.position.x},${failure.position.y},${failure.position.z}`;
            case 'PROTECTED_REGION':
                return `protected block at ${failure.position.x},${failure.position.y},${failure.position.z}`;
            case 'NO_BUILD_ZONE':
                return `no-build zone at ${failure.position.x},${failure.position.y},${failure.position.z}`;
            case 'UNKNOWN_TEMPLATE':
                return `unknown template ${failure.templateType}`;
            case 'UNSUPPORTED_FORMAT':
                return `unsupported format ${failure.format}`;
            case 'MISSING_MATERIALS':
                return `missing materials: ${failure.items.join(', ')}`;
            case 'SAFETY_VETO':
                return `safety veto: ${failure.reason}`;
            case 'UNSUPPORTED_SOURCE':
                return `unsupported source ${failure.source}`;
            case 'RAW_BLUEPRINTS_DISABLED':
                return 'raw blueprints are disabled';
            case 'STRUCTURAL_FAILURE':
                return `unsupported block at ${failure.position.x},${failure.position.y},${failure.position.z}`;
        }
    }
}
