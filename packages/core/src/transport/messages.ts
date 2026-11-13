import type { z as zod } from 'zod';

import { attempt, type Result } from '../kernel/index.js';
import {
    AGENCY_EPISODE_EVENT,
    AGENCY_STATE_EVENT,
    BLOCK_UPDATE_EVENT,
    blockUpdateSchema,
    BOT_AUTONOMY_PAUSE,
    BOT_AUTONOMY_RESUME,
    BOT_BLUEPRINT_GET,
    BOT_BLUEPRINT_RESPONSE,
    BOT_CONSTRUCTION_PLAN_GET,
    BOT_CONSTRUCTION_PLAN_RESPONSE,
    BOT_JOB_DECIDE,
    BOT_JOB_DECIDE_RESPONSE,
    BOT_JOB_OFFERS,
    BOT_JOB_OFFERS_RESPONSE,
    BOT_PERMISSION_OUTCOME_EVENT,
    BOT_PLAYER_SIGHTING_EVENT,
    BOT_PLOT_OWNERSHIP_REQUEST,
    BOT_PLOT_OWNERSHIP_RESPONSE,
    BOT_PROJECT_ABANDON,
    BOT_PROJECT_ABANDON_RESPONSE,
    BOT_PROJECT_PROPOSE,
    BOT_PROJECT_REPAIR,
    BOT_PROJECT_RESPONSE,
    BOT_PROJECT_REVISE,
    BOT_PROJECT_ROLLBACK,
    BOT_PROJECT_UPDATE_EVENT,
    BOT_SAFETY_RESUME,
    BOT_SAFETY_STOP,
    BOT_SKILL_CANCEL,
    BOT_SKILL_RESUME,
    BOT_SKILL_START,
    botAgencyEpisodeSchema,
    botAgencyStateSchema,
    botAutonomyPauseSchema,
    botAutonomyResumeSchema,
    botBlueprintGetSchema,
    botBlueprintResponseSchema,
    botConstructionPlanGetSchema,
    botConstructionPlanResponseSchema,
    botEventSchema,
    botHeartbeatSchema,
    botJobDecideResponseSchema,
    botJobDecideSchema,
    botJobOffersResponseSchema,
    botJobOffersSchema,
    botPermissionOutcomeSchema,
    botPlayerSightingSchema,
    botPlotOwnershipRequestSchema,
    botPlotOwnershipResponseSchema,
    botProjectAbandonResponseSchema,
    botProjectAbandonSchema,
    botProjectProposeSchema,
    botProjectRepairSchema,
    botProjectResponseSchema,
    botProjectReviseSchema,
    botProjectRollbackSchema,
    botProjectUpdateSchema,
    botSafetyResumeSchema,
    botSafetyStopSchema,
    botSkillCancelSchema,
    botSkillResumeSchema,
    botSkillStartSchema,
    botTaskClaimSchema,
    botTaskCompleteSchema,
    botTaskFailSchema,
    botTaskRenewSchema,
    botTaskResponseSchema,
    CHUNK_SNAPSHOT_EVENT,
    chunkSnapshotSchema,
    coordinatorErrorSchema,
    coordinatorPingResponseSchema,
    coordinatorPingSchema,
    coordinatorStatusResponseSchema,
    coordinatorStatusSchema,
    DECISION_REQUEST,
    DECISION_RESPONSE,
    decisionRequestSchema,
    decisionResponseSchema,
    type Envelope,
    envelopeSchema,
    LANDMARK_CANDIDATE_EVENT,
    landmarkCandidateSchema,
    PLANNER_STRATEGIC_INTENT_EVENT,
    plannerStrategicIntentEventSchema,
    PROTOCOL_VERSION,
    sessionHelloResponseSchema,
    sessionHelloSchema,
    SKILL_PROGRESS_EVENT,
    skillProgressSchema,
    TASK_CLAIM,
    TASK_COMPLETE,
    TASK_FAIL,
    TASK_RENEW,
    TASK_RESPONSE,
} from '../schemas/index.js';
import type { TransportFailure } from './failures.js';

export class MessageSchemaRegistry {
    private readonly schemas = new Map<string, zod.ZodType>();

    register(type: string, schema: zod.ZodType): this {
        this.schemas.set(type, schema);
        return this;
    }

    has(type: string): boolean {
        return this.schemas.has(type);
    }

    validate(input: unknown): Result<Envelope, TransportFailure> {
        const [parsed, envelopeError] = attempt(() => envelopeSchema.parse(input));
        if (envelopeError || parsed === null) {
            return [
                null,
                {
                    type: 'INVALID_FRAME',
                    message: MessageSchemaRegistry.describe(envelopeError),
                },
            ];
        }
        const schema = this.schemas.get(parsed.type);
        if (!schema) return [null, { type: 'UNKNOWN_MESSAGE', messageType: parsed.type }];
        const [, payloadError] = attempt(() => schema.parse(parsed.payload));
        if (payloadError) {
            return [
                null,
                {
                    type: 'INVALID_PAYLOAD',
                    messageType: parsed.type,
                    message: MessageSchemaRegistry.describe(payloadError),
                },
            ];
        }
        return [parsed, null];
    }

    static withDefaults(): MessageSchemaRegistry {
        return new MessageSchemaRegistry()
            .register('session.hello', sessionHelloSchema)
            .register('session.hello.response', sessionHelloResponseSchema)
            .register('coordinator.ping', coordinatorPingSchema)
            .register('coordinator.ping.response', coordinatorPingResponseSchema)
            .register('coordinator.status', coordinatorStatusSchema)
            .register('coordinator.status.response', coordinatorStatusResponseSchema)
            .register('coordinator.error', coordinatorErrorSchema)
            .register('bot.heartbeat', botHeartbeatSchema)
            .register('bot.event', botEventSchema)
            .register(CHUNK_SNAPSHOT_EVENT, chunkSnapshotSchema)
            .register(LANDMARK_CANDIDATE_EVENT, landmarkCandidateSchema)
            .register(BLOCK_UPDATE_EVENT, blockUpdateSchema)
            .register(SKILL_PROGRESS_EVENT, skillProgressSchema)
            .register(AGENCY_STATE_EVENT, botAgencyStateSchema)
            .register(AGENCY_EPISODE_EVENT, botAgencyEpisodeSchema)
            .register(BOT_SKILL_START, botSkillStartSchema)
            .register(BOT_SKILL_CANCEL, botSkillCancelSchema)
            .register(BOT_SKILL_RESUME, botSkillResumeSchema)
            .register(BOT_SAFETY_RESUME, botSafetyResumeSchema)
            .register(BOT_SAFETY_STOP, botSafetyStopSchema)
            .register(BOT_AUTONOMY_PAUSE, botAutonomyPauseSchema)
            .register(BOT_AUTONOMY_RESUME, botAutonomyResumeSchema)
            .register(PLANNER_STRATEGIC_INTENT_EVENT, plannerStrategicIntentEventSchema)
            .register(BOT_BLUEPRINT_GET, botBlueprintGetSchema)
            .register(BOT_BLUEPRINT_RESPONSE, botBlueprintResponseSchema)
            .register(BOT_CONSTRUCTION_PLAN_GET, botConstructionPlanGetSchema)
            .register(BOT_CONSTRUCTION_PLAN_RESPONSE, botConstructionPlanResponseSchema)
            .register(DECISION_REQUEST, decisionRequestSchema)
            .register(DECISION_RESPONSE, decisionResponseSchema)
            .register(TASK_CLAIM, botTaskClaimSchema)
            .register(TASK_RENEW, botTaskRenewSchema)
            .register(TASK_COMPLETE, botTaskCompleteSchema)
            .register(TASK_FAIL, botTaskFailSchema)
            .register(TASK_RESPONSE, botTaskResponseSchema)
            .register(BOT_PROJECT_PROPOSE, botProjectProposeSchema)
            .register(BOT_PROJECT_RESPONSE, botProjectResponseSchema)
            .register(BOT_PROJECT_ABANDON, botProjectAbandonSchema)
            .register(BOT_PROJECT_ABANDON_RESPONSE, botProjectAbandonResponseSchema)
            .register(BOT_PROJECT_REPAIR, botProjectRepairSchema)
            .register(BOT_PROJECT_REVISE, botProjectReviseSchema)
            .register(BOT_PROJECT_ROLLBACK, botProjectRollbackSchema)
            .register(BOT_PROJECT_UPDATE_EVENT, botProjectUpdateSchema)
            .register(BOT_JOB_OFFERS, botJobOffersSchema)
            .register(BOT_JOB_OFFERS_RESPONSE, botJobOffersResponseSchema)
            .register(BOT_JOB_DECIDE, botJobDecideSchema)
            .register(BOT_JOB_DECIDE_RESPONSE, botJobDecideResponseSchema)
            .register(BOT_PLOT_OWNERSHIP_REQUEST, botPlotOwnershipRequestSchema)
            .register(BOT_PLOT_OWNERSHIP_RESPONSE, botPlotOwnershipResponseSchema)
            .register(BOT_PLAYER_SIGHTING_EVENT, botPlayerSightingSchema)
            .register(BOT_PERMISSION_OUTCOME_EVENT, botPermissionOutcomeSchema);
    }

    private static describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}

export class ProtocolEnvelope {
    static create(
        kind: Envelope['kind'],
        type: string,
        payload: unknown,
        options: { id?: string; replyTo?: string; error?: Envelope['error'] } = {},
    ): Envelope {
        const envelope: Envelope = {
            v: PROTOCOL_VERSION,
            id: options.id ?? crypto.randomUUID(),
            kind,
            type,
            payload,
            timestamp: new Date().toISOString(),
        };
        if (options.replyTo !== undefined) envelope.replyTo = options.replyTo;
        if (options.error !== undefined) envelope.error = options.error;
        return envelope;
    }
}
