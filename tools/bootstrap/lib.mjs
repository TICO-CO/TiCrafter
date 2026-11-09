import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
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

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function readManifest() {
  return readJson(manifestPath);
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function exists(file) {
  return fs.existsSync(file);
}

export function hashFile(file, algorithm = 'sha256') {
  const hash = crypto.createHash(algorithm);
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

export function hashText(text, algorithm = 'sha256') {
  return crypto.createHash(algorithm).update(text).digest('hex');
}

export function readMarker(file) {
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    return null;
  }
}

export function writeMarker(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${value}\n`);
}

export function run(command, args = [], options = {}) {
  log(`run: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
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

export function runCapture(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
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
  ensureDir(path.dirname(destination));
  const temp = `${destination}.part`;

  if (commandExists('curl')) {
    const result = spawnSync(
      'curl',
      ['-fsSL', '--retry', '3', '--retry-delay', '2', '--connect-timeout', '20', '-o', temp, url],
      { stdio: 'inherit' },
    );
    if (!result.error && result.status === 0 && fs.existsSync(temp)) {
      fs.renameSync(temp, destination);
      return;
    }
    fs.rmSync(temp, { force: true });
  }

  let response;
  try {
    response = await fetch(url, { redirect: 'follow' });
  } catch (error) {
    fail(`download failed: ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) fail(`download failed ${response.status} ${response.statusText}: ${url}`);
  if (!response.body) fail(`download returned no body: ${url}`);
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(temp));
  fs.renameSync(temp, destination);
}

export function verifyHash(file, expected, algorithm, label) {
  if (!expected) return;
  const actual = hashFile(file, algorithm);
  if (actual !== expected) {
    fail(`${label}: ${algorithm} mismatch (expected ${expected}, got ${actual})`);
  }
}

function flattenSingleDirectory(directory) {
  const entries = fs.readdirSync(directory);
  if (entries.length !== 1) return;
  const only = path.join(directory, entries[0]);
  if (!fs.statSync(only).isDirectory()) return;
  for (const child of fs.readdirSync(only)) {
    fs.renameSync(path.join(only, child), path.join(directory, child));
  }
  fs.rmdirSync(only);
}

export function extractArchive(archive, destination, stripComponents = 0) {
  ensureDir(destination);
  if (archive.endsWith('.tar.gz') || archive.endsWith('.tgz')) {
    const args = ['-xzf', archive, '-C', destination];
    if (stripComponents > 0) args.push(`--strip-components=${stripComponents}`);
    run('tar', args);
    return;
  }
  if (archive.endsWith('.zip')) {
    run('unzip', ['-q', '-o', archive, '-d', destination]);
    for (let index = 0; index < stripComponents; index += 1) flattenSingleDirectory(destination);
    return;
  }
  fail(`unsupported archive: ${archive}`);
}

export function isMain(moduleUrl) {
  if (!process.argv[1]) return false;
  return moduleUrl === pathToFileURL(process.argv[1]).href;
}

export function localBin(name) {
  return path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name);
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

export function diskInfo(dir = root) {
  const stats = fs.statfsSync(dir);
  return {
    free: Number(stats.bavail) * Number(stats.bsize),
    total: Number(stats.blocks) * Number(stats.bsize),
  };
}

export function lowPriority(command, args) {
  if (process.platform !== 'linux') return { command, args };
  if (commandExists('nice') && commandExists('ionice')) {
    return { command: 'nice', args: ['-n', '10', 'ionice', '-c2', '-n7', command, ...args] };
  }
  if (commandExists('nice')) {
    return { command: 'nice', args: ['-n', '10', command, ...args] };
  }
  return { command, args };
}
