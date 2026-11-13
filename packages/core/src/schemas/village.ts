import { z as zod } from 'zod';

import { boundingBoxSchema } from './shared.js';

export const BOT_PLOT_OWNERSHIP_REQUEST = 'bot.plot-ownership.request';
export const BOT_PLOT_OWNERSHIP_RESPONSE = 'bot.plot-ownership.response';
export const BOT_PLAYER_SIGHTING_EVENT = 'bot.player-sighting';
export const BOT_PERMISSION_OUTCOME_EVENT = 'bot.permission-outcome';

export const playerConfidenceSchema = zod.object({
    playerId: zod.string().min(1),
    username: zod.string().min(1),
    score: zod.number().min(0).max(1),
    linkedBaseIds: zod.array(zod.string()),
    lastInteractionAt: zod.string().nullable(),
});

export const plotOwnershipSchema = zod.discriminatedUnion('kind', [
    zod.object({ kind: zod.literal('self'), ownerId: zod.string().min(1) }),
    zod.object({ kind: zod.literal('other'), ownerId: zod.string().min(1) }),
    zod.object({
        kind: zod.literal('ambiguous'),
        ownerIds: zod.array(zod.string()),
        nearbyBaseId: zod.string().nullable(),
    }),
    zod.object({
        kind: zod.literal('unknown'),
        nearbyBaseId: zod.string().nullable(),
        linkedPlayers: zod.array(playerConfidenceSchema),
    }),
]);

export const botPlotOwnershipRequestSchema = zod.object({
    botId: zod.string().min(1),
    plotId: zod.string().min(1),
    bbox: boundingBoxSchema,
});

export const botPlayerSightingSchema = zod.object({
    botId: zod.string().min(1),
    playerId: zod.string().min(1),
    username: zod.string().min(1),
    position: zod.object({ x: zod.number(), y: zod.number(), z: zod.number() }),
    at: zod.string().min(1),
});

export const botPermissionOutcomeSchema = zod.object({
    botId: zod.string().min(1),
    playerId: zod.string().min(1),
    plotId: zod.string().min(1),
    kept: zod.boolean(),
    at: zod.string().min(1),
});

export const botPlotOwnershipResponseSchema = zod.object({
    ok: zod.boolean(),
    plotId: zod.string().min(1),
    ownership: plotOwnershipSchema.nullable(),
    reason: zod.string().nullable(),
});

export type BotPlotOwnershipRequest = zod.infer<typeof botPlotOwnershipRequestSchema>;
export type BotPlotOwnershipResponse = zod.infer<typeof botPlotOwnershipResponseSchema>;
export type BotPlayerSighting = zod.infer<typeof botPlayerSightingSchema>;
export type BotPermissionOutcome = zod.infer<typeof botPermissionOutcomeSchema>;
export type PlayerConfidencePayload = zod.infer<typeof playerConfidenceSchema>;
export type PlotOwnershipPayload = zod.infer<typeof plotOwnershipSchema>;
