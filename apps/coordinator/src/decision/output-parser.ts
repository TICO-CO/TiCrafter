import type { Result } from '@ticrafter/core';
import { z as zod } from 'zod';

import type { DecisionFailure, DecisionParsedAnswer } from './types.js';

const answerSchema = zod.object({
    answers: zod.object({
        nextAction: zod.object({
            type: zod.literal('choice'),
            choice: zod.string().min(1),
            probabilities: zod.record(zod.string(), zod.number()),
            answer_confidence: zod.number().min(0).max(1),
        }),
        danger: zod.object({
            type: zod.literal('noul'),
            noul: zod.number(),
            answer_confidence: zod.number().min(0).max(1),
        }),
        shouldContinue: zod.object({
            type: zod.literal('noul'),
            noul: zod.number(),
            answer_confidence: zod.number().min(0).max(1),
        }),
    }),
});

export class DecisionOutputParser {
    parse(answer: unknown): Result<DecisionParsedAnswer, DecisionFailure> {
        const parsed = answerSchema.safeParse(answer);
        if (!parsed.success) {
            return [null, { type: 'INVALID_OUTPUT', message: parsed.error.message }];
        }
        const nextAction = parsed.data.answers.nextAction;
        return [
            {
                choiceId: nextAction.choice,
                probabilities: nextAction.probabilities,
                answerConfidence: nextAction.answer_confidence,
                danger: parsed.data.answers.danger.noul >= 0.5,
                shouldContinue: parsed.data.answers.shouldContinue.noul >= 0.5,
            },
            null,
        ];
    }
}
