import net from 'node:net';

import { attemptAsync, type Result } from '@ticrafter/core';

export class FreePort {
    static async allocate(host = '127.0.0.1'): Promise<Result<number, string>> {
        const [port, error] = await attemptAsync<number, string>(
            () =>
                new Promise<number>((resolve, reject) => {
                    const server = net.createServer();
                    server.once('error', (failure) => reject(failure.message));
                    server.listen(0, host, () => {
                        const address = server.address();
                        if (address === null || typeof address === 'string') {
                            server.close(() => reject('port allocation returned no address'));
                            return;
                        }
                        const assigned = address.port;
                        server.close(() => resolve(assigned));
                    });
                }),
        );
        return error === null ? [port, null] : [null, error];
    }
}
