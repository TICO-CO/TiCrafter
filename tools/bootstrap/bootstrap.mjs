import fs from 'node:fs';
import path from 'node:path';
import {
  currentPlatform,
  diskInfo,
  downloadTo,
  ensureDir,
  exists,
  extractArchive,
  fail,
  formatBytes,
  hashFile,
  hashText,
  log,
  lowPriority,
  readJson,
  readManifest,
  readMarker,
  root,
  run,
  runCapture,
  warn,
  writeMarker,
} from './lib.mjs';
import { provisionPython, pythonStatus, pythonVariant } from './python-env.mjs';

const args = new Set(process.argv.slice(2));
const check = args.has('--check');
const clean = args.has('--clean');
const withPython = !args.has('--no-python');
const withServer = !args.has('--no-server');
const withBrowser = !args.has('--no-browser');

const estimates = {
  npm: 2_000_000_000,
  python: 3_000_000_000,
  java17: 260_000_000,
  'minecraft-server-1.20.1': 60_000_000,
};

function assertNodeVersion() {
  const pkg = readJson(path.join(root, 'package.json'));
  const range = pkg.engines?.node ?? '';
  const major = Number.parseInt(process.versions.node.split('.')[0], 10);
  const min = Number.parseInt(/>=?\s*(\d+)/.exec(range)?.[1] ?? '0', 10);
  const max = Number.parseInt(/<\s*(\d+)/.exec(range)?.[1] ?? '999', 10);
  if (major < min || major >= max) {
    fail(`Node ${process.versions.node} does not satisfy ${range}`);
  }
  log(`node ${process.versions.node} satisfies ${range}`);
}

function assertNpm() {
  const probe = runCapture('npm', ['--version']);
  if (!probe.ok) fail('npm is required but not available on PATH');
  log(`npm ${probe.stdout}`);
}

function npmStatus(manifest) {
  const lockfile = path.join(root, manifest.npm.lockfile);
  if (!exists(lockfile)) return { ready: false, reason: `missing ${manifest.npm.lockfile}` };
  if (!exists(path.join(root, 'node_modules'))) return { ready: false, reason: 'missing node_modules' };
  const expected = npmMarker(manifest);
  const actual = readMarker(path.join(root, manifest.npm.marker));
  if (expected !== actual) return { ready: false, reason: 'lockfile changed since last install' };
  return { ready: true, reason: 'ready' };
}

function npmMarker(manifest) {
  const lockfile = path.join(root, manifest.npm.lockfile);
  return hashText(
    `${hashFile(lockfile, 'sha256')}:${hashFile(path.join(root, 'package.json'), 'sha256')}`,
    'sha256',
  );
}

function provisionNpm(manifest) {
  const status = npmStatus(manifest);
  if (status.ready) {
    log(`npm deps: ${status.reason}`);
    return;
  }
  if (check) {
    warn(`npm deps: ${status.reason}`);
    return;
  }

  const lockfile = path.join(root, manifest.npm.lockfile);
  if (!exists(lockfile)) fail(`missing ${manifest.npm.lockfile}; run npm install --package-lock-only`);

  const cache = path.join(root, manifest.npm.cache);
  ensureDir(cache);

  const hasNodeModules = exists(path.join(root, 'node_modules'));
  const useCi = clean || !hasNodeModules;
  const command = useCi ? ['ci'] : ['install', '--prefer-offline'];
  const invocation = lowPriority('npm', [...command, '--no-audit', '--no-fund', '--maxsockets=2']);

  log(`npm deps: ${status.reason}; running ${invocation.command} ${invocation.args.join(' ')}`);
  run(invocation.command, invocation.args, {
    env: {
      ...process.env,
      npm_config_cache: cache,
      npm_config_update_notifier: 'false',
      PUPPETEER_SKIP_DOWNLOAD: '1',
      PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: '1',
    },
  });

  writeMarker(path.join(root, manifest.npm.marker), npmMarker(manifest));
}

function firefoxPath() {
  if (process.env.FIREFOX) return process.env.FIREFOX;
  const probe = runCapture('which', ['firefox']);
  if (probe.ok) return probe.stdout;
  return null;
}

function downloadStatus(entry) {
  const dest = path.join(root, entry.dest);
  const target = entry.bin ? path.join(dest, entry.bin) : dest;
  if (!exists(target)) return { ready: false, reason: `missing ${entry.dest}` };
  const marker = readMarker(path.join(root, entry.marker));
  const expected = entry.sha256 ?? entry.sha1;
  if (marker !== expected) return { ready: false, reason: 'marker mismatch' };
  return { ready: true, reason: 'ready' };
}

async function provisionDownload(name, entry) {
  if (entry.platform && entry.platform !== 'any' && entry.platform !== currentPlatform()) {
    warn(`${name}: skipped on ${currentPlatform()} (requires ${entry.platform})`);
    return;
  }

  const status = downloadStatus(entry);
  if (status.ready) {
    log(`${name}: ${status.reason}`);
    return;
  }
  if (check) {
    warn(`${name}: ${status.reason}`);
    return;
  }

  const algorithm = entry.sha256 ? 'sha256' : 'sha1';
  const expected = entry[algorithm];
  if (!expected) fail(`${name}: manifest has no checksum`);

  const downloadsDir = path.join(root, '.cache/downloads');
  ensureDir(downloadsDir);
  const archive = path.join(downloadsDir, path.basename(new URL(entry.url).pathname));
  log(`${name}: downloading ${formatBytes(estimates[name] ?? 0)} from ${entry.url}`);
  await downloadTo(entry.url, archive);
  const actual = hashFile(archive, algorithm);
  if (actual !== expected) fail(`${name}: ${algorithm} mismatch (expected ${expected}, got ${actual})`);

  if (entry.kind === 'file') {
    const dest = path.join(root, entry.dest);
    ensureDir(path.dirname(dest));
    fs.copyFileSync(archive, dest);
  } else if (entry.kind === 'archive') {
    const dest = path.join(root, entry.dest);
    const temp = path.join(root, '.cache/extract', name);
    fs.rmSync(temp, { recursive: true, force: true });
    ensureDir(temp);
    extractArchive(archive, temp, entry.stripComponents ?? 0);
    fs.rmSync(dest, { recursive: true, force: true });
    ensureDir(path.dirname(dest));
    fs.renameSync(temp, dest);
  } else {
    fail(`${name}: unknown kind ${entry.kind}`);
  }

  writeMarker(path.join(root, entry.marker), expected);
  fs.rmSync(archive, { force: true });
}

function pendingSize(manifest) {
  let bytes = 0;
  const phases = [];

  if (!npmStatus(manifest).ready) {
    bytes += estimates.npm;
    phases.push(`npm ${formatBytes(estimates.npm)}`);
  }
  if (withPython && !pythonStatus(manifest).ready) {
    bytes += estimates.python;
    phases.push(`python ${formatBytes(estimates.python)}`);
  }
  for (const [name, entry] of Object.entries(manifest.downloads)) {
    if (!withServer && (name.startsWith('minecraft-server') || name.startsWith('java'))) continue;
    if (!downloadStatus(entry).ready) {
      bytes += estimates[name] ?? 0;
      phases.push(`${name} ${formatBytes(estimates[name] ?? 0)}`);
    }
  }

  return { bytes, phases };
}

function guardDisk(manifest) {
  const { free } = diskInfo(root);
  const { bytes, phases } = pendingSize(manifest);
  const needed = bytes + 1_500_000_000;
  const summary = phases.length ? phases.join(', ') : 'nothing';

  log(`disk: ${formatBytes(free)} free; pending: ${summary}; reserve: ${formatBytes(1_500_000_000)}`);

  if (check) return;
  if (free < needed) {
    fail(
      `not enough free disk: need about ${formatBytes(needed)}, have ${formatBytes(free)}. ` +
        'Free space or re-run with --no-python/--no-server.',
    );
  }
  if (free < needed + 2_000_000_000) {
    warn(`disk is tight: ${formatBytes(free)} free, ${formatBytes(needed)} needed`);
  }
}

async function main() {
  assertNodeVersion();
  assertNpm();

  const manifest = readManifest();
  guardDisk(manifest);

  provisionNpm(manifest);

  if (withPython) {
    provisionPython({ check, manifest });
  }

  for (const [name, entry] of Object.entries(manifest.downloads)) {
    if (!withServer && (name.startsWith('minecraft-server') || name.startsWith('java'))) continue;
    await provisionDownload(name, entry);
  }

  if (withBrowser) {
    const firefox = firefoxPath();
    if (firefox) log(`browser: firefox ${firefox} (no Chromium download)`);
    else warn('browser: firefox not found; local SVG rendering disabled, fenced Mermaid still works');
  }

  log(check ? 'check complete' : 'bootstrap complete');
  if (!check) log(`python variant: ${pythonVariant()}`);
  if (!check) log('next: npm run validate:graph');
}

try {
  await main();
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
