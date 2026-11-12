import { createHash } from 'node:crypto';

import { BlueprintDocumentHash } from './blueprint-document.js';
import type { ConstructionPlan } from './construction-types.js';

export type ConstructionPlanPurpose = 'build' | 'repair' | 'rollback' | 'renovation';

export interface ConstructionPlanDocument {
    id: string;
    revision: number;
    hash: string;
    structureId: string;
    blueprintId: string;
    blueprintRevision: number;
    purpose: ConstructionPlanPurpose;
    plan: ConstructionPlan;
    createdAt: string;
}

export type ConstructionPlanDocumentContent = Omit<ConstructionPlanDocument, 'hash'>;

export class ConstructionPlanDocumentHash {
    static of(document: ConstructionPlanDocumentContent): string {
        return createHash('sha256')
            .update(BlueprintDocumentHash.canonicalJson(document))
            .digest('hex');
    }
}
