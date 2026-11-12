import type { Result } from '@ticrafter/core';

import { TaskFailures } from './failures.js';
import type { TaskFailure, TaskRecord } from './types.js';

export interface TaskDag {
    byId: ReadonlyMap<string, TaskRecord>;
    children: ReadonlyMap<string, readonly string[]>;
}

export class TaskDagResolver {
    static build(tasks: readonly TaskRecord[]): Result<TaskDag, TaskFailure> {
        const byId = new Map<string, TaskRecord>();
        for (const task of tasks) {
            if (byId.has(task.id)) {
                return [null, TaskFailures.malformedTask(`duplicate task ${task.id}`)];
            }
            byId.set(task.id, task);
        }
        const children = new Map<string, string[]>();
        const indegree = new Map<string, number>();
        tasks.forEach((task) => {
            children.set(task.id, []);
            indegree.set(task.id, 0);
        });
        tasks.forEach((task) => {
            task.dependencies.forEach((dependency) => {
                if (!byId.has(dependency)) return;
                children.get(dependency)?.push(task.id);
                indegree.set(task.id, (indegree.get(task.id) ?? 0) + 1);
            });
        });
        const queue = tasks
            .filter((task) => (indegree.get(task.id) ?? 0) === 0)
            .map((task) => task.id);
        const visited = new Set<string>();
        let index = 0;
        while (index < queue.length) {
            const taskId = queue[index];
            index += 1;
            if (taskId === undefined) continue;
            visited.add(taskId);
            children.get(taskId)?.forEach((childId) => {
                const remaining = (indegree.get(childId) ?? 0) - 1;
                indegree.set(childId, remaining);
                if (remaining === 0) queue.push(childId);
            });
        }
        if (visited.size !== tasks.length) {
            const cycleTaskIds = tasks
                .filter((task) => !visited.has(task.id))
                .map((task) => task.id);
            return [null, TaskFailures.dependencyCycle(cycleTaskIds)];
        }
        return [{ byId, children }, null];
    }

    static dependenciesSatisfied(task: TaskRecord, dag: TaskDag): boolean {
        return task.dependencies.every((dependency) => {
            const dependencyTask = dag.byId.get(dependency);
            return dependencyTask?.status === 'completed';
        });
    }

    static ready(tasks: readonly TaskRecord[], dag: TaskDag, now: string): readonly TaskRecord[] {
        return tasks.filter(
            (task) =>
                (task.status === 'pending' || task.status === 'ready') &&
                task.availableAt <= now &&
                TaskDagResolver.dependenciesSatisfied(task, dag),
        );
    }
}
