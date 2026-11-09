export type StorageFailure =
    | { type: 'DATABASE_OPEN_FAILED'; message: string }
    | { type: 'SCHEMA_READ_FAILED'; message: string }
    | { type: 'MIGRATION_FAILED'; message: string }
    | { type: 'TRANSACTION_FAILED'; message: string }
    | { type: 'WRITE_FAILED'; message: string }
    | { type: 'READ_FAILED'; message: string }
    | { type: 'SNAPSHOT_EXPORT_FAILED'; message: string };

export class StorageFailures {
    static from(type: StorageFailure['type'], error: unknown): StorageFailure {
        return {
            type,
            message: error instanceof Error ? error.message : String(error),
        };
    }
}
