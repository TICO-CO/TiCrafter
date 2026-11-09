import path from 'node:path';
import fs from 'node:fs';
import { diskInfo, exists, formatBytes, hashFile, hashText, readJson, readManifest, readMarker, root, runCapture, warn } from './lib.mjs';

const required = [];
const optional = [];

const pkg = readJson(path.join(root, 'package.json'));
const range = pkg.engines?.node ?? '';
const major = Number.parseInt(process.versions.node.split('.')[0], 10);
const min = Number.parseInt(/>=?\s*(\d+)/.exec(range)?.[1] ?? '0', 10);
const max = Number.parseInt(/<\s*(\d+)/.exec(range)?.[1] ?? '999', 10);
required.push({
  name: `node ${range}`,
  ok: major >= min && major < max,
  detail: process.versions.node,
});

const npm = runCapture('npm', ['--version']);
required.push({ name: 'npm', ok: npm.ok, detail: npm.stdout || 'missing' });

const manifest = readManifest();
const lockfile = path.join(root, manifest.npm.lockfile);
required.push({ name: manifest.npm.lockfile, ok: exists(lockfile), detail: manifest.npm.lockfile });

let npmReady = false;
if (exists(lockfile) && exists(path.join(root, 'node_modules'))) {
  const expected = hashText(
    `${hashFile(lockfile, 'sha256')}:${hashFile(path.join(root, 'package.json'), 'sha256')}`,
    'sha256',
  );
  npmReady = readMarker(path.join(root, manifest.npm.marker)) === expected;
}
required.push({ name: 'node_modules', ok: npmReady, detail: npmReady ? 'ready' : 'run npm run bootstrap' });

const pythonProbe = runCapture(process.env.PYTHON || 'python3', ['--version']);
optional.push({ name: 'python3 (training)', ok: pythonProbe.ok, detail: pythonProbe.stdout || 'missing' });

const firefoxProbe = runCapture('which', ['firefox']);
const firefoxReady = Boolean(process.env.FIREFOX) || firefoxProbe.ok;
optional.push({
  name: 'firefox (diagrams)',
  ok: firefoxReady,
  detail: process.env.FIREFOX || firefoxProbe.stdout || 'missing',
});

const { free } = diskInfo(root);
optional.push({ name: 'free disk', ok: free > 5_000_000_000, detail: formatBytes(free) });

for (const [name, entry] of Object.entries(manifest.downloads)) {
  const dest = path.join(root, entry.dest);
  const target = entry.bin ? path.join(dest, entry.bin) : dest;
  const expected = entry.sha256 ?? entry.sha1;
  const ready = exists(target) && readMarker(path.join(root, entry.marker)) === expected;
  optional.push({ name, ok: ready, detail: entry.dest });
}

const eula = path.join(root, 'data/minecraft/eula.txt');
const eulaAccepted = exists(eula) && /^\s*eula\s*=\s*true\s*$/im.test(fs.readFileSync(eula, 'utf8'));
optional.push({ name: 'minecraft eula', ok: eulaAccepted, detail: eulaAccepted ? 'accepted' : 'not accepted' });

const print = (item) => console.log(`${item.ok ? 'ok  ' : 'miss'} ${item.name}: ${item.detail}`);

console.log('required:');
for (const item of required) print(item);
console.log('optional:');
for (const item of optional) print(item);

if (required.some((item) => !item.ok)) {
  warn('required capabilities missing');
  process.exit(1);
}
