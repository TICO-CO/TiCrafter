import type { Result } from '@ticrafter/core';

import type { PlannerFailure } from './failures.js';
import type { PlannerPlan } from './plan-schema.js';
import type { PlannerContext, PlannerSipProposalInput, PlannerSipProposalPort } from './types.js';

export class PlannerSipMutationTranslator {
    constructor(private readonly proposer: PlannerSipProposalPort) {}

    translate(
        plan: PlannerPlan,
        context: PlannerContext,
    ): Result<PlannerSipProposalInput | null, PlannerFailure> {
        if (plan.sipMutations.length === 0) return [null, null];
        const input: PlannerSipProposalInput = {
            metadata: {
                actor: 'planner',
                expectedRevision: context.sip.revision,
                idempotencyKey: `planner:${plan.planId}:sip`,
                fencingToken: 0,
                planId: plan.planId,
                grantId: null,
            },
            mutations: plan.sipMutations,
        };
        const [proposal, proposeError] = this.proposer.propose(input);
        if (proposeError) return [null, { type: 'TRANSLATION', message: proposeError }];
        return [proposal, null];
    }
}
