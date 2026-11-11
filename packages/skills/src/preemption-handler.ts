import type { Result } from '@ticrafter/core';

import type { SkillLifecycleExecutor } from './lifecycle-executor.js';
import type { SkillContext, SkillStep } from './types.js';

export class PreemptionHandler {
    constructor(private readonly lifecycle: SkillLifecycleExecutor) {}

    preempt(context: SkillContext, reason: string): Result<SkillStep | null, string> {
        if (this.lifecycle.activeSkillId === null) return [null, null];
        return this.lifecycle.preempt(context, reason);
    }
}
