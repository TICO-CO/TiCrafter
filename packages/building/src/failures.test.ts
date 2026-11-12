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

    it('creates structural failures', () => {
        expect(BuildingFailures.structuralFailure({ x: 1, y: 2, z: 3 })).toEqual({
            type: 'STRUCTURAL_FAILURE',
            position: { x: 1, y: 2, z: 3 },
        });
    });
});
