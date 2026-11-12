import {
    AgencyState,
    type AgencyStateSnapshot,
    NeedsModel,
    PersonalityModel,
} from '@ticrafter/agency';
import {
    AGENCY_EPISODE_EVENT,
    AGENCY_STATE_EVENT,
    type AgencyStatePayload,
    type LoggerPort,
    type Result,
    type TransportFailure,
    type Vec3,
} from '@ticrafter/core';

export interface AgencyEventSink {
    sendEvent(type: string, payload: unknown): Result<void, TransportFailure>;
}

export interface AgencyStateAdapterOptions {
    botId: string;
    events: AgencyEventSink;
    logger: LoggerPort;
}

export interface AgencyEpisodeInput {
    goalId: string | null;
    kind: string;
    summary: string;
    position?: Vec3 | null;
    relatedBotId?: string | null;
    payload?: unknown;
    at?: string;
}

export class AgencyStateAdapter {
    constructor(private readonly options: AgencyStateAdapterOptions) {}

    restore(payload: AgencyStatePayload | null | undefined): Result<AgencyState | null, string> {
        if (payload === null || payload === undefined) return [null, null];
        const [traits, traitsError] = PersonalityModel.restore(payload.traits);
        if (traitsError) return [null, traitsError];
        if (traits === null) return [null, 'personality restore returned null'];
        const [needs, needsError] = NeedsModel.restore(payload.needs);
        if (needsError) return [null, needsError];
        if (needs === null) return [null, 'needs restore returned null'];
        return AgencyState.restore({
            botId: this.options.botId,
            traits,
            needs,
            intention: payload.intention,
            routine: payload.routine,
            homeStructureId: payload.homeStructureId,
            personalStorageId: payload.personalStorageId,
            mood: payload.mood,
            lastDeliberationAt: payload.lastDeliberationAt,
        });
    }

    save(state: AgencyStateSnapshot, at = new Date().toISOString()): void {
        const [, sendError] = this.options.events.sendEvent(AGENCY_STATE_EVENT, {
            botId: this.options.botId,
            at,
            state: {
                traits: state.traits.traits,
                needs: state.needs.levels,
                intention: state.intention,
                routine: state.routine,
                homeStructureId: state.homeStructureId,
                personalStorageId: state.personalStorageId,
                mood: state.mood,
                lastDeliberationAt: state.lastDeliberationAt,
            },
        });
        if (sendError) {
            this.options.logger.warn({ error: sendError }, 'agency state save failed');
        }
    }

    episode(input: AgencyEpisodeInput): void {
        const at = input.at ?? new Date().toISOString();
        const [, sendError] = this.options.events.sendEvent(AGENCY_EPISODE_EVENT, {
            botId: this.options.botId,
            at,
            episode: {
                id: crypto.randomUUID(),
                goalId: input.goalId,
                kind: input.kind,
                summary: input.summary,
                position: input.position ?? null,
                relatedBotId: input.relatedBotId ?? null,
                payload: input.payload ?? {},
            },
        });
        if (sendError) {
            this.options.logger.warn({ error: sendError }, 'agency episode save failed');
        }
    }
}
