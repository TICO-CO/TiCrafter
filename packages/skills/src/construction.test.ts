import type { ActionOutcome, ActionRequest, Result } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { ConstructionSkill } from './construction.js';
import type {
    SkillBuildExecutionPort,
    SkillBuildPreparation,
    SkillConstructionOperation,
    SkillConstructionPlan,
    SkillConstructionSource,
    SkillContext,
    SkillInput,
    SkillInventoryItem,
    SkillServices,
    SkillWorldView,
} from './types.js';

class FakeWorld implements SkillWorldView {
    blockAt(): string | null {
        return null;
    }

    nearestContainer(): null {
        return null;
    }
}

class FakeSource implements SkillConstructionSource {
    plan: SkillConstructionPlan | null = null;
    resolveError: string | null = null;
    readonly inputs: SkillInput[] = [];

    resolve(_context: SkillContext, input: SkillInput): Result<SkillConstructionPlan, string> {
        this.inputs.push(input);
        if (this.resolveError !== null) return [null, this.resolveError];
        if (this.plan === null) return [null, 'plan missing'];
        return [this.plan, null];
    }
}

class FakeExecution implements SkillBuildExecutionPort {
    readonly prepared: SkillConstructionOperation[] = [];
    readonly completedOperations: SkillConstructionOperation[] = [];
    skipPositions = new Set<string>();

    prepare(
        _context: SkillContext,
        operation: SkillConstructionOperation,
    ): Result<SkillBuildPreparation, string> {
        this.prepared.push(operation);
        const position = operation.target.position;
        if (this.skipPositions.has(`${position.x},${position.y},${position.z}`)) {
            return [{ status: 'skipped', action: null }, null];
        }
        return [
            {
                status: 'ready',
                action:
                    operation.kind === 'break'
                        ? {
                              kind: 'break-block',
                              position,
                              expectedBlockId: operation.target.expectedBlockId,
                          }
                        : {
                              kind: 'place-block',
                              position,
                              itemName: operation.target.itemName,
                          },
            },
            null,
        ];
    }

    complete(_context: SkillContext, operation: SkillConstructionOperation): Result<void, string> {
        this.completedOperations.push(operation);
        return [undefined, null];
    }
}

function operation(
    position: { x: number; y: number; z: number },
    kind: 'place' | 'break' = 'place',
): SkillConstructionOperation {
    return {
        kind,
        target: { position, itemName: 'oak_planks', expectedBlockId: 'oak_planks' },
    };
}

function plan(operations: readonly SkillConstructionOperation[]): SkillConstructionPlan {
    return {
        blueprintId: 'blueprint.home',
        blueprintRevision: 2,
        workPackageId: 'package.walls',
        phase: 'walls',
        operations,
        scaffoldPositions: [],
    };
}

function context(inventory: readonly SkillInventoryItem[], services: SkillServices): SkillContext {
    return {
        botId: 'bot.builder',
        at: '2026-11-12T12:00:00.000Z',
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        food: 20,
        inventory,
        world: new FakeWorld(),
        hostiles: [],
        nearestHostile: null,
        lastAction: null,
        services,
    };
}

function completed(request: ActionRequest): ActionOutcome {
    return { request, status: 'completed' };
}

describe('construction skill', () => {
    it('executes operations in order and completes', () => {
        const source = new FakeSource();
        const execution = new FakeExecution();
        source.plan = plan([operation({ x: 0, y: 64, z: 0 }), operation({ x: 0, y: 65, z: 0 })]);
        const skill = new ConstructionSkill();
        const services = { construction: source, buildExecution: execution };
        const input = { blueprintId: 'blueprint.home', blueprintRevision: 2 };
        const [started, startError] = skill.start(
            context([{ name: 'oak_planks', count: 2 }], services),
            input,
        );
        expect(startError).toBeNull();
        expect(started?.status).toBe('running');
        expect(started?.action).toMatchObject({ position: { x: 0, y: 64, z: 0 } });

        let step = started;
        while (step?.status === 'running') {
            const action = step.action;
            expect(action).not.toBeNull();
            if (action === null) return;
            const [next, stepError] = skill.step(
                {
                    ...context([{ name: 'oak_planks', count: 2 }], services),
                    lastAction: completed(action),
                },
                step.run,
            );
            expect(stepError).toBeNull();
            step = next;
        }
        expect(step?.status).toBe('completed');
        expect(execution.completedOperations).toHaveLength(2);
    });

    it('executes break operations before replacement placement', () => {
        const source = new FakeSource();
        const execution = new FakeExecution();
        source.plan = plan([
            operation({ x: 0, y: 64, z: 0 }, 'break'),
            operation({ x: 0, y: 64, z: 0 }),
        ]);
        const skill = new ConstructionSkill();
        const services = { construction: source, buildExecution: execution };
        const input = { blueprintId: 'blueprint.home', blueprintRevision: 2 };
        const [started] = skill.start(context([{ name: 'oak_planks', count: 1 }], services), input);
        expect(started?.action?.kind).toBe('break-block');
        if (started?.action === null || started?.action === undefined) return;
        const [next] = skill.step(
            {
                ...context([{ name: 'oak_planks', count: 1 }], services),
                lastAction: completed(started.action),
            },
            started.run,
        );
        expect(next?.action?.kind).toBe('place-block');
    });

    it('skips satisfied operations without counting them as completed', () => {
        const source = new FakeSource();
        const execution = new FakeExecution();
        execution.skipPositions.add('0,64,0');
        source.plan = plan([operation({ x: 0, y: 64, z: 0 }), operation({ x: 0, y: 65, z: 0 })]);
        const skill = new ConstructionSkill();
        const services = { construction: source, buildExecution: execution };
        const input = { blueprintId: 'blueprint.home', blueprintRevision: 2 };
        const [started] = skill.start(context([{ name: 'oak_planks', count: 2 }], services), input);
        expect(started?.action).toMatchObject({ position: { x: 0, y: 65, z: 0 } });

        if (started === null) return;
        const action = started.action;
        expect(action).not.toBeNull();
        if (action === null) return;
        const [completedStep] = skill.step(
            {
                ...context([{ name: 'oak_planks', count: 2 }], services),
                lastAction: completed(action),
            },
            started.run,
        );
        expect(completedStep?.status).toBe('completed');
    });

    it('fails before starting when materials are missing', () => {
        const source = new FakeSource();
        const execution = new FakeExecution();
        source.plan = plan([operation({ x: 0, y: 64, z: 0 })]);
        const skill = new ConstructionSkill();
        const services = { construction: source, buildExecution: execution };
        const [started] = skill.start(context([], services), {
            blueprintId: 'blueprint.home',
            blueprintRevision: 2,
        });
        expect(started?.status).toBe('failed');
        expect(started?.failure?.class).toBe('missing-item');
    });

    it('checkpoints metadata and restores by resolving a fresh plan', () => {
        const source = new FakeSource();
        const execution = new FakeExecution();
        source.plan = plan([operation({ x: 0, y: 64, z: 0 })]);
        const skill = new ConstructionSkill();
        const services = { construction: source, buildExecution: execution };
        const initial = context([{ name: 'oak_planks', count: 1 }], services);
        const input = { blueprintId: 'blueprint.home', blueprintRevision: 2 };
        const [started] = skill.start(initial, input);
        if (started === null) {
            expect(started).not.toBeNull();
            return;
        }
        const [checkpoint, checkpointError] = skill.checkpoint(initial, started.run);
        expect(checkpointError).toBeNull();
        expect(checkpoint?.state.blueprintId).toBe('blueprint.home');
        expect(checkpoint?.state.blueprintRevision).toBe(2);

        if (checkpoint === null) {
            expect(checkpoint).not.toBeNull();
            return;
        }
        const [restored, restoreError] = skill.restore(initial, checkpoint);
        expect(restoreError).toBeNull();
        expect(restored?.state.blueprintId).toBe('blueprint.home');
    });
});
