import type { Result } from '@ticrafter/core';

import type { ConstructionPhase } from './blueprint-document.js';
import { type BlueprintBlock, type BlueprintBlockState, BlueprintIr } from './blueprint-ir.js';
import type { BuildingFailure } from './failures.js';
import type { WorldBlockQueryPort, WorldBlockState } from './schematic-diff.js';

export type BlockChangeKind = 'place' | 'break' | 'replace';

export interface BlockChange {
    kind: BlockChangeKind;
    botId: string;
    target: BlueprintBlock;
    claimId?: string;
    grantId?: string;
    planId?: string;
    structureId?: string;
    blueprintId?: string;
    blueprintRevision?: number;
    workPackageId?: string;
    fencingToken?: number;
    phase?: ConstructionPhase;
}

export interface BlockVerification {
    satisfied: boolean;
    actual: WorldBlockState | null;
}

export class BlockVerifier {
    constructor(private readonly world: WorldBlockQueryPort) {}

    verifyBefore(change: BlockChange): Result<BlockVerification, BuildingFailure> {
        const [actual, actualError] = this.world.blockAt(BlueprintIr.position(change.target));
        if (actualError) return [null, actualError];
        if (actual === null || BlueprintIr.isAir(actual.name)) {
            return [{ satisfied: change.kind === 'break', actual }, null];
        }
        const matches = this.matches(change.target.state, actual);
        if (change.kind === 'place' || change.kind === 'replace') {
            return [{ satisfied: matches, actual }, null];
        }
        return [{ satisfied: false, actual }, null];
    }

    verifyAfter(change: BlockChange): Result<BlockVerification, BuildingFailure> {
        const [actual, actualError] = this.world.blockAt(BlueprintIr.position(change.target));
        if (actualError) return [null, actualError];
        if (change.kind === 'break') {
            return [
                {
                    satisfied: actual === null || BlueprintIr.isAir(actual.name),
                    actual,
                },
                null,
            ];
        }
        if (actual === null) return [{ satisfied: false, actual: null }, null];
        return [{ satisfied: this.matches(change.target.state, actual), actual }, null];
    }

    private matches(expected: BlueprintBlockState, actual: WorldBlockState): boolean {
        if (expected.name !== actual.name) return false;
        if (expected.properties === undefined) return true;
        const actualProperties = actual.properties ?? {};
        return Object.entries(expected.properties).every(
            ([key, value]) => actualProperties[key] === value,
        );
    }
}
