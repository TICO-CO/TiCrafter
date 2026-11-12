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
    {
        version: 9,
        name: 'agent-state-episodes',
        sql: `
      CREATE TABLE IF NOT EXISTS agent_state (
        bot_id TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_agent_state_updated_at ON agent_state(updated_at);
      CREATE TABLE IF NOT EXISTS agent_episodes (
        id TEXT PRIMARY KEY,
        bot_id TEXT NOT NULL,
        goal_id TEXT,
        kind TEXT NOT NULL,
        summary TEXT NOT NULL,
        position_json TEXT,
        related_bot_id TEXT,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_agent_episodes_bot_created
        ON agent_episodes(bot_id, created_at);
    `,
    },
    {
        version: 10,
        name: 'personal-projects',
        sql: `
      CREATE TABLE IF NOT EXISTS personal_projects (
        id TEXT PRIMARY KEY,
        bot_id TEXT NOT NULL,
        title TEXT NOT NULL,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        anchor_json TEXT NOT NULL,
        bbox_json TEXT NOT NULL,
        claims_json TEXT NOT NULL DEFAULT '[]',
        structure_id TEXT,
        storage_id TEXT,
        reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_personal_projects_bot_status
        ON personal_projects(bot_id, status);
      CREATE INDEX IF NOT EXISTS idx_personal_projects_structure
        ON personal_projects(structure_id);
    `,
    },
    {
        version: 11,
        name: 'building-blueprints',
        sql: `
      CREATE TABLE IF NOT EXISTS blueprint_documents (
        id TEXT NOT NULL,
        revision INTEGER NOT NULL,
        hash TEXT NOT NULL,
        source TEXT NOT NULL,
        blueprint_json TEXT NOT NULL,
        provenance_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (id, revision)
      );
      CREATE INDEX IF NOT EXISTS idx_blueprint_documents_hash
        ON blueprint_documents(hash);
      ALTER TABLE block_changelog ADD COLUMN structure_id TEXT;
      ALTER TABLE block_changelog ADD COLUMN blueprint_id TEXT;
      ALTER TABLE block_changelog ADD COLUMN blueprint_revision INTEGER;
      ALTER TABLE block_changelog ADD COLUMN work_package_id TEXT;
      ALTER TABLE block_changelog ADD COLUMN plan_id TEXT;
      ALTER TABLE block_changelog ADD COLUMN fencing_token INTEGER;
      ALTER TABLE block_changelog ADD COLUMN phase TEXT;
    `,
    },
    {
        version: 12,
        name: 'building-construction-plans',
        sql: `
      CREATE TABLE IF NOT EXISTS construction_plans (
        id TEXT NOT NULL,
        revision INTEGER NOT NULL,
        hash TEXT NOT NULL,
        structure_id TEXT NOT NULL,
        blueprint_id TEXT NOT NULL,
        blueprint_revision INTEGER NOT NULL,
        plan_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (id, revision)
      );
      CREATE INDEX IF NOT EXISTS idx_construction_plans_structure
        ON construction_plans(structure_id, revision);
      ALTER TABLE claims ADD COLUMN parent_claim_id TEXT;
      ALTER TABLE block_changelog ADD COLUMN task_id TEXT;
      ALTER TABLE block_changelog ADD COLUMN grant_fencing_token INTEGER;
      ALTER TABLE block_changelog ADD COLUMN authorized INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE block_changelog ADD COLUMN rejection_reason TEXT;
    `,
    },
];
