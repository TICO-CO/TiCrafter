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
            ...(request.digest.workingMemoryRevision === undefined
                ? {}
                : { workingMemoryRevision: request.digest.workingMemoryRevision }),
            ...(request.digest.decisionKind === undefined
                ? {}
                : { decisionKind: request.digest.decisionKind }),
            ...(request.digest.focus === undefined ? {} : { focus: request.digest.focus }),
            ...(request.digest.commitments === undefined
                ? {}
                : { commitments: request.digest.commitments }),
            ...(request.digest.recentExperiences === undefined
                ? {}
                : { recentExperiences: request.digest.recentExperiences }),
            ...(request.digest.interruption === undefined
                ? {}
                : { interruption: request.digest.interruption }),
            ...(request.digest.strategicGoal === undefined
                ? {}
                : { strategicGoal: request.digest.strategicGoal }),
            ...(request.digest.strategicConstraints === undefined
                ? {}
                : { strategicConstraints: request.digest.strategicConstraints }),
        };
        const fitted = this.fit(state, request);
        if (fitted === null) {
            return [
                null,
                {
                    type: 'INVALID_OUTPUT',
                    message: `decision digest exceeds ${this.maximumInputTokens} tokens`,
                },
            ];
        }
        return [{ key: this.key(request), state: fitted }, null];
    }

    private fit(state: DecisionState, request: DecisionRequest): DecisionState | null {
        let candidate = state;
        if (this.fits(candidate, request)) return candidate;
        candidate = { ...candidate, recentExperiences: undefined };
        if (this.fits(candidate, request)) return candidate;
        candidate = { ...candidate, commitments: undefined };
        if (this.fits(candidate, request)) return candidate;
        candidate = {
            ...candidate,
            strategicGoal: undefined,
            strategicConstraints: undefined,
        };
        if (this.fits(candidate, request)) return candidate;
        return null;
    }

    private fits(state: DecisionState, request: DecisionRequest): boolean {
        return this.estimateTokens(state, request) <= this.maximumInputTokens;
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
