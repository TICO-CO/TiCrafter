export class EmergencyStopController {
    private reason: string | null = null;

    trigger(reason: string): void {
        if (this.reason === null) this.reason = reason;
    }

    clear(): void {
        this.reason = null;
    }

    resume(): void {
        this.clear();
    }

    get stopped(): boolean {
        return this.reason !== null;
    }

    get stopReason(): string | null {
        return this.reason;
    }
}
