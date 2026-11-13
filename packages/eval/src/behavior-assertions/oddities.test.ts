import type { BehaviorTraceEntry } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { OddityDetectors } from './oddities.js';

function trace(
    kind: BehaviorTraceEntry['kind'],
    subject: string,
    detail: Readonly<Record<string, unknown>>,
): BehaviorTraceEntry {
    return { at: '2026-11-13T00:00:00.000Z', botId: 'bot.one', kind, subject, detail };
}

describe('oddity detectors', () => {
    it('flags an interaction without a prior look', () => {
        const findings = OddityDetectors.detect([
            trace('action', 'use-block', {
                status: 'completed',
                target: { x: 1, y: 64, z: 0 },
            }),
        ]);
        expect(findings.some((finding) => finding.id === 'zero-look-interact')).toBe(true);
    });

    it('accepts a completed interaction after a look', () => {
        const findings = OddityDetectors.detect([
            trace('gaze', 'interaction', { target: { x: 1, y: 64, z: 0 } }),
            trace('action', 'use-block', {
                status: 'completed',
                target: { x: 1, y: 64, z: 0 },
            }),
        ]);
        expect(findings.some((finding) => finding.id === 'zero-look-interact')).toBe(false);
    });

    it('flags fast turns and fast chat replies', () => {
        const findings = OddityDetectors.detect([
            trace('gaze', 'interaction', { yawDelta: 1.2, pitchDelta: 0 }),
            trace('chat', 'outgoing', { delayMilliseconds: 100 }),
        ]);
        expect(findings.some((finding) => finding.id === 'instant-turn')).toBe(true);
        expect(findings.some((finding) => finding.id === 'instant-chat')).toBe(true);
    });

    it('flags repeated identical actions', () => {
        const action = trace('action', 'break-block', {
            status: 'completed',
            target: { x: 1, y: 64, z: 0 },
        });
        const look = trace('gaze', 'interaction', { target: { x: 1, y: 64, z: 0 } });
        const findings = OddityDetectors.detect([look, action, action, action, action]);
        expect(findings.some((finding) => finding.id === 'same-target-retry')).toBe(true);
    });
});
