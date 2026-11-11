import type { DecisionCalibratedAnswer, DecisionParsedAnswer } from './types.js';

export interface DecisionTemperatures {
    nextAction: number;
    danger: number;
    shouldContinue: number;
}

export class DecisionConfidenceCalibrator {
    constructor(
        private readonly temperatures: DecisionTemperatures,
        private readonly minimumConfidence: number,
    ) {}

    calibrate(answer: DecisionParsedAnswer): DecisionCalibratedAnswer {
        const probabilities = this.tempered(answer.probabilities, this.temperatures.nextAction);
        const probabilityConfidence = Math.max(...Object.values(probabilities), 0);
        const calibratedConfidence = Math.min(answer.answerConfidence, probabilityConfidence);
        return {
            ...answer,
            probabilities,
            calibratedConfidence,
            belowGate: calibratedConfidence < this.minimumConfidence,
        };
    }

    private tempered(
        probabilities: Record<string, number>,
        temperature: number,
    ): Record<string, number> {
        const entries = Object.entries(probabilities);
        const weighted = entries.map(([choiceId, probability]) => [
            choiceId,
            Math.pow(Math.max(probability, 0), 1 / temperature),
        ]);

        const total = weighted.reduce((sum, [, weight]) => sum + Number(weight), 0);
        if (total <= 0) return { ...probabilities };
        return Object.fromEntries(
            weighted.map(([choiceId, weight]) => [choiceId, Number(weight) / total]),
        );
    }
}
