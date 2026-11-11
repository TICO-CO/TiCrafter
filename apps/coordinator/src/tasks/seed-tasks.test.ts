import fileSystem from 'node:fs';
import operatingSystem from 'node:os';
import path from 'node:path';

import type { LoggerPort, Result } from '@ticrafter/core';
import { afterEach, describe, expect, it } from 'bun:test';

import { SeedTaskApplicator, type SeedTaskPort } from './seed-task-applicator.js';
import { SeedTaskLoader } from './seed-task-loader.js';
import type { CreateTaskInput, TaskFailure, TaskRecord } from './types.js';

const logger: LoggerPort = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

class FakeTaskPort implements SeedTaskPort {
    private readonly tasks = new Map<string, TaskRecord>();

    get(taskId: string): Result<TaskRecord | null, TaskFailure> {
        return [this.tasks.get(taskId) ?? null, null];
    }

    create(input: CreateTaskInput): Result<TaskRecord, TaskFailure> {
        const record = taskRecord(input);
        this.tasks.set(record.id, record);
        return [record, null];
    }
}

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
    const directory = fileSystem.mkdtempSync(
        path.join(operatingSystem.tmpdir(), 'ticrafter-seed-tasks-'),
    );
    temporaryDirectories.push(directory);
    return directory;
}

function taskRecord(input: CreateTaskInput): TaskRecord {
    const now = '2026-11-11T12:00:00.000Z';
    return {
        id: input.id,
        parentId: input.parentId ?? null,
        title: input.title,
        status: 'pending',
        priority: input.priority ?? 0,
        retryCount: 0,
        payload: input.payload ?? {},
        dependencies: input.dependencies ?? [],
        preconditions: input.preconditions ?? [],
        requiredRole: input.requiredRole ?? null,
        target: input.target ?? null,
        claimedBy: null,
        leaseUntil: null,
        leaseToken: null,
        availableAt: now,
        failureClass: null,
        deadLetterReason: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
    };
}

describe('SeedTaskLoader', () => {
    afterEach(() => {
        temporaryDirectories
            .splice(0)
            .forEach((directory) => fileSystem.rmSync(directory, { recursive: true, force: true }));
    });

    it('returns an empty list when the file is absent', () => {
        const [tasks, loadError] = SeedTaskLoader.load(temporaryDirectory());
        expect(loadError).toBeNull();
        expect(tasks).toEqual([]);
    });

    it('maps seed files to task inputs', () => {
        const directory = temporaryDirectory();
        fileSystem.writeFileSync(
            path.join(directory, 'seed-tasks.json'),
            JSON.stringify([
                {
                    id: 'seed-1',
                    title: 'Collect nearby items',
                    skillId: 'collect',
                    input: { radius: 8 },
                    priority: 2,
                },
            ]),
        );
        const [tasks, loadError] = SeedTaskLoader.load(directory);
        expect(loadError).toBeNull();
        expect(tasks?.[0]?.id).toBe('seed-1');
        expect(tasks?.[0]?.payload).toEqual({ radius: 8, skillId: 'collect' });
        expect(tasks?.[0]?.priority).toBe(2);
    });

    it('rejects malformed seed files', () => {
        const directory = temporaryDirectory();
        fileSystem.writeFileSync(path.join(directory, 'seed-tasks.json'), 'not-json');
        const [tasks, loadError] = SeedTaskLoader.load(directory);
        expect(tasks).toBeNull();
        expect(loadError).not.toBeNull();
    });

    it('creates seeds once and skips existing task ids', () => {
        const applicator = new SeedTaskApplicator(new FakeTaskPort(), logger);
        const inputs = [
            { id: 'seed-1', title: 'Collect', payload: { skillId: 'collect' } },
            { id: 'seed-2', title: 'Collect', payload: { skillId: 'collect' } },
        ];
        const [first, firstError] = applicator.apply(inputs);
        expect(firstError).toBeNull();
        expect(first?.created).toBe(2);
        const [second, secondError] = applicator.apply(inputs);
        expect(secondError).toBeNull();
        expect(second?.created).toBe(0);
        expect(second?.skipped).toBe(2);
    });
});
