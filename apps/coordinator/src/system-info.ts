import operatingSystem from 'node:os';

import type { SystemInfo } from '@ticrafter/core';

export class NodeSystemInfo implements SystemInfo {
    readonly platform = process.platform;
    readonly arch = process.arch;
    readonly cpuModel: string;
    readonly cpuCount: number;
    readonly totalMemoryBytes: number;
    readonly freeMemoryBytes: number;

    constructor() {
        const processors = operatingSystem.cpus();
        this.cpuModel = processors[0]?.model ?? 'unknown';
        this.cpuCount = processors.length;
        this.totalMemoryBytes = operatingSystem.totalmem();
        this.freeMemoryBytes = operatingSystem.freemem();
    }
}
