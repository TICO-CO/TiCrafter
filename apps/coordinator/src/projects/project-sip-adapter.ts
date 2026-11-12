import type { Result } from '@ticrafter/core';

import type {
    SipCommit,
    SipMutation,
    SipProposalInput,
    SipSnapshot,
    SipStructure,
} from '../sip/index.js';
import type { ProjectSipPort } from './types.js';

export interface ProjectSipAdapterOptions {
    loadSnapshot(): Result<SipSnapshot, unknown>;
    commit(input: SipProposalInput): Result<SipCommit, unknown>;
}

export class ProjectSipAdapter implements ProjectSipPort {
    constructor(private readonly options: ProjectSipAdapterOptions) {}

    propose(input: {
        projectId: string;
        botId: string;
        kind: 'home' | 'storage' | 'build';
        anchor: { x: number; y: number; z: number };
        rotation: number;
        bbox: {
            min: { x: number; y: number; z: number };
            max: { x: number; y: number; z: number };
        };
        structureId: string;
        blueprintRef: string;
        designRevision: number;
        materialsNeeded: readonly { item: string; count: number }[];
        workPackages: readonly {
            id: string;
            bbox: {
                min: { x: number; y: number; z: number };
                max: { x: number; y: number; z: number };
            };
            status: 'planned' | 'claimed' | 'building' | 'complete' | 'failed' | 'abandoned';
            claimedBy: string | null;
        }[];
        collaboration: 'private' | 'invite' | 'open';
        autoAcceptCompatibleHelpers: boolean;
        storageId: string | null;
        storagePosition: { x: number; y: number; z: number } | null;
    }): Result<void, string> {
        const [snapshot, snapshotError] = this.options.loadSnapshot();
        if (snapshotError) return [null, ProjectSipAdapter.describe(snapshotError)];
        if (snapshot === null) return [null, 'SIP snapshot missing'];
        const structure: SipStructure = {
            id: input.structureId,
            type: input.kind === 'storage' ? 'storage' : 'house',
            blueprintRef: input.blueprintRef,
            anchor: input.anchor,
            rotation: input.rotation,
            status: 'claimed',
            ownerBotIds: [input.botId],
            designRevision: input.designRevision,
            collaboration: input.collaboration,
            autoAcceptCompatibleHelpers: input.autoAcceptCompatibleHelpers,
            progress: 0,
            materialsNeeded: [...input.materialsNeeded],
            workPackages: input.workPackages.map((workPackage) => ({ ...workPackage })),
        };
        const mutations: SipMutation[] = [{ kind: 'structure.upsert', structure }];
        if (input.storageId !== null && input.storagePosition !== null) {
            mutations.push({
                kind: 'container.upsert',
                container: {
                    id: input.storageId,
                    pos: input.storagePosition,
                    role: 'storage',
                    reservedBy: input.botId,
                    contentsSnapshot: null,
                },
            });
        }
        return this.commit(input.projectId, input.botId, snapshot.revision, mutations, 'propose');
    }

    abandon(input: {
        projectId: string;
        botId: string;
        structureId: string | null;
        storageId: string | null;
    }): Result<void, string> {
        const [snapshot, snapshotError] = this.options.loadSnapshot();
        if (snapshotError) return [null, ProjectSipAdapter.describe(snapshotError)];
        if (snapshot === null) return [null, 'SIP snapshot missing'];
        const structure = snapshot.structures.find(
            (candidate) => candidate.id === input.structureId,
        );
        if (structure === undefined) return [undefined, null];
        const abandoned: SipStructure = { ...structure, status: 'abandoned' };
        const mutations: SipMutation[] = [{ kind: 'structure.upsert', structure: abandoned }];
        if (input.storageId !== null) {
            mutations.push({ kind: 'container.remove', containerId: input.storageId });
        }
        return this.commit(input.projectId, input.botId, snapshot.revision, mutations, 'abandon');
    }

    private commit(
        projectId: string,
        botId: string,
        expectedRevision: number,
        mutations: readonly SipMutation[],
        action: 'propose' | 'abandon',
    ): Result<void, string> {
        const [committed, commitError] = this.options.commit({
            metadata: {
                actor: botId,
                expectedRevision,
                idempotencyKey: `project:${projectId}:${action}`,
            },
            mutations,
        });
        if (commitError) return [null, ProjectSipAdapter.describe(commitError)];
        if (committed === null) return [null, 'SIP commit returned null'];
        return [undefined, null];
    }

    private static describe(error: unknown): string {
        if (typeof error === 'string') return error;
        if (error instanceof Error) return error.message;
        if (typeof error === 'object' && error !== null && 'type' in error) {
            const typed = error as {
                type: string;
                message?: string;
                failure?: { message?: string };
            };
            if (typed.message !== undefined) return `${typed.type}: ${typed.message}`;
            if (typed.failure?.message !== undefined) {
                return `${typed.type}: ${typed.failure.message}`;
            }
            return typed.type;
        }
        return String(error);
    }
}
