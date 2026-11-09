export interface ProposedAction {
    type: string;
    [key: string]: unknown;
}

export interface GuardianDecision {
    allowed: boolean;
    reason?: string;
}

export class GuardianHook {
    evaluate(action: ProposedAction | null): GuardianDecision {
        if (!action) return { allowed: false, reason: 'no action proposed' };
        const unsafe = ['lava', 'fire', 'tnt'].includes(action.type);
        return unsafe
            ? { allowed: false, reason: `blocked destructive action ${action.type}` }
            : { allowed: true };
    }
}
