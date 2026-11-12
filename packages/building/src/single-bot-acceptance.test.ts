import type { ActionOutcome, ActionRequest, Result, Vec3 } from '@ticrafter/core';
import type { SafetyDecision, SafetySnapshot } from '@ticrafter/safety';
import { describe, expect, it } from 'bun:test';

import type { BuildingClock } from './block-executor.js';
import { BlockExecutor } from './block-executor.js';
import { type BlockChange, BlockVerifier } from './block-verifier.js';
import { BlueprintComposer } from './blueprint-composer.js';
import type { BuildingBrief } from './blueprint-document.js';
import type { Blueprint } from './blueprint-ir.js';
import { BlueprintSupportValidator } from './blueprint-support.js';
import { BlueprintValidator } from './blueprint-validator.js';
import { ConstructionPlanPlanner } from './construction-plan-planner.js';
import type { ConstructionPlan } from './construction-types.js';
import type { BuildingFailure } from './failures.js';
import { FoundationPlanner } from './foundation-planner.js';
import {
    type BlockChangelogPort,
    type BlockChangeRecord,
    RollbackJournal,
} from './rollback-journal.js';
import { RollbackPlanPlanner } from './rollback-plan-planner.js';
import type { WorldBlockQueryPort, WorldBlockState } from './schematic-diff.js';
import type { SiteConstraintPort } from './site-evaluator.js';
import { SitePlanner } from './site-planner.js';

type GroundHeight = (x: number, z: number) => number | null;

class MutableWorld implements WorldBlockQueryPort {
    private readonly changes = new Map<string, WorldBlockState>();

    constructor(private readonly ground: GroundHeight = () => 63) {}

    blockAt(position: Vec3): Result<WorldBlockState | null, BuildingFailure> {
        const placed = this.changes.get(MutableWorld.key(position));
        if (placed !== undefined) return [placed, null];
        const height = this.ground(position.x, position.z);
        if (height !== null && position.y <= height) return [{ name: 'stone' }, null];
        return [null, null];
    }

    blocksInBox(bounds: {
        min: Vec3;
        max: Vec3;
    }): Result<readonly { name: string; position: Vec3 }[], BuildingFailure> {
        const blocks: { name: string; position: Vec3 }[] = [];
        for (let x = bounds.min.x; x <= bounds.max.x; x += 1) {
            for (let z = bounds.min.z; z <= bounds.max.z; z += 1) {
                const height = this.ground(x, z);
                if (height === null) continue;
                for (let y = bounds.min.y; y <= Math.min(bounds.max.y, height); y += 1) {
                    blocks.push({ name: 'stone', position: { x, y, z } });
                }
            }
        }
        for (const [key, state] of this.changes) {
            const [x, y, z] = key.split(',').map(Number);
            if (
                x === undefined ||
                y === undefined ||
                z === undefined ||
                x < bounds.min.x ||
                x > bounds.max.x ||
                y < bounds.min.y ||
                y > bounds.max.y ||
                z < bounds.min.z ||
                z > bounds.max.z
            ) {
                continue;
            }
            blocks.push({ name: state.name, position: { x, y, z } });
        }
        return [blocks, null];
    }

    set(position: Vec3, state: WorldBlockState): void {
        this.changes.set(MutableWorld.key(position), state);
    }

    remove(position: Vec3): void {
        this.changes.delete(MutableWorld.key(position));
    }

    stateAt(position: Vec3): WorldBlockState | null {
        return this.blockAt(position)[0];
    }

    private static key(position: Vec3): string {
        return `${position.x},${position.y},${position.z}`;
    }
}

class MutatingDispatcher {
    readonly requests: ActionRequest[] = [];

    constructor(private readonly world: MutableWorld) {}

    dispatch(request: ActionRequest): Result<string, string> {
        if (request.kind === 'place-block') {
            this.world.set(request.position, {
                name: request.itemName,
                ...(request.properties === undefined ? {} : { properties: request.properties }),
            });
        } else if (request.kind === 'break-block') {
            this.world.remove(request.position);
        } else {
            return [null, `unsupported acceptance action ${request.kind}`];
        }
        this.requests.push(request);
        return [`handle-${this.requests.length}`, null];
    }

    poll(): Result<ActionOutcome | null, string> {
        return [null, null];
    }

    cancel(): Result<void, string> {
        return [undefined, null];
    }
}

class FakeSafety {
    allowed = true;

    evaluate(): SafetyDecision {
        if (this.allowed) return { allowed: true, signals: [] };
        return {
            allowed: false,
            reason: 'acceptance veto',
            signals: [],
            recovery: { kind: 'retry-local', reason: 'acceptance veto' },
        };
    }
}

class FakeClock implements BuildingClock {
    now(): number {
        return 0;
    }
}

class FakeWriter implements BlockChangelogPort {
    readonly records: BlockChangeRecord[] = [];

    append(record: BlockChangeRecord): Result<number, string> {
        this.records.push(record);
        return [this.records.length, null];
    }
}

class ProtectedRules implements SiteConstraintPort {
    isProtected(): Result<boolean, BuildingFailure> {
        return [true, null];
    }

    intersectsActiveStructure(): Result<boolean, BuildingFailure> {
        return [false, null];
    }
}

const SNAPSHOT: SafetySnapshot = {
    botId: 'bot.builder',
    at: '2026-11-12T12:00:00.000Z',
    position: { x: 0, y: 64, z: 0 },
    health: 20,
    food: 20,
    oxygen: 20,
    onGround: true,
    stuckMilliseconds: 0,
    targetUnreachableMilliseconds: 0,
    inventory: [],
    inventoryUsedSlots: 0,
    inventoryTotalSlots: 36,
    hostiles: [],
    activeSkillId: 'construction',
    claimTrackingEnabled: true,
    allowDestructiveMaterials: false,
    world: {
        blockAt: () => null,
        isProtected: () => false,
        activeBots: () => [],
        claimFor: () => null,
        claims: () => [],
        grants: () => [],
    },
};

function createExecutor(world: MutableWorld, safety = new FakeSafety()) {
    const writer = new FakeWriter();
    const journal = new RollbackJournal(writer);
    const dispatcher = new MutatingDispatcher(world);
    const executor = new BlockExecutor(new BlockVerifier(world), dispatcher, safety, journal, {
        clock: new FakeClock(),
        rateLimitMilliseconds: 0,
    });
    return { executor, writer, dispatcher, safety };
}

function executeChanges(
    executor: BlockExecutor,
    changes: readonly BlockChange[],
): Result<number, BuildingFailure> {
    let applied = 0;
    for (const change of changes) {
        const [begin, beginError] = executor.begin(change, SNAPSHOT);
        if (beginError) return [null, beginError];
        if (begin === null) return [null, { type: 'ACTION_REJECTED', message: 'missing begin' }];
        if (begin.status === 'skipped' || begin.execution === null) continue;
        const [completion, completionError] = executor.complete(begin.execution, {
            request: begin.execution.action,
            status: 'completed',
        });
        if (completionError) return [null, completionError];
        if (completion === null) {
            return [null, { type: 'ACTION_REJECTED', message: 'missing completion' }];
        }
        applied += 1;
    }
    return [applied, null];
}

function houseBrief(): BuildingBrief {
    return {
        kind: 'house',
        size: { width: 9, depth: 7, storeys: 2 },
        program: {
            rooms: [
                { kind: 'main', count: 1, minimumSize: 3 },
                { kind: 'storage', count: 1, minimumSize: 2 },
            ],
            amenities: ['bed', 'chest', 'crafting_table', 'furnace', 'torch'],
        },
        style: {
            palette: 'oak_and_cobblestone',
            roof: 'gable',
            symmetry: 0.8,
            decoration: 0.5,
        },
        site: {
            anchor: { x: 0, y: 0, z: 0 },
            rotation: 0,
            maximumSlope: 3,
            connection: 'path',
        },
        seed: 1847,
    };
}

function towerBlueprint(): Blueprint {
    const blocks = Array.from({ length: 13 }, (_, y) => ({
        x: 0,
        y,
        z: 0,
        state: { name: 'stone' },
        priority: y === 0 ? 0 : 1,
    }));
    return {
        id: 'blueprint.acceptance-tower',
        anchor: { x: 0, y: 0, z: 0 },
        rotation: 0,
        blocks,
        materials: [{ item: 'stone', count: blocks.length }],
        constraints: [],
    };
}

function planChanges(plan: ConstructionPlan): readonly BlockChange[] {
    return plan.changes.map((change) => ({
        kind: change.kind,
        botId: 'bot.builder',
        target: change.block,
        planId: plan.id,
        blueprintId: plan.blueprintId,
        blueprintRevision: 1,
        workPackageId: `${plan.id}:acceptance`,
        structureId: 'structure.acceptance',
        fencingToken: 1,
        phase: change.phase,
    }));
}

function changeAt(plan: ConstructionPlan, position: Vec3): BlockChange {
    return {
        kind: 'place',
        botId: 'bot.builder',
        target: {
            ...position,
            state: { name: 'dirt' },
            priority: 0,
        },
        planId: plan.id,
        blueprintId: plan.blueprintId,
        blueprintRevision: 1,
        workPackageId: `${plan.id}:cleanup`,
        structureId: 'structure.acceptance',
        fencingToken: 1,
        phase: 'cleanup',
    };
}

function scaffoldBreak(plan: ConstructionPlan, position: Vec3, name: string): BlockChange {
    return {
        ...changeAt(plan, position),
        target: { ...position, state: { name }, priority: 0 },
        kind: 'break',
    };
}

describe('single-bot building acceptance', () => {
    it('arbitrary-house builds and stays idempotent', () => {
        const world = new MutableWorld();
        const [blueprint, composeError] = new BlueprintComposer().compose({
            id: 'blueprint.acceptance-house',
            brief: houseBrief(),
        });
        expect(composeError).toBeNull();
        expect(blueprint).not.toBeNull();
        if (blueprint === null) return;

        const [site, siteError] = new SitePlanner({ world }).plan(
            blueprint,
            { x: 20, y: 64, z: 20 },
            {
                requestedAnchor: { x: 20, y: 64, z: 20 },
                candidateRadius: 0,
                maximumSlope: 2,
                connection: 'path',
            },
        );
        expect(siteError).toBeNull();
        expect(site).not.toBeNull();
        if (site === null) return;

        const [plan, planError] = new ConstructionPlanPlanner({
            maxBlocks: 64,
            planId: 'plan.acceptance-house',
        }).plan(blueprint, site, world, { x: 20, y: 64, z: 20 });
        expect(planError).toBeNull();
        expect(plan).not.toBeNull();
        if (plan === null) return;

        const packageKeys = plan.workPackages.flatMap((workPackage) => workPackage.blockKeys);
        expect(packageKeys).toHaveLength(plan.changes.length);
        expect(new Set(packageKeys).size).toBe(plan.changes.length);

        const { executor, writer } = createExecutor(world);
        const [applied, applyError] = executeChanges(executor, planChanges(plan));
        expect(applyError).toBeNull();
        expect(applied).toBe(plan.changes.length);

        const recordsAfterBuild = writer.records.length;
        const [reapplied, reapplyError] = executeChanges(executor, planChanges(plan));
        expect(reapplyError).toBeNull();
        expect(reapplied).toBe(0);
        expect(writer.records).toHaveLength(recordsAfterBuild);

        for (const block of blueprint.blocks) {
            const position = {
                x: block.x + site.translation.x,
                y: block.y + site.translation.y,
                z: block.z + site.translation.z,
            };
            expect(world.stateAt(position)?.name).toBe(block.state.name);
        }

        const cleanup = [...plan.scaffolds]
            .sort((left, right) => right.position.y - left.position.y)
            .map((scaffold) => scaffoldBreak(plan, scaffold.position, scaffold.stateName));
        const [removed, cleanupError] = executeChanges(executor, cleanup);
        expect(cleanupError).toBeNull();
        expect(removed).toBe(plan.scaffolds.length);
        for (const scaffold of plan.scaffolds) {
            expect(world.stateAt(scaffold.position)).toBeNull();
        }
    });

    it('uneven-terrain adapts the site and fills the foundation', () => {
        const world = new MutableWorld((x, z) => 62 + ((x + z) % 3));
        const [blueprint, composeError] = new BlueprintComposer().compose({
            id: 'blueprint.acceptance-uneven',
            brief: houseBrief(),
        });
        expect(composeError).toBeNull();
        if (blueprint === null) return;
        const original = JSON.stringify(blueprint.blocks);

        const [site, siteError] = new SitePlanner({ world }).plan(
            blueprint,
            { x: 20, y: 70, z: 20 },
            {
                requestedAnchor: { x: 20, y: 70, z: 20 },
                candidateRadius: 4,
                maximumSlope: 3,
                connection: 'path',
            },
        );
        expect(siteError).toBeNull();
        expect(site).not.toBeNull();
        if (site === null) return;
        expect(site.foundationFillDepth > 0).toBe(true);
        expect(JSON.stringify(blueprint.blocks)).toBe(original);

        const [foundation, foundationError] = new FoundationPlanner().plan(blueprint, site, world);
        expect(foundationError).toBeNull();
        expect((foundation?.changes.length ?? 0) > 0).toBe(true);

        const [plan, planError] = new ConstructionPlanPlanner({
            maxBlocks: 64,
            planId: 'plan.acceptance-uneven',
        }).plan(blueprint, site, world, { x: 20, y: 70, z: 20 });
        expect(planError).toBeNull();
        if (plan === null) return;

        const { executor } = createExecutor(world);
        const [applied, applyError] = executeChanges(executor, planChanges(plan));
        expect(applyError).toBeNull();
        expect(applied).toBe(plan.changes.length);
        for (const block of blueprint.blocks) {
            const position = {
                x: block.x + site.translation.x,
                y: block.y + site.translation.y,
                z: block.z + site.translation.z,
            };
            expect(world.stateAt(position)?.name).toBe(block.state.name);
        }
        for (const change of foundation?.changes ?? []) {
            expect(world.stateAt(change.block)?.name).toBe(change.block.state.name);
        }
    });

    it('scaffold-tower uses a supported stack and cleans up top-down', () => {
        const world = new MutableWorld();
        const blueprint = towerBlueprint();
        const [validated, validationError] = BlueprintValidator.validate(blueprint);
        expect(validationError).toBeNull();
        expect(validated).not.toBeNull();
        if (validated === null) return;
        const [, supportError] = BlueprintSupportValidator.validate(validated);
        expect(supportError).toBeNull();

        const [site, siteError] = new SitePlanner({ world }).plan(
            validated,
            { x: 0, y: 64, z: 0 },
            {
                requestedAnchor: { x: 0, y: 64, z: 0 },
                candidateRadius: 0,
                maximumSlope: 0,
                connection: 'none',
            },
        );
        expect(siteError).toBeNull();
        if (site === null) return;

        const [plan, planError] = new ConstructionPlanPlanner({
            maxBlocks: 64,
            planId: 'plan.acceptance-tower',
        }).plan(validated, site, world, { x: 0, y: 64, z: 0 });
        expect(planError).toBeNull();
        expect(plan).not.toBeNull();
        if (plan === null) return;
        expect(plan.scaffolds.length > 1).toBe(true);

        const { executor } = createExecutor(world);
        const [applied, applyError] = executeChanges(executor, planChanges(plan));
        expect(applyError).toBeNull();
        expect(applied).toBe(plan.changes.length);

        for (const scaffold of plan.scaffolds) {
            const support = world.stateAt({
                x: scaffold.position.x,
                y: scaffold.position.y - 1,
                z: scaffold.position.z,
            });
            expect(support).not.toBeNull();
        }

        const cleanup = [...plan.scaffolds]
            .sort((left, right) => right.position.y - left.position.y)
            .map((scaffold) => scaffoldBreak(plan, scaffold.position, scaffold.stateName));
        const [removed, cleanupError] = executeChanges(executor, cleanup);
        expect(cleanupError).toBeNull();
        expect(removed).toBe(plan.scaffolds.length);
        for (const scaffold of plan.scaffolds) {
            expect(world.stateAt(scaffold.position)).toBeNull();
        }
        for (const block of validated.blocks) {
            expect(
                world.stateAt({
                    x: block.x + site.translation.x,
                    y: block.y + site.translation.y,
                    z: block.z + site.translation.z,
                }),
            ).not.toBeNull();
        }
    });

    it('rolls back a failed package from the journal', () => {
        const world = new MutableWorld();
        const blueprint = towerBlueprint();
        const [site, siteError] = new SitePlanner({ world }).plan(
            blueprint,
            { x: 0, y: 64, z: 0 },
            {
                requestedAnchor: { x: 0, y: 64, z: 0 },
                candidateRadius: 0,
                maximumSlope: 0,
                connection: 'none',
            },
        );
        expect(siteError).toBeNull();
        if (site === null) return;
        const [plan, planError] = new ConstructionPlanPlanner({
            maxBlocks: 64,
            planId: 'plan.acceptance-rollback',
        }).plan(blueprint, site, world, { x: 0, y: 64, z: 0 });
        expect(planError).toBeNull();
        if (plan === null) return;

        const { executor, writer } = createExecutor(world);
        const partial = planChanges(plan).slice(0, 4);
        const initial = partial.map((change) => ({
            position: { x: change.target.x, y: change.target.y, z: change.target.z },
            state: world.stateAt({
                x: change.target.x,
                y: change.target.y,
                z: change.target.z,
            }),
        }));
        const [applied, applyError] = executeChanges(executor, partial);
        expect(applyError).toBeNull();
        expect(applied).toBe(4);
        expect(writer.records).toHaveLength(4);
        const appliedRecords = [...writer.records];

        const [rollback, rollbackError] = new RollbackPlanPlanner({
            planId: 'plan.acceptance-rollback:reverse',
        }).plan(
            plan,
            writer.records.map((record) => ({
                position: record.position,
                before: record.before,
                after: record.after,
            })),
        );
        expect(rollbackError).toBeNull();
        expect(rollback).not.toBeNull();
        if (rollback === null) return;

        const [reversed, reverseError] = executeChanges(executor, planChanges(rollback));
        expect(reverseError).toBeNull();
        expect(reversed).toBe(rollback.changes.length);
        for (const entry of initial) {
            expect(world.stateAt(entry.position)).toEqual(entry.state);
        }
        for (const record of appliedRecords) {
            expect(record.planId).toBe('plan.acceptance-rollback');
            expect(record.structureId).toBe('structure.acceptance');
            expect(record.fencingToken).toBe(1);
            expect(record.phase === undefined).toBe(false);
        }
    });

    it('rejects protected sites and vetoed block changes', () => {
        const world = new MutableWorld();
        const blueprint = towerBlueprint();
        const [protectedSite, protectedError] = new SitePlanner({
            world,
            constraints: new ProtectedRules(),
        }).plan(
            blueprint,
            { x: 0, y: 64, z: 0 },
            {
                requestedAnchor: { x: 0, y: 64, z: 0 },
                candidateRadius: 0,
                maximumSlope: 0,
                connection: 'none',
            },
        );
        expect(protectedSite).toBeNull();
        expect(protectedError?.type).toBe('SITE_REJECTED');

        const { executor, writer, safety } = createExecutor(world);
        safety.allowed = false;
        const change: BlockChange = {
            kind: 'place',
            botId: 'bot.builder',
            target: { x: 0, y: 64, z: 0, state: { name: 'stone' }, priority: 0 },
            structureId: 'structure.acceptance',
        };
        const [begin, beginError] = executor.begin(change, SNAPSHOT);
        expect(begin).toBeNull();
        expect(beginError?.type).toBe('SAFETY_VETO');
        expect(writer.records).toHaveLength(0);
        expect(world.stateAt({ x: 0, y: 64, z: 0 })).toBeNull();
    });
});
