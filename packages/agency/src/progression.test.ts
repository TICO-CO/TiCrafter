import { describe, expect, it } from 'bun:test';

import { ProgressionPlanModel } from './progression-plan.js';
import { ProgressionPlanner } from './progression-planner.js';
import { StaticRecipePort } from './recipe-port.js';
import type { AgencySnapshot } from './types.js';

function snapshot(overrides: Partial<AgencySnapshot> = {}): AgencySnapshot {
    return {
        at: '2026-11-13T00:00:00.000Z',
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        food: 20,
        timeOfDay: 1000,
        inventory: [],
        nearbyBots: [],
        nearbyPlayers: [],
        hostiles: [],
        home: { x: 0, y: 64, z: 0 },
        hasBed: false,
        knownResourceSites: [
            { kind: 'wood', position: { x: 4, y: 64, z: 0 } },
            { kind: 'stone', position: { x: -4, y: 64, z: 0 } },
        ],
        homeBbox: null,
        homeStatus: null,
        homeStructureId: null,
        hasBedAtHome: false,
        isSheltered: false,
        digSite: null,
        weapon: null,
        armorPieces: 0,
        armorInventoryPieces: 0,
        nightIntent: null,
        ...overrides,
    };
}

class ProgressionTestWorld {
    static after(goalId: string, current: AgencySnapshot): AgencySnapshot {
        if (goalId.endsWith('forage-wood')) {
            return { ...current, inventory: [{ name: 'oak_log', count: 24 }] };
        }
        if (goalId.endsWith('crafting-table')) {
            return { ...current, hasCraftingTable: true };
        }
        if (goalId.endsWith('wooden-tools')) {
            return {
                ...current,
                inventory: [
                    ...current.inventory,
                    { name: 'wooden_pickaxe', count: 1 },
                    { name: 'wooden_sword', count: 1 },
                ],
            };
        }
        if (goalId.endsWith('stone-tools')) {
            return {
                ...current,
                inventory: [
                    ...current.inventory,
                    { name: 'stone_pickaxe', count: 1 },
                    { name: 'stone_sword', count: 1 },
                ],
            };
        }
        if (goalId.endsWith('furnace-chest')) {
            return {
                ...current,
                hasFurnace: true,
                hasContainer: true,
            };
        }
        return { ...current, isSheltered: true, hasBedAtHome: true };
    }
}

describe('progression plan', () => {
    it('creates a versioned early-game plan', () => {
        const plan = ProgressionPlanModel.create('2026-11-13T00:00:00.000Z');
        expect(plan.version).toBe(1);
        expect(plan.milestones[0]?.id).toBe('forage-wood');
        expect(ProgressionPlanModel.current(plan)?.id).toBe('forage-wood');
    });

    it('migrates an unknown plan version to an empty plan', () => {
        const [result, error] = ProgressionPlanModel.restore(
            { ...ProgressionPlanModel.create('2026-11-13T00:00:00.000Z'), version: 99 },
            '2026-11-13T00:00:00.000Z',
        );
        expect(error).toBeNull();
        expect(result?.migrated).toBe(true);
        expect(result?.plan.milestones).toHaveLength(0);
    });

    it('completes a milestone and advances the index', () => {
        const plan = ProgressionPlanModel.create('2026-11-13T00:00:00.000Z');
        const next = ProgressionPlanModel.complete(plan, 'forage-wood', plan.updatedAt);
        expect(next.milestoneIndex).toBe(1);
        expect(next.milestones[0]?.completedAt).not.toBeNull();
    });
});

describe('progression planner', () => {
    it('starts with gathering wood', () => {
        const planner = new ProgressionPlanner(new StaticRecipePort());
        const plan = ProgressionPlanModel.create('2026-11-13T00:00:00.000Z');
        const [decision, error] = planner.nextGoal(plan, snapshot());
        expect(error).toBeNull();
        expect(decision?.goal?.id).toBe('goal:progression:forage-wood');
        expect(decision?.goal?.steps[0]?.skillId).toBe('gather-resource');
    });

    it('moves to the crafting table after wood is gathered', () => {
        const planner = new ProgressionPlanner(new StaticRecipePort());
        const plan = ProgressionPlanModel.create('2026-11-13T00:00:00.000Z');
        const [decision, error] = planner.nextGoal(
            plan,
            snapshot({ inventory: [{ name: 'oak_log', count: 24 }] }),
        );
        expect(error).toBeNull();
        expect(decision?.plan.milestoneIndex).toBe(1);
        expect(decision?.goal?.id).toBe('goal:progression:crafting-table');
        expect(decision?.goal?.steps.some((step) => step.skillId === 'craft')).toBe(true);
    });

    it('walks from empty inventory to a provisioned base', () => {
        const planner = new ProgressionPlanner(new StaticRecipePort());
        let plan = ProgressionPlanModel.create('2026-11-13T00:00:00.000Z');
        let current = snapshot();
        const completed: string[] = [];
        for (let guard = 0; guard < 10; guard += 1) {
            const [decision, error] = planner.nextGoal(plan, current);
            expect(error).toBeNull();
            if (decision === null || decision.goal === null) break;
            plan = decision.plan;
            completed.push(decision.goal.id);
            plan = planner.observe(plan, {
                goal: decision.goal,
                status: 'completed',
                at: '2026-11-13T00:00:01.000Z',
            });
            current = ProgressionTestWorld.after(decision.goal.id, current);
        }
        expect(completed).toHaveLength(6);
        expect(plan.milestoneIndex).toBe(plan.milestones.length);
    });

    it('records attempts without completing a failed milestone', () => {
        const planner = new ProgressionPlanner(new StaticRecipePort());
        const plan = ProgressionPlanModel.create('2026-11-13T00:00:00.000Z');
        const [decision] = planner.nextGoal(plan, snapshot());
        if (decision?.goal === null || decision?.goal === undefined) return;
        const next = planner.observe(decision.plan, {
            goal: decision.goal,
            status: 'abandoned',
            at: '2026-11-13T00:00:01.000Z',
        });
        expect(next.milestones[0]?.attempts).toBe(1);
        expect(next.milestones[0]?.completedAt).toBeNull();
    });
});
