import { LoggerConfig, type LoggerFactoryPort, type LoggerPort } from '@ticrafter/core';
import pino from 'pino';

export class NodeLoggerFactory implements LoggerFactoryPort {
    create(name: string, level: string): LoggerPort {
        return pino({
            name,
            level,
            redact: {
                paths: LoggerConfig.redactionPaths(),
                censor: '[redacted]',
            },
        });
    }
}
