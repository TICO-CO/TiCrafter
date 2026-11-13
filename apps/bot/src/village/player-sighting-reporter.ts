import type { ClockHandle, ClockPort, LoggerPort, Result, Vec3 } from '@ticrafter/core';

export interface ObservedPlayer {
    playerId: string;
    username: string;
    position: Vec3;
}

export interface PlayerSightingReporterOptions {
    clock: ClockPort;
    logger: LoggerPort;
    botId: string;
    intervalMilliseconds: number;
    radius: number;
    position: () => Vec3 | null;
    players: () => readonly ObservedPlayer[];
    send: (payload: {
        botId: string;
        playerId: string;
        username: string;
        position: { x: number; y: number; z: number };
        at: string;
    }) => Result<void, string>;
}

export class PlayerSightingReporter {
    private timer: ClockHandle | null = null;

    constructor(private readonly options: PlayerSightingReporterOptions) {}

    start(): void {
        if (this.timer !== null) return;
        this.report();
        this.timer = this.options.clock.setInterval(
            () => this.report(),
            this.options.intervalMilliseconds,
        );
    }

    stop(): void {
        if (this.timer === null) return;
        this.options.clock.clearInterval(this.timer);
        this.timer = null;
    }

    report(): void {
        const origin = this.options.position();
        if (origin === null) return;
        const at = new Date(this.options.clock.now()).toISOString();
        for (const player of this.options.players()) {
            const position = player.position;
            const distance = Math.hypot(
                position.x - origin.x,
                position.y - origin.y,
                position.z - origin.z,
            );
            if (distance > this.options.radius) continue;
            const [, sendError] = this.options.send({
                botId: this.options.botId,
                playerId: player.playerId,
                username: player.username,
                position: {
                    x: position.x,
                    y: position.y,
                    z: position.z,
                },
                at,
            });
            if (sendError) {
                this.options.logger.warn(
                    { error: sendError, playerId: player.playerId },
                    'player sighting send failed',
                );
            }
        }
    }
}
