import type { Result } from '@ticrafter/core';
import type { AgentEpisode, StorageFailure } from '@ticrafter/memory';

import type { AgencyStateRecord } from '../bots/index.js';
import type { SessionManager } from '../core/index.js';
import type {
    AgencyEpisodeSnapshot,
    AgencyStatusPort,
    AgencyStatusSnapshot,
} from './agency-status-view.js';

export interface AgencyStatusSourceOptions {
    states: { load(botId: string): Result<AgencyStateRecord | null, StorageFailure> };
    episodes: { list(botId: string, limit?: number): Result<AgentEpisode[], StorageFailure> };
    sessions: Pick<SessionManager, 'list'>;
}

export class AgencyStatusSource implements AgencyStatusPort {
    constructor(private readonly options: AgencyStatusSourceOptions) {}

    snapshot(botId: string): Result<AgencyStatusSnapshot | null, string> {
        const [record, recordError] = this.options.states.load(botId);
        if (recordError) return [null, recordError.message];
        if (record === null) return [null, null];
        const [episodes, episodeError] = this.options.episodes.list(botId, 20);
        if (episodeError) return [null, episodeError.message];
        return [
            {
                botId: record.botId,
                phase: record.routine.phase,
                activeGoal: record.intention?.label ?? null,
                needs: record.needs.levels,
                homeStructureId: record.homeStructureId,
                lastDeliberationAt: record.lastDeliberationAt,
                recentGoalOutcomes: (episodes ?? [])
                    .filter(
                        (episode) =>
                            episode.kind === 'goal.completed' || episode.kind === 'goal.abandoned',
                    )
                    .map((episode) => episode.summary)
                    .slice(0, 5),
            },
            null,
        ];
    }

    episodes(botId: string, limit: number): Result<readonly AgencyEpisodeSnapshot[], string> {
        const [episodes, episodeError] = this.options.episodes.list(botId, limit);
        if (episodeError) return [null, episodeError.message];
        return [
            (episodes ?? []).map((episode) => ({
                id: episode.id,
                goalId: episode.goalId,
                kind: episode.kind,
                summary: episode.summary,
                createdAt: episode.createdAt,
            })),
            null,
        ];
    }

    onlineBotIds(): Result<readonly string[], string> {
        return [this.options.sessions.list().map((session) => session.botId), null];
    }
}
