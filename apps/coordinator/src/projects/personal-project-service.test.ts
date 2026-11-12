import { NeedsModel, PersonalityModel } from '@ticrafter/agency';
import { AgentEpisodeRepository, EventLogWriter, TransactionManager } from '@ticrafter/memory';
import { afterEach, describe, expect, it } from 'bun:test';

import {
    AgencyStateStore,
    BotNamePoolAllocator,
    type BotProfile,
    BotProfileStore,
} from '../bots/index.js';
import { ClaimFixtures, ClaimService } from '../claims/index.js';
import type { CoordinatorDatabase } from '../core/index.js';
import { CoordinatorTestSupport } from '../testing/index.js';
import { PersonalProjectService } from './personal-project-service.js';
import { PersonalProjectRepository } from './project-repository.js';
import type { ProjectSipPort } from './types.js';

const now = '2026-11-12T10:00:00.000Z';

class FakeSip implements ProjectSipPort {
    readonly proposed: string[] = [];
    readonly abandoned: string[] = [];

    propose(input: { projectId: string }): ReturnType<ProjectSipPort['propose']> {
        this.proposed.push(input.projectId);
        return [undefined, null];
    }

    abandon(input: { projectId: string }): ReturnType<ProjectSipPort['abandon']> {
        this.abandoned.push(input.projectId);
        return [undefined, null];
    }
}

const projectInput = (botId: string, id = 'project-1') => ({
    id,
    botId,
    title: 'Home of TiBot1',
    kind: 'home' as const,
    anchor: { x: 10, y: 64, z: 10 },
    bbox: { min: { x: 10, y: 64, z: 10 }, max: { x: 16, y: 67, z: 16 } },
    storagePosition: { x: 11, y: 65, z: 15 },
});

describe('PersonalProjectService', () => {
    const fresh = () => {
        const [database, openError] = CoordinatorTestSupport.openDatabase();
        expect(openError).toBeNull();
        expect(database).not.toBeNull();
        const coordinatorDatabase = database as CoordinatorDatabase;
        const profiles = new BotProfileStore(coordinatorDatabase);
        const [profile, allocateError] = new BotNamePoolAllocator().allocate(
            ['TiBot1', 'TiBot2'],
            0,
            now,
        );
        expect(allocateError).toBeNull();
        expect(profile).not.toBeNull();
        const allocated = profile as BotProfile;
        profiles.save(allocated);
        const agency = new AgencyStateStore(coordinatorDatabase);
        agency.save({
            botId: allocated.botId,
            traits: PersonalityModel.fromBotIndex(0),
            needs: NeedsModel.create()[0] as NeedsModel,
            intention: null,
            routine: { phase: 'day', lastMealAt: null, lastRestAt: null },
            homeStructureId: null,
            personalStorageId: null,
            mood: 'calm',
            lastDeliberationAt: null,
            updatedAt: now,
        });
        const claims = new ClaimService({
            database: coordinatorDatabase,
            transactions: new TransactionManager(coordinatorDatabase),
            sessions: ClaimFixtures.sessions(),
            tasks: ClaimFixtures.tasks([]),
            epoch: 1,
        });
        const sip = new FakeSip();
        const projects = new PersonalProjectRepository(coordinatorDatabase);
        const service = new PersonalProjectService({
            projects,
            claims: {
                acquire: (input, at) => {
                    const [claim, claimError] = claims.acquire(input, at);
                    if (claimError) return [null, claimError.type];
                    if (claim === null) return [null, 'claim missing'];
                    return [{ id: claim.id, fencingToken: claim.fencingToken }, null];
                },
                release: (claimId, botId, fencingToken, at) => {
                    const [, releaseError] = claims.release(claimId, botId, fencingToken, at);
                    return releaseError ? [null, releaseError.type] : [undefined, null];
                },
            },
            bots: profiles,
            agency,
            episodes: new AgentEpisodeRepository(coordinatorDatabase),
            events: new EventLogWriter(coordinatorDatabase),
            sip,
            logger: {
                debug: () => undefined,
                info: () => undefined,
                warn: () => undefined,
                error: () => undefined,
            },
            now: () => now,
            id: () => 'episode-1',
        });
        return { service, projects, profiles, agency, claims, sip, profile: allocated };
    };

    afterEach(() => CoordinatorTestSupport.cleanup());

    it('proposes a home with claims, SIP structure, profile, and agency state', () => {
        const { service, projects, profiles, agency, claims, sip, profile } = fresh();
        const [project, projectError] = service.propose(projectInput(profile.botId));
        expect(projectError).toBeNull();
        expect(project?.status).toBe('active');
        expect(project?.claims).toHaveLength(1);
        expect(sip.proposed).toEqual(['project-1']);
        expect(projects.get('project-1')[0]?.structureId).toBe('structure.project.project-1');
        expect(profiles.get(profile.botId)[0]?.homeStructureId).toBe('structure.project.project-1');
        expect(agency.load(profile.botId)[0]?.personalStorageId).toBe(
            'container.project.project-1',
        );
        expect(claims.listActive()[0]).toHaveLength(1);
    });

    it('rejects a second home project for the same bot', () => {
        const { service, profile } = fresh();
        service.propose(projectInput(profile.botId));
        const [, duplicateError] = service.propose(projectInput(profile.botId, 'project-2'));
        expect(duplicateError?.type).toBe('PROJECT_EXISTS');
    });

    it('abandons a project and releases claims and home state', () => {
        const { service, projects, profiles, agency, claims, sip, profile } = fresh();
        service.propose(projectInput(profile.botId));
        const [abandoned, abandonError] = service.abandon(
            'project-1',
            profile.botId,
            'no longer needed',
        );
        expect(abandonError).toBeNull();
        expect(abandoned?.status).toBe('abandoned');
        expect(abandoned?.reason).toBe('no longer needed');
        expect(sip.abandoned).toEqual(['project-1']);
        expect(projects.get('project-1')[0]?.claims).toEqual([]);
        expect(profiles.get(profile.botId)[0]?.homeStructureId).toBeNull();
        expect(agency.load(profile.botId)[0]?.homeStructureId).toBeNull();
        expect(claims.listActive()[0]).toHaveLength(0);
    });
});
