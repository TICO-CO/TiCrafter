import os from 'node:os';

export interface HardwareReport {
    platform: NodeJS.Platform;
    arch: string;
    cpuModel: string;
    cpuCount: number;
    totalMemoryGiB: number;
    freeMemoryGiB: number;
    webgpu: boolean;
}

export class HardwareProbe {
    probe(): HardwareReport {
        const cpus = os.cpus();
        return {
            platform: process.platform,
            arch: process.arch,
            cpuModel: cpus[0]?.model ?? 'unknown',
            cpuCount: cpus.length,
            totalMemoryGiB: HardwareProbe.toGiB(os.totalmem()),
            freeMemoryGiB: HardwareProbe.toGiB(os.freemem()),
            webgpu: false,
        };
    }

    private static toGiB(bytes: number): number {
        return Math.round((bytes / 1024 ** 3) * 10) / 10;
    }
}
