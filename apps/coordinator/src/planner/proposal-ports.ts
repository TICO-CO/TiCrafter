import type { Result } from '@ticrafter/core';
import type {
    PlannerSipProposalInput,
    PlannerSipProposalPort,
    PlannerSipValidationPort,
    PlannerTaskProposal,
    PlannerTaskProposalPort,
} from '@ticrafter/planning';

import { SipMutationProposer } from '../sip/index.js';
import type { TaskRepository } from '../tasks/index.js';

export class CoordinatorSipProposalPort
    implements PlannerSipProposalPort, PlannerSipValidationPort
{
    private readonly proposer = new SipMutationProposer();

    propose(input: PlannerSipProposalInput): Result<PlannerSipProposalInput, string> {
        const [proposal, proposeError] = this.proposer.propose(input);
        if (proposeError) return [null, proposeError.message];
        return [proposal, null];
    }

    validate(mutations: PlannerSipProposalInput['mutations']): Result<void, string> {
        const [proposal, proposeError] = this.proposer.propose({
            metadata: {
                actor: 'planner',
                expectedRevision: 0,
                idempotencyKey: 'planner-validation',
                fencingToken: 0,
                planId: null,
                grantId: null,
            },
            mutations,
        });
        if (proposeError) return [null, proposeError.message];
        if (proposal === null) return [null, 'SIP proposal validation returned null'];
        return [undefined, null];
    }
}

export class CoordinatorTaskProposalPort implements PlannerTaskProposalPort {
    constructor(private readonly tasks: TaskRepository) {}

    validate(inputs: readonly PlannerTaskProposal[]): Result<void, string> {
        const [existing, existingError] = this.tasks.list();
        if (existingError) return [null, existingError.type];
        if (existing === null) return [null, 'task list missing'];
        const existingIds = new Set(existing.map((task) => task.id));
        const proposedIds = new Set<string>();
        for (const task of inputs) {
            if (proposedIds.has(task.id)) {
                return [null, `task ${task.id} appears more than once`];
            }
            proposedIds.add(task.id);
        }
        for (const task of inputs) {
            if (existingIds.has(task.id)) continue;
            if (
                task.parentId !== null &&
                !proposedIds.has(task.parentId) &&
                !existingIds.has(task.parentId)
            ) {
                return [null, `task ${task.id} has unknown parent ${task.parentId}`];
            }
            for (const dependency of task.dependencies) {
                if (!proposedIds.has(dependency) && !existingIds.has(dependency)) {
                    return [null, `task ${task.id} has unknown dependency ${dependency}`];
                }
            }
        }
        return [undefined, null];
    }
}
