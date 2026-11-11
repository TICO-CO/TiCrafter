import type { SipBoundingBox } from '../sip/index.js';
import type { AcquireClaimInput, ClaimSessionPort, ClaimTaskPort } from './types.js';

export class ClaimFixtures {
    static bbox(x = 0, z = 0): SipBoundingBox {
        return {
            min: { x, y: 60, z },
            max: { x: x + 2, y: 70, z: z + 2 },
        };
    }

    static input(overrides: Partial<AcquireClaimInput> = {}): AcquireClaimInput {
        return {
            id: 'claim-1',
            resourceType: 'work_package',
            resourceId: 'package-1',
            bbox: ClaimFixtures.bbox(),
            botId: 'bot.one',
            taskId: 'task-1',
            payload: {},
            ...overrides,
        };
    }

    static sessions(connected = true): ClaimSessionPort {
        return {
            isConnected: () => connected,
        };
    }

    static tasks(requeued: string[] = []): ClaimTaskPort {
        return {
            requeue: (taskId) => {
                requeued.push(taskId);
                return [undefined, null];
            },
        };
    }
}
