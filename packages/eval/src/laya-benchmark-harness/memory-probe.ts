import fileSystem from 'node:fs';

import { attempt } from '@ticrafter/core';

import type { MemoryProbePort, MemorySnapshot } from './types.js';

interface VramUsage {
    usedBytes: number;
    totalBytes: number;
}

export class SysfsVramReader {
    constructor(private readonly drmDirectory = '/sys/class/drm') {}

    read(): VramUsage | null {
        const [entries, entriesError] = attempt(() => fileSystem.readdirSync(this.drmDirectory));
        if (entriesError) return null;
        if (entries === null) return null;

        const usages = entries
            .filter((entry) => /^card\d+$/.test(entry))
            .map((entry) => this.readCard(entry))
            .filter((usage): usage is VramUsage => usage !== null);
        if (usages.length === 0) return null;

        return usages.reduce((largest, usage) =>
            usage.totalBytes > largest.totalBytes ? usage : largest,
        );
    }

    private readCard(entry: string): VramUsage | null {
        const deviceDirectory = `${this.drmDirectory}/${entry}/device`;
        const usedBytes = this.readNumber(`${deviceDirectory}/mem_info_vram_used`);
        if (usedBytes === null) return null;
        const totalBytes = this.readNumber(`${deviceDirectory}/mem_info_vram_total`);
        if (totalBytes === null) return null;
        return { usedBytes, totalBytes };
    }

    private readNumber(path: string): number | null {
        const [text, readError] = attempt(() => fileSystem.readFileSync(path, 'utf8'));
        if (readError) return null;
        if (text === null) return null;
        const value = Number(text.trim());
        return Number.isFinite(value) ? value : null;
    }
}

export class ProcessMemoryProbe implements MemoryProbePort {
    constructor(private readonly vramReader = new SysfsVramReader()) {}

    snapshot(): MemorySnapshot {
        const vram = this.vramReader.read();
        return {
            rssBytes: process.memoryUsage().rss,
            vramUsedBytes: vram?.usedBytes ?? null,
            vramTotalBytes: vram?.totalBytes ?? null,
        };
    }
}
