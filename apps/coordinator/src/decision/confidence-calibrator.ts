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
        const dangerScore = this.temperedBinary(answer.dangerScore, this.temperatures.danger);
        const shouldContinueScore = this.temperedBinary(
            answer.shouldContinueScore,
            this.temperatures.shouldContinue,
        );
        return {
            ...answer,
            probabilities,
            danger: dangerScore >= 0.5,
            shouldContinue: shouldContinueScore >= 0.5,
            dangerScore,
            shouldContinueScore,
            calibratedConfidence,
            belowGate: calibratedConfidence < this.minimumConfidence,
        };
    }

    private temperedBinary(probability: number, temperature: number): number {
        if (probability <= 0 || probability >= 1) return probability;
        const logit = Math.log(probability / (1 - probability));
        return 1 / (1 + Math.exp(-logit / temperature));
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
