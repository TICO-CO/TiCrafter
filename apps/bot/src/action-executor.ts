import type { Result } from '@ticrafter/core';
import type { Logger } from 'pino';
import { GuardianHook, type ProposedAction } from './guardian.js';

export class ActionExecutor {
    constructor(
        private readonly guardian: GuardianHook,
        private readonly logger: Logger,
    ) {}

    execute(action: ProposedAction | null): Result<void, string> {
        const decision = this.guardian.evaluate(action);
        if (!decision.allowed) {
            const reason = decision.reason ?? 'action vetoed';
            this.logger.warn({ action, reason }, 'action vetoed');
            return [null, reason];
        }
        this.logger.info({ action }, 'action accepted (executor stub)');
        return [undefined, null];
    }
}
