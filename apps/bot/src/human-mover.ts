import {
    type GazeController,
    type HumanizationPolicy,
    type SprintContext,
} from '@ticrafter/brains';

const SCAN_SWEEP_RADIANS = 0.9;
const SCAN_STEP_RADIANS = 0.3;
const SCAN_INTERVAL_MILLISECONDS = 50;

export interface TravelContext extends SprintContext {
    urgent: boolean;
}

export interface HumanMoverOptions {
    policy: HumanizationPolicy;
    gaze: GazeController;
    sleep: (milliseconds: number) => Promise<void>;
    now: () => number;
}

export class HumanMover {
    constructor(private readonly options: HumanMoverOptions) {}

    sprintAllowed(context: TravelContext): boolean {
        return this.options.policy.sprintAllowed(context);
    }

    async beforeTravel(context: TravelContext): Promise<void> {
        if (context.urgent) return;
        await this.options.sleep(this.options.policy.reactionLatency());
    }

    async afterTravel(context: TravelContext): Promise<void> {
        if (context.urgent) return;
        if (this.options.policy.shouldPause()) {
            await this.options.sleep(this.options.policy.pauseDuration());
        }
        if (this.options.policy.shouldScan()) {
            await this.scan();
        }
    }

    private async scan(): Promise<void> {
        const start = this.options.gaze.angles;
        const targetYaw = start.yaw + SCAN_SWEEP_RADIANS;
        for (let index = 0; index < 4; index += 1) {
            const rotation = this.options.gaze.rotateTo(
                { yaw: targetYaw, pitch: start.pitch },
                this.options.now(),
            );
            await this.options.sleep(SCAN_INTERVAL_MILLISECONDS);
            if (rotation.aligned) break;
        }
        for (let index = 0; index < 4; index += 1) {
            const rotation = this.options.gaze.rotateTo(
                { yaw: start.yaw, pitch: start.pitch },
                this.options.now(),
            );
            await this.options.sleep(SCAN_INTERVAL_MILLISECONDS);
            if (rotation.aligned) break;
        }
    }
}
