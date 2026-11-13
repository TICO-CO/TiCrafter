import type { GazeController, HumanizationPolicy } from '@ticrafter/brains';
import {
    type ActionDispatchPort,
    type ActionOutcome,
    type ActionRequest,
    type ClockHandle,
    type ClockPort,
    type Result,
    type Vec3,
} from '@ticrafter/core';

import type { BehaviorTracePort } from './behavior-trace.js';

export interface BehavioralDispatchOptions {
    inner: ActionDispatchPort;
    clock: ClockPort;
    policy: HumanizationPolicy;
    trace: BehaviorTracePort;
    gaze?: GazeController;
    position: () => Vec3;
    urgent: () => boolean;
}

interface PendingDispatch {
    request: ActionRequest;
    innerHandle: string | null;
    outcome: ActionOutcome | null;
    timer: ClockHandle | null;
}

export class BehavioralDispatch implements ActionDispatchPort {
    private sequence = 0;
    private lastLookAt: number | null = null;
    private readonly pending = new Map<string, PendingDispatch>();

    constructor(private readonly options: BehavioralDispatchOptions) {}

    dispatch(request: ActionRequest): Result<string, string> {
        const handle = `behavior.${this.sequence}`;
        this.sequence += 1;
        const record: PendingDispatch = {
            request,
            innerHandle: null,
            outcome: null,
            timer: null,
        };
        this.pending.set(handle, record);
        if (this.options.urgent()) {
            this.start(handle);
            return [handle, null];
        }
        const target = BehavioralDispatch.target(request);
        const distance =
            target === null
                ? 0
                : Math.hypot(
                      target.x - this.options.position().x,
                      target.y - this.options.position().y,
                      target.z - this.options.position().z,
                  );
        const traveling = request.kind === 'move-to' || request.kind === 'follow-path';
        const reaction = this.options.policy.reactionLatency();
        const pause =
            traveling && this.options.policy.shouldPause()
                ? this.options.policy.pauseDuration()
                : 0;
        if (pause > 0) {
            this.options.trace.record('pause', 'travel', {
                durationMilliseconds: pause,
                target,
            });
        }
        record.timer = this.options.clock.setTimeout(() => {
            record.timer = null;
            if (target !== null) this.look(target);
            this.options.trace.record(traveling ? 'movement' : 'action', request.kind, {
                target,
                distance,
                delayMilliseconds: reaction,
                pauseMilliseconds: pause,
                sprintAllowed: traveling
                    ? this.options.policy.sprintAllowed({
                          distance,
                          indoor: false,
                          nearHazard: false,
                          surface: 'open',
                      })
                    : false,
            });
            this.start(handle);
        }, reaction + pause);
        return [handle, null];
    }

    poll(handleId: string): Result<ActionOutcome | null, string> {
        const record = this.pending.get(handleId);
        if (record === undefined) return [null, `unknown action handle ${handleId}`];
        if (record.outcome !== null) {
            const outcome = record.outcome;
            this.pending.delete(handleId);
            return [outcome, null];
        }
        if (record.innerHandle === null) return [null, null];
        const [outcome, pollError] = this.options.inner.poll(record.innerHandle);
        if (pollError !== null) return [null, pollError];
        if (outcome === null) return [null, null];
        record.outcome = outcome;
        this.options.trace.record('action', record.request.kind, {
            target: BehavioralDispatch.target(record.request),
            status: outcome.status,
            failure: outcome.failure?.class ?? outcome.failure?.message ?? null,
        });
        this.pending.delete(handleId);
        return [outcome, null];
    }

    cancel(handleId: string): Result<void, string> {
        const record = this.pending.get(handleId);
        if (record === undefined) return [null, `unknown action handle ${handleId}`];
        if (record.timer !== null) this.options.clock.clearTimeout(record.timer);
        if (record.innerHandle !== null) this.options.inner.cancel(record.innerHandle);
        this.pending.delete(handleId);
        return [undefined, null];
    }

    private start(handle: string): void {
        const record = this.pending.get(handle);
        if (record === undefined || record.innerHandle !== null) return;
        const [innerHandle, error] = this.options.inner.dispatch(record.request);
        if (error !== null) {
            record.outcome = {
                request: record.request,
                status: 'failed',
                message: error,
                failure: { class: 'execution-failed', message: error },
            };
            return;
        }
        record.innerHandle = innerHandle;
    }

    private look(target: Vec3): void {
        const gaze = this.options.gaze;
        if (gaze === undefined) return;
        const origin = this.options.position();
        const dx = target.x - origin.x;
        const dy = target.y - origin.y;
        const dz = target.z - origin.z;
        const yaw = Math.atan2(-dx, dz);
        const pitch = Math.atan2(dy, Math.hypot(dx, dz));
        const now = this.options.clock.now();
        const elapsedMilliseconds =
            this.lastLookAt === null ? 100 : Math.max(100, now - this.lastLookAt);
        this.lastLookAt = now;
        const rotation = gaze.rotateTo({ yaw, pitch }, now);
        this.options.trace.record('gaze', 'interaction', {
            target,
            yawDelta: rotation.yawDelta,
            pitchDelta: rotation.pitchDelta,
            elapsedMilliseconds,
            aligned: rotation.aligned,
        });
    }

    private static target(request: ActionRequest): Vec3 | null {
        if ('position' in request) return request.position;
        if (request.kind === 'follow-path') return request.waypoints.at(-1) ?? null;
        return null;
    }
}
