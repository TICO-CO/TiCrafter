import type { Result } from '@ticrafter/core';

import type {
    ProjectConstructionArtifacts,
    ProjectConstructionPort,
    ProjectConstructionTaskInput,
} from '../projects/index.js';
import type { ProjectConstructionPlanner } from './project-construction-planner.js';
import type { ProjectConstructionTaskSeeder } from './project-construction-task-seeder.js';

export class ProjectConstructionService implements ProjectConstructionPort {
    constructor(
        private readonly planner: ProjectConstructionPlanner,
        private readonly tasks: ProjectConstructionTaskSeeder,
    ) {}

    prepare(input: {
        projectId: string;
        structureId: string;
        botId: string;
        kind: 'home' | 'storage' | 'build';
        anchor: { x: number; y: number; z: number };
        bbox: {
            min: { x: number; y: number; z: number };
            max: { x: number; y: number; z: number };
        };
    }): Result<ProjectConstructionArtifacts, string> {
        const [result, error] = this.planner.prepare(input);
        if (error) return [null, ProjectConstructionService.describe(error)];
        if (result === null) return [null, 'project construction planning returned null'];
        return [result, null];
    }

    seedTasks(input: ProjectConstructionTaskInput): Result<readonly string[], string> {
        return this.tasks.seed(input);
    }

    cancelTasks(taskIds: readonly string[]): Result<void, string> {
        return this.tasks.cancelTasks(taskIds);
    }

    cancelProjectTasks(projectId: string): Result<void, string> {
        return this.tasks.cancelProjectTasks(projectId);
    }

    private static describe(failure: {
        type: string;
        message?: string;
        failure?: { type: string; message?: string };
    }): string {
        if (failure.message !== undefined) return `${failure.type}: ${failure.message}`;
        if (failure.failure !== undefined) {
            return `${failure.type}: ${failure.failure.type}`;
        }
        return failure.type;
    }
}
