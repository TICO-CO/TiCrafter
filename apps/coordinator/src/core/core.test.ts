import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrate, openDatabase, type DatabaseConnection } from '@ticrafter/memory';
import { afterEach, describe, expect, it } from 'vitest';
import { bumpEpoch, currentEpoch } from './epoch';
import { SessionManager } from './session-manager';

const dirs: string[] = [];

function tempDb(): DatabaseConnection {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ticrafter-coordinator-'));
  dirs.push(dir);
  const db = openDatabase({ dataDir: dir });
  migrate(db);
  return db;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('coordinator core', () => {
  it('increments the coordinator epoch across restarts', () => {
    const db = tempDb();
    expect(currentEpoch(db)).toBe(0);
    expect(bumpEpoch(db)).toBe(1);
    expect(bumpEpoch(db)).toBe(2);
    expect(currentEpoch(db)).toBe(2);
    db.close();
  });

  it('tracks and prunes sessions', () => {
    const sessions = new SessionManager();
    sessions.add({
      botId: 'bot.a',
      name: 'A',
      connectionId: 'c1',
      connectedAt: '2026-01-01T00:00:00.000Z',
      lastSeen: '2026-01-01T00:00:00.000Z',
    });
    expect(sessions.count()).toBe(1);
    sessions.touch('bot.a', '2026-01-01T00:00:10.000Z');
    expect(sessions.get('bot.a')?.lastSeen).toBe('2026-01-01T00:00:10.000Z');
    expect(sessions.pruneStale(5000, Date.parse('2026-01-01T00:00:20.000Z'))).toEqual(['bot.a']);
    expect(sessions.count()).toBe(0);
  });
});
