import type { Result } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { type CommandOutput, MinecraftServerHarness, type ServerCommandPort } from './index.js';

class FakeCommands implements ServerCommandPort {
    readonly calls: string[][] = [];

    run(command: readonly string[]): Result<CommandOutput, string> {
        this.calls.push([...command]);
        return [
            {
                status: 0,
                stdout: command.includes('status') ? 'running (processId 123)\n' : '',
                stderr: '',
            },
            null,
        ];
    }
}

describe('MinecraftServerHarness', () => {
    it('starts, stops, and reports the local server', () => {
        const commands = new FakeCommands();
        const harness = new MinecraftServerHarness(commands, '/repo', { acceptEula: true });

        expect(harness.start()[1]).toBeNull();
        expect(commands.calls[0]?.includes('--accept-eula')).toBe(true);
        const [status, statusError] = harness.status();
        expect(statusError).toBeNull();
        expect(status?.running).toBe(true);
        expect(harness.stop()[1]).toBeNull();
    });

    it('uses docker when requested', () => {
        const commands = new FakeCommands();
        const harness = new MinecraftServerHarness(commands, '/repo', {
            mode: 'docker',
            dockerName: 'test-server',
        });

        expect(harness.start()[1]).toBeNull();
        expect(commands.calls[0]?.[0]).toBe('docker');
        expect(commands.calls[0]?.includes('test-server')).toBe(true);
    });
});
