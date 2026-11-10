import type { Result } from '../kernel/index.js';
import type { ConfigFailure } from './failures.js';

export class NamePoolValidator {
    static validate(names: string[], botCount: number): Result<void, ConfigFailure> {
        if (names.length < botCount) {
            return [
                null,
                {
                    type: 'NAME_POOL',
                    message: `botNames has ${names.length} entries but botCount is ${botCount}`,
                },
            ];
        }
        if (new Set(names).size !== names.length) {
            return [null, { type: 'NAME_POOL', message: 'botNames must be unique' }];
        }
        return [undefined, null];
    }

    static nameFor(names: string[], index: number): Result<string, ConfigFailure> {
        const name = names[index];
        if (!name) return [null, { type: 'NAME_POOL', message: `no bot name for index ${index}` }];
        return [name, null];
    }
}
