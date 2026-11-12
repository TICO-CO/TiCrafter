import type { BlockUpdateMessage, Result } from '@ticrafter/core';

import type { ClaimService } from '../claims/index.js';
import type { GrantService } from '../grants/index.js';
import { SipGeometry, type SipSnapshot, type SipStructure } from '../sip/index.js';

export type ConstructionEditDecision =
    { authorized: true } | { authorized: false; reason: string; taskId: string | null };

export interface ConstructionEditAuthorizerOptions {
    claims: ClaimService;
    grants: GrantService;
    sip: { loadSnapshot(): Result<SipSnapshot, unknown> };
}

const AIR_BLOCKS: ReadonlySet<string> = new Set(['air', 'cave_air', 'void_air']);
const ACTIVE_STRUCTURE_STATUSES: ReadonlySet<string> = new Set(['planned', 'claimed', 'building']);

export class ConstructionEditAuthorizer {
    constructor(private readonly options: ConstructionEditAuthorizerOptions) {}

    authorize(
        update: BlockUpdateMessage,
        beforeBlockId: string | null,
    ): Result<ConstructionEditDecision, string> {
        const [snapshot, snapshotError] = this.options.sip.loadSnapshot();
        if (snapshotError) return [null, String(snapshotError)];
        if (snapshot === null) return [null, 'sip snapshot missing'];
        const structure = this.structure(snapshot, update);
        if (structure === null) return [{ authorized: true }, null];
        const attribution = update.attribution;
        if (attribution === undefined) {
            return [
                {
                    authorized: false,
                    reason: 'active structure edit is missing attribution',
                    taskId: null,
                },
                null,
            ];
        }
        return this.authorizeAttributed(structure, update, beforeBlockId, attribution);
    }

    private authorizeAttributed(
        structure: SipStructure,
        update: BlockUpdateMessage,
        beforeBlockId: string | null,
        attribution: NonNullable<BlockUpdateMessage['attribution']>,
    ): Result<ConstructionEditDecision, string> {
        const operations = ConstructionEditAuthorizer.operations(
            beforeBlockId,
            update.block.blockId,
        );
        if (attribution.claimId === undefined || attribution.fencingToken === undefined) {
            return [
                {
                    authorized: false,
                    reason: 'active structure edit is missing claim fencing metadata',
                    taskId: attribution.taskId ?? null,
                },
                null,
            ];
        }
        const [claim, claimError] = this.options.claims.authorizeScope({
            claimId: attribution.claimId,
            fencingToken: attribution.fencingToken,
            position: update.block.position,
            structureId: structure.id,
            ...(attribution.workPackageId === undefined
                ? {}
                : { workPackageId: attribution.workPackageId }),
        });
        if (claimError) {
            return [
                {
                    authorized: false,
                    reason: `claim rejected: ${claimError.type}`,
                    taskId: attribution.taskId ?? null,
                },
                null,
            ];
        }
        if (claim === null) {
            return [
                {
                    authorized: false,
                    reason: 'claim rejected',
                    taskId: attribution.taskId ?? null,
                },
                null,
            ];
        }
        if (claim.botId === update.botId) return [{ authorized: true }, null];
        return this.authorizeHelper(structure, update, operations, attribution);
    }

    private authorizeHelper(
        structure: SipStructure,
        update: BlockUpdateMessage,
        operations: readonly ('place' | 'break')[],
        attribution: NonNullable<BlockUpdateMessage['attribution']>,
    ): Result<ConstructionEditDecision, string> {
        if (attribution.grantId === undefined || attribution.grantFencingToken === undefined) {
            return [
                {
                    authorized: false,
                    reason: 'helper edit is missing grant fencing metadata',
                    taskId: attribution.taskId ?? null,
                },
                null,
            ];
        }
        const [grant, grantError] = this.options.grants.authorize({
            grantId: attribution.grantId,
            botId: update.botId,
            fencingToken: attribution.grantFencingToken,
            bbox: SipGeometry.singleBlock(update.block.position),
            operations,
        });
        if (grantError) {
            return [
                {
                    authorized: false,
                    reason: `grant rejected: ${grantError.type}`,
                    taskId: attribution.taskId ?? null,
                },
                null,
            ];
        }
        if (grant === null) {
            return [
                {
                    authorized: false,
                    reason: 'grant rejected',
                    taskId: attribution.taskId ?? null,
                },
                null,
            ];
        }
        if (grant.structureId !== structure.id) {
            return [
                {
                    authorized: false,
                    reason: 'grant structure mismatch',
                    taskId: attribution.taskId ?? null,
                },
                null,
            ];
        }
        return [{ authorized: true }, null];
    }

    private structure(snapshot: SipSnapshot, update: BlockUpdateMessage): SipStructure | null {
        const id = update.attribution?.structureId;
        if (id !== undefined) {
            return (
                snapshot.structures.find(
                    (structure) =>
                        structure.id === id && ACTIVE_STRUCTURE_STATUSES.has(structure.status),
                ) ?? null
            );
        }
        return (
            snapshot.structures.find(
                (structure) =>
                    ACTIVE_STRUCTURE_STATUSES.has(structure.status) &&
                    SipGeometry.pointInBbox(
                        update.block.position,
                        ConstructionEditAuthorizer.bounds(structure),
                    ),
            ) ?? null
        );
    }

    private static bounds(structure: SipStructure) {
        const boxes = [
            SipGeometry.singleBlock(structure.anchor),
            ...structure.workPackages.map((workPackage) => workPackage.bbox),
        ];
        return SipGeometry.bboxFromBboxes(boxes) ?? SipGeometry.singleBlock(structure.anchor);
    }

    private static operations(
        beforeBlockId: string | null,
        afterBlockId: string,
    ): readonly ('place' | 'break')[] {
        const beforeAir = beforeBlockId === null || AIR_BLOCKS.has(beforeBlockId);
        const afterAir = AIR_BLOCKS.has(afterBlockId);
        if (beforeAir && !afterAir) return ['place'];
        if (!beforeAir && afterAir) return ['break'];
        return ['place', 'break'];
    }
}
