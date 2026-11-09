import path from 'node:path';
import {
    ensureDir,
    exists,
    fail,
    hashFile,
    hashText,
    log,
    lowPriority,
    readManifest,
    readMarker,
    root,
    run,
    runCapture,
    warn,
    writeMarker,
} from './lib.mjs';

export function bunExecutable(manifest = readManifest()) {
    const local = path.join(root, manifest.bun.toolchain, manifest.downloads['bun-runtime'].bin);
    if (exists(local)) return local;
    return process.env.BUN || 'bun';
}

export function bunAvailable(manifest = readManifest()) {
    return runCapture(bunExecutable(manifest), ['--version']).ok;
}

export function bunMarker(manifest) {
    const lockfile = path.join(root, manifest.bun.lockfile);
    return hashText(
        `${hashFile(lockfile, 'sha256')}:${hashFile(path.join(root, 'package.json'), 'sha256')}`,
        'sha256',
    );
}

export function bunStatus(manifest = readManifest()) {
    const lockfile = path.join(root, manifest.bun.lockfile);
    if (!exists(lockfile)) return { ready: false, reason: `missing ${manifest.bun.lockfile}` };
    if (!exists(path.join(root, 'node_modules'))) {
        return { ready: false, reason: 'missing node_modules' };
    }

    const probe = runCapture(bunExecutable(manifest), ['--version']);
    if (!probe.ok) return { ready: false, reason: 'bun is not available' };

    const expected = bunMarker(manifest);
    const actual = readMarker(path.join(root, manifest.bun.marker));
    if (expected !== actual) return { ready: false, reason: 'lockfile changed since last install' };
    return { ready: true, reason: `ready (bun ${probe.stdout})` };
}

export function provisionBun({ check = false, clean = false, manifest = readManifest() } = {}) {
    const executable = bunExecutable(manifest);
    const probe = runCapture(executable, ['--version']);
    if (!probe.ok) {
        const message =
            `bun is required but not available (looked for ${executable}); ` +
            'install Bun 1.4.2 or place it in .toolchain/bun';
        if (check) {
            warn(message);
            return false;
        }
        fail(message);
    }
    log(`bun ${probe.stdout}`);

    const status = bunStatus(manifest);
    if (status.ready) {
        log(`bun deps: ${status.reason}`);
        return true;
    }
    if (check) {
        warn(`bun deps: ${status.reason}`);
        return false;
    }

    const lockfile = path.join(root, manifest.bun.lockfile);
    if (!exists(lockfile)) fail(`missing ${manifest.bun.lockfile}; run bun install`);

    const cache = path.join(root, manifest.bun.cache);
    ensureDir(cache);

    const hasNodeModules = exists(path.join(root, 'node_modules'));
    const command = clean || !hasNodeModules ? ['install', '--frozen-lockfile'] : ['install'];
    const invocation = lowPriority(executable, command);

    log(`bun deps: ${status.reason}; running ${invocation.command} ${invocation.args.join(' ')}`);
    run(invocation.command, invocation.args, {
        env: {
            ...process.env,
            BUN_INSTALL_CACHE_DIR: cache,
        },
    });

    writeMarker(path.join(root, manifest.bun.marker), bunMarker(manifest));
    return true;
}
