import type { Result } from '@ticrafter/core';
import type { PlannerTask, PlannerTaskProposal } from '@ticrafter/planning';

import type { CreateTaskInput, TaskPrecondition } from '../tasks/index.js';

type PlannerPrecondition = PlannerTask['preconditions'][number];

export class PlannerTaskMapper {
    static toTask(proposal: PlannerTaskProposal): Result<CreateTaskInput, string> {
        const [preconditions, preconditionError] = PlannerTaskMapper.preconditions(
            proposal.preconditions,
        );
        if (preconditionError) return [null, preconditionError];
        return [
            {
                id: proposal.id,
                title: proposal.title,
                parentId: proposal.parentId,
                priority: proposal.priority,
                payload: proposal.payload,
                dependencies: proposal.dependencies,
                preconditions: preconditions ?? [],
                requiredRole: proposal.requiredRole,
                target: proposal.target,
            },
            null,
        ];
    }

    private static preconditions(
        preconditions: readonly PlannerPrecondition[],
    ): Result<readonly TaskPrecondition[], string> {
        const mapped: TaskPrecondition[] = [];
        for (const precondition of preconditions) {
            const [taskPrecondition, mappingError] = PlannerTaskMapper.toPrecondition(precondition);
            if (mappingError) return [null, mappingError];
            if (taskPrecondition === null) continue;
            mapped.push(taskPrecondition);
        }
        return [mapped, null];
    }

    private static toPrecondition(
        precondition: PlannerPrecondition,
    ): Result<TaskPrecondition, string> {
        if (precondition.kind !== 'world.landmark') return [precondition, null];
        const { bbox, type } = precondition;
        if (type === undefined) return [{ kind: 'world.landmark', bbox }, null];
        switch (type) {
            case 'house':
            case 'farm':
            case 'storage':
            case 'wall':
            case 'bridge':
            case 'path':
                return [{ kind: 'world.landmark', bbox, type }, null];
            case 'road':
            case 'watchtower':
                return [null, `planner landmark precondition type ${type} is unsupported`];
        }
    }
}
