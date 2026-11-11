import { describe, expect, it } from 'bun:test';

import { plannerPlan } from './planning-fixture.js';
import { PlannerSchemaValidator } from './schema-validator.js';

describe('PlannerSchemaValidator', () => {
    it('accepts a valid plan', () => {
        const [plan, planError] = new PlannerSchemaValidator().validate(
            JSON.stringify(plannerPlan()),
        );
        expect(planError).toBeNull();
        expect(plan?.planId).toBe('plan-1');
    });

    it('rejects invalid JSON', () => {
        const [plan, planError] = new PlannerSchemaValidator().validate('not-json');
        expect(plan).toBeNull();
        expect(planError?.type).toBe('SCHEMA');
    });

    it('rejects unknown fields', () => {
        const [, planError] = new PlannerSchemaValidator().validate(
            JSON.stringify({ ...plannerPlan(), unexpected: true }),
        );
        expect(planError?.type).toBe('SCHEMA');
    });

    it('rejects malformed nested tasks', () => {
        const [, planError] = new PlannerSchemaValidator().validate(
            JSON.stringify({ ...plannerPlan(), tasks: [{ id: 'task-1' }] }),
        );
        expect(planError?.type).toBe('SCHEMA');
    });
});
