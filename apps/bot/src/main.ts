import path from 'node:path';

import { attemptAsync, ConfigErrorFormatter, ConfigLoader } from '@ticrafter/core';

import { BotRuntime } from './bot-runtime.js';
import { NodeConfigSource } from './config-source.js';
import { NodeLoggerFactory } from './logger.js';

export class BotMain {
    async run(): Promise<void> {
        const configDirectory = path.resolve(process.cwd(), 'config');
        const runtime = new BotRuntime({
            configLoader: new ConfigLoader({
                source: new NodeConfigSource(configDirectory),
                environment: process.env,
            }),
            loggerFactory: new NodeLoggerFactory(),
        });
        const [handle, startError] = await runtime.start();
        if (startError) return this.fail(startError);
        if (handle === null) return this.fail('bot start returned null');

        const shutdown = () => {
            handle.close();
            process.exit(0);
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
        console.log(`bot ${handle.name} (${handle.botId}) started`);
    }

    private fail(message: string): void {
        console.error(message);
        process.exit(1);
    }
}

const [, mainError] = await attemptAsync(() => new BotMain().run());
if (mainError) {
    console.error(ConfigErrorFormatter.format(mainError));
    process.exit(1);
}
