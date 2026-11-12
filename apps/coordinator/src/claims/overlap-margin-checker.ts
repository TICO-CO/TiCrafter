import type { Result } from '@ticrafter/core';

import { type SipBoundingBox, SipGeometry } from '../sip/index.js';
import { ClaimFailures } from './failures.js';
import type { ClaimFailure, ClaimRecord } from './types.js';

export class ClaimOverlapChecker {
    static check(
        bbox: SipBoundingBox,
        activeClaims: readonly ClaimRecord[],
        margin: number,
        ignoredClaimId: string | null = null,
        parentClaimId: string | null = null,
    ): Result<void, ClaimFailure> {
        if (!SipGeometry.isValidBbox(bbox)) {
            return [null, ClaimFailures.invalidClaim('invalid claim bbox')];
        }
        if (!Number.isFinite(margin) || margin < 0) {
            return [null, ClaimFailures.invalidClaim('invalid claim margin')];
        }
        const expanded = ClaimOverlapChecker.expand(bbox, margin);
        const overlapping = activeClaims.filter(
            (claim) =>
                claim.id !== ignoredClaimId &&
                ClaimOverlapChecker.sameFamily(claim, parentClaimId) === false &&
                SipGeometry.overlaps(expanded, claim.bbox),
        );
        if (overlapping.length > 0) {
            return [null, ClaimFailures.overlap(overlapping.map((claim) => claim.id))];
        }
        return [undefined, null];
    }

    private static sameFamily(claim: ClaimRecord, parentClaimId: string | null): boolean {
        if (parentClaimId === null) return false;
        return claim.id === parentClaimId || claim.parentClaimId === parentClaimId;
    }

    static expand(bbox: SipBoundingBox, margin: number): SipBoundingBox {
        return {
            min: {
                x: bbox.min.x - margin,
                y: bbox.min.y - margin,
                z: bbox.min.z - margin,
            },
            max: {
                x: bbox.max.x + margin,
                y: bbox.max.y + margin,
                z: bbox.max.z + margin,
            },
        };
    }
}
