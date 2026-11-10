import fileSystem from 'node:fs';
import path from 'node:path';

import { bunExecutable, bunStatus } from './bun-env.mjs';
import {
    diskInformation,
    exists,
    formatBytes,
    readManifest,
    readMarker,
    root,
    runCapture,
    warn,
} from './lib.mjs';
import { nativeLibrariesStatus } from './native-libs.mjs';

const required = [];
const optional = [];

const manifest = readManifest();
const bunProbe = runCapture(bunExecutable(manifest), ['--version']);
required.push({ name: 'bun', ok: bunProbe.ok, detail: bunProbe.stdout || 'missing' });

const lockfile = path.join(root, manifest.bun.lockfile);
required.push({ name: manifest.bun.lockfile, ok: exists(lockfile), detail: manifest.bun.lockfile });

const dependencyStatus = bunStatus(manifest);
required.push({
    name: 'node_modules',
    ok: dependencyStatus.ready,
    detail: dependencyStatus.ready ? dependencyStatus.reason : 'run bun run bootstrap',
});

const nativeLibraries = nativeLibrariesStatus(manifest);
optional.push({
    name: 'native libraries',
    ok: nativeLibraries.ready,
    detail: nativeLibraries.reason,
});

const pythonProbe = runCapture(process.env.PYTHON || 'python3', ['--version']);
optional.push({
    name: 'python3 (training)',
    ok: pythonProbe.ok,
    detail: pythonProbe.stdout || 'missing',
});

const firefoxProbe = runCapture('which', ['firefox']);
const firefoxReady = Boolean(process.env.FIREFOX) || firefoxProbe.ok;
optional.push({
    name: 'firefox (diagrams)',
    ok: firefoxReady,
    detail: process.env.FIREFOX || firefoxProbe.stdout || 'missing',
});

const disk = diskInformation(root);
optional.push({
    name: 'free disk',
    ok: disk.free > 5_000_000_000,
    detail: formatBytes(disk.free),
});

for (const [downloadName, downloadEntry] of Object.entries(manifest.downloads)) {
    const destination = path.join(root, downloadEntry.dest);
    const target = downloadEntry.bin ? path.join(destination, downloadEntry.bin) : destination;
    const expectedChecksum = downloadEntry.sha256 ?? downloadEntry.sha1;
    const marker = readMarker(path.join(root, downloadEntry.marker));
    const ready = exists(target) && marker === expectedChecksum;
    optional.push({
        name: downloadName,
        ok: ready,
        detail: ready ? downloadEntry.dest : `${downloadEntry.dest} (marker mismatch)`,
    });
}

const eulaPath = path.join(root, 'data/minecraft/eula.txt');
const eulaAccepted =
    exists(eulaPath) && /^\s*eula\s*=\s*true\s*$/im.test(fileSystem.readFileSync(eulaPath, 'utf8'));
optional.push({
    name: 'minecraft eula',
    ok: eulaAccepted,
    detail: eulaAccepted ? 'accepted' : 'not accepted',
});

const printCapability = (capability) =>
    console.log(`${capability.ok ? 'ok  ' : 'miss'} ${capability.name}: ${capability.detail}`);

console.log('required:');
for (const capability of required) printCapability(capability);
console.log('optional:');
for (const capability of optional) printCapability(capability);

if (required.some((capability) => !capability.ok)) {
    warn('required capabilities missing');
    process.exit(1);
}
