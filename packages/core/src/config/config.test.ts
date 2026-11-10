import { describe, expect, it } from 'bun:test';

import { ConfigFixture } from './config-fixture.js';
import { EnvOverlay } from './env-overlay.js';
import { EnvParser } from './env-parser.js';
import { HardwareProbe, type SystemInfo } from './hardware-probe.js';
import { DeepMerge } from './merge.js';
import { ConfigSchemaValidator } from './schema.js';

describe('config', () => {
    it('loads defaults with the home-min profile', () => {
        const [config, configError] = ConfigFixture.load();
        expect(configError).toBeNull();
        if (config === null) return;
        expect(config.hardwareProfile).toBe('home-min');
        expect(config.botCount).toBe(4);
        expect(config.laya.executionProviders).toEqual(['cpu']);
    });

    it('loads the home-full profile from env', () => {
        const [config, configError] = ConfigFixture.load({ HARDWARE_PROFILE: 'home-full' });
        expect(configError).toBeNull();
        if (config === null) return;
        expect(config.hardwareProfile).toBe('home-full');
        expect(config.botCount).toBe(8);
        expect(config.laya.threads).toBe(8);
    });

    it('applies env overrides after profiles', () => {
        const [config, configError] = ConfigFixture.load({
            HARDWARE_PROFILE: 'home-min',
            BOT_COUNT: '2',
            BOT_NAMES: '["Alpha","Beta"]',
            LAN_PORT: '25570',
            LAYA_EP: 'cpu,webgpu',
            PLANNER_ENABLED: 'true',
            PLANNER_BASE_URL: 'https://planner.invalid',
            PLANNER_API_KEY: 'secret',
        });
        expect(configError).toBeNull();
        if (config === null) return;
        expect(config.botCount).toBe(2);
        expect(config.botNames).toEqual(['Alpha', 'Beta']);
        expect(config.lan.port).toBe(25570);
        expect(config.laya.executionProviders).toEqual(['cpu', 'webgpu']);
        expect(config.planner.enabled).toBe(true);
    });

    it('rejects a short or duplicate name pool', () => {
        const [baseConfig, baseError] = ConfigFixture.load();
        expect(baseError).toBeNull();
        if (baseConfig === null) return;
        const shortPool = ConfigSchemaValidator.validate({
            ...baseConfig,
            botCount: 5,
            botNames: ['Alpha', 'Beta', 'Gamma', 'Delta'],
        });
        expect(shortPool[1]).not.toBeNull();
        const duplicatePool = ConfigSchemaValidator.validate({
            ...baseConfig,
            botNames: ['Alpha', 'Alpha', 'Beta', 'Gamma'],
        });
        expect(duplicatePool[1]).not.toBeNull();
    });

    it('requires planner credentials when enabled', () => {
        const [baseConfig, baseError] = ConfigFixture.load();
        expect(baseError).toBeNull();
        if (baseConfig === null) return;
        const [validated, validationError] = ConfigSchemaValidator.validate({
            ...baseConfig,
            planner: { enabled: true, baseUrl: '', apiKey: '' },
        });
        expect(validated).toBeNull();
        expect(validationError).not.toBeNull();
    });

    it('parses env files without expanding secrets', () => {
        expect(EnvParser.parse('export ALPHA=1\n# comment\nBETA="two"\n')).toEqual({
            ALPHA: '1',
            BETA: 'two',
        });
    });

    it('deep merges nested objects and replaces arrays', () => {
        const merged = DeepMerge.merge(
            { alpha: { beta: 1, gamma: 2 }, list: [1, 2] },
            { alpha: { gamma: 3 }, list: [9] },
        );
        expect(merged).toEqual({ alpha: { beta: 1, gamma: 3 }, list: [9] });
    });

    it('maps env booleans and numbers', () => {
        expect(EnvOverlay.apply({ AUTO_SPAWN_BOTS: 'false', BOT_COUNT: '3' })).toMatchObject({
            autoSpawnBots: false,
            botCount: 3,
        });
    });

    it('probes injected system information', () => {
        const systemInfo: SystemInfo = {
            platform: 'linux',
            arch: 'x64',
            cpuModel: 'Test CPU',
            cpuCount: 8,
            totalMemoryBytes: 16 * 1024 ** 3,
            freeMemoryBytes: 8 * 1024 ** 3,
        };
        const report = new HardwareProbe(systemInfo).probe();
        expect(report.cpuModel).toBe('Test CPU');
        expect(report.totalMemoryGiB).toBe(16);
        expect(report.freeMemoryGiB).toBe(8);
    });
});
