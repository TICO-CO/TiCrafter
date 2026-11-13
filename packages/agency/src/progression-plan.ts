import type { ProgressionMilestone, ProgressionPlan, Result } from '@ticrafter/core';

export const PROGRESSION_PLAN_VERSION = 1;
export const PROGRESSION_PLAN_ID = 'plan:early-game';

const MILESTONES: readonly {
    id: string;
    kind: string;
    label: string;
    targetCount: number;
}[] = [
    { id: 'forage-wood', kind: 'forage', label: 'Forage wood', targetCount: 24 },
    {
        id: 'crafting-table',
        kind: 'station',
        label: 'Craft and place a crafting table',
        targetCount: 1,
    },
    { id: 'wooden-tools', kind: 'tools', label: 'Craft wooden tools', targetCount: 2 },
    { id: 'stone-tools', kind: 'tools', label: 'Craft stone tools', targetCount: 2 },
    { id: 'furnace-chest', kind: 'station', label: 'Craft a furnace and chest', targetCount: 2 },
    { id: 'base-provisioning', kind: 'base', label: 'Provision the base', targetCount: 4 },
];

export class ProgressionPlanModel {
    static create(now: string): ProgressionPlan {
        return {
            id: PROGRESSION_PLAN_ID,
            version: PROGRESSION_PLAN_VERSION,
            revision: 0,
            milestoneIndex: 0,
            milestones: MILESTONES.map((milestone) => ({
                ...milestone,
                attempts: 0,
                blocked: false,
                completedAt: null,
            })),
            updatedAt: now,
        };
    }

    static empty(now: string): ProgressionPlan {
        return {
            id: PROGRESSION_PLAN_ID,
            version: PROGRESSION_PLAN_VERSION,
            revision: 0,
            milestoneIndex: 0,
            milestones: [],
            updatedAt: now,
        };
    }

    static restore(
        input: ProgressionPlan | null | undefined,
        now: string,
    ): Result<{ plan: ProgressionPlan; migrated: boolean }, string> {
        if (input === null || input === undefined) {
            return [{ plan: ProgressionPlanModel.create(now), migrated: false }, null];
        }
        if (input.version !== PROGRESSION_PLAN_VERSION) {
            return [{ plan: ProgressionPlanModel.empty(now), migrated: true }, null];
        }
        return [{ plan: input, migrated: false }, null];
    }

    static current(plan: ProgressionPlan): ProgressionMilestone | null {
        return plan.milestones[plan.milestoneIndex] ?? null;
    }

    static complete(plan: ProgressionPlan, milestoneId: string, now: string): ProgressionPlan {
        const milestones = plan.milestones.map((milestone) =>
            milestone.id === milestoneId && milestone.completedAt === null
                ? { ...milestone, blocked: false, completedAt: now }
                : milestone,
        );
        return {
            ...plan,
            revision: plan.revision + 1,
            milestoneIndex: ProgressionPlanModel.nextIncompleteIndex(
                milestones,
                plan.milestoneIndex,
            ),
            milestones,
            updatedAt: now,
        };
    }

    static recordAttempt(
        plan: ProgressionPlan,
        milestoneId: string,
        now: string,
        blocked: boolean,
    ): ProgressionPlan {
        const milestones = plan.milestones.map((milestone) =>
            milestone.id === milestoneId
                ? { ...milestone, attempts: milestone.attempts + 1, blocked }
                : milestone,
        );
        return {
            ...plan,
            revision: plan.revision + 1,
            milestones,
            updatedAt: now,
        };
    }

    private static nextIncompleteIndex(
        milestones: readonly ProgressionMilestone[],
        from: number,
    ): number {
        let index = from;
        while (index < milestones.length && milestones[index]?.completedAt !== null) {
            index += 1;
        }
        return index;
    }
}
