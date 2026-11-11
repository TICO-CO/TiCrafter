import type { Result } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { ContentionHarness, type ContentionWorkPort } from './index.js';

class FakeWork implements ContentionWorkPort {
    private owners = new Set<string>();

    attempt(input: { botId: string }): Result<boolean, string> {
        if (this.owners.has('resource')) return [null, 'CLAIM_CONFLICT'];
        this.owners.add('resource');
        return [true, null];
    }

    active(): number {
        return this.owners.size;
    }
}

describe('ContentionHarness', () => {
    it('counts successes and conflicts under concurrent attempts', () => {
        const harness = new ContentionHarness(new FakeWork());
        const [report, runError] = harness.run({
            botIds: ['bot.one', 'bot.two', 'bot.three'],
            attemptsPerBot: 2,
            now: () => 1000,
        });

        expect(runError).toBeNull();
        expect(report?.attempts).toBe(6);
        expect(report?.successes).toBe(1);
        expect(report?.conflicts).toBe(5);
        expect(report?.active).toBe(1);
        expect(report?.finished).toBe(true);
    });
});
