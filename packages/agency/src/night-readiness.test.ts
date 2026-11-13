import { describe, expect, it } from 'bun:test';

import { NightPrepDefaults } from './night-prep-config.js';
import { NightReadinessModel } from './night-readiness.js';
import { ShelterPlan } from './shelter-plan.js';
import { ShelterStrategyModel } from './shelter-strategy.js';
import type { AgencySnapshot } from './types.js';

function snapshot(overrides: Partial<AgencySnapshot> = {}): AgencySnapshot {
    return {
        at: '2026-11-11T12:00:00.000Z',
        position: { x: 0, y: 64, z: 0 },
        health: 20,
        food: 20,
        timeOfDay: 17_500,
        inventory: [],
        nearbyBots: [],
        nearbyPlayers: [],
        hostiles: [],
        home: { x: 0, y: 64, z: 0 },
        hasBed: false,
        knownResourceSites: [],
        homeBbox: { min: { x: -3, y: 63, z: -3 }, max: { x: 3, y: 67, z: 3 } },
        homeStatus: 'active',
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

describe('night readiness', () => {
    it('reports ready when sheltered, fed, armed, and healthy', () => {
        const readiness = NightReadinessModel.assess(
            snapshot({
                isSheltered: true,
                hasBedAtHome: true,
                weapon: { name: 'stone_sword', tier: 2 },
                inventory: [{ name: 'bread', count: 3 }],
            }),
            'evening',
        );
        expect(readiness.ready).toBe(true);
        expect(readiness.shelterStrategy).toBe('keep');
        expect(readiness.actions.some((action) => action.kind === 'dig-shelter')).toBe(false);
    });

    it('navigates home when dusk starts far away', () => {
        const readiness = NightReadinessModel.assess(
            snapshot({ position: { x: 40, y: 64, z: 0 }, isSheltered: true }),
            'evening',
        );
        expect(readiness.gaps.includes('home-far')).toBe(true);
        expect(readiness.actions[0]?.kind).toBe('navigate-home');
    });

    it('digs in when no shelter exists and a safe site is nearby', () => {
        const readiness = NightReadinessModel.assess(
            snapshot({ digSite: { x: 1, y: 64, z: 0 } }),
            'evening',
        );
        expect(readiness.shelterStrategy).toBe('dig-in');
        expect(readiness.actions.some((action) => action.kind === 'dig-shelter')).toBe(true);
    });

    it('builds when materials and daylight are sufficient', () => {
        const config = NightPrepDefaults.config();
        const readiness = NightReadinessModel.assess(
            snapshot({
                timeOfDay: 7_500,
                digSite: { x: 1, y: 64, z: 0 },
                inventory: [{ name: 'cobblestone', count: config.buildMaterialCount }],
            }),
            'evening',
            config,
        );
        expect(readiness.shelterStrategy).toBe('build');
        const build = readiness.actions.find((action) => action.kind === 'build-shelter');
        expect(build === undefined).toBe(false);
        expect(Array.isArray(build?.input.blocks)).toBe(true);
    });

    it('builds a first shelter when no home exists', () => {
        const config = NightPrepDefaults.config();
        const readiness = NightReadinessModel.assess(
            snapshot({
                timeOfDay: 7_500,
                home: null,
                homeBbox: null,
                inventory: [{ name: 'cobblestone', count: config.buildMaterialCount }],
            }),
            'day',
            config,
        );
        expect(readiness.shelterStrategy).toBe('build');
        const build = readiness.actions.find((action) => action.kind === 'build-shelter');
        expect(build === undefined).toBe(false);
    });

    it('defaults enough material for the shelter shell', () => {
        const config = NightPrepDefaults.config();
        const shell = ShelterPlan.shell({ x: 0, y: 64, z: 0 }, 'cobblestone');
        expect(config.buildMaterialCount >= shell.length).toBe(true);
    });

    it('places a bed at the current position when no home exists', () => {
        const readiness = NightReadinessModel.assess(
            snapshot({
                home: null,
                homeBbox: null,
                hasBedAtHome: false,
                inventory: [{ name: 'red_bed', count: 1 }],
            }),
            'evening',
            NightPrepDefaults.config(),
        );
        const place = readiness.actions.find((action) => action.kind === 'place-bed');
        expect(place?.input.target).toEqual({ x: 0, y: 64, z: 0 });
    });

    it('gathers wool before crafting a bed', () => {
        const readiness = NightReadinessModel.assess(
            snapshot({ isSheltered: true, inventory: [{ name: 'oak_planks', count: 3 }] }),
            'evening',
        );
        expect(readiness.gaps.includes('bed-missing')).toBe(true);
        expect(readiness.actions.some((action) => action.kind === 'gather-wool')).toBe(true);
    });

    it('gathers food when none is available', () => {
        const readiness = NightReadinessModel.assess(
            snapshot({ isSheltered: true, hasBedAtHome: true }),
            'evening',
        );
        expect(readiness.gaps.includes('food-missing')).toBe(true);
        expect(readiness.actions.some((action) => action.kind === 'gather-food')).toBe(true);
    });

    it('allows hunting at night when there is a concrete need', () => {
        const readiness = NightReadinessModel.assess(
            snapshot({
                timeOfDay: 20_000,
                isSheltered: true,
                hasBedAtHome: true,
                food: 2,
                inventory: [{ name: 'bread', count: 4 }],
                nightIntent: 'hunt',
            }),
            'night',
        );
        expect(readiness.nightIntent).toBe('hunt');
    });

    it('chooses dig-in over build when dusk is too close', () => {
        const config = NightPrepDefaults.config();
        const strategy = ShelterStrategyModel.choose(
            {
                snapshot: snapshot({
                    timeOfDay: 18_500,
                    digSite: { x: 1, y: 64, z: 0 },
                    inventory: [{ name: 'cobblestone', count: 64 }],
                }),
                ticksUntilNight: 1_000,
                materialCount: 64,
            },
            config,
        );
        expect(strategy).toBe('dig-in');
    });

    it('creates a shelter shell around the home anchor', () => {
        const blocks = ShelterPlan.shell({ x: 0, y: 64, z: 0 }, 'cobblestone');
        expect(blocks.length > 20).toBe(true);
        expect(blocks.every((block) => block.itemName === 'cobblestone')).toBe(true);
    });
});
