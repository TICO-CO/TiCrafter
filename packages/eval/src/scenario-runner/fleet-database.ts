import { type TaskRecord, TaskRepository } from '@ticrafter/coordinator/tasks';
import { attempt, type Result } from '@ticrafter/core';
import { MigrationRunner, SqliteRuntime } from '@ticrafter/memory';

import type { ScenarioDefinition, ScenarioObservation } from './index.js';

interface CountRow {
    count: number;
}

export class FleetDatabase {
    static prepare(dataDir: string, definition: ScenarioDefinition): Result<void, string> {
        const [database, openError] = new SqliteRuntime({ dataDir }).open();
        if (openError) return [null, openError.type];
        if (database === null) return [null, 'database open returned null'];
        const [, migrationError] = new MigrationRunner(database).run();
        if (migrationError) {
            FleetDatabase.close(database);
            return [null, migrationError.type];
        }
        const repository = new TaskRepository(database);
        for (const seed of definition.tasks ?? []) {
            const [existing, readError] = repository.get(seed.id);
            if (readError) {
                FleetDatabase.close(database);
                return [null, readError.type];
            }
            if (existing !== null) continue;
            const [, insertError] = repository.insert(FleetDatabase.task(seed));
            if (insertError) {
                FleetDatabase.close(database);
                return [null, insertError.type];
            }
        }
        FleetDatabase.close(database);
        return [undefined, null];
    }

    static observe(
        dataDir: string,
        definition: ScenarioDefinition,
    ): Result<ScenarioObservation, string> {
        const [database, openError] = new SqliteRuntime({ dataDir }).open();
        if (openError) return [null, openError.type];
        if (database === null) return [null, 'database open returned null'];
        const [tasks, taskError] = new TaskRepository(database).list();
        if (taskError) {
            FleetDatabase.close(database);
            return [null, taskError.type];
        }
        if (tasks === null) {
            FleetDatabase.close(database);
            return [null, 'task list returned null'];
        }
        const [events, eventError] = attempt(
            () => database.prepare('SELECT COUNT(*) AS count FROM bot_events').get() as CountRow,
        );
        const [sessions, sessionError] = attempt(
            () =>
                database
                    .prepare(
                        "SELECT COUNT(*) AS count FROM bot_events WHERE type = 'session.joined'",
                    )
                    .get() as CountRow,
        );
        const [duplicates, duplicateError] = attempt(
            () =>
                database
                    .prepare(
                        `SELECT COUNT(*) AS count FROM (
                        SELECT x, y, z FROM block_changelog GROUP BY x, y, z HAVING COUNT(*) > 1
                    )`,
                    )
                    .get() as CountRow,
        );
        FleetDatabase.close(database);
        if (eventError || sessionError || duplicateError) {
            return [null, 'observation query failed'];
        }
        if (events === null || sessions === null || duplicates === null) {
            return [null, 'observation query returned null'];
        }
        const seeds = definition.tasks ?? [];
        const completed = tasks.filter(
            (task) => seeds.some((seed) => seed.id === task.id) && task.status === 'completed',
        ).length;
        const reasons: string[] = [];
        if (seeds.length > 0 && completed < seeds.length) {
            reasons.push(`completed ${completed}/${seeds.length} tasks`);
        }
        if (sessions.count < definition.bots.length) {
            reasons.push(`connected ${sessions.count}/${definition.bots.length} bots`);
        }
        if (duplicates.count > 0) reasons.push(`duplicate block writes ${duplicates.count}`);
        return [
            {
                passed: reasons.length === 0,
                reasons,
                events: events.count,
                duplicates: duplicates.count,
                claimConflicts: 0,
            },
            null,
        ];
    }

    private static task(seed: NonNullable<ScenarioDefinition['tasks']>[number]): TaskRecord {
        const now = new Date().toISOString();
        return {
            id: seed.id,
            parentId: null,
            title: seed.title,
            status: 'pending',
            priority: 10,
            retryCount: 0,
            payload: { ...seed.payload, skillId: seed.skillId },
            dependencies: [],
            preconditions: [],
            requiredRole: seed.requiredRole ?? null,
            target: seed.target ?? null,
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

    private static close(database: { close: () => void }): void {
        attempt(() => database.close());
    }
}
