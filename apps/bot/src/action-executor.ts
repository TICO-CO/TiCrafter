import type {
    ActionDispatchPort,
    ActionOutcome,
    ActionRequest,
    LoggerPort,
    Result,
} from '@ticrafter/core';
import type { SafetyDecision } from '@ticrafter/safety';

export interface ActionGuardian {
    evaluate(request: ActionRequest): SafetyDecision;
    recordVeto(request: ActionRequest, reason: string): void;
}

export class ActionExecutor implements ActionDispatchPort {
    constructor(
        private readonly guardian: ActionGuardian,
        private readonly dispatchPort: ActionDispatchPort,
        private readonly logger: LoggerPort,
    ) {}

    dispatch(request: ActionRequest): Result<string, string> {
        const decision = this.guardian.evaluate(request);
        if (!decision.allowed) {
            this.guardian.recordVeto(request, decision.reason);
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
