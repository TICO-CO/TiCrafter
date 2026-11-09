import fs from 'node:fs';
import path from 'node:path';
import {
    ensureDir,
    exists,
    log,
    readManifest,
    root,
    runCapture,
    warn,
} from './lib.mjs';

export const NATIVE_LIBRARIES = ['libstdc++.so.6', 'libgcc_s.so.1'];

export function findSharedLibrary(library) {
    const compiler = process.env.CXX || 'g++';
    const found = runCapture(compiler, ['-print-file-name', library]);
    if (found.ok && path.isAbsolute(found.stdout) && exists(found.stdout)) return found.stdout;

    const version = runCapture(compiler, ['-dumpversion']).stdout;
    const major = version.split('.')[0];
    const patterns = [];
    if (version) patterns.push(`/nix/store/*gcc-${version}-lib/lib/${library}`);
    if (major) patterns.push(`/nix/store/*gcc-${major}.*-lib/lib/${library}`);
    patterns.push(`/nix/store/*gcc-*-lib/lib/${library}`);
    for (const pattern of patterns) {
        try {
            const matches = fs.globSync(pattern);
            if (matches.length) return matches.sort().at(-1);
        } catch {
            continue;
        }
    }

    for (const dir of ['/usr/lib/x86_64-linux-gnu', '/usr/lib64', '/usr/lib', '/lib64', '/lib']) {
        const candidate = path.join(dir, library);
        if (exists(candidate)) return candidate;
    }
    return null;
}

export function nativeLibsDir(manifest = readManifest()) {
    return path.join(root, manifest.bun.nativeLibs);
}

export function nativeLibsStatus(manifest = readManifest()) {
    if (process.platform !== 'linux') {
        return { ready: true, reason: 'not required on this platform' };
    }
    const dir = nativeLibsDir(manifest);
    const missing = NATIVE_LIBRARIES.filter((library) => !exists(path.join(dir, library)));
    if (missing.length) {
        return {
            ready: false,
            reason: `missing ${missing.join(', ')} in ${path.relative(root, dir)}`,
        };
    }
    return { ready: true, reason: 'ready' };
}

export function provisionNativeLibs({ check = false, manifest = readManifest() } = {}) {
    if (process.platform !== 'linux') {
        log('native libs: not required on this platform');
        return true;
    }

    const status = nativeLibsStatus(manifest);
    if (status.ready) {
        log(`native libs: ${status.reason}`);
        return true;
    }
    if (check) {
        warn(`native libs: ${status.reason}`);
        return false;
    }

    const dir = nativeLibsDir(manifest);
    ensureDir(dir);
    for (const library of NATIVE_LIBRARIES) {
        const target = path.join(dir, library);
        if (exists(target)) continue;
        const source = findSharedLibrary(library);
        if (!source) {
            warn(`native libs: could not locate ${library}; set CXX or install a compiler`);
            continue;
        }
        fs.copyFileSync(source, target);
        log(`native libs: copied ${library} from ${source}`);
    }

    return nativeLibsStatus(manifest).ready;
}
