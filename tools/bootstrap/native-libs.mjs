import fileSystem from 'node:fs';
import path from 'node:path';

import { ensureDirectory, exists, log, readManifest, root, runCapture, warn } from './lib.mjs';

export const NATIVE_LIBRARIES = ['libstdc++.so.6', 'libgcc_s.so.1'];

const globMatches = (pattern) => {
    try {
        return fileSystem.globSync(pattern);
    } catch {
        return [];
    }
};

export function findSharedLibrary(library) {
    const compiler = process.env.CXX || 'g++';
    const found = runCapture(compiler, ['-print-file-name', library]);
    if (found.ok && path.isAbsolute(found.stdout) && exists(found.stdout)) return found.stdout;

    const version = runCapture(compiler, ['-dumpversion']).stdout;
    const majorVersion = version.split('.')[0];
    const patterns = [];
    if (version) patterns.push(`/nix/store/*gcc-${version}-lib/lib/${library}`);
    if (majorVersion) patterns.push(`/nix/store/*gcc-${majorVersion}.*-lib/lib/${library}`);
    patterns.push(`/nix/store/*gcc-*-lib/lib/${library}`);
    for (const pattern of patterns) {
        const matches = globMatches(pattern);
        if (matches.length) return matches.sort().at(-1);
    }

    for (const directory of [
        '/usr/lib/x86_64-linux-gnu',
        '/usr/lib64',
        '/usr/lib',
        '/lib64',
        '/lib',
    ]) {
        const candidate = path.join(directory, library);
        if (exists(candidate)) return candidate;
    }
    return null;
}

export function nativeLibrariesDirectory(manifest = readManifest()) {
    return path.join(root, manifest.bun.nativeLibs);
}

export function nativeLibrariesStatus(manifest = readManifest()) {
    if (process.platform !== 'linux') {
        return { ready: true, reason: 'not required on this platform' };
    }
    const directory = nativeLibrariesDirectory(manifest);
    const missing = NATIVE_LIBRARIES.filter((library) => !exists(path.join(directory, library)));
    if (missing.length) {
        return {
            ready: false,
            reason: `missing ${missing.join(', ')} in ${path.relative(root, directory)}`,
        };
    }
    return { ready: true, reason: 'ready' };
}

export function provisionNativeLibraries({ check = false, manifest = readManifest() } = {}) {
    if (process.platform !== 'linux') {
        log('native libs: not required on this platform');
        return true;
    }

    const status = nativeLibrariesStatus(manifest);
    if (status.ready) {
        log(`native libs: ${status.reason}`);
        return true;
    }
    if (check) {
        warn(`native libs: ${status.reason}`);
        return false;
    }

    const directory = nativeLibrariesDirectory(manifest);
    ensureDirectory(directory);
    for (const library of NATIVE_LIBRARIES) {
        const targetLibraryPath = path.join(directory, library);
        if (exists(targetLibraryPath)) continue;
        const sourceLibraryPath = findSharedLibrary(library);
        if (!sourceLibraryPath) {
            warn(`native libs: could not locate ${library}; set CXX or install a compiler`);
            continue;
        }
        fileSystem.copyFileSync(sourceLibraryPath, targetLibraryPath);
        log(`native libs: copied ${library} from ${sourceLibraryPath}`);
    }

    return nativeLibrariesStatus(manifest).ready;
}
