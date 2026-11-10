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
    {
        version: 2,
        name: 'world-model-landmarks',
        sql: `
      ALTER TABLE landmarks ADD COLUMN bbox_json TEXT NOT NULL DEFAULT '{}';
      ALTER TABLE landmarks ADD COLUMN anchors_json TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE landmarks ADD COLUMN evidence_json TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE landmarks ADD COLUMN last_seen TEXT NOT NULL DEFAULT '';
      ALTER TABLE landmarks ADD COLUMN plan_id TEXT;
    `,
    },
];
