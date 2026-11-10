import { describe, expect, it } from 'bun:test';

import { BenchmarkFixture } from './benchmark-fixture.js';

describe('BenchmarkFixture', () => {
    it('provides a bounded choice question', () => {
        const fixture = BenchmarkFixture.create('standard');
        expect(fixture.affordanceIds).toHaveLength(12);
        expect(fixture.questions.nextAction.type).toBe('choice');
        expect(fixture.questions.danger.type).toBe('noul');
        expect(fixture.questions.shouldContinue.type).toBe('noul');
    });

    it('keeps every affordance label within twelve words', () => {
        const criteria = BenchmarkFixture.create('standard').questions.nextAction.criteria;
        const labels = Array.isArray(criteria)
            ? criteria
            : Object.values(criteria).filter((label): label is string => label !== null);
        for (const label of labels) {
            expect(label.split(/\s+/).length <= 12).toBe(true);
        }
    });

    it('keeps the state digest compact', () => {
        const fixture = BenchmarkFixture.create('standard');
        expect(JSON.stringify(fixture.state).length < 2000).toBe(true);
    });

    it('provides a smaller compact variant', () => {
        const compact = BenchmarkFixture.create('compact');
        expect(compact.affordanceIds).toHaveLength(8);
        expect(
            JSON.stringify(compact.state).length <
                JSON.stringify(BenchmarkFixture.create('standard').state).length,
        ).toBe(true);
    });
});
