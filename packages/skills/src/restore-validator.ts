import type { Result } from '@ticrafter/core';

import type { SkillCheckpoint, SkillContext } from './types.js';
import { SkillSharedUtilities } from './utilities.js';

const MAX_RESTORE_DISTANCE = 64;
const MAX_CHECKPOINT_AGE_MILLISECONDS = 30 * 60 * 1000;

export class RestoreValidator {
    validate(checkpoint: SkillCheckpoint, context: SkillContext): Result<boolean, string> {
        if (checkpoint.botId !== context.botId) {
            return [null, 'checkpoint belongs to another bot'];
        }
        if (checkpoint.taskId !== (context.taskId ?? 'default')) {
            return [null, 'checkpoint belongs to another task'];
        }
        const updatedAt = Date.parse(checkpoint.updatedAt);
        const currentTime = Date.parse(context.at);
        if (Number.isNaN(updatedAt) || Number.isNaN(currentTime)) {
            return [null, 'checkpoint or context timestamp is invalid'];
        }
        if (currentTime - updatedAt > MAX_CHECKPOINT_AGE_MILLISECONDS) {
            return [null, 'checkpoint is stale'];
        }
        const target = SkillSharedUtilities.readVec3(checkpoint.state.target);
        if (target === null) return [true, null];
        const distance = SkillSharedUtilities.distance(context.position, target);
        return [distance <= MAX_RESTORE_DISTANCE, null];
    }
}
