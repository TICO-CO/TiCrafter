import { NeedsModel, PersonalityModel, WorkingMemoryModel } from '@ticrafter/agency';
import type { BlueprintDocument, ConstructionPlanDocument } from '@ticrafter/building';
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
import type { ProjectConstructionPort, ProjectSipPort } from './types.js';

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

const fakeConstruction = (): ProjectConstructionPort => ({
    prepare: (input: {
        structureId: string;
        bbox: {
            min: { x: number; y: number; z: number };
            max: { x: number; y: number; z: number };
        };
    }) => {
        const blueprint: BlueprintDocument = {
            id: 'blueprint.project.project-1',
            revision: 1,
            hash: 'blueprint-hash',
            source: 'composed',
            provenance: { createdBy: 'bot.tibot1', createdAt: now },
            blueprint: {
                id: 'blueprint.project.project-1',
                anchor: input.bbox.min,
                rotation: 0,
                blocks: [],
                materials: [],
                constraints: [],
            },
        };
        const plan: ConstructionPlanDocument = {
            id: `plan.${input.structureId}`,
            revision: 1,
            hash: 'plan-hash',
            structureId: input.structureId,
            blueprintId: blueprint.id,
            blueprintRevision: 1,
            purpose: 'build',
            createdAt: now,
            plan: {
                id: `plan.${input.structureId}`,
                blueprintId: blueprint.id,
                anchor: input.bbox.min,
                rotation: 0,
                translation: { x: 0, y: 0, z: 0 },
                site: {
                    anchor: input.bbox.min,
                    translation: { x: 0, y: 0, z: 0 },
                    rotation: 0,
                    bounds: input.bbox,
                    clearance: [],
                    access: { kind: 'none', from: null, to: input.bbox.min, length: 0 },
                    foundationMode: 'level',
                    foundationFillDepth: 0,
                    foundationCutDepth: 0,
                    score: 1,
                    rationale: [],
                },
                foundation: {
                    mode: 'level',
                    targetY: input.bbox.min.y,
                    maximumFillDepth: 0,
                    changes: [],
                    materials: [],
                    rationale: [],
                },
                changes: [
                    {
                        kind: 'place',
                        block: {
                            x: input.bbox.min.x,
                            y: input.bbox.min.y,
                            z: input.bbox.min.z,
                            state: { name: 'oak_planks' },
                            priority: 1,
                        },
                        phase: 'walls',
                        reason: 'blueprint',
                        dependsOn: [],
                    },
                ],
                order: [`${input.bbox.min.x},${input.bbox.min.y},${input.bbox.min.z}`],
                dependencies: [],
                scaffolds: [],
                unreachable: [],
                phases: ['walls'],
                materials: [{ item: 'oak_planks', count: 1 }],
                workPackages: [
                    {
                        id: `plan.${input.structureId}:layers:walls:0`,
                        bbox: input.bbox,
                        blockKeys: [`${input.bbox.min.x},${input.bbox.min.y},${input.bbox.min.z}`],
                        strategy: 'layers',
                        status: 'planned',
                        phase: 'walls',
                        materials: [{ item: 'oak_planks', count: 1 }],
                        scaffoldPositions: [],
                        predecessorIds: [],
                    },
                ],
            },
        };
        return [{ blueprint, plan, bbox: input.bbox }, null];
    },
    seedTasks: () => [['task.project.project-1.package.0'], null],
    cancelTasks: () => [undefined, null],
    cancelProjectTasks: () => [undefined, null],
});

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
            workingMemory: WorkingMemoryModel.create().snapshot,
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
            construction: fakeConstruction(),
            repair: {
                prepare: (input) => fakeConstruction().prepare({ ...input, kind: 'home' }),
            },
            rollback: {
                prepare: (input) => fakeConstruction().prepare({ ...input, kind: 'home' }),
            },
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
        expect(project?.claims).toHaveLength(2);
        expect(sip.proposed).toEqual(['project-1']);
        expect(projects.get('project-1')[0]?.structureId).toBe('structure.project.project-1');
        expect(profiles.get(profile.botId)[0]?.homeStructureId).toBe('structure.project.project-1');
        expect(agency.load(profile.botId)[0]?.personalStorageId).toBe(
            'container.project.project-1',
        );
        expect(claims.listActive()[0]).toHaveLength(2);
    });

    it('rejects a second home project for the same bot', () => {
        const { service, profile } = fresh();
        service.propose(projectInput(profile.botId));
        const [, duplicateError] = service.propose(projectInput(profile.botId, 'project-2'));
        expect(duplicateError?.type).toBe('PROJECT_EXISTS');
    });

    it('revises a project blueprint, plan, and task set', () => {
        const { service, projects, profile } = fresh();
        service.propose(projectInput(profile.botId));
        const [revised, reviseError] = service.revise({
            projectId: 'project-1',
            botId: profile.botId,
            title: 'Renovated Home',
        });
        expect(reviseError).toBeNull();
        expect(revised?.title).toBe('Renovated Home');
        expect(revised?.status).toBe('active');
        expect(projects.get('project-1')[0]?.title).toBe('Renovated Home');
    });

    it('repairs a project from the latest blueprint diff', () => {
        const { service, profile } = fresh();
        service.propose(projectInput(profile.botId));
        const [repaired, repairError] = service.repair('project-1', profile.botId);
        expect(repairError).toBeNull();
        expect(repaired?.status).toBe('active');
        expect(repaired?.claims).toHaveLength(2);
    });

    it('rolls back a project using inverse construction changes', () => {
        const { service, profile } = fresh();
        service.propose(projectInput(profile.botId));
        const [rolledBack, rollbackError] = service.rollback('project-1', profile.botId);
        expect(rollbackError).toBeNull();
        expect(rolledBack?.status).toBe('active');
        expect(rolledBack?.claims).toHaveLength(2);
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
