import fileSystem from 'node:fs';
import path from 'node:path';

import { attempt, type Result } from '@ticrafter/core';
import { z as zod } from 'zod';

import type { CreateTaskInput, TaskRole } from './types.js';

const taskRoleSchema = zod.enum(['builder', 'farmer', 'miner', 'scout', 'hauler', 'guard']);

const seedTaskSchema = zod.strictObject({
    id: zod.string().min(1),
    title: zod.string().min(1),
    skillId: zod.string().min(1),
    input: zod.record(zod.string(), zod.unknown()).default({}),
    priority: zod.number().int().optional(),
    dependencies: zod.array(zod.string().min(1)).optional(),
    requiredRole: taskRoleSchema.nullable().optional(),
});

const seedTasksSchema = zod.array(seedTaskSchema);

type SeedTask = zod.infer<typeof seedTaskSchema>;

export class SeedTaskLoader {
    static load(configDirectory: string): Result<readonly CreateTaskInput[], string> {
        const filePath = path.join(configDirectory, 'seed-tasks.json');
        if (!fileSystem.existsSync(filePath)) return [[], null];
        const [fileText, readError] = attempt<string, unknown>(() =>
            fileSystem.readFileSync(filePath, 'utf8'),
        );
        if (readError) return [null, SeedTaskLoader.describe(readError)];
        if (fileText === null) return [null, 'seed task file returned null'];
        const [decoded, parseError] = attempt<unknown, unknown>(
            () => JSON.parse(fileText) as unknown,
        );
        if (parseError) return [null, 'seed task file is not valid JSON'];
        if (decoded === null) return [null, 'seed task file returned null'];
        const parsed = seedTasksSchema.safeParse(decoded);
        if (!parsed.success) return [null, parsed.error.message];
        return [parsed.data.map((seed) => SeedTaskLoader.toTask(seed)), null];
    }

    private static toTask(seed: SeedTask): CreateTaskInput {
        const requiredRole: TaskRole | null | undefined = seed.requiredRole;
        return {
            id: seed.id,
            title: seed.title,
            priority: seed.priority,
            payload: { ...seed.input, skillId: seed.skillId },
            dependencies: seed.dependencies,
            requiredRole,
        };
    }

    private static describe(error: unknown): string {
        if (error instanceof Error) return `seed task read failed: ${error.message}`;
        return `seed task read failed: ${String(error)}`;
    }
}
