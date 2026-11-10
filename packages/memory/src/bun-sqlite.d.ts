declare module 'bun:sqlite' {
    export interface StatementResult {
        changes: number | bigint;
        lastInsertRowid: number | bigint;
    }

    export interface Statement {
        run(...params: unknown[]): StatementResult;
        all(...params: unknown[]): unknown[];
        get(...params: unknown[]): unknown;
    }

    export interface DatabaseOptions {
        readonly?: boolean;
        create?: boolean;
        readwrite?: boolean;
    }

    export class Database {
        constructor(filename?: string, options?: DatabaseOptions);
        exec(sql: string): void;
        prepare(sql: string): Statement;
        query(sql: string): Statement;
        transaction<Arguments extends unknown[], R>(
            operation: (...parameters: Arguments) => R,
        ): (...parameters: Arguments) => R;
        serialize(): Uint8Array;
        close(): void;
    }
}
