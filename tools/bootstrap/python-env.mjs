import path from 'node:path';
import {
  ensureDir,
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
import fs from 'node:fs';

const pythonCommand = () => process.env.PYTHON || 'python3';

const pipPath = (venvDir) =>
  process.platform === 'win32' ? path.join(venvDir, 'Scripts', 'pip.exe') : path.join(venvDir, 'bin', 'pip');

const venvPythonPath = (venvDir) =>
  process.platform === 'win32'
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python');

export function pythonVariant() {
  if (process.env.PYTORCH_VARIANT) return process.env.PYTORCH_VARIANT;
  return process.env.HARDWARE_PROFILE === 'home-full' ? 'rocm' : 'cpu';
}

export function pythonRequirements(manifest = readManifest()) {
  const variant = pythonVariant();
  const config = manifest.python;
  const relative = config.requirements[variant];
  if (!relative) {
    throw new Error(
      `unknown PyTorch variant ${variant}; expected one of ${Object.keys(config.requirements).join(', ')}`,
    );
  }
  return { variant, relative, absolute: path.join(root, relative) };
}

function torchLibDir(venvDir) {
  const libRoot = path.join(venvDir, 'lib');
  let entries = [];
  try {
    entries = fs.readdirSync(libRoot);
  } catch {
    return null;
  }
  const pythonDir = entries.find((entry) => entry.startsWith('python'));
  if (!pythonDir) return null;
  return path.join(libRoot, pythonDir, 'site-packages/torch/lib');
}

function findSharedLibrary(library) {
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
      // pattern unsupported on this Node version; continue
    }
  }

  for (const dir of ['/usr/lib/x86_64-linux-gnu', '/usr/lib64', '/usr/lib', '/lib64', '/lib']) {
    const candidate = path.join(dir, library);
    if (exists(candidate)) return candidate;
  }
  return null;
}

function ensureTorchNativeLibs(venvDir) {
  if (process.platform !== 'linux') return;
  const python = venvPythonPath(venvDir);
  const probe = runCapture(python, ['-c', 'import torch']);
  if (probe.ok) return;

  const libDir = torchLibDir(venvDir);
  if (!libDir || !exists(libDir)) return;

  for (const library of ['libstdc++.so.6', 'libgcc_s.so.1']) {
    const hostLibrary = findSharedLibrary(library);
    if (!hostLibrary) continue;
    const target = path.join(libDir, library);
    fs.copyFileSync(hostLibrary, target);
    log(`python env: copied ${library} into torch/lib`);
  }

  const retry = runCapture(python, ['-c', 'import torch']);
  if (!retry.ok) {
    warn(`python env: torch import failed: ${retry.stderr || retry.stdout || 'unknown error'}`);
  }
}

function requirementsFingerprint(requirementsPath) {
  const parts = [fs.readFileSync(requirementsPath, 'utf8')];
  const base = path.join(root, 'tools/laya-train/requirements.txt');
  if (exists(base) && path.resolve(base) !== path.resolve(requirementsPath)) {
    parts.push(fs.readFileSync(base, 'utf8'));
  }
  return hashText(parts.join('\n'), 'sha256');
}

export function pythonStatus(manifest = readManifest()) {
  const config = manifest.python;
  const requirements = pythonRequirements(manifest);
  const venvDir = path.join(root, config.venv);
  const markerPath = path.join(root, config.marker);

  if (!exists(requirements.absolute)) {
    return { ready: false, reason: `missing requirements file ${requirements.relative}` };
  }
  if (!exists(venvPythonPath(venvDir))) {
    return { ready: false, reason: `missing virtualenv ${config.venv}` };
  }

  const expected = requirementsFingerprint(requirements.absolute);
  const actual = readMarker(markerPath);
  if (expected !== actual) {
    return { ready: false, reason: 'requirements changed since last install' };
  }

  return { ready: true, reason: `ready (${requirements.variant})` };
}

export function provisionPython({ check = false, manifest = readManifest() } = {}) {
  const config = manifest.python;
  const requirements = pythonRequirements(manifest);
  const venvDir = path.join(root, config.venv);
  const markerPath = path.join(root, config.marker);

  if (!exists(requirements.absolute)) {
    warn(`python requirements not found at ${requirements.relative}; skipping`);
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

  const python = pythonCommand();
  const probe = runCapture(python, ['--version']);
  if (!probe.ok) {
    warn(`python env: ${python} not available; install Python or set PYTHON to a local interpreter`);
    return false;
  }

  ensureDir(path.join(root, config.cache));
  const env = {
    ...process.env,
    PIP_CACHE_DIR: path.join(root, config.cache),
    PIP_DISABLE_PIP_VERSION_CHECK: '1',
  };

  if (!exists(venvPythonPath(venvDir))) {
    log(`python env: creating ${config.venv}`);
    run(python, ['-m', 'venv', venvDir], { env });
  }

  log(`python env: installing ${requirements.relative}`);
  run(pipPath(venvDir), ['install', '--no-input', '-r', requirements.absolute], { env });
  ensureTorchNativeLibs(venvDir);
  writeMarker(markerPath, requirementsFingerprint(requirements.absolute));
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
