import { describe, expect, it } from 'bun:test';

import { plannerContext, plannerPlan } from './planning-fixture.js';
import { PlannerSemanticValidator } from './semantic-validator.js';

function validator(sipError: string | null = null): PlannerSemanticValidator {
    return new PlannerSemanticValidator({
        skills: { has: (skillId) => skillId === 'navigate' },
        sip: {
            validate: () => (sipError === null ? [undefined, null] : [null, sipError]),
        },
    });
}

describe('PlannerSemanticValidator', () => {
    it('accepts a valid plan', () => {
        const [validated, validationError] = validator().validate(plannerPlan(), plannerContext());
        expect(validationError).toBeNull();
        expect(validated).toBe(undefined);
    });

    it('rejects stale revisions', () => {
        const [, validationError] = validator().validate(
            plannerPlan({ baseRevision: 4 }),
            plannerContext(),
        );
        expect(validationError?.type).toBe('SEMANTIC');
    });

    it('rejects unknown skills and dependencies', () => {
        const plan = plannerPlan({
            tasks: [
                {
                    id: 'task-1',
                    title: 'Unknown',
                    dependencies: ['task-missing'],
                    skillId: 'unknown-skill',
                },
            ],
        });
        const [, validationError] = validator().validate(plan, plannerContext());
        expect(validationError?.type).toBe('SEMANTIC');
        if (validationError?.type !== 'SEMANTIC') return;
        expect(validationError.issues.some((issue) => issue.includes('unknown skill'))).toBe(true);
        expect(validationError.issues.some((issue) => issue.includes('unknown dependency'))).toBe(
            true,
        );
    });

    it('rejects dependency cycles', () => {
        const plan = plannerPlan({
            tasks: [
                { id: 'task-1', title: 'One', dependencies: ['task-2'], skillId: 'navigate' },
                { id: 'task-2', title: 'Two', dependencies: ['task-1'], skillId: 'navigate' },
            ],
        });
        const [, validationError] = validator().validate(plan, plannerContext());
        expect(validationError?.type).toBe('SEMANTIC');
        if (validationError?.type !== 'SEMANTIC') return;
        expect(validationError.issues.some((issue) => issue.includes('cycle'))).toBe(true);
    });

    it('rejects protected and no-build positions', () => {
        const context = plannerContext();
        const protectedContext = {
            ...context,
            sip: {
                ...context.sip,
                protectedBboxes: [{ min: { x: 1, y: 64, z: 1 }, max: { x: 3, y: 64, z: 3 } }],
            },
        };
        const [, protectedError] = validator().validate(plannerPlan(), protectedContext);
        expect(protectedError?.type).toBe('SEMANTIC');
        const noBuildContext = {
            ...context,
            sip: {
                ...context.sip,
                noBuildZones: [
                    [
                        { x: 0, y: 64, z: 0 },
                        { x: 5, y: 64, z: 0 },
                        { x: 5, y: 64, z: 5 },
                    ],
                ],
            },
        };
        const [, noBuildError] = validator().validate(plannerPlan(), noBuildContext);
        expect(noBuildError?.type).toBe('SEMANTIC');
    });

    it('rejects missing blueprint materials', () => {
        const plan = plannerPlan({
            blueprints: [
                {
                    id: 'blueprint-1',
                    template: 'house',
                    anchor: { x: 2, y: 64, z: 2 },
                    rotation: 0,
                    materials: [{ item: 'oak_planks', count: 100 }],
                    parameters: {},
                },
            ],
        });
        const [, validationError] = validator().validate(plan, plannerContext());
        expect(validationError?.type).toBe('SEMANTIC');
        if (validationError?.type !== 'SEMANTIC') return;
        expect(validationError.issues.some((issue) => issue.includes('oak_planks'))).toBe(true);
    });

    it('propagates SIP validation failures', () => {
        const plan = plannerPlan({
            sipMutations: [
                {
                    kind: 'zone.upsert',
                    zone: {
                        id: 'zone-2',
                        name: 'Mining',
                        type: 'mining',
                        polygon: [
                            { x: 20, y: 64, z: 20 },
                            { x: 25, y: 64, z: 20 },
                            { x: 25, y: 64, z: 25 },
                        ],
                        priority: 1,
                    },
                },
            ],
        });
        const [, validationError] = validator('broken').validate(plan, plannerContext());
        expect(validationError?.type).toBe('SEMANTIC');
        if (validationError?.type !== 'SEMANTIC') return;
        expect(validationError.issues.some((issue) => issue.includes('broken'))).toBe(true);
    });
});
