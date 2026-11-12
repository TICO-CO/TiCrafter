import type { NeedsModel } from './needs-model.js';
import type { PersonalityModel } from './personality-model.js';
import type { NeedName } from './types.js';

export type JobMarketDecision = 'accept' | 'defer' | 'decline';

export interface JobOfferView {
    taskId: string;
    title: string;
    priority: number;
    skillId: string | null;
    requiredRole: string | null;
    distance: number | null;
}

export interface JobMarketContext {
    role: string | null;
    activeGoal: boolean;
    needs: NeedsModel;
    traits: PersonalityModel;
}

export interface JobMarketChoice {
    decision: JobMarketDecision;
    reason: string;
    score: number;
}

const SKILL_NEEDS: Readonly<Record<string, NeedName>> = {
    mine: 'materials',
    collect: 'materials',
    craft: 'tools',
    smelt: 'tools',
    eat: 'hunger',
    sleep: 'rest',
    'place-build': 'achievement',
    'schematic-build': 'achievement',
    repair: 'shelter',
    deposit: 'achievement',
    withdraw: 'materials',
    explore: 'novelty',
    navigate: 'shelter',
};

export class JobMarketPolicy {
    static decide(offer: JobOfferView, context: JobMarketContext): JobMarketChoice {
        if (context.activeGoal) {
            return { decision: 'defer', reason: 'agency goal is active', score: 0 };
        }
        const roleScore = JobMarketPolicy.roleScore(offer.requiredRole, context.role);
        const needScore = JobMarketPolicy.needScore(offer.skillId, context.needs);
        const distanceScore = JobMarketPolicy.distanceScore(offer.distance);
        const priorityScore = Math.max(0, Math.min(1, offer.priority / 100));
        const drive =
            (context.traits.weight('industriousness') + context.traits.weight('ambition')) / 2;
        const score = roleScore + needScore * (0.5 + drive) + distanceScore + priorityScore * 0.35;
        if (roleScore < 0) {
            return {
                decision: 'decline',
                reason: `role mismatch: needs ${offer.requiredRole}`,
                score,
            };
        }
        if (score >= 0.45) {
            return { decision: 'accept', reason: 'fits role and current needs', score };
        }
        if (score < 0.15) {
            return {
                decision: 'decline',
                reason: 'low value for current needs',
                score,
            };
        }
        return { decision: 'defer', reason: 'better opportunities may appear', score };
    }

    private static roleScore(requiredRole: string | null, role: string | null): number {
        if (requiredRole === null) return 0.1;
        if (requiredRole === role) return 0.35;
        return -0.4;
    }

    private static needScore(skillId: string | null, needs: NeedsModel): number {
        if (skillId === null) return 0.1;
        const need = SKILL_NEEDS[skillId];
        if (need === undefined) return 0.1;
        return needs.pressure(need);
    }

    private static distanceScore(distance: number | null): number {
        if (distance === null) return 0;
        if (distance <= 16) return 0.2;
        if (distance <= 48) return 0.1;
        if (distance <= 96) return 0;
        return -0.2;
    }
}
