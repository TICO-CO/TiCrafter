import type { Result } from '@ticrafter/core';
import type {
    PlannerBotView,
    PlannerContextSource,
    PlannerLandmarkView,
    PlannerPosition,
    PlannerSipView,
    PlannerTaskView,
} from '@ticrafter/planning';
import type { ContainerObservation, Landmark } from '@ticrafter/worldmodel';

import type { BotProfileStore } from '../bots/index.js';
import type { SipTransactionalCommitter } from '../sip/index.js';
import type { TaskRepository } from '../tasks/index.js';

export interface CoordinatorPlannerWorldPort {
    listLandmarks(): Result<readonly Landmark[], string>;
    listContainers(): Result<readonly ContainerObservation[], string>;
}

export interface CoordinatorPlannerContextSourceOptions {
    sip: SipTransactionalCommitter;
    tasks: TaskRepository;
    bots: BotProfileStore;
    world: CoordinatorPlannerWorldPort;
    positions: (botId: string) => PlannerPosition | null;
}

export class CoordinatorPlannerContextSource implements PlannerContextSource {
    constructor(private readonly options: CoordinatorPlannerContextSourceOptions) {}

    snapshot(): Result<PlannerSipView, string> {
        const [snapshot, snapshotError] = this.options.sip.loadSnapshot();
        if (snapshotError) return [null, snapshotError.message];
        if (snapshot === null) return [null, 'SIP snapshot missing'];
        return [
            {
                revision: snapshot.revision,
                zones: snapshot.zones,
                structures: snapshot.structures,
                roads: snapshot.roads,
                farms: snapshot.farms,
                containers: snapshot.containers,
                protectedBboxes: snapshot.rules.protectedBboxes,
                noBuildZones: snapshot.zones
                    .filter((zone) => zone.type === 'no_build')
                    .map((zone) => zone.polygon),
            },
            null,
        ];
    }

    tasks(): Result<readonly PlannerTaskView[], string> {
        const [tasks, tasksError] = this.options.tasks.list();
        if (tasksError) return [null, tasksError.type];
        if (tasks === null) return [null, 'task list missing'];
        return [
            tasks.map((task) => ({
                id: task.id,
                title: task.title,
                status: task.status,
                priority: task.priority,
                dependencies: task.dependencies,
                skillId: typeof task.payload.skillId === 'string' ? task.payload.skillId : null,
                target: task.target,
                failureClass: task.failureClass,
                deadLetterReason: task.deadLetterReason,
            })),
            null,
        ];
    }

    bots(): Result<readonly PlannerBotView[], string> {
        const [bots, botsError] = this.options.bots.list();
        if (botsError) return [null, botsError.type];
        if (bots === null) return [null, 'bot list missing'];
        return [
            bots.map((bot) => ({
                id: bot.botId,
                role: bot.temporaryRole ?? bot.role,
                online: bot.status === 'online',
                position: this.options.positions(bot.botId),
            })),
            null,
        ];
    }

    landmarks(): Result<readonly PlannerLandmarkView[], string> {
        const [landmarks, landmarkError] = this.options.world.listLandmarks();
        if (landmarkError) return [null, landmarkError];
        if (landmarks === null) return [null, 'landmark list missing'];
        return [
            landmarks.map((landmark) => ({
                id: landmark.id,
                type: landmark.type,
                position: CoordinatorPlannerContextSource.position(landmark.bbox.min),
                confidence: landmark.confidence,
            })),
            null,
        ];
    }

    inventory(): Result<Readonly<Record<string, number>>, string> {
        const [containers, containerError] = this.options.world.listContainers();
        if (containerError) return [null, containerError];
        if (containers === null) return [null, 'container list missing'];
        const inventory: Record<string, number> = {};
        containers.forEach((container) => {
            container.contents?.forEach((item) => {
                inventory[item.itemId] = (inventory[item.itemId] ?? 0) + item.count;
            });
        });
        return [inventory, null];
    }

    private static position(
        position: PlannerSipView['zones'][number]['polygon'][number],
    ): PlannerPosition {
        return { x: position.x, y: position.y, z: position.z };
    }
}
