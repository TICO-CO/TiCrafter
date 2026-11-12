import { describe, expect, it } from 'bun:test';

import { BlueprintDocumentFailures } from './blueprint-document-failures.js';
import { ConstructionPlanFailures } from './construction-plan-failures.js';
import { ProjectConstructionFailures } from './project-construction-failures.js';

describe('construction failures', () => {
    it('constructs plan failure variants', () => {
        expect(ConstructionPlanFailures.invalidPlan('bad')).toEqual({
            type: 'INVALID_PLAN',
            message: 'bad',
        });
    });

    it('constructs blueprint document failure variants', () => {
        const failure = { type: 'COMPOSE_FAILED' as const, message: 'bad' };
        expect(BlueprintDocumentFailures.invalidId('bad')).toEqual({
            type: 'INVALID_ID',
            message: 'bad',
        });
        expect(BlueprintDocumentFailures.invalidSource('bad')).toEqual({
            type: 'INVALID_SOURCE',
            message: 'bad',
        });
        expect(BlueprintDocumentFailures.invalidBlueprint(failure)).toEqual({
            type: 'INVALID_BLUEPRINT',
            failure,
        });
    });

    it('constructs project construction failure variants', () => {
        const failure = { type: 'COMPOSE_FAILED' as const, message: 'bad' };
        expect(ProjectConstructionFailures.siteUnavailable('bad')).toEqual({
            type: 'SITE_UNAVAILABLE',
            message: 'bad',
        });
        expect(ProjectConstructionFailures.storage('bad')).toEqual({
            type: 'STORAGE',
            message: 'bad',
        });
        expect(ProjectConstructionFailures.blueprintFailed(failure)).toEqual({
            type: 'BLUEPRINT_FAILED',
            failure,
        });
        expect(ProjectConstructionFailures.planFailed(failure)).toEqual({
            type: 'PLAN_FAILED',
            failure,
        });
    });
});
