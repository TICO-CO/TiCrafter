import type { DecisionRequest } from '@ticrafter/core';
import type { Result } from '@ticrafter/core';

import type { DecisionFailure, DecisionState } from './types.js';

const MAXIMUM_INVENTORY_ENTRIES = 5;
const MAXIMUM_HAZARDS = 8;
const MAXIMUM_LABEL_WORDS = 12;
const TOKEN_ESTIMATE_DIVISOR = 4;

export interface AssembledDigest {
    key: string;
    state: DecisionState;
}

export class DecisionDigestAssembler {
    constructor(private readonly maximumInputTokens: number) {}

    assemble(request: DecisionRequest): Result<AssembledDigest, DecisionFailure> {
        if (request.affordances.length === 0 || request.affordances.length > 16) {
            return [null, { type: 'INVALID_OUTPUT', message: 'affordance count must be 1-16' }];
        }
        const invalidLabel = request.affordances.find(
            (affordance) => affordance.label.trim().split(/\s+/).length > MAXIMUM_LABEL_WORDS,
        );
        if (invalidLabel !== undefined) {
            return [
                null,
                {
                    type: 'INVALID_OUTPUT',
                    message: `affordance ${invalidLabel.id} exceeds ${MAXIMUM_LABEL_WORDS} words`,
                },
            ];
        }
        const state: DecisionState = {
            health: request.digest.health,
            food: request.digest.food,
            position: request.digest.position,
            inventorySummary: (request.digest.inventorySummary ?? []).slice(
                0,
                MAXIMUM_INVENTORY_ENTRIES,
            ),
            hazards: (request.digest.hazards ?? []).slice(0, MAXIMUM_HAZARDS),
            ...(request.digest.currentSkill === undefined
                ? {}
                : { currentSkill: request.digest.currentSkill }),
            ...(request.digest.taskId === undefined ? {} : { taskId: request.digest.taskId }),
            ...(request.digest.taskProgress === undefined
                ? {}
                : { taskProgress: request.digest.taskProgress }),
            ...(request.digest.lastResult === undefined
                ? {}
                : { lastResult: request.digest.lastResult }),
        };
        const estimatedTokens = this.estimateTokens(state, request);
        if (estimatedTokens > this.maximumInputTokens) {
            return [
                null,
                {
                    type: 'INVALID_OUTPUT',
                    message: `decision digest exceeds ${this.maximumInputTokens} tokens`,
                },
            ];
        }
        return [{ key: this.key(request), state }, null];
    }

    private estimateTokens(state: DecisionState, request: DecisionRequest): number {
        const text = JSON.stringify({
            state,
            labels: request.affordances.map((item) => item.label),
        });
        return Math.ceil(text.length / TOKEN_ESTIMATE_DIVISOR);
    }

    private key(request: DecisionRequest): string {
        return JSON.stringify({
            digest: request.digest,
            affordances: request.affordances.map((affordance) => affordance.id),
        });
    }
}
