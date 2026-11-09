import pino, { type Logger } from 'pino';

export function createLogger(name: string, level = 'info'): Logger {
  return pino({
    name,
    level,
    redact: {
      paths: [
        '*.apiKey',
        '*.PLANNER_API_KEY',
        'config.planner.apiKey',
        'planner.apiKey',
        'apiKey',
        'password',
        'token',
      ],
      censor: '[redacted]',
    },
  });
}
