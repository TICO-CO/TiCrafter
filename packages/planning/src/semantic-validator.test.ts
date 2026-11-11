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

function workTask(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id,
        title: id,
        parentId: null,
        priority: 1,
        dependencies: [],
        preconditions: [],
        requiredRole: 'builder',
        target: { x: 1, y: 64, z: 1 },
        skillId: 'navigate',
        payload: {},
        ...overrides,
    };
}

describe('PlannerSemanticValidator', () => {
    it('accepts a valid plan', () => {
        const [validated, validationError] = validator().validate(plannerPlan(), plannerContext());
        expect(validationError).toBeNull();
        expect(validated).toBe(undefined);
    });

    it('rejects parented and dependent planner tasks', () => {
        const plan = plannerPlan({
            tasks: [
                workTask('task-1', { parentId: 'task-parent' }),
                workTask('task-2', { dependencies: ['task-2'] }),
            ],
        });
        const [, validationError] = validator().validate(plan, plannerContext());
        expect(validationError?.type).toBe('SEMANTIC');
        if (validationError?.type !== 'SEMANTIC') return;
        expect(
            validationError.issues.some((issue) => issue.includes('must not have a parent')),
        ).toBe(true);
        expect(
            validationError.issues.some((issue) => issue.includes('must not have dependencies')),
        ).toBe(true);
    });

    it('rejects duplicate work anchors', () => {
        const plan = plannerPlan({
            tasks: [workTask('task-1'), workTask('task-2')],
        });
        const [, validationError] = validator().validate(plan, plannerContext());
        expect(validationError?.type).toBe('SEMANTIC');
        if (validationError?.type !== 'SEMANTIC') return;
        expect(validationError.issues.some((issue) => issue.includes('share work anchor'))).toBe(
            true,
        );
    });

    it('requires one independent task per online bot', () => {
        const bots = Array.from({ length: 4 }, (_, index) => ({
            id: `bot-${index}`,
            role: 'builder',
            online: true,
            position: { x: index, y: 64, z: 0 },
        }));
        const [shortValidated, shortError] = validator().validate(
            plannerPlan({
                tasks: [
                    workTask('task-1', { target: { x: 1, y: 64, z: 1 } }),
                    workTask('task-2', { target: { x: 2, y: 64, z: 1 } }),
                ],
            }),
            plannerContext({ tasks: [], bots }),
        );
        expect(shortValidated).toBeNull();
        expect(shortError?.type).toBe('SEMANTIC');
        if (shortError?.type !== 'SEMANTIC') return;
        expect(
            shortError.issues.some((issue) =>
                issue.includes('plan must provide independent tasks for every online bot'),
            ),
        ).toBe(true);

        const [validated, validationError] = validator().validate(
            plannerPlan({
                tasks: Array.from({ length: 4 }, (_, index) =>
                    workTask(`task-${index}`, { target: { x: index, y: 64, z: 1 } }),
                ),
            }),
            plannerContext({ tasks: [], bots }),
        );
        expect(validationError).toBeNull();
        expect(validated).toBe(undefined);
    });

    it('rejects invalid cancellation targets', () => {
        const context = plannerContext({
            tasks: [
                {
                    id: 'task-done',
                    title: 'Done task',
                    status: 'completed',
                    priority: 1,
                    dependencies: [],
                    skillId: 'navigate',
                    target: null,
                    failureClass: null,
                    deadLetterReason: null,
                },
            ],
        });
        const [, validationError] = validator().validate(
            plannerPlan({
                tasks: [workTask('task-1')],
                cancelTaskIds: ['task-done', 'task-missing', 'task-1'],
            }),
            context,
        );
        expect(validationError?.type).toBe('SEMANTIC');
        if (validationError?.type !== 'SEMANTIC') return;
        expect(
            validationError.issues.some((issue) =>
                issue.includes('cancellation references non-open task task-done'),
            ),
        ).toBe(true);
        expect(
            validationError.issues.some((issue) =>
                issue.includes('cancellation references unknown task task-missing'),
            ),
        ).toBe(true);
        expect(
            validationError.issues.some((issue) =>
                issue.includes('task task-1 cannot be both planned and cancelled'),
            ),
        ).toBe(true);
    });

    it('requires replacements for cancelled open work', () => {
        const context = plannerContext({
            tasks: [
                {
                    id: 'task-ready',
                    title: 'Ready task',
                    status: 'ready',
                    priority: 1,
                    dependencies: [],
                    skillId: 'navigate',
                    target: null,
                    failureClass: null,
                    deadLetterReason: null,
                },
            ],
        });
        const [, validationError] = validator().validate(
            plannerPlan({ tasks: [], cancelTaskIds: ['task-ready'] }),
            context,
        );
        expect(validationError?.type).toBe('SEMANTIC');
        if (validationError?.type !== 'SEMANTIC') return;
        expect(
            validationError.issues.some((issue) =>
                issue.includes('plan must provide independent tasks for every online bot'),
            ),
        ).toBe(true);
    });

    it('rejects empty plans when no work is open', () => {
        const [validated, validationError] = validator().validate(
            plannerPlan({ tasks: [] }),
            plannerContext(),
        );
        expect(validated).toBeNull();
        expect(validationError?.type).toBe('SEMANTIC');
        if (validationError?.type !== 'SEMANTIC') return;
        expect(
            validationError.issues.some((issue) =>
                issue.includes('plan must provide independent tasks for every online bot'),
            ),
        ).toBe(true);
    });

    it('accepts empty plans when work is already open', () => {
        const [validated, validationError] = validator().validate(
            plannerPlan({ tasks: [] }),
            plannerContext({
                tasks: [
                    {
                        id: 'task-ready',
                        title: 'Ready task',
                        status: 'ready',
                        priority: 1,
                        dependencies: [],
                        skillId: 'navigate',
                        target: null,
                        failureClass: null,
                        deadLetterReason: null,
                    },
                ],
            }),
        );
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
