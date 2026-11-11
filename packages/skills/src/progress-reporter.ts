import type { Result } from '@ticrafter/core';

import type { SkillProgressEvent, SkillProgressSink, SkillStatus, SkillStep } from './types.js';

export class ProgressReporter {
    constructor(private readonly sink: SkillProgressSink) {}

    report(
        botId: string,
        at: string,
        step: SkillStep,
        status: SkillStatus,
        taskId?: string,
    ): Result<void, string> {
        const event: SkillProgressEvent = {
            botId,
            at,
            skillId: step.run.skillId,
            ...(taskId === undefined ? {} : { taskId }),
            status,
            progress: step.progress,
            ...(step.failure === null ? {} : { failureClass: step.failure.class }),
        };
        return this.sink.report(event);
    }
}
