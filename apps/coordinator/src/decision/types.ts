import type { ChoiceQuestion, NoulQuestion, Question, SystemOneResult } from '@receptron/laya';
import type { DecisionDigest, DecisionRequest, DecisionResponse } from '@ticrafter/core';
import type { Result } from '@ticrafter/core';

export type DecisionProvider = 'cpu' | 'webgpu';

export interface DecisionQuestions extends Record<string, Question> {
    nextAction: ChoiceQuestion;
    danger: NoulQuestion;
    shouldContinue: NoulQuestion;
}

export type DecisionAnswer = SystemOneResult<DecisionQuestions>;

export interface DecisionModelPort {
    readonly modelDir: string;
    readonly loadedProvider: DecisionProvider;
    readonly fallbackReason: string | null;
    answer(
        state: DecisionState,
        questions: DecisionQuestions,
    ): Promise<Result<DecisionAnswer, string>>;
    close(): Promise<Result<void, string>>;
}

export interface DecisionModelLoadOptions {
    provider: DecisionProvider;
    threads: number;
    revision: string;
    cacheDirectory: string;
    modelDirectory: string;
    fallbackToCpu: boolean;
}

export interface DecisionModelLoaderPort {
    load(options: DecisionModelLoadOptions): Promise<Result<DecisionModelPort, string>>;
}

export interface DecisionState {
    health: number;
    food: number;
    position: { x: number; y: number; z: number };
    inventorySummary: readonly { name: string; count: number }[];
    hazards: readonly string[];
    currentSkill?: string;
    taskId?: string;
    taskProgress?: number;
    lastResult?: string;
}

export interface DecisionParsedAnswer {
    choiceId: string;
    probabilities: Record<string, number>;
    answerConfidence: number;
    danger: boolean;
    shouldContinue: boolean;
}

export interface DecisionCalibratedAnswer extends DecisionParsedAnswer {
    calibratedConfidence: number;
    belowGate: boolean;
}

export interface DecisionFallbackSignal {
    source: 'fallback';
    reason: string;
}

export interface DecisionOutcome {
    response: DecisionResponse;
    fallback: DecisionFallbackSignal | null;
}

export interface DecisionJob {
    id: string;
    botId: string;
    request: DecisionRequest;
    priority: number;
    createdAt: number;
    resolve: (result: Result<DecisionOutcome, DecisionFailure>) => void;
}

export type DecisionFailure =
    | { type: 'DISABLED'; message: string }
    | { type: 'RATE_LIMITED'; botId: string }
    | { type: 'QUEUE_FULL'; depth: number }
    | { type: 'MODEL_UNAVAILABLE'; message: string }
    | { type: 'INFERENCE_FAILED'; message: string }
    | { type: 'TIMEOUT'; timeoutMilliseconds: number }
    | { type: 'INVALID_OUTPUT'; message: string }
    | { type: 'BUSY' }
    | { type: 'CLOSED' };

export interface DecisionDigestInput {
    digest: DecisionDigest;
    affordances: DecisionRequest['affordances'];
}
