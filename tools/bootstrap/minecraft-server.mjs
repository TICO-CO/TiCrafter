import { spawn } from 'node:child_process';
import fileSystem from 'node:fs';
import path from 'node:path';

import {
    ensureDirectory,
    exists,
    fail,
    isMain,
    readJsonFile,
    readManifest,
    root,
    warn,
} from './lib.mjs';

const serverDirectory = path.join(root, 'data/minecraft');
const processIdPath = path.join(serverDirectory, 'server.pid');
const logPath = path.join(serverDirectory, 'server.log');
const eulaPath = path.join(serverDirectory, 'eula.txt');
const propertiesPath = path.join(serverDirectory, 'server.properties');

const resolveServerJarPath = (manifest) =>
    path.join(root, manifest.downloads['minecraft-server-1.20.1'].dest);
const resolveJavaExecutablePath = (manifest) =>
    path.join(root, manifest.downloads.java17.dest, manifest.downloads.java17.bin);

const isProcessRunning = (processId) => {
    try {
        process.kill(processId, 0);
        return true;
    } catch {
        return false;
    }
};

const readProcessId = () => {
    try {
        return Number.parseInt(fileSystem.readFileSync(processIdPath, 'utf8').trim(), 10);
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
        'level-type=minecraft\\:normal',
        'generate-structures=true',
        'allow-nether=false',
        'enable-command-block=false',
    ];
    fileSystem.writeFileSync(propertiesPath, `${properties.join('\n')}\n`);
};

const eulaAccepted = () => {
    try {
        return /^\s*eula\s*=\s*true\s*$/im.test(fileSystem.readFileSync(eulaPath, 'utf8'));
    } catch {
        return false;
    }
};

export function serverStatus() {
    const processId = readProcessId();
    return {
        processId,
        running: processId !== null && isProcessRunning(processId),
        logPath,
    };
}

export function startServer({ acceptEula = false } = {}) {
    const manifest = readManifest();
    const serverJarPath = resolveServerJarPath(manifest);
    const javaExecutablePath = resolveJavaExecutablePath(manifest);

    if (!exists(serverJarPath)) {
        fail(`missing Minecraft server jar at ${serverJarPath}; run the bootstrap first`);
    }
    if (!exists(javaExecutablePath)) {
        fail(`missing local Java runtime at ${javaExecutablePath}; run the bootstrap first`);
    }

    const status = serverStatus();
    if (status.running) {
        console.log(`server already running (processId ${status.processId})`);
        return;
    }

    ensureDirectory(serverDirectory);

    if (!eulaAccepted()) {
        if (!acceptEula) {
            fail(
                'Minecraft EULA not accepted. Read https://aka.ms/MinecraftEULA then re-run with --accept-eula to write data/minecraft/eula.txt.',
            );
        }
        fileSystem.writeFileSync(eulaPath, 'eula=true\n');
        console.log('wrote data/minecraft/eula.txt after explicit --accept-eula');
    }

    writeDefaultProperties();

    const logFileDescriptor = fileSystem.openSync(logPath, 'a');
    const childProcess = spawn(
        javaExecutablePath,
        ['-Xms1G', '-Xmx2G', '-jar', serverJarPath, 'nogui'],
        {
            cwd: serverDirectory,
            detached: true,
            stdio: ['ignore', logFileDescriptor, logFileDescriptor],
        },
    );
    childProcess.unref();
    fileSystem.writeFileSync(processIdPath, `${childProcess.pid}\n`);
    console.log(`started Minecraft 1.20.1 server (processId ${childProcess.pid})`);
    console.log(`log: ${logPath}`);
}

export function stopServer() {
    const status = serverStatus();
    if (!status.running) {
        console.log('server is not running');
        if (status.processId !== null) fileSystem.rmSync(processIdPath, { force: true });
        return;
    }
    process.kill(status.processId, 'SIGTERM');
    fileSystem.rmSync(processIdPath, { force: true });
    console.log(`sent SIGTERM to Minecraft server (processId ${status.processId})`);
}

export function printStatus() {
    const status = serverStatus();
    console.log(status.running ? `running (processId ${status.processId})` : 'stopped');
    console.log(`log: ${status.logPath}`);
}

function runCommand(command, acceptEula) {
    switch (command) {
        case 'start':
            startServer({ acceptEula });
            break;
        case 'stop':
            stopServer();
            break;
        case 'status':
            printStatus();
            break;
        default:
            warn(`unknown command ${command}`);
            console.log(
                'usage: bun tools/bootstrap/minecraft-server.mjs <start|stop|status> [--accept-eula]',
            );
            process.exit(1);
    }
}

function main() {
    const command = process.argv[2] ?? 'status';
    const acceptEula = process.argv.includes('--accept-eula');
    try {
        runCommand(command, acceptEula);
    } catch (error) {
        console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}

if (isMain(import.meta.url)) main();
