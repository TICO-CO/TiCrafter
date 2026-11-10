export interface LoggerPort {
    debug(payload: unknown, message?: string): void;
    info(payload: unknown, message?: string): void;
    warn(payload: unknown, message?: string): void;
    error(payload: unknown, message?: string): void;
}

export interface LoggerFactoryPort {
    create(name: string, level: string): LoggerPort;
}

export class LoggerConfig {
    static redactionPaths(): string[] {
        return [
            '*.apiKey',
            '*.PLANNER_API_KEY',
            'config.planner.apiKey',
            'planner.apiKey',
            'apiKey',
            'password',
            'token',
        ];
    }
}
