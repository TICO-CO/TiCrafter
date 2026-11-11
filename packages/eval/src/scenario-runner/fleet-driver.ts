import { type ChildProcess, spawn } from 'node:child_process';
import net from 'node:net';

import { attempt, type Result } from '@ticrafter/core';

import type { MinecraftServerHarness } from '../docker-server-harness/index.js';
import { FleetDatabase } from './fleet-database.js';
import type { ScenarioDefinition, ScenarioDriver, ScenarioObservation } from './index.js';

export interface FleetDriverOptions {
    repositoryRoot: string;
    dataDir: string;
    server: MinecraftServerHarness;
    transportHost?: string;
    transportPort?: number;
    opsHost?: string;
    opsPort?: number;
    lanPort?: number;
    readyTimeoutMilliseconds?: number;
}

export class FleetScenarioDriver implements ScenarioDriver {
    private process: ChildProcess | null = null;

    constructor(private readonly options: FleetDriverOptions) {}

    start(definition: ScenarioDefinition): Result<void, string> {
        const [, serverError] = this.options.server.start();
        if (serverError) return [null, serverError];
        const [, databaseError] = FleetDatabase.prepare(this.options.dataDir, definition);
        if (databaseError) {
            this.options.server.stop();
            return [null, databaseError];
        }
        const [childProcess, spawnError] = attempt(() =>
            spawn(process.execPath, ['apps/coordinator/src/main.ts'], {
                cwd: this.options.repositoryRoot,
                env: this.environment(definition),
                stdio: 'inherit',
            }),
        );
        if (spawnError || childProcess === null) {
            this.options.server.stop();
            return [null, 'coordinator spawn failed'];
        }
        this.process = childProcess;
        return [undefined, null];
    }

    async run(definition: ScenarioDefinition): Promise<Result<ScenarioObservation, string>> {
        const [ready, readyError] = await this.waitForPort();
        if (readyError) return [null, readyError];
        if (!ready) return [null, 'coordinator did not become ready'];
        const deadline = Date.now() + definition.timeoutMilliseconds;
        let last: ScenarioObservation = {
            passed: false,
            reasons: ['scenario did not run'],
            events: 0,
            duplicates: 0,
            claimConflicts: 0,
        };
        while (Date.now() < deadline) {
            const [observation, observeError] = FleetDatabase.observe(
                this.options.dataDir,
                definition,
            );
            if (observeError) return [null, observeError];
            if (observation === null) return [null, 'observation returned null'];
            last = observation;
            if (observation.passed) return [observation, null];
            await this.sleep(500);
        }
        return [last, null];
    }

    stop(_definition: ScenarioDefinition): Result<void, string> {
        const childProcess = this.process;
        this.process = null;
        if (childProcess !== null) {
            childProcess.kill('SIGTERM');
        }
        return this.options.server.stop();
    }

    private environment(definition: ScenarioDefinition): NodeJS.ProcessEnv {
        return {
            ...process.env,
            DATA_DIR: this.options.dataDir,
            AUTO_SPAWN_BOTS: 'true',
            BOT_COUNT: String(definition.bots.length),
            BOT_NAMES: JSON.stringify(definition.bots.map((bot) => bot.name)),
            TRAINING_TRACE_ENABLED: 'true',
            TRANSPORT_HOST: this.options.transportHost ?? '127.0.0.1',
            TRANSPORT_PORT: String(this.options.transportPort ?? 8788),
            OPS_HOST: this.options.opsHost ?? '127.0.0.1',
            OPS_PORT: String(this.options.opsPort ?? 8787),
            LAN_HOST: 'localhost',
            LAN_PORT: String(this.options.lanPort ?? 25565),
        };
    }

    private waitForPort(): Promise<Result<boolean, string>> {
        const host = this.options.transportHost ?? '127.0.0.1';
        const port = this.options.transportPort ?? 8788;
        const timeout = this.options.readyTimeoutMilliseconds ?? 30_000;
        return new Promise((resolve) => {
            const started = Date.now();
            const attemptConnect = (): void => {
                const socket = net.createConnection({ host, port });
                socket.setTimeout(1000);
                socket.once('connect', () => {
                    socket.destroy();
                    resolve([true, null]);
                });
                socket.once('timeout', () => {
                    socket.destroy();
                    retry();
                });
                socket.once('error', () => {
                    socket.destroy();
                    retry();
                });
            };
            const retry = (): void => {
                if (Date.now() - started >= timeout) {
                    resolve([false, null]);
                    return;
                }
                setTimeout(attemptConnect, 250);
            };
            attemptConnect();
        });
    }

    private sleep(milliseconds: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, milliseconds));
    }
}
