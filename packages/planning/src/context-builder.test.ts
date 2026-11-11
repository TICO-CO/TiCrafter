import { describe, expect, it } from 'bun:test';

import { PlannerContextBuilder } from './context-builder.js';
import { FakePlannerContextSource, plannerContext, plannerTrigger } from './planning-fixture.js';

describe('PlannerContextBuilder', () => {
    it('builds a deterministic bounded prompt', () => {
        const context = plannerContext({
            tasks: Array.from({ length: 400 }, (_, index) => ({
                id: `task-${index}`,
                status: 'pending',
                priority: index,
                dependencies: [],
                failureClass: null,
                deadLetterReason: null,
            })),
        });
        const builder = new PlannerContextBuilder({
            source: new FakePlannerContextSource(context),
            maxContextCharacters: 12_000,
            now: () => 1_000,
        });
        const [first, firstError] = builder.build(plannerTrigger());
        expect(firstError).toBeNull();
        const [second, secondError] = builder.build(plannerTrigger());
        expect(secondError).toBeNull();
        expect(first?.contextHash).toBe(second?.contextHash);
        expect((first?.context.tasks.length ?? 0) < 400).toBe(true);
        expect(JSON.stringify(first?.context).length <= 12_000).toBe(true);
    });

    it('fails closed when context cannot be bounded', () => {
        const builder = new PlannerContextBuilder({
            source: new FakePlannerContextSource(),
            maxContextCharacters: 10,
        });
        const [prompt, promptError] = builder.build(plannerTrigger());
        expect(prompt).toBeNull();
        expect(promptError?.type).toBe('CONTEXT');
    });
});
