import type { Result } from '@ticrafter/core';

import type { SkillCheckpoint, SkillContext } from './types.js';
import { SkillSharedUtilities } from './utilities.js';

const MAX_RESTORE_DISTANCE = 64;

export class RestoreValidator {
    validate(checkpoint: SkillCheckpoint, context: SkillContext): Result<boolean, string> {
        if (checkpoint.botId !== context.botId) {
            return [null, 'checkpoint belongs to another bot'];
        }
        const target = SkillSharedUtilities.readVec3(checkpoint.state.target);
        if (target === null) return [true, null];
        const distance = SkillSharedUtilities.distance(context.position, target);
        return [distance <= MAX_RESTORE_DISTANCE, null];
    }
}
