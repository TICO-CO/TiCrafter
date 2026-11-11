import { spawnSync } from 'node:child_process';

import type { Result } from '@ticrafter/core';

export interface CommandOutput {
    status: number | null;
    stdout: string;
    stderr: string;
}

export interface ServerCommandPort {
    run(command: readonly string[], cwd: string): Result<CommandOutput, string>;
}

export interface ServerStatus {
    running: boolean;
    detail: string;
}

export interface ServerHarness {
    start(): Result<void, string>;
    stop(): Result<void, string>;
    status(): Result<ServerStatus, string>;
}

export interface MinecraftServerOptions {
    mode?: 'local' | 'docker';
    acceptEula?: boolean;
    dockerImage?: string;
    dockerName?: string;
}

export class NodeServerCommands implements ServerCommandPort {
    run(command: readonly string[], cwd: string): Result<CommandOutput, string> {
        const [executable, ...argumentsList] = command;
        if (executable === undefined) return [null, 'missing executable'];
        const result = spawnSync(executable, argumentsList, { cwd, encoding: 'utf8' });
        return [
            {
                status: result.status,
                stdout: result.stdout,
                stderr: result.stderr,
            },
            null,
        ];
    }
}

export class MinecraftServerHarness implements ServerHarness {
    private readonly mode: 'local' | 'docker';
    private readonly acceptEula: boolean;
    private readonly dockerImage: string;
    private readonly dockerName: string;

    constructor(
        private readonly commands: ServerCommandPort,
        private readonly repositoryRoot: string,
        options: MinecraftServerOptions = {},
    ) {
        this.mode = options.mode ?? 'local';
        this.acceptEula = options.acceptEula ?? false;
        this.dockerImage = options.dockerImage ?? 'itzg/minecraft-server:java17';
        this.dockerName = options.dockerName ?? 'ticrafter-eval';
    }

    start(): Result<void, string> {
        if (this.mode === 'docker') return this.runVoid(['docker', ...this.dockerStart()]);
        return this.runVoid([
            'bun',
            'tools/bootstrap/minecraft-server.mjs',
            'start',
            ...(this.acceptEula ? ['--accept-eula'] : []),
        ]);
    }

    stop(): Result<void, string> {
        if (this.mode === 'docker') {
            return this.runVoid(['docker', 'rm', '--force', this.dockerName]);
        }
        return this.runVoid(['bun', 'tools/bootstrap/minecraft-server.mjs', 'stop']);
    }

    status(): Result<ServerStatus, string> {
        if (this.mode === 'docker') return this.dockerStatus();
        const [output, commandError] = this.run([
            'bun',
            'tools/bootstrap/minecraft-server.mjs',
            'status',
        ]);
        if (commandError) return [null, commandError];
        if (output === null) return [null, 'server status returned null'];
        const running = output.stdout.trim().split('\n')[0]?.startsWith('running') ?? false;
        return [{ running, detail: output.stdout.trim() }, null];
    }

    private dockerStart(): string[] {
        return [
            'run',
            '--detach',
            '--name',
            this.dockerName,
            '--publish',
            '25565:25565',
            '--env',
            'EULA=TRUE',
            '--env',
            'ONLINE_MODE=FALSE',
            '--env',
            'LEVEL_TYPE=FLAT',
            '--env',
            'MODE=survival',
            this.dockerImage,
        ];
    }

    private dockerStatus(): Result<ServerStatus, string> {
        const [output, commandError] = this.run([
            'docker',
            'inspect',
            '--format',
            '{{.State.Running}}',
            this.dockerName,
        ]);
        if (commandError) return [null, commandError];
        if (output === null) return [null, 'docker status returned null'];
        return [
            {
                running: output.status === 0 && output.stdout.trim() === 'true',
                detail: output.stdout.trim(),
            },
            null,
        ];
    }

    private runVoid(command: readonly string[]): Result<void, string> {
        const [, commandError] = this.run(command);
        if (commandError) return [null, commandError];
        return [undefined, null];
    }

    private run(
        command: readonly string[],
        cwd = this.repositoryRoot,
    ): Result<CommandOutput, string> {
        const [output, commandError] = this.commands.run(command, cwd);
        if (commandError) return [null, commandError];
        if (output === null) return [null, 'command returned null'];
        if (output.status !== 0) {
            return [null, output.stderr.trim() || `command failed with ${output.status}`];
        }
        return [output, null];
    }
}
