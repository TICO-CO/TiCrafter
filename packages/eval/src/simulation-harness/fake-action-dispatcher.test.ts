import type { Vec3 } from '@ticrafter/core';
import { describe, expect, it } from 'bun:test';

import { FakeActionDispatcher } from './fake-action-dispatcher.js';
import { FakeContainers } from './fake-containers.js';
import { FakeInventory } from './fake-inventory.js';
import { FakeWorld } from './fake-world.js';
import { SimulationClock } from './simulation-clock.js';

function dispatcher(latencyMilliseconds: number): {
    clock: SimulationClock;
    dispatcher: FakeActionDispatcher;
} {
    const clock = new SimulationClock(1_000);
    const position: Vec3 = { x: 0, y: 61, z: 0 };
    return {
        clock,
        dispatcher: new FakeActionDispatcher({
            clock,
            world: new FakeWorld({
                seed: 1,
                kind: 'flat',
                min: { x: -2, y: 55, z: -2 },
                max: { x: 2, y: 70, z: 2 },
                groundY: 59,
            }),
            inventory: new FakeInventory(),
            containers: new FakeContainers(),
            position: () => position,
            latencyMilliseconds,
        }),
    };
}

describe('FakeActionDispatcher latency', () => {
    it('holds actions pending until the simulated latency elapses', () => {
        const { clock, dispatcher: actions } = dispatcher(20_000);
        const [handle, dispatchError] = actions.dispatch({
            kind: 'wait',
            milliseconds: 0,
        });
        expect(dispatchError).toBeNull();
        expect(handle).not.toBeNull();
        if (handle === null) return;

        expect(actions.poll(handle)[0]).toBeNull();
        clock.advanceBy(19_999);
        expect(actions.poll(handle)[0]).toBeNull();
        clock.advanceBy(1);
        expect(actions.poll(handle)?.[0]?.status).toBe('completed');
    });

    it('applies updated latency to subsequent actions', () => {
        const { clock, dispatcher: actions } = dispatcher(0);
        actions.setLatencyMilliseconds(5_000);
        const [handle] = actions.dispatch({ kind: 'wait', milliseconds: 0 });
        if (handle === null) return;

        expect(actions.poll(handle)[0]).toBeNull();
        clock.advanceBy(5_000);
        expect(actions.poll(handle)?.[0]?.status).toBe('completed');
    });
});
