import {
    attempt,
    type LoggerPort,
    type Result,
    type TicrafterConfig,
    type TransportFailure,
} from '@ticrafter/core';

import type { BlueprintDocumentService } from '../building/index.js';
import type { ClaimService } from '../claims/index.js';
import type { DecisionService } from '../decision/index.js';
import type { GrantService } from '../grants/index.js';
import type { OpsApi, OpsFailure } from '../ops/index.js';
import type { SipTransactionalCommitter } from '../sip/index.js';
import type { TaskBoard } from '../tasks/index.js';
import type { TransportServer } from '../transport/index.js';
import type { BotProcessSupervisor } from './bot-process-supervisor.js';
import type { CoordinatorDatabase } from './epoch.js';
import type { MessageRouter } from './message-router.js';
import type { RestartRecovery } from './recovery.js';
import type { Scheduler } from './scheduler.js';

export interface CoordinatorOptions {
    config: TicrafterConfig;
    logger: LoggerPort;
    database: CoordinatorDatabase;
    epoch: number;
    schemaVersion: number;
    transport: TransportServer;
    messageRouter: MessageRouter;
    ops: OpsApi;
    scheduler: Scheduler;
    recovery: RestartRecovery;
    reconcile: () => Result<void, string>;
    supervisor: BotProcessSupervisor | null;
    sip: SipTransactionalCommitter;
    tasks: TaskBoard;
    claims: ClaimService;
    grants: GrantService;
    decision: DecisionService;
    blueprints: BlueprintDocumentService;
}

export class Coordinator {
    constructor(private readonly options: CoordinatorOptions) {}

    async start(): Promise<Result<void, string>> {
        const [transportStarted, transportError] = await this.options.transport.start();
        if (transportError) return [null, this.failureMessage(transportError)];
        if (transportStarted === null) return [null, 'transport start returned null'];

        const [opsStarted, opsError] = await this.options.ops.start();
        if (opsError) return [null, this.opsFailureMessage(opsError)];
        if (opsStarted === null) return [null, 'ops server start returned null'];

        const [, recoveryError] = this.runRecovery();
        if (recoveryError) return [null, recoveryError];
        const [, reconcileError] = this.options.reconcile();
        if (reconcileError) return [null, reconcileError];

        this.options.scheduler.start();
        this.options.supervisor?.spawnAll();

        this.options.logger.info(
            { host: this.options.config.transport.host, port: this.options.config.transport.port },
            'transport listening',
        );
        return [undefined, null];
    }

    async close(): Promise<void> {
        this.options.scheduler.stop();
        this.options.supervisor?.stopAll();
        const [, transportCloseError] = await this.options.transport.close();
        if (transportCloseError) {
            this.options.logger.warn(
                { error: this.failureMessage(transportCloseError) },
                'transport close failed',
            );
        }
        await this.options.ops.close();
        await this.options.decision.close();
        const [, closeError] = attempt(() => this.options.database.close());
        if (closeError) {
            this.options.logger.warn({ error: this.describe(closeError) }, 'database close failed');
        }
        this.options.logger.info('coordinator stopped');
    }

    get epoch(): number {
        return this.options.epoch;
    }

    get config(): TicrafterConfig {
        return this.options.config;
    }

    get logger(): LoggerPort {
        return this.options.logger;
    }

    get database(): CoordinatorDatabase {
        return this.options.database;
    }

    get sip(): SipTransactionalCommitter {
        return this.options.sip;
    }

    get tasks(): TaskBoard {
        return this.options.tasks;
    }

    get claims(): ClaimService {
        return this.options.claims;
    }

    get grants(): GrantService {
        return this.options.grants;
    }

    get blueprints(): BlueprintDocumentService {
        return this.options.blueprints;
    }

    private runRecovery(): Result<void, string> {
        const [report, recoveryError] = this.options.recovery.run();
        if (recoveryError) return [null, this.describe(recoveryError)];
        if (report) this.options.logger.info(report, 'restart recovery complete');
        return [undefined, null];
    }

    private failureMessage(failure: TransportFailure): string {
        return 'message' in failure ? failure.message : failure.type;
    }

    private opsFailureMessage(failure: OpsFailure): string {
        switch (failure.type) {
            case 'STORAGE':
                return failure.failure.message;
            case 'BOT_NOT_CONNECTED':
                return `bot is not connected: ${failure.botId}`;
            case 'LISTEN_FAILED':
            case 'COMMAND_FAILED':
            case 'INVALID_REQUEST':
            case 'UNAVAILABLE':
                return failure.message;
        }
    }

    private describe(error: unknown): string {
        if (error instanceof Error) return error.message;
        if (typeof error !== 'object' || error === null) return String(error);
        if ('message' in error && typeof error.message === 'string') return error.message;
        if ('type' in error && typeof error.type === 'string') return error.type;
        return JSON.stringify(error);
    }
}
