import type { Result } from '@ticrafter/core';

import { type SipBoundingBox, SipGeometry } from '../sip/index.js';
import type { ClaimFailure, ClaimRecord } from './types.js';

export class ClaimOverlapChecker {
    static check(
        bbox: SipBoundingBox,
        activeClaims: readonly ClaimRecord[],
        margin: number,
        ignoredClaimId: string | null = null,
    ): Result<void, ClaimFailure> {
        if (!SipGeometry.isValidBbox(bbox)) {
            return [null, { type: 'INVALID_CLAIM', message: 'invalid claim bbox' }];
        }
        if (!Number.isFinite(margin) || margin < 0) {
            return [null, { type: 'INVALID_CLAIM', message: 'invalid claim margin' }];
        }
        const expanded = ClaimOverlapChecker.expand(bbox, margin);
        const overlapping = activeClaims.filter(
            (claim) => claim.id !== ignoredClaimId && SipGeometry.overlaps(expanded, claim.bbox),
        );
        if (overlapping.length > 0) {
            return [null, { type: 'OVERLAP', claimIds: overlapping.map((claim) => claim.id) }];
        }
        return [undefined, null];
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
