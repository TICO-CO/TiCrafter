import type { Vec3 } from '@ticrafter/core';

import { ItemKnowledge } from './item-knowledge.js';
import { type NightPrepConfig, NightPrepDefaults } from './night-prep-config.js';
import { RoutineModel } from './routine-model.js';
import { ShelterPlan } from './shelter-plan.js';
import { ShelterStrategyModel } from './shelter-strategy.js';
import type {
    AgencySnapshot,
    NightAction,
    NightGap,
    NightIntent,
    NightReadiness,
    RoutinePhase,
} from './types.js';

const EAT_THRESHOLD = 20;
const LOW_FOOD_LEVEL = 6;

export class NightReadinessModel {
    static assess(
        snapshot: AgencySnapshot,
        phase: RoutinePhase,
        config: NightPrepConfig = NightPrepDefaults.config(),
    ): NightReadiness {
        const gaps: NightGap[] = [];
        const actions: NightAction[] = [];
        const ticksUntilNight = RoutineModel.ticksUntilNight(snapshot.timeOfDay);
        const materialCount = ItemKnowledge.buildingMaterialCount(snapshot);
        const shelterStrategy = ShelterStrategyModel.choose(
            { snapshot, ticksUntilNight, materialCount },
            config,
        );
        const nightIntent = snapshot.nightIntent ?? NightReadinessModel.intentFor(snapshot);
        NightReadinessModel.assessHome(snapshot, config, gaps, actions);
        NightReadinessModel.assessShelter(snapshot, shelterStrategy, gaps, actions);
        NightReadinessModel.assessBed(snapshot, config, gaps, actions);
        NightReadinessModel.assessFood(snapshot, config, gaps, actions);
        NightReadinessModel.assessCombat(snapshot, config, gaps, actions);
        if (snapshot.hostiles.length > 0) gaps.push('hostiles-near');
        const foodServings = ItemKnowledge.foodServings(snapshot);
        const combatReady = NightReadinessModel.combatReady(snapshot, config);
        const shelterAvailable = snapshot.isSheltered || shelterStrategy !== 'none';
        const blocked =
            gaps.includes('food-missing') ||
            gaps.includes('health-low') ||
            (nightIntent === 'rest' && !shelterAvailable);
        return {
            ready: !blocked,
            gaps,
            actions,
            foodServings,
            shelterStrategy,
            combat: {
                weaponTier: snapshot.weapon?.tier ?? 0,
                armorPieces: snapshot.armorPieces,
                health: snapshot.health,
                ready: combatReady,
            },
            nightIntent,
        };
    }

    private static intentFor(snapshot: AgencySnapshot): NightIntent {
        return snapshot.nightIntent ?? 'rest';
    }

    private static assessHome(
        snapshot: AgencySnapshot,
        config: NightPrepConfig,
        gaps: NightGap[],
        actions: NightAction[],
    ): void {
        if (snapshot.home === null) {
            gaps.push('home-missing');
            return;
        }
        if (NightReadinessModel.distance(snapshot.position, snapshot.home) <= config.homeRadius) {
            return;
        }
        gaps.push('home-far');
        actions.push({
            kind: 'navigate-home',
            gap: 'home-far',
            label: 'Return home before nightfall',
            input: { target: snapshot.home, range: 2 },
        });
    }

    private static assessShelter(
        snapshot: AgencySnapshot,
        strategy: NightReadiness['shelterStrategy'],
        gaps: NightGap[],
        actions: NightAction[],
    ): void {
        if (snapshot.isSheltered) return;
        gaps.push('shelter-missing');
        const material = ItemKnowledge.buildingMaterialName(snapshot);
        if (strategy === 'build' && material !== null) {
            const anchor = snapshot.home ?? snapshot.position;
            actions.push({
                kind: 'build-shelter',
                gap: 'shelter-missing',
                label: 'Build a shelter before nightfall',
                input: { blocks: ShelterPlan.shell(anchor, material) },
            });
        }
        if (strategy === 'dig-in' && snapshot.digSite !== null) {
            actions.push({
                kind: 'dig-shelter',
                gap: 'shelter-missing',
                label: 'Dig in for the night',
                input: { target: snapshot.digSite },
            });
        }
    }

    private static assessBed(
        snapshot: AgencySnapshot,
        config: NightPrepConfig,
        gaps: NightGap[],
        actions: NightAction[],
    ): void {
        if (snapshot.hasBedAtHome) return;
        gaps.push('bed-missing');
        const bedTarget = snapshot.home ?? snapshot.position;
        const bed = ItemKnowledge.bedItem(snapshot);
        if (bed !== null) {
            actions.push(NightReadinessModel.placeBed(bed, bedTarget));
            return;
        }
        const craftable = ItemKnowledge.craftableBed(snapshot);
        if (craftable !== null) {
            actions.push({
                kind: 'craft-bed',
                gap: 'bed-missing',
                label: 'Craft a bed',
                input: { itemName: craftable, count: 1 },
            });
            actions.push(NightReadinessModel.placeBed(craftable, bedTarget));
            return;
        }
        const woolMissing = config.woolTarget - ItemKnowledge.woolCount(snapshot);
        if (woolMissing > 0) {
            actions.push({
                kind: 'gather-wool',
                gap: 'bed-missing',
                label: 'Gather wool for a bed',
                input: { itemName: 'white_wool', count: woolMissing },
            });
        }
    }

    private static placeBed(bed: string, home: Vec3 | null): NightAction {
        return {
            kind: 'place-bed',
            gap: 'bed-missing',
            label: 'Place a bed at home',
            input: { itemName: bed, ...(home === null ? {} : { target: home }) },
        };
    }

    private static assessFood(
        snapshot: AgencySnapshot,
        config: NightPrepConfig,
        gaps: NightGap[],
        actions: NightAction[],
    ): void {
        const servings = ItemKnowledge.foodServings(snapshot);
        if (servings === 0) {
            gaps.push('food-missing');
            actions.push({
                kind: 'gather-food',
                gap: 'food-missing',
                label: 'Gather food for the night',
                input: { count: config.foodServings },
            });
            return;
        }
        if (servings >= config.foodServings && snapshot.food > LOW_FOOD_LEVEL) return;
        gaps.push('food-low');
        if (snapshot.food < EAT_THRESHOLD) {
            actions.push({
                kind: 'eat',
                gap: 'food-low',
                label: 'Eat before nightfall',
                input: { threshold: EAT_THRESHOLD },
            });
        }
    }

    private static assessCombat(
        snapshot: AgencySnapshot,
        config: NightPrepConfig,
        gaps: NightGap[],
        actions: NightAction[],
    ): void {
        const carriedWeapon = ItemKnowledge.bestWeapon(snapshot);
        if (snapshot.weapon === null) {
            gaps.push('weapon-missing');
            if (carriedWeapon !== null) {
                actions.push({
                    kind: 'equip-gear',
                    gap: 'weapon-missing',
                    label: 'Equip a weapon',
                    input: {},
                });
            } else {
                const craftable = ItemKnowledge.craftableWeapon(snapshot);
                if (craftable !== null) {
                    actions.push({
                        kind: 'craft-weapon',
                        gap: 'weapon-missing',
                        label: 'Craft a weapon',
                        input: { itemName: craftable, count: 1 },
                    });
                }
            }
        }
        if (snapshot.armorPieces === 0 && snapshot.armorInventoryPieces === 0) {
            gaps.push('armor-missing');
        }
        if (snapshot.armorInventoryPieces > 0) {
            actions.push({
                kind: 'equip-gear',
                gap: 'armor-missing',
                label: 'Equip armor',
                input: {},
            });
        }
        if (snapshot.health < config.minHealth) {
            gaps.push('health-low');
            if (ItemKnowledge.hasFood(snapshot) && snapshot.food < EAT_THRESHOLD) {
                actions.push({
                    kind: 'eat',
                    gap: 'health-low',
                    label: 'Eat to recover health',
                    input: { threshold: EAT_THRESHOLD },
                });
            }
        }
    }

    private static combatReady(snapshot: AgencySnapshot, config: NightPrepConfig): boolean {
        const armed = snapshot.weapon !== null || snapshot.armorPieces > 0;
        return armed && snapshot.health >= config.minHealth;
    }

    private static distance(left: Vec3, right: Vec3): number {
        return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
    }
}
