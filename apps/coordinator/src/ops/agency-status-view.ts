import type { Result } from '@ticrafter/core';

export interface AgencyStatusSnapshot {
    botId: string;
    phase: string;
    activeGoal: string | null;
    needs: Readonly<Record<string, number>>;
    homeStructureId: string | null;
    lastDeliberationAt: string | null;
    recentGoalOutcomes: readonly string[];
}

export interface AgencyStatusPort {
    snapshot(botId: string): Result<AgencyStatusSnapshot | null, string>;
    onlineBotIds(): Result<readonly string[], string>;
}

export class AgencyStatusView {
    constructor(private readonly port: AgencyStatusPort) {}

    one(botId: string): Result<AgencyStatusSnapshot | null, string> {
        return this.port.snapshot(botId);
    }

    fleet(): Result<readonly AgencyStatusSnapshot[], string> {
        const [botIds, idsError] = this.port.onlineBotIds();
        if (idsError) return [null, idsError];
        if (botIds === null) return [null, 'online bot list missing'];
        const snapshots: AgencyStatusSnapshot[] = [];
        for (const botId of botIds) {
            const [snapshot, snapshotError] = this.port.snapshot(botId);
            if (snapshotError) return [null, snapshotError];
            if (snapshot !== null) snapshots.push(snapshot);
        }
        return [snapshots, null];
    }
}
