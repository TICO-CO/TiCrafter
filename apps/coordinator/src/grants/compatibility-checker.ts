import type { Result } from '@ticrafter/core';

import { SipGeometry } from '../sip/index.js';
import type { CompatibilityInput, GrantFailure } from './types.js';

export class GrantCompatibilityChecker {
    check(input: CompatibilityInput): Result<void, GrantFailure> {
        if (input.observedDesignRevision !== input.structure.designRevision) {
            return [
                null,
                {
                    type: 'REVISION_MISMATCH',
                    expected: input.structure.designRevision,
                    actual: input.observedDesignRevision,
                },
            ];
        }
        const [, requestError] = this.validateRequest(input);
        if (requestError) return [null, requestError];
        const footprint = this.structureFootprint(input);
        if (!SipGeometry.overlaps(footprint, input.bbox)) {
            return [
                null,
                {
                    type: 'OUT_OF_SCOPE',
                    message: `request bbox is outside structure ${input.structure.id}`,
                },
            ];
        }
        const [, ruleError] = this.validateRules(input);
        if (ruleError) return [null, ruleError];
        const [, claimError] = this.validateClaims(input);
        if (claimError) return [null, claimError];
        if (input.allowCompletedWork) return [undefined, null];
        return this.validateCompletedWork(input);
    }

    private validateRequest(input: CompatibilityInput): Result<void, GrantFailure> {
        if (!SipGeometry.isValidBbox(input.bbox)) {
            return [null, { type: 'INVALID_REQUEST', message: 'request bbox is inverted' }];
        }
        if (input.proposedOps.length === 0) {
            return [
                null,
                { type: 'INVALID_REQUEST', message: 'at least one operation is required' },
            ];
        }
        if (new Set(input.proposedOps).size !== input.proposedOps.length) {
            return [null, { type: 'INVALID_REQUEST', message: 'operations must be unique' }];
        }
        return [undefined, null];
    }

    private validateRules(input: CompatibilityInput): Result<void, GrantFailure> {
        const protectedOverlap = input.snapshot.rules.protectedBboxes.some((bbox) =>
            SipGeometry.overlaps(bbox, input.bbox),
        );
        if (protectedOverlap) {
            return [
                null,
                {
                    type: 'PROTECTED_REGION',
                    message: `request overlaps a protected region`,
                },
            ];
        }
        const noBuildOverlap = input.snapshot.zones.some((zone) => {
            if (zone.type !== 'no_build') return false;
            const zoneBbox = SipGeometry.bboxFromPositions(zone.polygon);
            if (zoneBbox === null) return false;
            return SipGeometry.overlaps(zoneBbox, input.bbox);
        });
        if (noBuildOverlap) {
            return [null, { type: 'NO_BUILD_ZONE', message: 'request overlaps a no-build zone' }];
        }
        return [undefined, null];
    }

    private validateClaims(input: CompatibilityInput): Result<void, GrantFailure> {
        const claimIds = input.claims
            .filter(
                (claim) =>
                    claim.botId !== input.requesterBotId &&
                    SipGeometry.overlaps(claim.bbox, input.bbox),
            )
            .map((claim) => claim.id);
        if (claimIds.length > 0) return [null, { type: 'CLAIM_COLLISION', claimIds }];
        const claimedPackages = input.structure.workPackages
            .filter(
                (workPackage) =>
                    workPackage.claimedBy !== null &&
                    workPackage.claimedBy !== input.requesterBotId &&
                    SipGeometry.overlaps(workPackage.bbox, input.bbox),
            )
            .map((workPackage) => workPackage.id);
        if (claimedPackages.length > 0) {
            return [null, { type: 'CLAIM_COLLISION', claimIds: claimedPackages }];
        }
        return [undefined, null];
    }

    private validateCompletedWork(input: CompatibilityInput): Result<void, GrantFailure> {
        const completed = input.structure.workPackages
            .filter(
                (workPackage) =>
                    workPackage.status === 'complete' &&
                    SipGeometry.overlaps(workPackage.bbox, input.bbox),
            )
            .map((workPackage) => workPackage.id);
        if (completed.length > 0) {
            return [null, { type: 'COMPLETED_WORK_COLLISION', workPackageIds: completed }];
        }
        return [undefined, null];
    }

    private structureFootprint(input: CompatibilityInput) {
        const boxes = [
            SipGeometry.singleBlock(input.structure.anchor),
            ...input.structure.workPackages.map((workPackage) => workPackage.bbox),
        ];
        const footprint = SipGeometry.bboxFromBboxes(boxes);
        return footprint ?? SipGeometry.singleBlock(input.structure.anchor);
    }
}
