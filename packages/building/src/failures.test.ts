import { describe, expect, it } from 'bun:test';

import { BuildingFailures } from './failures.js';

describe('BuildingFailures', () => {
    it('creates composer failures', () => {
        expect(BuildingFailures.composeFailed('bad layout')).toEqual({
            type: 'COMPOSE_FAILED',
            message: 'bad layout',
        });
    });

    it('creates unsupported source failures', () => {
        expect(BuildingFailures.unsupportedSource('litematic')).toEqual({
            type: 'UNSUPPORTED_SOURCE',
            source: 'litematic',
        });
    });

    it('creates raw blueprint gate failures', () => {
        expect(BuildingFailures.rawBlueprintsDisabled()).toEqual({
            type: 'RAW_BLUEPRINTS_DISABLED',
        });
    });

    it('creates observation failures', () => {
        expect(BuildingFailures.observationFailed('empty region')).toEqual({
            type: 'OBSERVATION_FAILED',
            message: 'empty region',
        });
    });

    it('creates site and construction failures', () => {
        expect(BuildingFailures.siteRejected('slope too high')).toEqual({
            type: 'SITE_REJECTED',
            message: 'slope too high',
        });
        expect(BuildingFailures.foundationFailed('too deep')).toEqual({
            type: 'FOUNDATION_FAILED',
            message: 'too deep',
        });
        expect(BuildingFailures.invalidConstructionPlan('cycle')).toEqual({
            type: 'INVALID_CONSTRUCTION_PLAN',
            message: 'cycle',
        });
        expect(BuildingFailures.invalidBlueprint('empty')).toEqual({
            type: 'INVALID_BLUEPRINT',
            message: 'empty',
        });
        expect(BuildingFailures.worldQueryFailed('unavailable')).toEqual({
            type: 'WORLD_QUERY_FAILED',
            message: 'unavailable',
        });
    });

    it('creates structural failures', () => {
        expect(BuildingFailures.structuralFailure({ x: 1, y: 2, z: 3 })).toEqual({
            type: 'STRUCTURAL_FAILURE',
            position: { x: 1, y: 2, z: 3 },
        });
    });
});
