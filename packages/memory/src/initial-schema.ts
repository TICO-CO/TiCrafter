export const initialSchemaSql = `
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS coordinator_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        epoch INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bots (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        role TEXT,
        profile_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bot_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id TEXT,
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        actor TEXT,
        causation_id TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_bot_events_created_at ON bot_events(created_at);
      CREATE INDEX IF NOT EXISTS idx_bot_events_bot_id ON bot_events(bot_id);

      CREATE TABLE IF NOT EXISTS skill_checkpoints (
        id TEXT PRIMARY KEY,
        bot_id TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        state_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        parent_id TEXT,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 0,
        retry_count INTEGER NOT NULL DEFAULT 0,
        payload_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS claims (
        id TEXT PRIMARY KEY,
        resource TEXT NOT NULL,
        owner_bot_id TEXT NOT NULL,
        lease_expires_at TEXT NOT NULL,
        fencing_token INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_claims_expires ON claims(lease_expires_at);

      CREATE TABLE IF NOT EXISTS edit_grants (
        id TEXT PRIMARY KEY,
        structure_id TEXT NOT NULL,
        owner_bot_id TEXT NOT NULL,
        grantee_bot_id TEXT NOT NULL,
        revision INTEGER NOT NULL,
        status TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_edit_grants_expires ON edit_grants(expires_at);

      CREATE TABLE IF NOT EXISTS sip (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        revision INTEGER NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sip_revisions (
        revision INTEGER PRIMARY KEY,
        payload_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chunks (
        x INTEGER NOT NULL,
        z INTEGER NOT NULL,
        version INTEGER NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL,
        PRIMARY KEY (x, z)
      );

      CREATE TABLE IF NOT EXISTS landmarks (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        z INTEGER NOT NULL,
        confidence REAL NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS structures (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS containers (
        id TEXT PRIMARY KEY,
        position TEXT NOT NULL,
        role TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS episodes (
        id TEXT PRIMARY KEY,
        task_id TEXT,
        bot_id TEXT,
        outcome TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS block_changelog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id TEXT NOT NULL,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        z INTEGER NOT NULL,
        before_json TEXT,
        after_json TEXT,
        grant_id TEXT,
        claim_id TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_block_changelog_created_at ON block_changelog(created_at);

      CREATE TABLE IF NOT EXISTS metrics (
        name TEXT NOT NULL,
        ts TEXT NOT NULL,
        value REAL NOT NULL,
        labels_json TEXT NOT NULL DEFAULT '{}',
        PRIMARY KEY (name, ts)
      );
    `;
