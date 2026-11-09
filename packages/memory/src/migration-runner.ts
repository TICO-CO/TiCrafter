import type { Database } from 'bun:sqlite';
import { attempt, type Result } from '@ticrafter/core';
import { StorageFailures, type StorageFailure } from './failures.js';
import { migrations, type Migration } from './migrations.js';
import { SchemaVersionRegistry } from './schema-version-registry.js';

export class MigrationRunner {
    constructor(private readonly db: Database) {}

    run(): Result<number, StorageFailure> {
        const [, error] = attempt(() => this.applyPending());
        if (error) {
            return [null, StorageFailures.from('MIGRATION_FAILED', error)];
        }

        return new SchemaVersionRegistry(this.db).current();
    }

    private applyPending(): void {
        this.db.exec(
            'CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)',
        );
        const appliedVersions = new Set(
            (
                this.db.prepare('SELECT version FROM schema_version').all() as Array<{
                    version: number;
                }>
            ).map((row) => row.version),
        );
        const applyMigration = this.db.transaction((migration: Migration) => {
            this.db.exec(migration.sql);
            this.db
                .prepare('INSERT INTO schema_version (version, name, applied_at) VALUES (?, ?, ?)')
                .run(migration.version, migration.name, new Date().toISOString());
        });

        migrations.forEach((migration) => {
            if (appliedVersions.has(migration.version)) {
                return;
            }
            applyMigration(migration);
        });
    }
}
