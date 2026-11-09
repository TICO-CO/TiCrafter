import { ConfigErrorFormatter, attemptAsync } from '@ticrafter/core';
import { BotRuntime } from './bot-runtime.js';

export class BotMain {
    async run(): Promise<void> {
        const [handle, startError] = await new BotRuntime().start();
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
