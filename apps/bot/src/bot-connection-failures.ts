export type BotConnectionFailure =
    { type: 'transport'; message: string } | { type: 'minecraft'; message: string };

export class BotConnectionFailures {
    static transport(message: string): BotConnectionFailure {
        return { type: 'transport', message };
    }

    static minecraft(message: string): BotConnectionFailure {
        return { type: 'minecraft', message };
    }

    static isFatal(failure: BotConnectionFailure): boolean {
        return failure.type === 'minecraft';
    }
}
