import { initialSchemaSql } from './initial-schema.js';

export interface Migration {
    version: number;
    name: string;
    sql: string;
}

export const migrations: Migration[] = [
    {
        version: 1,
        name: 'initial-schema',
        sql: initialSchemaSql,
    },
];
