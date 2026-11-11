import { describe, expect, it } from 'bun:test';

import { ArchitectureGuard } from './index.js';

describe('architecture guard tests', () => {
    it('validates the canonical architecture graph', () => {
        const result = ArchitectureGuard.atRepositoryRoot().validate();
        expect(result.ok).toBe(true);
        expect(result.stderr).toBe('');
    });
});
