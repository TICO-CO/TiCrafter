import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ensureDir, exists, fail, isMain, readJson, readManifest, root, warn } from './lib.mjs';

const serverDir = path.join(root, 'data/minecraft');
const pidPath = path.join(serverDir, 'server.pid');
const logPath = path.join(serverDir, 'server.log');
const eulaPath = path.join(serverDir, 'eula.txt');
const propertiesPath = path.join(serverDir, 'server.properties');

const serverJar = (manifest) => path.join(root, manifest.downloads['minecraft-server-1.20.1'].dest);
const javaBin = (manifest) => path.join(root, manifest.downloads.java17.dest, manifest.downloads.java17.bin);

const isRunning = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const readPid = () => {
  try {
    return Number.parseInt(fs.readFileSync(pidPath, 'utf8').trim(), 10);
  } catch {
    return null;
  }
};

const writeDefaultProperties = () => {
  if (exists(propertiesPath)) return;
  const properties = [
    'online-mode=false',
    'server-port=25565',
    'server-ip=127.0.0.1',
    'motd=TiCrafter test server',
    'max-players=8',
    'view-distance=6',
    'simulation-distance=6',
    'spawn-protection=0',
    'difficulty=peaceful',
    'level-type=minecraft\\:flat',
    'generate-structures=false',
    'allow-nether=false',
    'enable-command-block=false',
  ];
  fs.writeFileSync(propertiesPath, `${properties.join('\n')}\n`);
};

const eulaAccepted = () => {
  try {
    return /^\s*eula\s*=\s*true\s*$/im.test(fs.readFileSync(eulaPath, 'utf8'));
  } catch {
    return false;
  }
};

export function serverStatus() {
  const pid = readPid();
  return {
    pid,
    running: pid !== null && isRunning(pid),
    logPath,
  };
}

export function startServer({ acceptEula = false } = {}) {
  const manifest = readManifest();
  const jar = serverJar(manifest);
  const java = javaBin(manifest);

  if (!exists(jar)) fail(`missing Minecraft server jar at ${jar}; run the bootstrap first`);
  if (!exists(java)) fail(`missing local Java runtime at ${java}; run the bootstrap first`);

  const status = serverStatus();
  if (status.running) {
    console.log(`server already running (pid ${status.pid})`);
    return;
  }

  ensureDir(serverDir);

  if (!eulaAccepted()) {
    if (!acceptEula) {
      fail(
        'Minecraft EULA not accepted. Read https://aka.ms/MinecraftEULA then re-run with --accept-eula to write data/minecraft/eula.txt.',
      );
    }
    fs.writeFileSync(eulaPath, 'eula=true\n');
    console.log('wrote data/minecraft/eula.txt after explicit --accept-eula');
  }

  writeDefaultProperties();

  const out = fs.openSync(logPath, 'a');
  const child = spawn(java, ['-Xms1G', '-Xmx2G', '-jar', jar, 'nogui'], {
    cwd: serverDir,
    detached: true,
    stdio: ['ignore', out, out],
  });
  child.unref();
  fs.writeFileSync(pidPath, `${child.pid}\n`);
  console.log(`started Minecraft 1.20.1 server (pid ${child.pid})`);
  console.log(`log: ${logPath}`);
}

export function stopServer() {
  const status = serverStatus();
  if (!status.running) {
    console.log('server is not running');
    if (status.pid !== null) fs.rmSync(pidPath, { force: true });
    return;
  }
  process.kill(status.pid, 'SIGTERM');
  fs.rmSync(pidPath, { force: true });
  console.log(`sent SIGTERM to Minecraft server (pid ${status.pid})`);
}

export function printStatus() {
  const status = serverStatus();
  console.log(status.running ? `running (pid ${status.pid})` : 'stopped');
  console.log(`log: ${status.logPath}`);
}

if (isMain(import.meta.url)) {
  const command = process.argv[2] ?? 'status';
  const acceptEula = process.argv.includes('--accept-eula');
  try {
    if (command === 'start') startServer({ acceptEula });
    else if (command === 'stop') stopServer();
    else if (command === 'status') printStatus();
    else {
      warn(`unknown command ${command}`);
      console.log('usage: node tools/bootstrap/minecraft-server.mjs <start|stop|status> [--accept-eula]');
      process.exit(1);
    }
  } catch (error) {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
