import { type ChildProcess, spawn } from 'node:child_process';
import path from 'node:path';

import { attempt, type LoggerPort } from '@ticrafter/core';

export interface BotProcessSupervisorOptions {
    root: string;
    botCount: number;
    logger: LoggerPort;
}

export class BotProcessSupervisor {
    private readonly processes = new Map<number, ChildProcess>();

    constructor(private readonly options: BotProcessSupervisorOptions) {}

    spawnAll(): void {
        for (let botIndex = 0; botIndex < this.options.botCount; botIndex += 1) {
            this.spawn(botIndex);
        }
    }

    spawn(botIndex: number): void {
        if (this.processes.has(botIndex)) return;
        const entryPoint = path.join(this.options.root, 'apps/bot/src/main.ts');
        const [childProcess, spawnError] = attempt(() =>
            spawn(process.execPath, [entryPoint], {
                cwd: this.options.root,
                env: { ...process.env, BOT_INDEX: String(botIndex) },
                stdio: 'inherit',
            }),
        );
        if (spawnError || childProcess === null) {
            this.options.logger.error(
                { botIndex, error: this.describe(spawnError) },
                'bot process failed to spawn',
            );
            return;
        }
        this.processes.set(botIndex, childProcess);
        this.options.logger.info({ botIndex, processId: childProcess.pid }, 'bot process spawned');
        childProcess.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
            this.processes.delete(botIndex);
            this.options.logger.warn({ botIndex, code, signal }, 'bot process exited');
        });
    }

    stopAll(): void {
        for (const [botIndex, childProcess] of this.processes) {
            childProcess.kill('SIGTERM');
            this.processes.delete(botIndex);
        }
    }

    private describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
