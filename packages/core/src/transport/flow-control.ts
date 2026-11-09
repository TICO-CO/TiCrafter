export interface FlowControlLimits {
    maxInFlight: number;
    maxQueueDepth: number;
}

export class FlowController {
    private inFlight = 0;
    private queued = 0;

    constructor(private readonly limits: FlowControlLimits) {}

    tryAcquire(): boolean {
        if (this.inFlight >= this.limits.maxInFlight) return false;
        this.inFlight += 1;
        return true;
    }

    release(): void {
        if (this.inFlight > 0) this.inFlight -= 1;
    }

    enqueue(): boolean {
        if (this.queued >= this.limits.maxQueueDepth) return false;
        this.queued += 1;
        return true;
    }

    dequeue(): void {
        if (this.queued > 0) this.queued -= 1;
    }

    snapshot(): { inFlight: number; queued: number } {
        return { inFlight: this.inFlight, queued: this.queued };
    }
}
