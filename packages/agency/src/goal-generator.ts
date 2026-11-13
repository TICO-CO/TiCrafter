import type { Result, Vec3 } from '@ticrafter/core';

import { GoalCatalog, type GoalTemplate } from './goal-catalog.js';
import type { NeedsModel } from './needs-model.js';
import type { NightPrepConfig } from './night-prep-config.js';
import { NightPrepDefaults } from './night-prep-config.js';
import { NightReadinessModel } from './night-readiness.js';
import type { PersonalityModel } from './personality-model.js';
import { RoutineModel } from './routine-model.js';
import type {
    AgencySnapshot,
    Goal,
    GoalKind,
    GoalStep,
    NightAction,
    NightActionKind,
    NightReadiness,
    RoutinePhase,
} from './types.js';

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
        nightPrep: NightPrepConfig = NightPrepDefaults.config(),
    ): Result<readonly Goal[], string> {
        const readiness = NightReadinessModel.assess(snapshot, phase, nightPrep);
        const filtered = GoalCatalog.templates().filter((template) =>
            template.kind === 'prepare-night'
                ? nightPrep.enabled && this.shouldPrepare(readiness, snapshot, phase, nightPrep)
                : this.applies(template, snapshot, needs, personality, phase),
        );
        const goals = filtered.map((template) =>
            template.kind === 'prepare-night'
                ? this.materializeNightPrep(template, readiness, snapshot)
                : this.materialize(template, snapshot),
        );
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
                if (template.label.includes('wood')) {
                    return (
                        this.hasResourceSite(snapshot, 'wood') &&
                        (needs.pressure('materials') > 0.35 ||
                            personality.weight('industriousness') > 0.6)
                    );
                }
                return this.hasResourceSite(snapshot, 'stone') && needs.pressure('tools') > 0.35;
            case 'craft':
                return needs.pressure('tools') > 0.4 && this.hasAny(snapshot, ['log', 'stone']);
            case 'shelter':
                return snapshot.home !== null && this.distanceToHome(snapshot) > 12;
            case 'return-home':
                return snapshot.home !== null && this.distanceToHome(snapshot) > 12;
            case 'deposit':
                return false;
            case 'explore':
                return needs.pressure('novelty') > 0.35 || personality.weight('curiosity') > 0.6;
            case 'social':
                return false;
            case 'leisure':
                return true;
            case 'prepare-night':
            case 'build-shelter':
            case 'dig-shelter':
            case 'secure-bed':
            case 'gather-wool':
            case 'gather-food':
            case 'equip-gear':
                return false;
        }
    }

    private shouldPrepare(
        readiness: NightReadiness,
        snapshot: AgencySnapshot,
        phase: RoutinePhase,
        nightPrep: NightPrepConfig,
    ): boolean {
        if (readiness.actions.length === 0) return false;
        if (RoutineModel.isPreparationWindow(phase)) return true;
        if (RoutineModel.isNight(phase)) return !readiness.ready;
        const ticksUntilNight = RoutineModel.ticksUntilNight(snapshot.timeOfDay);
        return ticksUntilNight > 0 && ticksUntilNight <= nightPrep.duskLeadTicks;
    }

    private materializeNightPrep(
        template: GoalTemplate,
        readiness: NightReadiness,
        snapshot: AgencySnapshot,
    ): Goal {
        const target = snapshot.home;
        return {
            id: `goal:${template.kind}:${template.label.toLowerCase().replace(/\s+/g, '-')}`,
            kind: template.kind,
            label: template.label,
            priority: template.priority,
            source: template.source,
            target,
            steps: this.nightPrepSteps(readiness.actions),
            expectedValue: template.expectedValue,
            estimatedCost: template.estimatedCost,
            estimatedRisk: template.estimatedRisk,
            deadline: null,
        };
    }

    private nightPrepSteps(actions: readonly NightAction[]): readonly GoalStep[] {
        return actions.map((action) => ({
            skillId: GoalGenerator.skillFor(action.kind),
            label: action.label,
            input: action.input,
        }));
    }

    private static skillFor(kind: NightActionKind): string {
        switch (kind) {
            case 'navigate-home':
                return 'navigate';
            case 'eat':
                return 'eat';
            case 'gather-food':
                return 'gather-food';
            case 'gather-wool':
                return 'gather-wool';
            case 'craft-bed':
            case 'craft-weapon':
                return 'craft';
            case 'place-bed':
                return 'place-bed';
            case 'equip-gear':
                return 'equip-gear';
            case 'build-shelter':
                return 'place-build';
            case 'dig-shelter':
                return 'dig-shelter';
        }
    }

    private materialize(template: GoalTemplate, snapshot: AgencySnapshot): Goal {
        const target = this.target(template, snapshot);
        return {
            id: `goal:${template.kind}:${template.label.toLowerCase().replace(/\s+/g, '-')}`,
            kind: template.kind,
            label: template.label,
            priority: template.priority,
            source: template.source,
            target,
            steps: this.steps(template, snapshot, target),
            expectedValue: template.expectedValue,
            estimatedCost: template.estimatedCost,
            estimatedRisk: template.estimatedRisk,
            deadline: null,
        };
    }

    private steps(
        template: GoalTemplate,
        snapshot: AgencySnapshot,
        target: Vec3 | null,
    ): readonly GoalStep[] {
        return template.steps.map((step) => {
            if (step.skillId === 'mine') {
                return { ...step, input: { ...step.input, target } };
            }
            if (step.skillId === 'navigate') {
                return {
                    ...step,
                    input: { ...step.input, target: this.navigationTarget(snapshot) },
                };
            }
            if (step.skillId === 'explore') {
                return { ...step, input: { ...step.input, center: snapshot.position } };
            }
            return step;
        });
    }

    private target(template: GoalTemplate, snapshot: AgencySnapshot): Vec3 | null {
        if (template.kind === 'gather') {
            return this.resourceSite(snapshot, template.label.includes('wood') ? 'wood' : 'stone');
        }
        if (
            template.kind === 'shelter' ||
            template.kind === 'deposit' ||
            template.kind === 'return-home'
        ) {
            return snapshot.home;
        }
        if (template.kind === 'explore') return snapshot.position;
        return null;
    }

    private navigationTarget(snapshot: AgencySnapshot): Vec3 {
        return snapshot.home ?? snapshot.position;
    }

    private hasResourceSite(snapshot: AgencySnapshot, kind: string): boolean {
        return snapshot.knownResourceSites.some((site) => site.kind === kind);
    }

    private resourceSite(snapshot: AgencySnapshot, kind: string): Vec3 | null {
        return snapshot.knownResourceSites.find((site) => site.kind === kind)?.position ?? null;
    }

    private hasFood(snapshot: AgencySnapshot): boolean {
        return snapshot.inventory.some((item) => FOOD_ITEMS.has(item.name));
    }

    private hasAny(snapshot: AgencySnapshot, names: readonly string[]): boolean {
        return snapshot.inventory.some((item) => names.some((name) => item.name.includes(name)));
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
