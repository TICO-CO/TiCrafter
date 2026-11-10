import fileSystem from 'node:fs';
import path from 'node:path';

import { bunStatus, provisionBun } from './bun-env.mjs';
import {
    currentPlatform,
    diskInformation,
    downloadTo,
    ensureDirectory,
    exists,
    extractArchive,
    fail,
    formatBytes,
    hashFile,
    log,
    readManifest,
    readMarker,
    root,
    runCapture,
    warn,
    writeMarker,
} from './lib.mjs';
import { provisionNativeLibraries } from './native-libs.mjs';
import { provisionPython, pythonStatus, pythonVariant } from './python-env.mjs';

const cliArguments = new Set(process.argv.slice(2));
const check = cliArguments.has('--check');
const clean = cliArguments.has('--clean');
const withBun = !cliArguments.has('--no-bun');
const withPython = !cliArguments.has('--no-python');
const withServer = !cliArguments.has('--no-server');
const withBrowser = !cliArguments.has('--no-browser');

const estimates = {
    bun: 2_000_000_000,
    python: 3_000_000_000,
    java17: 260_000_000,
    'minecraft-server-1.20.1': 60_000_000,
};

function firefoxPath() {
    if (process.env.FIREFOX) return process.env.FIREFOX;
    const probe = runCapture('which', ['firefox']);
    if (probe.ok) return probe.stdout;
    return null;
}

function downloadStatus(downloadEntry) {
    const destination = path.join(root, downloadEntry.dest);
    const target = downloadEntry.bin ? path.join(destination, downloadEntry.bin) : destination;
    if (!exists(target)) return { ready: false, reason: `missing ${downloadEntry.dest}` };
    const marker = readMarker(path.join(root, downloadEntry.marker));
    const expected = downloadEntry.sha256 ?? downloadEntry.sha1;
    if (marker !== expected) return { ready: false, reason: 'marker mismatch' };
    return { ready: true, reason: 'ready' };
}

async function provisionDownload(downloadName, downloadEntry) {
    if (
        downloadEntry.platform &&
        downloadEntry.platform !== 'any' &&
        downloadEntry.platform !== currentPlatform()
    ) {
        warn(
            `${downloadName}: skipped on ${currentPlatform()} (requires ${downloadEntry.platform})`,
        );
        return;
    }

    const status = downloadStatus(downloadEntry);
    if (status.ready) {
        log(`${downloadName}: ${status.reason}`);
        return;
    }
    if (check) {
        warn(`${downloadName}: ${status.reason}`);
        return;
    }

    const algorithm = downloadEntry.sha256 ? 'sha256' : 'sha1';
    const expected = downloadEntry[algorithm];
    if (!expected) fail(`${downloadName}: manifest has no checksum`);

    const downloadsDirectory = path.join(root, '.cache/downloads');
    ensureDirectory(downloadsDirectory);
    const archive = path.join(
        downloadsDirectory,
        path.basename(new URL(downloadEntry.url).pathname),
    );
    log(
        `${downloadName}: downloading ${formatBytes(estimates[downloadName] ?? 0)} from ${downloadEntry.url}`,
    );
    await downloadTo(downloadEntry.url, archive);
    const actual = hashFile(archive, algorithm);
    if (actual !== expected) {
        fail(`${downloadName}: ${algorithm} mismatch (expected ${expected}, got ${actual})`);
    }

    if (downloadEntry.kind === 'file') {
        const destination = path.join(root, downloadEntry.dest);
        ensureDirectory(path.dirname(destination));
        fileSystem.copyFileSync(archive, destination);
    } else if (downloadEntry.kind === 'archive') {
        const destination = path.join(root, downloadEntry.dest);
        const temporaryDirectory = path.join(root, '.cache/extract', downloadName);
        fileSystem.rmSync(temporaryDirectory, { recursive: true, force: true });
        ensureDirectory(temporaryDirectory);
        extractArchive(archive, temporaryDirectory, downloadEntry.stripComponents ?? 0);
        fileSystem.rmSync(destination, { recursive: true, force: true });
        ensureDirectory(path.dirname(destination));
        fileSystem.renameSync(temporaryDirectory, destination);
    } else {
        fail(`${downloadName}: unknown kind ${downloadEntry.kind}`);
    }

    writeMarker(path.join(root, downloadEntry.marker), expected);
    fileSystem.rmSync(archive, { force: true });
}

function pendingSize(manifest) {
    let bytes = 0;
    const phases = [];

    if (withBun && !bunStatus(manifest).ready) {
        bytes += estimates.bun;
        phases.push(`bun ${formatBytes(estimates.bun)}`);
    }
    if (withPython && !pythonStatus(manifest).ready) {
        bytes += estimates.python;
        phases.push(`python ${formatBytes(estimates.python)}`);
    }
    for (const [downloadName, downloadEntry] of Object.entries(manifest.downloads)) {
        if (!withBun && downloadName === 'bun-runtime') continue;
        if (
            !withServer &&
            (downloadName.startsWith('minecraft-server') || downloadName.startsWith('java'))
        ) {
            continue;
        }
        if (!downloadStatus(downloadEntry).ready) {
            bytes += estimates[downloadName] ?? 0;
            phases.push(`${downloadName} ${formatBytes(estimates[downloadName] ?? 0)}`);
        }
    }

    return { bytes, phases };
}

function guardDisk(manifest) {
    const disk = diskInformation(root);
    const freeBytes = disk.free;
    const { bytes, phases } = pendingSize(manifest);
    const neededBytes = bytes + 1_500_000_000;
    const summary = phases.length ? phases.join(', ') : 'nothing';

    log(
        `disk: ${formatBytes(freeBytes)} free; pending: ${summary}; reserve: ${formatBytes(1_500_000_000)}`,
    );

    if (check) return;
    if (freeBytes < neededBytes) {
        fail(
            `not enough free disk: need about ${formatBytes(neededBytes)}, have ${formatBytes(freeBytes)}. ` +
                'Free space or re-run with --no-python/--no-server.',
        );
    }
    if (freeBytes < neededBytes + 2_000_000_000) {
        warn(`disk is tight: ${formatBytes(freeBytes)} free, ${formatBytes(neededBytes)} needed`);
    }
}

async function main() {
    const manifest = readManifest();
    guardDisk(manifest);

    if (withBun) {
        provisionBun({ check, clean, manifest });
    }
    provisionNativeLibraries({ check, manifest });

    if (withPython) {
        provisionPython({ check, manifest });
    }

    for (const [downloadName, downloadEntry] of Object.entries(manifest.downloads)) {
        if (!withBun && downloadName === 'bun-runtime') continue;
        if (
            !withServer &&
            (downloadName.startsWith('minecraft-server') || downloadName.startsWith('java'))
        ) {
            continue;
        }
        await provisionDownload(downloadName, downloadEntry);
    }

    if (withBrowser) {
        const firefox = firefoxPath();
        if (firefox) log(`browser: firefox ${firefox} (no Chromium download)`);
        else
            warn(
                'browser: firefox not found; local SVG rendering disabled, fenced Mermaid still works',
            );
    }

    log(check ? 'check complete' : 'bootstrap complete');
    if (!check) log(`python variant: ${pythonVariant()}`);
    if (!check) log('next: bun run validate:graph');
}

try {
    await main();
} catch (error) {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
}
