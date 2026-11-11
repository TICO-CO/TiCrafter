import type { DecisionAffordance } from '@ticrafter/core';
import type { Result } from '@ticrafter/core';

import type {
    DecisionAnswer,
    DecisionModelPort,
    DecisionQuestions,
    DecisionState,
} from './types.js';

export class DecisionBatchRunner {
    constructor(private readonly model: DecisionModelPort) {}

    run(
        state: DecisionState,
        affordances: readonly DecisionAffordance[],
    ): Promise<Result<DecisionAnswer, string>> {
        return this.model.answer(state, DecisionBatchRunner.questions(affordances));
    }

    private static questions(affordances: readonly DecisionAffordance[]): DecisionQuestions {
        return {
            nextAction: {
                type: 'choice',
                instructions: 'Choose the next action for the builder bot.',
                criteria: Object.fromEntries(
                    affordances.map((affordance) => [affordance.id, affordance.label]),
                ),
            },
            danger: {
                type: 'noul',
                instructions: 'Is the bot about to take damage or die?',
            },
            shouldContinue: {
                type: 'noul',
                instructions: 'Is the current skill still making progress?',
            },
        };
    }
}
