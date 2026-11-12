import type { BlueprintDocument, ConstructionPlanDocument } from '@ticrafter/building';
import type { Result } from '@ticrafter/core';
import type { StorageFailure } from '@ticrafter/memory';

import type { AgencyStateRecord } from '../bots/index.js';
import type { BotProfile } from '../bots/index.js';
import type {
    SipBlockPosition,
    SipBoundingBox,
    SipCollaborationPolicy,
    SipMaterialNeed,
    SipWorkPackage,
} from '../sip/index.js';

export type PersonalProjectKind = 'home' | 'storage' | 'build';

export type PersonalProjectStatus = 'proposed' | 'active' | 'completed' | 'abandoned' | 'failed';

export interface ProjectClaimReference {
    claimId: string;
    fencingToken: number;
    resourceId?: string;
    resourceType?: 'structure' | 'work_package' | 'container';
}

export interface PersonalProjectRecord {
    id: string;
    botId: string;
    title: string;
    kind: PersonalProjectKind;
    status: PersonalProjectStatus;
    anchor: SipBlockPosition;
    bbox: SipBoundingBox;
    claims: readonly ProjectClaimReference[];
    structureId: string | null;
    storageId: string | null;
    reason: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface ProposeProjectInput {
    id: string;
    botId: string;
    title: string;
    kind: PersonalProjectKind;
    anchor: SipBlockPosition;
    bbox: SipBoundingBox;
    storagePosition?: SipBlockPosition | null;
    collaboration?: SipCollaborationPolicy;
    autoAcceptCompatibleHelpers?: boolean;
}

export interface ProjectClaimPort {
    acquire(
        input: {
            id: string;
            resourceType: 'structure' | 'work_package' | 'container';
            resourceId: string;
            bbox: SipBoundingBox;
            botId: string;
            parentClaimId?: string | null;
            payload?: Readonly<Record<string, unknown>>;
            leaseTtlMilliseconds?: number;
        },
        now?: string,
    ): Result<{ id: string; fencingToken: number }, string>;
    release(
        claimId: string,
        botId: string,
        fencingToken: number,
        now?: string,
    ): Result<void, string>;
}

export interface ProjectSipPort {
    propose(input: {
        projectId: string;
        botId: string;
        kind: PersonalProjectKind;
        anchor: SipBlockPosition;
        rotation: number;
        bbox: SipBoundingBox;
        structureId: string;
        blueprintRef: string;
        designRevision: number;
        materialsNeeded: readonly SipMaterialNeed[];
        workPackages: readonly SipWorkPackage[];
        collaboration: SipCollaborationPolicy;
        autoAcceptCompatibleHelpers: boolean;
        storageId: string | null;
        storagePosition: SipBlockPosition | null;
    }): Result<void, string>;
    abandon(input: {
        projectId: string;
        botId: string;
        structureId: string | null;
        storageId: string | null;
    }): Result<void, string>;
}

export interface ProjectConstructionArtifacts {
    blueprint: BlueprintDocument;
    plan: ConstructionPlanDocument;
    bbox: SipBoundingBox;
}

export interface ProjectConstructionTaskInput {
    projectId: string;
    structureId: string;
    title: string;
    botId: string;
    ownerBotId: string;
    collaboration: SipCollaborationPolicy;
    blueprint: BlueprintDocument;
    plan: ConstructionPlanDocument;
    claims: readonly ProjectClaimReference[];
}

export interface ProjectConstructionPort {
    prepare(input: {
        projectId: string;
        structureId: string;
        botId: string;
        kind: PersonalProjectKind;
        anchor: SipBlockPosition;
        bbox: SipBoundingBox;
    }): Result<ProjectConstructionArtifacts, string>;
    seedTasks(input: ProjectConstructionTaskInput): Result<readonly string[], string>;
    cancelTasks(taskIds: readonly string[]): Result<void, string>;
    cancelProjectTasks(projectId: string): Result<void, string>;
}

export interface ProjectRepairPort {
    prepare(input: {
        projectId: string;
        structureId: string;
        botId: string;
        anchor: SipBlockPosition;
        bbox: SipBoundingBox;
    }): Result<ProjectConstructionArtifacts | null, string>;
}

export interface ProjectRollbackPort {
    prepare(input: {
        projectId: string;
        structureId: string;
        botId: string;
        anchor: SipBlockPosition;
        bbox: SipBoundingBox;
    }): Result<ProjectConstructionArtifacts | null, string>;
}

export interface ProjectGrantPort {
    revokeStructure(structureId: string): Result<void, string>;
}

export interface ReviseProjectInput {
    projectId: string;
    botId: string;
    title?: string;
    kind?: PersonalProjectKind;
    anchor?: SipBlockPosition;
    bbox?: SipBoundingBox;
    collaboration?: SipCollaborationPolicy;
    autoAcceptCompatibleHelpers?: boolean;
}

export interface ProjectBotPort {
    get(botId: string): Result<BotProfile | null, StorageFailure>;
    save(profile: BotProfile): Result<void, StorageFailure>;
}

export interface ProjectAgencyPort {
    load(botId: string): Result<AgencyStateRecord | null, StorageFailure>;
    save(state: AgencyStateRecord): Result<void, StorageFailure>;
}

export interface ProjectEpisodePort {
    append(input: {
        id: string;
        botId: string;
        goalId: string | null;
        kind: string;
        summary: string;
        position: { x: number; y: number; z: number } | null;
        relatedBotId: string | null;
        payload: unknown;
        createdAt: string;
    }): Result<void, StorageFailure>;
}

export interface ProjectEventPort {
    append(input: {
        botId: string;
        type: string;
        payload: unknown;
        actor: string;
        createdAt: string;
    }): Result<unknown, StorageFailure>;
}

export type ProjectFailure =
    | { type: 'STORAGE'; failure: StorageFailure }
    | { type: 'INVALID_PROJECT'; message: string }
    | { type: 'PROJECT_NOT_FOUND'; projectId: string }
    | { type: 'PROJECT_EXISTS'; projectId: string }
    | { type: 'OWNER_MISMATCH'; projectId: string; botId: string }
    | { type: 'BOT_NOT_FOUND'; botId: string }
    | { type: 'CLAIM_FAILED'; message: string }
    | { type: 'CONSTRUCTION_FAILED'; message: string }
    | { type: 'TASK_FAILED'; message: string }
    | { type: 'SIP_FAILED'; message: string }
    | { type: 'PROFILE_FAILED'; message: string }
    | { type: 'AGENCY_FAILED'; message: string };
