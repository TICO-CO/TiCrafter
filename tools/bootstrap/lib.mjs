import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fileSystem from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';

export const root = path.resolve(import.meta.dirname, '..', '..');
export const manifestPath = path.join(root, 'tools/bootstrap/manifest.json');

export const log = (message) => console.log(`[bootstrap] ${message}`);
export const warn = (message) => console.warn(`[bootstrap] warn: ${message}`);

export class BootstrapError extends Error {}

export function fail(message) {
    throw new BootstrapError(message);
}

export function readJsonFile(file) {
    return JSON.parse(fileSystem.readFileSync(file, 'utf8'));
}

export function readManifest() {
    return readJsonFile(manifestPath);
}

export function ensureDirectory(directory) {
    fileSystem.mkdirSync(directory, { recursive: true });
}

export function exists(file) {
    return fileSystem.existsSync(file);
}

export function hashFile(file, algorithm = 'sha256') {
    const hash = crypto.createHash(algorithm);
    hash.update(fileSystem.readFileSync(file));
    return hash.digest('hex');
}

export function hashText(text, algorithm = 'sha256') {
    return crypto.createHash(algorithm).update(text).digest('hex');
}

export function readMarker(file) {
    try {
        return fileSystem.readFileSync(file, 'utf8').trim();
    } catch {
        return null;
    }
}

export function writeMarker(file, value) {
    ensureDirectory(path.dirname(file));
    fileSystem.writeFileSync(file, `${value}\n`);
}

export function run(command, argumentsList = [], options = {}) {
    log(`run: ${command} ${argumentsList.join(' ')}`);
    const result = spawnSync(command, argumentsList, {
        cwd: root,
        stdio: 'inherit',
        ...options,
    });
    if (result.error) {
        fail(`failed to start ${command}: ${result.error.message}`);
    }
    if (result.status !== 0) {
        fail(`${command} exited with status ${result.status}`);
    }
    return result;
}

export function runCapture(command, argumentsList = [], options = {}) {
    const result = spawnSync(command, argumentsList, {
        cwd: root,
        encoding: 'utf8',
        ...options,
    });
    return {
        ok: !result.error && result.status === 0,
        status: result.status,
        stdout: (result.stdout ?? '').trim(),
        stderr: (result.stderr ?? '').trim(),
        error: result.error,
    };
}

export function commandExists(command) {
    return runCapture(command, ['--version']).ok;
}

export function currentPlatform() {
    return `${process.platform}-${process.arch}`;
}

export async function downloadTo(url, destination) {
    ensureDirectory(path.dirname(destination));
    const temporaryPath = `${destination}.part`;

    if (commandExists('curl')) {
        const result = spawnSync(
            'curl',
            [
                '-fsSL',
                '--retry',
                '3',
                '--retry-delay',
                '2',
                '--connect-timeout',
                '20',
                '-o',
                temporaryPath,
                url,
            ],
            { stdio: 'inherit' },
        );
        if (!result.error && result.status === 0 && fileSystem.existsSync(temporaryPath)) {
            fileSystem.renameSync(temporaryPath, destination);
            return;
        }
        fileSystem.rmSync(temporaryPath, { force: true });
    }

    let response;
    try {
        response = await fetch(url, { redirect: 'follow' });
    } catch (error) {
        fail(`download failed: ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!response.ok) fail(`download failed ${response.status} ${response.statusText}: ${url}`);
    if (!response.body) fail(`download returned no body: ${url}`);
    await pipeline(Readable.fromWeb(response.body), fileSystem.createWriteStream(temporaryPath));
    fileSystem.renameSync(temporaryPath, destination);
}

export function verifyHash(file, expected, algorithm, label) {
    if (!expected) return;
    const actual = hashFile(file, algorithm);
    if (actual !== expected) {
        fail(`${label}: ${algorithm} mismatch (expected ${expected}, got ${actual})`);
    }
}

function flattenSingleDirectory(directory) {
    const directoryEntries = fileSystem.readdirSync(directory);
    if (directoryEntries.length !== 1) return;
    const singleDirectory = path.join(directory, directoryEntries[0]);
    if (!fileSystem.statSync(singleDirectory).isDirectory()) return;
    for (const childEntry of fileSystem.readdirSync(singleDirectory)) {
        fileSystem.renameSync(
            path.join(singleDirectory, childEntry),
            path.join(directory, childEntry),
        );
    }
    fileSystem.rmdirSync(singleDirectory);
}

export function extractArchive(archive, destination, stripComponents = 0) {
    ensureDirectory(destination);
    if (archive.endsWith('.tar.gz') || archive.endsWith('.tgz')) {
        const argumentsList = ['-xzf', archive, '-C', destination];
        if (stripComponents > 0) argumentsList.push(`--strip-components=${stripComponents}`);
        run('tar', argumentsList);
        return;
    }
    if (archive.endsWith('.zip')) {
        run('unzip', ['-q', '-o', archive, '-d', destination]);
        for (let index = 0; index < stripComponents; index += 1)
            flattenSingleDirectory(destination);
        return;
    }
    fail(`unsupported archive: ${archive}`);
}

export function isMain(moduleUrl) {
    if (!process.argv[1]) return false;
    return moduleUrl === pathToFileURL(process.argv[1]).href;
}

export function localBinaryPath(name) {
    return path.join(
        root,
        'node_modules',
        '.bin',
        process.platform === 'win32' ? `${name}.cmd` : name,
    );
}

export function formatBytes(bytes) {
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function diskInformation(directory = root) {
    const stats = fileSystem.statfsSync(directory);
    return {
        free: Number(stats.bavail) * Number(stats.bsize),
        total: Number(stats.blocks) * Number(stats.bsize),
    };
}

export function lowPriority(command, argumentsList) {
    if (process.platform !== 'linux') return { command, argumentsList };
    if (commandExists('nice') && commandExists('ionice')) {
        return {
            command: 'nice',
            argumentsList: ['-n', '10', 'ionice', '-c2', '-n7', command, ...argumentsList],
        };
    }
    if (commandExists('nice')) {
        return { command: 'nice', argumentsList: ['-n', '10', command, ...argumentsList] };
    }
    return { command, argumentsList };
}
