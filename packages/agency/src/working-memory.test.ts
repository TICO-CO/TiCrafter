import { describe, expect, it } from 'bun:test';

import {
    MAXIMUM_COMMITMENTS,
    MAXIMUM_RECENT_EXPERIENCES,
    WorkingMemoryModel,
} from './working-memory.js';

const at = '2026-11-12T10:00:00.000Z';

describe('working memory', () => {
    it('creates empty memory and restores missing memory as empty', () => {
        const created = WorkingMemoryModel.create();
        expect(created.revision).toBe(0);
        expect(created.focus).toBeNull();
        expect(created.commitments).toEqual([]);
        const [restored, restoreError] = WorkingMemoryModel.restore(undefined);
        expect(restoreError).toBeNull();
        expect(restored?.snapshot).toEqual(created.snapshot);
    });

    it('increments the revision on focus and interruption changes', () => {
        const focused = WorkingMemoryModel.create().withFocus({
            kind: 'project',
            id: 'project-1',
            label: 'Home of TiBot1',
            startedAt: at,
        });
        expect(focused.revision).toBe(1);
        expect(focused.focus?.kind).toBe('project');
        const interrupted = focused.withInterruption({
            reason: 'hunger',
            resumeCondition: 'hunger above threshold',
            interruptedFocusId: 'project-1',
            at,
        });
        expect(interrupted.revision).toBe(2);
        expect(interrupted.interruption?.reason).toBe('hunger');
        const resumed = interrupted.withoutInterruption();
        expect(resumed.revision).toBe(3);
        expect(resumed.interruption).toBeNull();
    });

    it('bounds commitments and recent experiences', () => {
        let memory = WorkingMemoryModel.create();
        for (let index = 0; index < MAXIMUM_COMMITMENTS; index += 1) {
            const [next, error] = memory.withCommitment({
                id: `commitment-${index}`,
                description: 'finish current work',
                priority: 1,
                createdAt: at,
                expiresAt: null,
            });
            expect(error).toBeNull();
            if (next === null) return;
            memory = next;
        }
        const [overflow, overflowError] = memory.withCommitment({
            id: 'commitment-overflow',
            description: 'too many commitments',
            priority: 1,
            createdAt: at,
            expiresAt: null,
        });
        expect(overflow).toBeNull();
        expect(overflowError).not.toBeNull();

        let experiences = WorkingMemoryModel.create();
        for (let index = 0; index < MAXIMUM_RECENT_EXPERIENCES + 2; index += 1) {
            experiences = experiences.withExperience({
                event: `event-${index}`,
                outcome: 'ok',
                at,
            });
        }
        expect(experiences.recentExperiences).toHaveLength(MAXIMUM_RECENT_EXPERIENCES);
        expect(experiences.recentExperiences[0]?.event).toBe('event-2');
    });

    it('rejects malformed persisted memory', () => {
        const [restored, restoreError] = WorkingMemoryModel.restore({
            revision: 1,
            focus: null,
            commitments: [],
            interruption: null,
            recentExperiences: Array.from({ length: MAXIMUM_RECENT_EXPERIENCES + 1 }, () => ({
                event: 'event',
                outcome: 'ok',
                at,
            })),
            lastTacticalDecision: null,
        });
        expect(restored).toBeNull();
        expect(restoreError).not.toBeNull();
    });
});
