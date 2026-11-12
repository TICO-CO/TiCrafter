import { z as zod } from 'zod';

export const BOT_SAFETY_RESUME = 'bot.safety.resume';
export const BOT_SAFETY_STOP = 'bot.safety.stop';

export const botSafetyResumeSchema = zod.object({
    reason: zod.string().min(1).optional(),
});

export const botSafetyStopSchema = zod.object({
    reason: zod.string().min(1),
});

export type BotSafetyResumeMessage = zod.infer<typeof botSafetyResumeSchema>;
export type BotSafetyStopMessage = zod.infer<typeof botSafetyStopSchema>;
