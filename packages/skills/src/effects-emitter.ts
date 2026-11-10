import type { ActionRequest, Result } from '@ticrafter/core';

const SUPPORTED_EFFECTS = new Set<ActionRequest['kind']>([
    'move-to',
    'follow-path',
    'break-block',
    'place-block',
    'use-block',
    'attack',
    'equip',
    'consume',
    'craft',
    'collect-drops',
    'transfer',
    'wait',
]);

export class EffectsEmitter {
    emit(action: ActionRequest): Result<ActionRequest, string> {
        if (!SUPPORTED_EFFECTS.has(action.kind)) {
            return [null, `unsupported effect ${action.kind}`];
        }
        return [action, null];
    }
}
