import type { BlockPosition } from '@ticrafter/worldmodel';

import type { TaskClaimContext, TaskRecord, TaskRole } from './types.js';

export class TaskPriorityScheduler {
    static rank(tasks: readonly TaskRecord[], context: TaskClaimContext): readonly TaskRecord[] {
        return [...tasks].sort((first, second) => {
            const priorityOrder = second.priority - first.priority;
            if (priorityOrder !== 0) return priorityOrder;
            const roleOrder =
                TaskPriorityScheduler.roleRank(second, context.botRole) -
                TaskPriorityScheduler.roleRank(first, context.botRole);
            if (roleOrder !== 0) return roleOrder;
            const distanceOrder =
                TaskPriorityScheduler.distance(first.target, context.botPosition) -
                TaskPriorityScheduler.distance(second.target, context.botPosition);
            if (distanceOrder !== 0) return distanceOrder;
            const createdOrder = first.createdAt.localeCompare(second.createdAt);
            if (createdOrder !== 0) return createdOrder;
            return first.id.localeCompare(second.id);
        });
    }

    private static roleRank(task: TaskRecord, role: TaskRole | null): number {
        if (task.requiredRole === null) return 1;
        return task.requiredRole === role ? 2 : 0;
    }

    private static distance(target: BlockPosition | null, position: BlockPosition | null): number {
        if (target === null || position === null) return Number.MAX_SAFE_INTEGER;
        const deltaX = target.x - position.x;
        const deltaY = target.y - position.y;
        const deltaZ = target.z - position.z;
        return deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;
    }
}
