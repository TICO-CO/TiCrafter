import {
    type ConstructionPlan,
    type ConstructionPlanDocument,
    ConstructionPlanDocumentHash,
    type ConstructionPlanPurpose,
} from '@ticrafter/building';
import type { Result } from '@ticrafter/core';

import {
    type ConstructionPlanFailure,
    ConstructionPlanFailures,
} from './construction-plan-failures.js';
import type { ConstructionPlanRepository } from './construction-plan-repository.js';

export interface CommitConstructionPlanInput {
    id: string;
    structureId: string;
    blueprintId: string;
    blueprintRevision: number;
    purpose?: ConstructionPlanPurpose;
    plan: ConstructionPlan;
}

export interface ConstructionPlanDocumentServiceOptions {
    plans: ConstructionPlanRepository;
    now?: () => string;
}

export class ConstructionPlanDocumentService {
    private readonly now: () => string;

    constructor(private readonly options: ConstructionPlanDocumentServiceOptions) {
        this.now = options.now ?? (() => new Date().toISOString());
    }

    commit(
        input: CommitConstructionPlanInput,
    ): Result<ConstructionPlanDocument, ConstructionPlanFailure> {
        if (input.id.trim().length === 0 || input.structureId.trim().length === 0) {
            return [null, ConstructionPlanFailures.invalidPlan('plan identity is required')];
        }
        if (input.plan.workPackages.length === 0) {
            return [null, ConstructionPlanFailures.invalidPlan('plan has no work packages')];
        }
        const [latest, latestError] = this.options.plans.latest(input.id);
        if (latestError) return [null, ConstructionPlanFailures.storage(latestError)];
        const revision = (latest?.revision ?? 0) + 1;
        const content = {
            id: input.id,
            revision,
            structureId: input.structureId,
            blueprintId: input.blueprintId,
            blueprintRevision: input.blueprintRevision,
            purpose: input.purpose ?? 'build',
            plan: input.plan,
            createdAt: this.now(),
        };
        const document: ConstructionPlanDocument = {
            ...content,
            hash: ConstructionPlanDocumentHash.of(content),
        };
        const [, writeError] = this.options.plans.insert(document);
        if (writeError) return [null, ConstructionPlanFailures.storage(writeError)];
        return [document, null];
    }

    get(
        id: string,
        revision: number,
    ): Result<ConstructionPlanDocument | null, ConstructionPlanFailure> {
        const [document, readError] = this.options.plans.get(id, revision);
        if (readError) return [null, ConstructionPlanFailures.storage(readError)];
        return [document, null];
    }

    latest(id: string): Result<ConstructionPlanDocument | null, ConstructionPlanFailure> {
        const [document, readError] = this.options.plans.latest(id);
        if (readError) return [null, ConstructionPlanFailures.storage(readError)];
        return [document, null];
    }
}
