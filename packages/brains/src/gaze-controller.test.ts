import { describe, expect, it } from 'bun:test';

import { GazeController } from './gaze-controller.js';

describe('gaze controller', () => {
    it('turns toward a target without exceeding the yaw rate', () => {
        const gaze = new GazeController({ yaw: 0, pitch: 0 }, { updateHz: 10 });
        const step = gaze.rotateTowards({ x: 0, y: 64, z: 0 }, { x: 4, y: 64, z: 0 }, 100);
        expect(Math.abs(step.yawDelta) <= 0.36).toBe(true);
        expect(step.aligned).toBe(false);
    });

    it('reaches the target over repeated updates', () => {
        const gaze = new GazeController({ yaw: 0, pitch: 0 }, { updateHz: 10 });
        let step = gaze.rotateTo({ yaw: 0.2, pitch: 0.1 }, 0);
        for (let tick = 1; tick <= 40; tick += 1) {
            step = gaze.rotateTo({ yaw: 0.2, pitch: 0.1 }, tick * 100);
        }
        expect(step.aligned).toBe(true);
        expect(Math.abs(step.yaw - 0.2) < 0.1).toBe(true);
        expect(Math.abs(step.pitch - 0.1) < 0.1).toBe(true);
    });

    it('uses minecraft yaw conventions', () => {
        const east = GazeController.desiredAngles({ x: 0, y: 64, z: 0 }, { x: 4, y: 64, z: 0 });
        const west = GazeController.desiredAngles({ x: 0, y: 64, z: 0 }, { x: -4, y: 64, z: 0 });
        expect(Math.abs(east.yaw + Math.PI / 2) < 0.001).toBe(true);
        expect(Math.abs(west.yaw - Math.PI / 2) < 0.001).toBe(true);
    });
});
