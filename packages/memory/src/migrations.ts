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
    {
        version: 3,
        name: 'landmark-confidence-timestamp',
        sql: `
      ALTER TABLE landmarks ADD COLUMN confidence_updated_at TEXT;
    `,
    },
    {
        version: 4,
        name: 'world-container-observations',
        sql: `
      CREATE TABLE IF NOT EXISTS world_container_observations (
        id TEXT PRIMARY KEY,
        position_json TEXT NOT NULL DEFAULT '{}',
        role TEXT NOT NULL,
        contents_json TEXT,
        observed_at TEXT NOT NULL,
        confidence REAL NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
    },
    {
        version: 5,
        name: 'skill-checkpoint-task-id',
        sql: `
      ALTER TABLE skill_checkpoints ADD COLUMN task_id TEXT NOT NULL DEFAULT 'default';
    `,
    },
    {
        version: 6,
        name: 'tasks-claims',
        sql: `
      ALTER TABLE tasks ADD COLUMN claimed_by TEXT;
      ALTER TABLE tasks ADD COLUMN lease_until TEXT;
      ALTER TABLE tasks ADD COLUMN lease_token INTEGER;
      ALTER TABLE tasks ADD COLUMN available_at TEXT NOT NULL DEFAULT '';
      ALTER TABLE tasks ADD COLUMN dependencies_json TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE tasks ADD COLUMN preconditions_json TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE tasks ADD COLUMN required_role TEXT;
      ALTER TABLE tasks ADD COLUMN target_json TEXT;
      ALTER TABLE tasks ADD COLUMN failure_class TEXT;
      ALTER TABLE tasks ADD COLUMN dead_letter_reason TEXT;
      ALTER TABLE tasks ADD COLUMN completed_at TEXT;
      ALTER TABLE claims ADD COLUMN resource_type TEXT NOT NULL DEFAULT 'unknown';
      ALTER TABLE claims ADD COLUMN bbox_json TEXT NOT NULL DEFAULT '{}';
      ALTER TABLE claims ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
      ALTER TABLE claims ADD COLUMN task_id TEXT;
      ALTER TABLE claims ADD COLUMN epoch INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE claims ADD COLUMN payload_json TEXT NOT NULL DEFAULT '{}';
      ALTER TABLE claims ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
      CREATE INDEX IF NOT EXISTS idx_tasks_status_priority ON tasks(status, priority);
      CREATE INDEX IF NOT EXISTS idx_claims_resource_status ON claims(resource_type, status);
    `,
    },
    {
        version: 7,
        name: 'grants-bot-profiles',
        sql: `
      ALTER TABLE bots ADD COLUMN status TEXT NOT NULL DEFAULT 'offline';
      ALTER TABLE bots ADD COLUMN last_seen TEXT NOT NULL DEFAULT '';
      ALTER TABLE bots ADD COLUMN bot_index INTEGER NOT NULL DEFAULT -1;
      CREATE INDEX IF NOT EXISTS idx_bots_status ON bots(status);
      ALTER TABLE edit_grants ADD COLUMN bbox_json TEXT NOT NULL DEFAULT '{}';
      ALTER TABLE edit_grants ADD COLUMN allowed_ops_json TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE edit_grants ADD COLUMN material_constraints_json TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE edit_grants ADD COLUMN intent TEXT NOT NULL DEFAULT '';
      ALTER TABLE edit_grants ADD COLUMN fencing_token INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE edit_grants ADD COLUMN epoch INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE edit_grants ADD COLUMN granted_by TEXT NOT NULL DEFAULT 'coordinator';
      ALTER TABLE edit_grants ADD COLUMN task_id TEXT;
      ALTER TABLE edit_grants ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
      CREATE INDEX IF NOT EXISTS idx_edit_grants_structure_status ON edit_grants(structure_id, status);
    `,
    },
    {
        version: 8,
        name: 'planner-cache',
        sql: `
      CREATE TABLE IF NOT EXISTS planner_plans (
        id TEXT PRIMARY KEY,
        revision INTEGER NOT NULL,
        context_hash TEXT,
        plan_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_planner_plans_created_at ON planner_plans(created_at);
      CREATE TABLE IF NOT EXISTS planner_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id TEXT,
        status TEXT NOT NULL,
        content TEXT NOT NULL,
        error TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_planner_responses_created_at
        ON planner_responses(created_at);
    `,
    },
];
