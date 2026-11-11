import { describe, expect, it } from 'bun:test';

import { plannerContext, plannerPlan } from './planning-fixture.js';
import { PlannerSipMutationTranslator } from './sip-mutation-translator.js';
import { PlannerTaskDagTranslator } from './task-dag-translator.js';
import type { PlannerSipProposalInput, PlannerTaskProposal } from './types.js';

describe('planner translators', () => {
    it('adds proposal metadata to SIP mutations', () => {
        const plan = plannerPlan({
            sipMutations: [
                {
                    kind: 'zone.remove',
                    zoneId: 'zone-1',
                },
            ],
        });
        const translator = new PlannerSipMutationTranslator({
            propose: (input: PlannerSipProposalInput) => [input, null],
        });
        const [proposal, proposalError] = translator.translate(plan, plannerContext());
        expect(proposalError).toBeNull();
        expect(proposal?.metadata.actor).toBe('planner');
        expect(proposal?.metadata.expectedRevision).toBe(5);
        expect(proposal?.metadata.planId).toBe('plan-1');
    });

    it('returns no proposal when there are no SIP mutations', () => {
        const translator = new PlannerSipMutationTranslator({
            propose: (input: PlannerSipProposalInput) => [input, null],
        });
        const [proposal, proposalError] = translator.translate(plannerPlan(), plannerContext());
        expect(proposalError).toBeNull();
        expect(proposal).toBeNull();
    });

    it('orders tasks topologically and embeds the skill id', () => {
        const plan = plannerPlan({
            tasks: [
                {
                    id: 'task-2',
                    title: 'Second',
                    dependencies: ['task-1'],
                    skillId: 'navigate',
                },
                {
                    id: 'task-1',
                    title: 'First',
                    dependencies: [],
                    skillId: 'navigate',
                },
            ],
        });
        const translator = new PlannerTaskDagTranslator({ validate: () => [undefined, null] });
        const [proposals, proposalError] = translator.translate(plan);
        expect(proposalError).toBeNull();
        expect(proposals?.map((proposal) => proposal.id)).toEqual(['task-1', 'task-2']);
        expect(proposals?.[0]?.payload.skillId).toBe('navigate');
    });

    it('fails when the task proposal port rejects the DAG', () => {
        const translator = new PlannerTaskDagTranslator({
            validate: (_inputs: readonly PlannerTaskProposal[]) => [null, 'duplicate task'],
        });
        const [, proposalError] = translator.translate(plannerPlan());
        expect(proposalError?.type).toBe('TRANSLATION');
    });
});
