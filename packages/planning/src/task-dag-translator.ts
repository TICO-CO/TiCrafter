import type { Result } from '@ticrafter/core';

import type { PlannerFailure } from './failures.js';
import type { PlannerPlan, PlannerTask } from './plan-schema.js';
import type { PlannerTaskProposal, PlannerTaskProposalPort } from './types.js';

export class PlannerTaskDagTranslator {
    constructor(private readonly port: PlannerTaskProposalPort) {}

    translate(plan: PlannerPlan): Result<readonly PlannerTaskProposal[], PlannerFailure> {
        if (plan.tasks.length === 0) return [[], null];
        const [ordered, orderError] = PlannerTaskDagTranslator.topological(plan.tasks);
        if (orderError) return [null, { type: 'TRANSLATION', message: orderError }];
        if (ordered === null) return [null, { type: 'TRANSLATION', message: 'task order missing' }];
        const proposals = ordered.map((task) => PlannerTaskDagTranslator.toProposal(task));
        const [, validationError] = this.port.validate(proposals);
        if (validationError) return [null, { type: 'TRANSLATION', message: validationError }];
        return [proposals, null];
    }

    private static toProposal(task: PlannerTask): PlannerTaskProposal {
        return {
            id: task.id,
            title: task.title,
            parentId: task.parentId,
            priority: task.priority,
            payload: { ...task.payload, skillId: task.skillId },
            dependencies: task.dependencies,
            preconditions: task.preconditions,
            requiredRole: task.requiredRole,
            target: task.target,
        };
    }

    private static topological(
        tasks: readonly PlannerTask[],
    ): Result<readonly PlannerTask[], string> {
        const byId = new Map(tasks.map((task) => [task.id, task]));
        const indegree = new Map(tasks.map((task) => [task.id, 0]));
        const outgoing = new Map(tasks.map((task) => [task.id, [] as string[]]));
        tasks.forEach((task) => {
            task.dependencies.forEach((dependency) => {
                if (!byId.has(dependency)) return;
                indegree.set(task.id, (indegree.get(task.id) ?? 0) + 1);
                outgoing.get(dependency)?.push(task.id);
            });
        });
        const ready = [...indegree.entries()]
            .filter(([, degree]) => degree === 0)
            .map(([id]) => id);
        const ordered: PlannerTask[] = [];
        while (ready.length > 0) {
            const id = ready.shift();
            if (id === undefined) break;
            const task = byId.get(id);
            if (task === undefined) continue;
            ordered.push(task);
            for (const dependent of outgoing.get(id) ?? []) {
                const next = (indegree.get(dependent) ?? 0) - 1;
                indegree.set(dependent, next);
                if (next === 0) ready.push(dependent);
            }
        }
        if (ordered.length !== tasks.length) {
            return [null, 'task dependency cycle detected'];
        }
        return [ordered, null];
    }
}
