export interface GazePosition {
    x: number;
    y: number;
    z: number;
}

export interface GazeAngles {
    yaw: number;
    pitch: number;
}

export interface GazeStep extends GazeAngles {
    yawDelta: number;
    pitchDelta: number;
    aligned: boolean;
}

export interface GazeControllerOptions {
    yawRateRadiansPerSecond?: number;
    pitchRateRadiansPerSecond?: number;
    updateHz?: number;
    toleranceRadians?: number;
}

const DEFAULT_YAW_RATE = 3.5;
const DEFAULT_PITCH_RATE = 2.5;
const DEFAULT_UPDATE_HZ = 10;
const DEFAULT_TOLERANCE = 0.05;
const FULL_CIRCLE = Math.PI * 2;

export class GazeController {
    private yaw: number;
    private pitch: number;
    private updatedAt: number | null = null;

    constructor(
        initial: GazeAngles,
        private readonly options: GazeControllerOptions = {},
    ) {
        this.yaw = initial.yaw;
        this.pitch = initial.pitch;
    }

    get angles(): GazeAngles {
        return { yaw: this.yaw, pitch: this.pitch };
    }

    static desiredAngles(from: GazePosition, target: GazePosition): GazeAngles {
        const deltaX = target.x - from.x;
        const deltaY = target.y - from.y;
        const deltaZ = target.z - from.z;
        const horizontal = Math.hypot(deltaX, deltaZ);
        return {
            yaw: Math.atan2(-deltaX, deltaZ),
            pitch: -Math.atan2(deltaY, horizontal),
        };
    }

    rotateTowards(from: GazePosition, target: GazePosition, now: number): GazeStep {
        return this.rotateTo(GazeController.desiredAngles(from, target), now);
    }

    rotateTo(target: GazeAngles, now: number): GazeStep {
        const elapsed = this.elapsedSeconds(now);
        const yawDelta = GazeController.clampDelta(
            GazeController.normalize(target.yaw - this.yaw),
            (this.options.yawRateRadiansPerSecond ?? DEFAULT_YAW_RATE) * elapsed,
        );
        const pitchDelta = GazeController.clampDelta(
            target.pitch - this.pitch,
            (this.options.pitchRateRadiansPerSecond ?? DEFAULT_PITCH_RATE) * elapsed,
        );
        this.yaw = GazeController.normalize(this.yaw + yawDelta);
        this.pitch = GazeController.clampPitch(this.pitch + pitchDelta);
        this.updatedAt = now;
        const tolerance = this.options.toleranceRadians ?? DEFAULT_TOLERANCE;
        const aligned =
            Math.abs(GazeController.normalize(target.yaw - this.yaw)) <= tolerance &&
            Math.abs(target.pitch - this.pitch) <= tolerance;
        return { yaw: this.yaw, pitch: this.pitch, yawDelta, pitchDelta, aligned };
    }

    private elapsedSeconds(now: number): number {
        if (this.updatedAt === null) {
            return 1 / (this.options.updateHz ?? DEFAULT_UPDATE_HZ);
        }
        return Math.max(
            1 / (this.options.updateHz ?? DEFAULT_UPDATE_HZ),
            (now - this.updatedAt) / 1000,
        );
    }

    private static normalize(angle: number): number {
        return ((((angle + Math.PI) % FULL_CIRCLE) + FULL_CIRCLE) % FULL_CIRCLE) - Math.PI;
    }

    private static clampDelta(delta: number, maximum: number): number {
        return Math.max(-maximum, Math.min(maximum, delta));
    }

    private static clampPitch(pitch: number): number {
        return Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
    }
}
