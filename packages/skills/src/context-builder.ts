import type { ActionOutcome, Result } from '@ticrafter/core';

import type { SkillContext, SkillContextSource } from './types.js';

export class SkillContextBuilder {
    constructor(private readonly source: SkillContextSource) {}

    build(lastAction: ActionOutcome | null): Result<SkillContext, string> {
        const [snapshot, readError] = this.source.read();
        if (readError) return [null, readError];
        if (snapshot === null) return [null, 'skill context snapshot returned null'];
        return [{ ...snapshot, lastAction }, null];
    }
}
