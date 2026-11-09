import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { attempt } from '@ticrafter/core';
import type { Logger } from 'pino';

export interface BotProcessSupervisorOptions {
    root: string;
    botCount: number;
    logger: Logger;
}

export class BotProcessSupervisor {
    private readonly children = new Map<number, ChildProcess>();

    constructor(private readonly options: BotProcessSupervisorOptions) {}

    spawnAll(): void {
        for (let index = 0; index < this.options.botCount; index += 1) this.spawn(index);
    }

    spawn(index: number): void {
        if (this.children.has(index)) return;
        const entry = path.join(this.options.root, 'apps/bot/src/main.ts');
        const [child, spawnError] = attempt(() =>
            spawn(process.execPath, ['--import', 'tsx', entry], {
                cwd: this.options.root,
                env: { ...process.env, BOT_INDEX: String(index) },
                stdio: 'inherit',
            }),
        );
        if (spawnError || child === null) {
            this.options.logger.error(
                { index, error: this.describe(spawnError) },
                'bot process failed to spawn',
            );
            return;
        }
        this.children.set(index, child);
        this.options.logger.info({ index, pid: child.pid }, 'bot process spawned');
        child.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
            this.children.delete(index);
            this.options.logger.warn({ index, code, signal }, 'bot process exited');
        });
    }

    stopAll(): void {
        for (const [index, child] of this.children) {
            child.kill('SIGTERM');
            this.children.delete(index);
        }
    }

    private describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
