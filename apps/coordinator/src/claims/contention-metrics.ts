import type { ClaimContentionSnapshot } from './types.js';

export class ClaimContentionMetrics {
    private claimWaitMilliseconds = 0;
    private duplicateAttempts = 0;
    private reclaims = 0;
    private leaseChurn = 0;

    recordWait(milliseconds: number): void {
        this.claimWaitMilliseconds += Math.max(0, milliseconds);
    }

    recordDuplicateAttempt(): void {
        this.duplicateAttempts += 1;
    }

    recordReclaim(): void {
        this.reclaims += 1;
    }

    recordLeaseChurn(): void {
        this.leaseChurn += 1;
    }

    snapshot(): ClaimContentionSnapshot {
        return {
            claimWaitMilliseconds: this.claimWaitMilliseconds,
            duplicateAttempts: this.duplicateAttempts,
            reclaims: this.reclaims,
            leaseChurn: this.leaseChurn,
        };
    }
}
