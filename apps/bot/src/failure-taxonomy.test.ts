import { describe, expect, it } from 'bun:test';

import { FailureTaxonomy } from './failure-taxonomy.js';

describe('FailureTaxonomy', () => {
    it('maps skill failures to task retry classes', () => {
        expect(FailureTaxonomy.taskClassForSkill('invalid-input')).toBe('invalid');
        expect(FailureTaxonomy.taskClassForSkill('unsupported')).toBe('invalid');
        expect(FailureTaxonomy.taskClassForSkill('missing-item')).toBe('precondition');
        expect(FailureTaxonomy.taskClassForSkill('missing-tool')).toBe('precondition');
        expect(FailureTaxonomy.taskClassForSkill('no-path')).toBe('blocked');
        expect(FailureTaxonomy.taskClassForSkill('target-missing')).toBe('blocked');
        expect(FailureTaxonomy.taskClassForSkill('unsafe')).toBe('fatal');
        expect(FailureTaxonomy.taskClassForSkill('timeout')).toBe('transient');
        expect(FailureTaxonomy.taskClassForSkill('preempted')).toBe('transient');
        expect(FailureTaxonomy.taskClassForSkill('cancelled')).toBe('transient');
        expect(FailureTaxonomy.taskClassForSkill('execution-failed')).toBe('transient');
        expect(FailureTaxonomy.taskClassForSkill('unknown')).toBe('transient');
    });
});
