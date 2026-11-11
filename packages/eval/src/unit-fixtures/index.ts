import type { Blueprint } from '@ticrafter/building';
import type { AcquireClaimInput, ClaimRecord } from '@ticrafter/coordinator/claims';
import { ClaimFixtures } from '@ticrafter/coordinator/claims';
import type { EditGrantRecord } from '@ticrafter/coordinator/grants';
import type { SipSnapshot } from '@ticrafter/coordinator/sip';
import { SipFixtures } from '@ticrafter/coordinator/sip';
import type { CreateTaskInput, TaskClaimContext, TaskRecord } from '@ticrafter/coordinator/tasks';
import { TaskFixtures } from '@ticrafter/coordinator/tasks';
import type { SafetySnapshot } from '@ticrafter/safety';

export class EvalFixtures {
    static sipSnapshot(overrides: Partial<SipSnapshot> = {}): SipSnapshot {
        return { ...SipFixtures.snapshot(), ...overrides };
    }

    static taskInput(overrides: Partial<CreateTaskInput> = {}): CreateTaskInput {
        return TaskFixtures.task(overrides);
    }

    static taskRecord(overrides: Partial<TaskRecord> = {}): TaskRecord {
        const now = '2026-11-11T10:00:00.000Z';
        return {
            id: 'task-1',
            parentId: null,
            title: 'Build a wall',
            status: 'ready',
            priority: 10,
            retryCount: 0,
            payload: { skillId: 'navigate' },
            dependencies: [],
            preconditions: [],
            requiredRole: 'builder',
            target: { x: 1, y: 64, z: 1 },
            claimedBy: null,
            leaseUntil: null,
            leaseToken: null,
            availableAt: now,
            failureClass: null,
            deadLetterReason: null,
            createdAt: now,
            updatedAt: now,
            completedAt: null,
            ...overrides,
        };
    }

    static taskContext(overrides: Partial<TaskClaimContext> = {}): TaskClaimContext {
        return TaskFixtures.context('bot.one', overrides);
    }

    static claimInput(overrides: Partial<AcquireClaimInput> = {}): AcquireClaimInput {
        return ClaimFixtures.input(overrides);
    }

    static claimRecord(overrides: Partial<ClaimRecord> = {}): ClaimRecord {
        const now = '2026-11-11T10:00:00.000Z';
        return {
            id: 'claim-1',
            resourceType: 'work_package',
            resourceId: 'package-1',
            bbox: ClaimFixtures.bbox(),
            botId: 'bot.one',
            leaseUntil: '2026-11-11T10:01:00.000Z',
            fencingToken: 1,
            status: 'active',
            taskId: 'task-1',
            epoch: 1,
            payload: {},
            createdAt: now,
            updatedAt: now,
            ...overrides,
        };
    }

    static grantRecord(overrides: Partial<EditGrantRecord> = {}): EditGrantRecord {
        const now = '2026-11-11T10:00:00.000Z';
        return {
            id: 'grant-1',
            structureId: 'structure.house',
            ownerBotId: 'bot.one',
            granteeBotId: 'bot.two',
            designRevision: 1,
            bbox: ClaimFixtures.bbox(),
            allowedOps: ['place', 'break'],
            materialConstraints: [],
            intent: 'Repair the east wall',
            status: 'active',
            expiresAt: '2026-11-11T10:10:00.000Z',
            fencingToken: 1,
            epoch: 1,
            grantedBy: 'owner',
            taskId: 'task-1',
            createdAt: now,
            updatedAt: now,
            ...overrides,
        };
    }

    static blueprint(overrides: Partial<Blueprint> = {}): Blueprint {
        return {
            id: 'blueprint.test',
            anchor: { x: 0, y: 64, z: 0 },
            rotation: 0,
            blocks: [
                { x: 0, y: 64, z: 0, state: { name: 'stone' }, priority: 0 },
                { x: 0, y: 65, z: 0, state: { name: 'oak_planks' }, priority: 0 },
            ],
            materials: [
                { item: 'stone', count: 1 },
                { item: 'oak_planks', count: 1 },
            ],
            constraints: [],
            ...overrides,
        };
    }

    static guardianSnapshot(overrides: Partial<SafetySnapshot> = {}): SafetySnapshot {
        return {
            botId: 'bot.one',
            at: '2026-11-11T10:00:00.000Z',
            position: { x: 0, y: 64, z: 0 },
            health: 20,
            food: 20,
            oxygen: 20,
            onGround: true,
            stuckMilliseconds: 0,
            targetUnreachableMilliseconds: 0,
            inventory: [],
            inventoryUsedSlots: 0,
            inventoryTotalSlots: 36,
            nearestHostileDistance: null,
            activeSkillId: null,
            claimTrackingEnabled: false,
            allowDestructiveMaterials: false,
            world: {
                blockAt: () => null,
                isProtected: () => false,
                activeBots: () => [],
                claimFor: () => null,
            },
            ...overrides,
        };
    }
}
