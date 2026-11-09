import { describe, expect, it } from 'vitest';
import { configSchema } from './schema';
import { loadConfig } from './config-loader';
import { deepMerge } from './merge';
import { envOverrides, parseEnvFile } from './env-parser';

describe('config', () => {
  it('loads defaults with the home-min profile', () => {
    const config = loadConfig({ env: {} });
    expect(config.hardwareProfile).toBe('home-min');
    expect(config.botCount).toBe(4);
    expect(config.laya.executionProviders).toEqual(['cpu']);
  });

  it('loads the home-full profile from env', () => {
    const config = loadConfig({ env: { HARDWARE_PROFILE: 'home-full' } });
    expect(config.hardwareProfile).toBe('home-full');
    expect(config.botCount).toBe(8);
    expect(config.laya.threads).toBe(8);
  });

  it('applies env overrides after profiles', () => {
    const config = loadConfig({
      env: {
        HARDWARE_PROFILE: 'home-min',
        BOT_COUNT: '2',
        BOT_NAMES: '["Alpha","Beta"]',
        LAN_PORT: '25570',
        LAYA_EP: 'cpu,webgpu',
        PLANNER_ENABLED: 'true',
        PLANNER_BASE_URL: 'https://planner.invalid',
        PLANNER_API_KEY: 'secret',
      },
    });
    expect(config.botCount).toBe(2);
    expect(config.botNames).toEqual(['Alpha', 'Beta']);
    expect(config.lan.port).toBe(25570);
    expect(config.laya.executionProviders).toEqual(['cpu', 'webgpu']);
    expect(config.planner.enabled).toBe(true);
  });

  it('rejects a short or duplicate name pool', () => {
    const base = loadConfig({ env: {} });
    expect(configSchema.safeParse({ ...base, botCount: 5, botNames: ['A', 'B', 'C', 'D'] }).success).toBe(
      false,
    );
    expect(configSchema.safeParse({ ...base, botNames: ['A', 'A', 'B', 'C'] }).success).toBe(false);
  });

  it('requires planner credentials when enabled', () => {
    const base = loadConfig({ env: {} });
    expect(
      configSchema.safeParse({ ...base, planner: { enabled: true, baseUrl: '', apiKey: '' } }).success,
    ).toBe(false);
  });

  it('parses env files without expanding secrets', () => {
    expect(parseEnvFile('export A=1\n# comment\nB="two"\n')).toEqual({ A: '1', B: 'two' });
  });

  it('deep merges nested objects and replaces arrays', () => {
    const merged = deepMerge({ a: { b: 1, c: 2 }, list: [1, 2] }, { a: { c: 3 }, list: [9] });
    expect(merged).toEqual({ a: { b: 1, c: 3 }, list: [9] });
  });

  it('maps env booleans and numbers', () => {
    expect(envOverrides({ AUTO_SPAWN_BOTS: 'false', BOT_COUNT: '3' })).toMatchObject({
      autoSpawnBots: false,
      botCount: 3,
    });
  });
});
