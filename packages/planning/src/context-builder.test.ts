import { describe, expect, it } from 'bun:test';

import { PlannerContextBuilder } from './context-builder.js';
import { FakePlannerContextSource, plannerContext, plannerTrigger } from './planning-fixture.js';

describe('PlannerContextBuilder', () => {
    it('builds a deterministic bounded prompt', () => {
        const context = plannerContext({
            tasks: Array.from({ length: 400 }, (_, index) => ({
                id: `task-${index}`,
                title: `Task ${index}`,
                status: 'pending',
                priority: index,
                dependencies: [],
                skillId: 'navigate',
                target: null,
                failureClass: null,
                deadLetterReason: null,
            })),
        });
        const builder = new PlannerContextBuilder({
            source: new FakePlannerContextSource(context),
            allowedSkills: ['explore', 'navigate'],
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
        const systemPrompt = first?.messages.find((message) => message.role === 'system')?.content;
        expect(systemPrompt?.includes('Allowed skillId values are: explore, navigate.')).toBe(true);
        expect(systemPrompt?.includes('baseRevision must equal context.sip.revision')).toBe(true);
        expect(systemPrompt?.includes('Every task must be independent')).toBe(true);
        expect(systemPrompt?.includes('Set cancelTaskIds to existing open task IDs')).toBe(true);
        expect(systemPrompt?.includes('"schemaVersion":1')).toBe(true);
    });

    it('uses context revision and bot position in the prompt example', () => {
        const context = plannerContext({
            sip: { ...plannerContext().sip, revision: 7 },
            bots: [
                {
                    id: 'bot-1',
                    role: 'builder',
                    online: true,
                    position: { x: 4, y: -60, z: 7 },
                },
            ],
        });
        const builder = new PlannerContextBuilder({
            source: new FakePlannerContextSource(context),
            allowedSkills: ['explore', 'navigate'],
            maxContextCharacters: 12_000,
        });
        const [prompt, promptError] = builder.build(plannerTrigger());
        expect(promptError).toBeNull();
        const systemPrompt = prompt?.messages.find((message) => message.role === 'system')?.content;
        expect(systemPrompt?.includes('"baseRevision":7')).toBe(true);
        expect(systemPrompt?.includes('"center":{"x":4,"y":-60,"z":7}')).toBe(true);
    });

    it('fails closed when context cannot be bounded', () => {
        const builder = new PlannerContextBuilder({
            source: new FakePlannerContextSource(),
            allowedSkills: ['explore', 'navigate'],
            maxContextCharacters: 10,
        });
        const [prompt, promptError] = builder.build(plannerTrigger());
        expect(prompt).toBeNull();
        expect(promptError?.type).toBe('CONTEXT');
    });
});
