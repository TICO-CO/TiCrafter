import type { LoggerPort, Result } from '@ticrafter/core';
import type { StorageFailure } from '@ticrafter/memory';

import type { AgencyStateRecord } from '../bots/index.js';
import { type SipBlockPosition, type SipBoundingBox, SipGeometry } from '../sip/index.js';
import { PersonalProjectRepository } from './project-repository.js';
import type {
    PersonalProjectRecord,
    ProjectAgencyPort,
    ProjectBotPort,
    ProjectClaimPort,
    ProjectEpisodePort,
    ProjectEventPort,
    ProjectFailure,
    ProjectSipPort,
    ProposeProjectInput,
} from './types.js';

export interface PersonalProjectServiceOptions {
    projects: PersonalProjectRepository;
    claims: ProjectClaimPort;
    bots: ProjectBotPort;
    agency: ProjectAgencyPort;
    episodes: ProjectEpisodePort;
    events: ProjectEventPort;
    sip: ProjectSipPort;
    logger: LoggerPort;
    now?: () => string;
    id?: () => string;
}

const PROJECT_CLAIM_TTL_MILLISECONDS = 24 * 60 * 60 * 1000;

export class PersonalProjectService {
    private readonly now: () => string;
    private readonly nextId: () => string;

    constructor(private readonly options: PersonalProjectServiceOptions) {
        this.now = options.now ?? (() => new Date().toISOString());
        this.nextId = options.id ?? (() => crypto.randomUUID());
    }

    propose(input: ProposeProjectInput): Result<PersonalProjectRecord, ProjectFailure> {
        const validation = PersonalProjectService.validate(input);
        if (validation !== null) return [null, validation];
        const [existing, existingError] = this.options.projects.get(input.id);
        if (existingError) return [null, { type: 'STORAGE', failure: existingError }];
        if (existing !== null) return [null, { type: 'PROJECT_EXISTS', projectId: input.id }];
        const [duplicateHome, duplicateError] = this.duplicateHome(input);
        if (duplicateError) return [null, duplicateError];
        if (duplicateHome) {
            return [null, { type: 'PROJECT_EXISTS', projectId: `home:${input.botId}` }];
        }
        const [profile, profileError] = this.options.bots.get(input.botId);
        if (profileError) return [null, { type: 'STORAGE', failure: profileError }];
        if (profile === null) return [null, { type: 'BOT_NOT_FOUND', botId: input.botId }];
        const now = this.now();
        const structureId = `structure.project.${input.id}`;
        const storageId =
            input.storagePosition === undefined || input.storagePosition === null
                ? null
                : `container.project.${input.id}`;
        const [claims, claimError] = this.acquireClaims(input, structureId, storageId, now);
        if (claimError) return [null, claimError];
        if (claims === null) return [null, { type: 'CLAIM_FAILED', message: 'claims missing' }];
        const [, sipError] = this.options.sip.propose({
            projectId: input.id,
            botId: input.botId,
            kind: input.kind,
            anchor: input.anchor,
            bbox: input.bbox,
            structureId,
            storageId,
            storagePosition: input.storagePosition ?? null,
        });
        if (sipError) {
            this.releaseClaims(input.botId, claims, now);
            return [null, { type: 'SIP_FAILED', message: sipError }];
        }
        const record: PersonalProjectRecord = {
            id: input.id,
            botId: input.botId,
            title: input.title,
            kind: input.kind,
            status: 'active',
            anchor: input.anchor,
            bbox: input.bbox,
            claims,
            structureId,
            storageId,
            reason: null,
            createdAt: now,
            updatedAt: now,
        };
        const [, insertError] = this.options.projects.insert(record);
        if (insertError) {
            this.releaseClaims(input.botId, claims, now);
            this.options.sip.abandon({
                projectId: input.id,
                botId: input.botId,
                structureId,
                storageId,
            });
            return [null, { type: 'STORAGE', failure: insertError }];
        }
        const [, profileSaveError] = this.options.bots.save({
            ...profile,
            homeStructureId: input.kind === 'home' ? structureId : profile.homeStructureId,
            updatedAt: now,
        });
        if (profileSaveError) {
            this.rollback(record, now);
            return [null, { type: 'PROFILE_FAILED', message: profileSaveError.message }];
        }
        const [, agencyError] = this.assignAgency(
            input.botId,
            input.kind,
            structureId,
            storageId,
            now,
        );
        if (agencyError) {
            this.rollback(record, now);
            return [null, agencyError];
        }
        this.recordProposal(record, now);
        return [record, null];
    }

    abandon(
        projectId: string,
        botId: string,
        reason: string,
    ): Result<PersonalProjectRecord, ProjectFailure> {
        const [project, readError] = this.options.projects.get(projectId);
        if (readError) return [null, { type: 'STORAGE', failure: readError }];
        if (project === null) return [null, { type: 'PROJECT_NOT_FOUND', projectId }];
        if (project.botId !== botId) {
            return [null, { type: 'OWNER_MISMATCH', projectId, botId }];
        }
        const now = this.now();
        this.releaseClaims(botId, project.claims, now);
        const [, sipError] = this.options.sip.abandon({
            projectId: project.id,
            botId,
            structureId: project.structureId,
            storageId: project.storageId,
        });
        if (sipError) this.logFailure({ error: sipError }, 'project SIP abandon failed');
        const abandoned: PersonalProjectRecord = {
            ...project,
            status: 'abandoned',
            claims: [],
            reason,
            updatedAt: now,
        };
        const [, updateError] = this.options.projects.update(abandoned);
        if (updateError) return [null, { type: 'STORAGE', failure: updateError }];
        const [, clearError] = this.clearHome(botId, project, now);
        if (clearError) return [null, clearError];
        this.recordEpisode({
            botId,
            title: abandoned.title,
            kind: 'project.abandoned',
            summary: `Abandoned ${abandoned.title}: ${reason}`,
            position: project.anchor,
            projectId: abandoned.id,
            reason,
            now,
        });
        this.appendEvent(
            botId,
            'project.abandoned',
            {
                projectId: abandoned.id,
                reason,
            },
            now,
        );
        return [abandoned, null];
    }

    listForBot(botId: string): Result<readonly PersonalProjectRecord[], ProjectFailure> {
        const [projects, readError] = this.options.projects.listByBot(botId);
        if (readError) return [null, { type: 'STORAGE', failure: readError }];
        return [projects, null];
    }

    findActiveHome(botId: string): Result<PersonalProjectRecord | null, ProjectFailure> {
        const [projects, readError] = this.options.projects.listByBot(botId);
        if (readError) return [null, { type: 'STORAGE', failure: readError }];
        if (projects === null) {
            return [
                null,
                { type: 'STORAGE', failure: { type: 'READ_FAILED', message: 'projects missing' } },
            ];
        }
        return [
            projects.find(
                (project) =>
                    project.kind === 'home' &&
                    (project.status === 'proposed' || project.status === 'active'),
            ) ?? null,
            null,
        ];
    }

    private duplicateHome(input: ProposeProjectInput): Result<boolean, ProjectFailure> {
        if (input.kind !== 'home') return [false, null];
        const [home, homeError] = this.findActiveHome(input.botId);
        if (homeError) return [null, homeError];
        return [home !== null, null];
    }

    private acquireClaims(
        input: ProposeProjectInput,
        structureId: string,
        storageId: string | null,
        now: string,
    ): Result<readonly { claimId: string; fencingToken: number }[], ProjectFailure> {
        const structureClaim = this.options.claims.acquire(
            {
                id: `claim.project.${input.id}.structure`,
                resourceType: 'structure',
                resourceId: structureId,
                bbox: input.bbox,
                botId: input.botId,
                payload: { projectId: input.id, kind: input.kind },
                leaseTtlMilliseconds: PROJECT_CLAIM_TTL_MILLISECONDS,
            },
            now,
        );
        if (structureClaim[1]) {
            return [null, { type: 'CLAIM_FAILED', message: structureClaim[1] }];
        }
        if (structureClaim[0] === null) {
            return [null, { type: 'CLAIM_FAILED', message: 'structure claim missing' }];
        }
        const claims = [
            { claimId: structureClaim[0].id, fencingToken: structureClaim[0].fencingToken },
        ];
        if (
            storageId === null ||
            input.storagePosition === undefined ||
            input.storagePosition === null
        ) {
            return [claims, null];
        }
        const storageBox = PersonalProjectService.singleBlock(input.storagePosition);
        if (SipGeometry.contains(input.bbox, storageBox)) return [claims, null];
        const storageClaim = this.options.claims.acquire(
            {
                id: `claim.project.${input.id}.storage`,
                resourceType: 'container',
                resourceId: storageId,
                bbox: storageBox,
                botId: input.botId,
                payload: { projectId: input.id, kind: input.kind },
                leaseTtlMilliseconds: PROJECT_CLAIM_TTL_MILLISECONDS,
            },
            now,
        );
        if (storageClaim[1]) {
            this.releaseClaims(input.botId, claims, now);
            return [null, { type: 'CLAIM_FAILED', message: storageClaim[1] }];
        }
        if (storageClaim[0] === null) {
            this.releaseClaims(input.botId, claims, now);
            return [null, { type: 'CLAIM_FAILED', message: 'storage claim missing' }];
        }
        claims.push({
            claimId: storageClaim[0].id,
            fencingToken: storageClaim[0].fencingToken,
        });
        return [claims, null];
    }

    private clearHome(
        botId: string,
        project: PersonalProjectRecord,
        now: string,
    ): Result<void, ProjectFailure> {
        const [profile, profileError] = this.options.bots.get(botId);
        if (profileError) return [null, { type: 'STORAGE', failure: profileError }];
        if (profile !== null && profile.homeStructureId === project.structureId) {
            const [, saveError] = this.options.bots.save({
                ...profile,
                homeStructureId: null,
                updatedAt: now,
            });
            if (saveError) return [null, { type: 'PROFILE_FAILED', message: saveError.message }];
        }
        const [agency, agencyError] = this.options.agency.load(botId);
        if (agencyError) return [null, { type: 'STORAGE', failure: agencyError }];
        if (agency === null) return [undefined, null];
        const clearsHome = agency.homeStructureId === project.structureId;
        const clearsStorage = agency.personalStorageId === project.storageId;
        if (!clearsHome && !clearsStorage) return [undefined, null];
        const cleared: AgencyStateRecord = {
            ...agency,
            homeStructureId: clearsHome ? null : agency.homeStructureId,
            personalStorageId: clearsStorage ? null : agency.personalStorageId,
            updatedAt: now,
        };
        const [, agencySaveError] = this.options.agency.save(cleared);
        if (agencySaveError) {
            return [null, { type: 'AGENCY_FAILED', message: agencySaveError.message }];
        }
        return [undefined, null];
    }

    private assignAgency(
        botId: string,
        kind: ProposeProjectInput['kind'],
        structureId: string,
        storageId: string | null,
        now: string,
    ): Result<void, ProjectFailure> {
        const [agency, agencyError] = this.options.agency.load(botId);
        if (agencyError) return [null, { type: 'STORAGE', failure: agencyError }];
        if (agency === null) return [undefined, null];
        const [, saveError] = this.options.agency.save({
            ...agency,
            homeStructureId: kind === 'home' ? structureId : agency.homeStructureId,
            personalStorageId: storageId ?? agency.personalStorageId,
            updatedAt: now,
        });
        if (saveError) return [null, { type: 'AGENCY_FAILED', message: saveError.message }];
        return [undefined, null];
    }

    private rollback(record: PersonalProjectRecord, now: string): void {
        this.releaseClaims(record.botId, record.claims, now);
        this.options.sip.abandon({
            projectId: record.id,
            botId: record.botId,
            structureId: record.structureId,
            storageId: record.storageId,
        });
        const [, updateError] = this.options.projects.update({
            ...record,
            status: 'failed',
            claims: [],
            reason: 'project setup failed',
            updatedAt: now,
        });
        if (updateError) this.logFailure({ error: updateError }, 'project rollback failed');
        const [, clearError] = this.clearHome(record.botId, record, now);
        if (clearError)
            this.logFailure({ error: clearError }, 'project rollback home clear failed');
    }

    private releaseClaims(
        botId: string,
        claims: readonly { claimId: string; fencingToken: number }[],
        now: string,
    ): void {
        claims.forEach((claim) => {
            const [, releaseError] = this.options.claims.release(
                claim.claimId,
                botId,
                claim.fencingToken,
                now,
            );
            if (releaseError)
                this.logFailure({ error: releaseError }, 'project claim release failed');
        });
    }

    private recordProposal(record: PersonalProjectRecord, now: string): void {
        this.recordEpisode({
            botId: record.botId,
            title: record.title,
            kind: 'project.proposed',
            summary: `Started ${record.title}`,
            position: record.anchor,
            projectId: record.id,
            reason: null,
            now,
        });
        this.appendEvent(
            record.botId,
            'project.proposed',
            {
                projectId: record.id,
                kind: record.kind,
                structureId: record.structureId,
            },
            now,
        );
    }

    private recordEpisode(input: {
        botId: string;
        title: string;
        kind: string;
        summary: string;
        position: SipBlockPosition;
        projectId: string;
        reason: string | null;
        now: string;
    }): void {
        const [, episodeError] = this.options.episodes.append({
            id: this.nextId(),
            botId: input.botId,
            goalId: null,
            kind: input.kind,
            summary: input.summary,
            position: input.position,
            relatedBotId: null,
            payload: {
                projectId: input.projectId,
                title: input.title,
                reason: input.reason,
            },
            createdAt: input.now,
        });
        if (episodeError) this.logFailure({ error: episodeError }, 'project episode failed');
    }

    private appendEvent(botId: string, type: string, payload: unknown, now: string): void {
        const [, eventError] = this.options.events.append({
            botId,
            type,
            payload,
            actor: botId,
            createdAt: now,
        });
        if (eventError) this.logFailure({ error: eventError }, 'project event failed');
    }

    private logFailure(fields: Readonly<Record<string, unknown>>, message: string): void {
        this.options.logger.warn(fields, message);
    }

    private static validate(input: ProposeProjectInput): ProjectFailure | null {
        if (input.id.trim().length === 0) {
            return { type: 'INVALID_PROJECT', message: 'project id is required' };
        }
        if (input.botId.trim().length === 0) {
            return { type: 'INVALID_PROJECT', message: 'bot id is required' };
        }
        if (input.title.trim().length === 0) {
            return { type: 'INVALID_PROJECT', message: 'project title is required' };
        }
        if (!SipGeometry.isValidBbox(input.bbox)) {
            return { type: 'INVALID_PROJECT', message: 'project bbox is invalid' };
        }
        return null;
    }

    private static singleBlock(position: SipBlockPosition): SipBoundingBox {
        return { min: position, max: position };
    }
}
