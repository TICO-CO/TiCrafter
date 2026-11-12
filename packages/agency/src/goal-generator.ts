import type { Result, Vec3 } from '@ticrafter/core';

import { GoalCatalog, type GoalTemplate } from './goal-catalog.js';
import type { NeedsModel } from './needs-model.js';
import type { PersonalityModel } from './personality-model.js';
import type { AgencySnapshot, Goal, GoalKind, RoutinePhase } from './types.js';

const FOOD_ITEMS = new Set([
    'apple',
    'bread',
    'carrot',
    'cooked_beef',
    'cooked_chicken',
    'cooked_porkchop',
    'potato',
    'baked_potato',
]);

export class GoalGenerator {
    generate(
        snapshot: AgencySnapshot,
        needs: NeedsModel,
        personality: PersonalityModel,
        phase: RoutinePhase,
    ): Result<readonly Goal[], string> {
        const filtered = GoalCatalog.templates().filter((template) =>
            this.applies(template, snapshot, needs, personality, phase),
        );
        const goals = filtered.map((template) => this.materialize(template, snapshot));
        if (goals.length === 0) return [null, 'no legal goal candidates'];
        return [goals, null];
    }

    private applies(
        template: GoalTemplate,
        snapshot: AgencySnapshot,
        needs: NeedsModel,
        personality: PersonalityModel,
        phase: RoutinePhase,
    ): boolean {
        switch (template.kind) {
            case 'survive':
                return snapshot.hostiles.length > 0;
            case 'eat':
                return (
                    (snapshot.food <= 18 || needs.pressure('hunger') > 0.5) &&
                    this.hasFood(snapshot)
                );
            case 'rest':
                return phase === 'night' && snapshot.hasBed;
            case 'gather':
                return template.label.includes('wood')
                    ? needs.pressure('materials') > 0.35 ||
                          personality.weight('industriousness') > 0.6
                    : needs.pressure('tools') > 0.35;
            case 'craft':
                return needs.pressure('tools') > 0.4 && this.hasAny(snapshot, ['log', 'stone']);
            case 'shelter':
                return (
                    snapshot.home !== null &&
                    (phase === 'night' || this.distanceToHome(snapshot) > 24)
                );
            case 'return-home':
                return snapshot.home !== null && this.distanceToHome(snapshot) > 12;
            case 'deposit':
                return this.itemCount(snapshot) >= 30;
            case 'explore':
                return needs.pressure('novelty') > 0.35 || personality.weight('curiosity') > 0.6;
            case 'social':
                return (
                    snapshot.nearbyBots.length + snapshot.nearbyPlayers.length > 0 &&
                    personality.weight('sociability') > 0.3
                );
            case 'leisure':
                return true;
        }
    }

    private materialize(template: GoalTemplate, snapshot: AgencySnapshot): Goal {
        return {
            id: `goal:${template.kind}:${template.label.toLowerCase().replace(/\s+/g, '-')}`,
            kind: template.kind,
            label: template.label,
            priority: template.priority,
            source: template.source,
            target: this.target(template.kind, snapshot),
            steps: template.steps,
            expectedValue: template.expectedValue,
            estimatedCost: template.estimatedCost,
            estimatedRisk: template.estimatedRisk,
            deadline: null,
        };
    }

    private target(kind: GoalKind, snapshot: AgencySnapshot): Vec3 | null {
        if (kind === 'shelter' || kind === 'deposit' || kind === 'return-home') {
            return snapshot.home;
        }
        if (kind === 'gather') {
            return snapshot.knownResourceSites[0]?.position ?? null;
        }
        if (kind === 'explore') return snapshot.position;
        return null;
    }

    private hasFood(snapshot: AgencySnapshot): boolean {
        return snapshot.inventory.some((item) => FOOD_ITEMS.has(item.name));
    }

    private hasAny(snapshot: AgencySnapshot, names: readonly string[]): boolean {
        return snapshot.inventory.some((item) => names.some((name) => item.name.includes(name)));
    }

    private itemCount(snapshot: AgencySnapshot): number {
        return snapshot.inventory.reduce((total, item) => total + item.count, 0);
    }

    private distanceToHome(snapshot: AgencySnapshot): number {
        if (snapshot.home === null) return Number.POSITIVE_INFINITY;
        return Math.hypot(
            snapshot.position.x - snapshot.home.x,
            snapshot.position.y - snapshot.home.y,
            snapshot.position.z - snapshot.home.z,
        );
    }
}
