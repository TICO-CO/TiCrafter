export interface SystemInfo {
    platform: string;
    arch: string;
    cpuModel: string;
    cpuCount: number;
    totalMemoryBytes: number;
    freeMemoryBytes: number;
}

export interface HardwareReport {
    platform: string;
    arch: string;
    cpuModel: string;
    cpuCount: number;
    totalMemoryGiB: number;
    freeMemoryGiB: number;
    webgpu: boolean;
}

export class HardwareProbe {
    constructor(private readonly system: SystemInfo) {}

    probe(): HardwareReport {
        return {
            platform: this.system.platform,
            arch: this.system.arch,
            cpuModel: this.system.cpuModel,
            cpuCount: this.system.cpuCount,
            totalMemoryGiB: HardwareProbe.toGiB(this.system.totalMemoryBytes),
            freeMemoryGiB: HardwareProbe.toGiB(this.system.freeMemoryBytes),
            webgpu: false,
        };
    }

    private static toGiB(bytes: number): number {
        return Math.round((bytes / 1024 ** 3) * 10) / 10;
    }
}
