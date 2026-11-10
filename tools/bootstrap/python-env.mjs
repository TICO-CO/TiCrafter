import fileSystem from 'node:fs';
import path from 'node:path';

import {
    ensureDirectory,
    exists,
    hashText,
    isMain,
    log,
    readManifest,
    readMarker,
    root,
    run,
    runCapture,
    warn,
    writeMarker,
} from './lib.mjs';
import { findSharedLibrary, NATIVE_LIBRARIES } from './native-libs.mjs';

const pythonExecutable = () => process.env.PYTHON || 'python3';

const pipExecutablePath = (virtualEnvironmentDirectory) =>
    process.platform === 'win32'
        ? path.join(virtualEnvironmentDirectory, 'Scripts', 'pip.exe')
        : path.join(virtualEnvironmentDirectory, 'bin', 'pip');

const virtualEnvironmentPythonPath = (virtualEnvironmentDirectory) =>
    process.platform === 'win32'
        ? path.join(virtualEnvironmentDirectory, 'Scripts', 'python.exe')
        : path.join(virtualEnvironmentDirectory, 'bin', 'python');

export function pythonVariant() {
    if (process.env.PYTORCH_VARIANT) return process.env.PYTORCH_VARIANT;
    return process.env.HARDWARE_PROFILE === 'home-full' ? 'rocm' : 'cpu';
}

export function pythonRequirements(manifest = readManifest()) {
    const variant = pythonVariant();
    const pythonConfig = manifest.python;
    const relativePath = pythonConfig.requirements[variant];
    if (!relativePath) {
        throw new Error(
            `unknown PyTorch variant ${variant}; expected one of ${Object.keys(pythonConfig.requirements).join(', ')}`,
        );
    }
    return { variant, relativePath, absolutePath: path.join(root, relativePath) };
}

function torchLibraryDirectory(virtualEnvironmentDirectory) {
    const libraryRoot = path.join(virtualEnvironmentDirectory, 'lib');
    let directoryEntries = [];
    try {
        directoryEntries = fileSystem.readdirSync(libraryRoot);
    } catch {
        return null;
    }
    const pythonDirectory = directoryEntries.find((entry) => entry.startsWith('python'));
    if (!pythonDirectory) return null;
    return path.join(libraryRoot, pythonDirectory, 'site-packages/torch/lib');
}

function ensureTorchNativeLibraries(virtualEnvironmentDirectory) {
    if (process.platform !== 'linux') return;
    const python = virtualEnvironmentPythonPath(virtualEnvironmentDirectory);
    const torchProbe = runCapture(python, ['-c', 'import torch']);
    if (torchProbe.ok) return;

    const libraryDirectory = torchLibraryDirectory(virtualEnvironmentDirectory);
    if (!libraryDirectory || !exists(libraryDirectory)) return;

    for (const library of NATIVE_LIBRARIES) {
        const hostLibraryPath = findSharedLibrary(library);
        if (!hostLibraryPath) continue;
        const targetLibraryPath = path.join(libraryDirectory, library);
        fileSystem.copyFileSync(hostLibraryPath, targetLibraryPath);
        log(`python env: copied ${library} into torch/lib`);
    }

    const retryProbe = runCapture(python, ['-c', 'import torch']);
    if (!retryProbe.ok) {
        warn(
            `python env: torch import failed: ${retryProbe.stderr || retryProbe.stdout || 'unknown error'}`,
        );
    }
}

function requirementsFingerprint(requirementsPath) {
    const fingerprintParts = [fileSystem.readFileSync(requirementsPath, 'utf8')];
    const baseRequirementsPath = path.join(root, 'tools/laya-train/requirements.txt');
    if (
        exists(baseRequirementsPath) &&
        path.resolve(baseRequirementsPath) !== path.resolve(requirementsPath)
    ) {
        fingerprintParts.push(fileSystem.readFileSync(baseRequirementsPath, 'utf8'));
    }
    return hashText(fingerprintParts.join('\n'), 'sha256');
}

export function pythonStatus(manifest = readManifest()) {
    const pythonConfig = manifest.python;
    const requirements = pythonRequirements(manifest);
    const virtualEnvironmentDirectory = path.join(root, pythonConfig.venv);
    const markerPath = path.join(root, pythonConfig.marker);

    if (!exists(requirements.absolutePath)) {
        return {
            ready: false,
            reason: `missing requirements file ${requirements.relativePath}`,
        };
    }
    if (!exists(virtualEnvironmentPythonPath(virtualEnvironmentDirectory))) {
        return { ready: false, reason: `missing virtualenv ${pythonConfig.venv}` };
    }

    const expectedFingerprint = requirementsFingerprint(requirements.absolutePath);
    const actualFingerprint = readMarker(markerPath);
    if (expectedFingerprint !== actualFingerprint) {
        return { ready: false, reason: 'requirements changed since last install' };
    }

    return { ready: true, reason: `ready (${requirements.variant})` };
}

export function provisionPython({ check = false, manifest = readManifest() } = {}) {
    const pythonConfig = manifest.python;
    const requirements = pythonRequirements(manifest);
    const virtualEnvironmentDirectory = path.join(root, pythonConfig.venv);
    const markerPath = path.join(root, pythonConfig.marker);

    if (!exists(requirements.absolutePath)) {
        warn(`python requirements not found at ${requirements.relativePath}; skipping`);
        return false;
    }

    const status = pythonStatus(manifest);
    if (status.ready) {
        log(`python env: ${status.reason}`);
        return true;
    }

    if (check) {
        warn(`python env: ${status.reason}`);
        return false;
    }

    const python = pythonExecutable();
    const pythonProbe = runCapture(python, ['--version']);
    if (!pythonProbe.ok) {
        warn(
            `python env: ${python} not available; install Python or set PYTHON to a local interpreter`,
        );
        return false;
    }

    ensureDirectory(path.join(root, pythonConfig.cache));
    const environment = {
        ...process.env,
        PIP_CACHE_DIR: path.join(root, pythonConfig.cache),
        PIP_DISABLE_PIP_VERSION_CHECK: '1',
    };

    if (!exists(virtualEnvironmentPythonPath(virtualEnvironmentDirectory))) {
        log(`python env: creating ${pythonConfig.venv}`);
        run(python, ['-m', 'venv', virtualEnvironmentDirectory], { env: environment });
    }

    log(`python env: installing ${requirements.relativePath}`);
    run(
        pipExecutablePath(virtualEnvironmentDirectory),
        ['install', '--no-input', '-r', requirements.absolutePath],
        { env: environment },
    );
    ensureTorchNativeLibraries(virtualEnvironmentDirectory);
    writeMarker(markerPath, requirementsFingerprint(requirements.absolutePath));
    return true;
}

if (isMain(import.meta.url)) {
    const check = process.argv.includes('--check');
    try {
        const ready = provisionPython({ check });
        console.log(`python: ${ready ? 'ready' : 'not ready'} (${pythonVariant()})`);
    } catch (error) {
        console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}
