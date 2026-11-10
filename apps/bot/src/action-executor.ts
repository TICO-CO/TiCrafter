import type {
    ActionDispatchPort,
    ActionOutcome,
    ActionRequest,
    LoggerPort,
    Result,
} from '@ticrafter/core';

import type { GuardianHook } from './guardian.js';

export class ActionExecutor implements ActionDispatchPort {
    constructor(
        private readonly guardian: GuardianHook,
        private readonly dispatchPort: ActionDispatchPort,
        private readonly logger: LoggerPort,
    ) {}

    dispatch(request: ActionRequest): Result<string, string> {
        const decision = this.guardian.evaluate(request);
        if (!decision.allowed) {
            this.logger.warn({ request, reason: decision.reason }, 'action vetoed');
            return [null, decision.reason];
        }
        return this.dispatchPort.dispatch(request);
    }

    poll(handleId: string): Result<ActionOutcome | null, string> {
        return this.dispatchPort.poll(handleId);
    }

    cancel(handleId: string): Result<void, string> {
        return this.dispatchPort.cancel(handleId);
    }
}
