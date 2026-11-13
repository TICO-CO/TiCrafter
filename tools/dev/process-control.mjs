import { spawnSync } from 'node:child_process';
import fileSystem from 'node:fs';
import net from 'node:net';

const pollIntervalMs = 100;

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const parseSsOutput = (output, port) =>
    output
        .split('\n')
        .filter((line) => line.includes(`:${port} `))
        .flatMap((line) => [...line.matchAll(/pid=(\d+)/g)].map((match) => Number(match[1])));

export const listenerProcessIds = (port) => {
    const ssResult = spawnSync('ss', ['-ltnp'], { encoding: 'utf8' });
    if (!ssResult.error && ssResult.status === 0) {
        return [...new Set(parseSsOutput(ssResult.stdout, port))];
    }

    const lsofResult = spawnSync('lsof', ['-tiTCP:' + port, '-sTCP:LISTEN'], {
        encoding: 'utf8',
    });
    if (!lsofResult.error && lsofResult.status === 0) {
        const processIds = lsofResult.stdout
            .split('\n')
            .map((line) => Number.parseInt(line.trim(), 10))
            .filter((processId) => Number.isInteger(processId));
        return [...new Set(processIds)];
    }

    console.error('error: cannot inspect listening processes; install ss or lsof');
    process.exit(1);
};

export const readCommandLine = (processId) => {
    try {
        const raw = fileSystem.readFileSync(`/proc/${processId}/cmdline`, 'utf8');
        return raw.split('\0').filter(Boolean).join(' ');
    } catch {
        const psResult = spawnSync('ps', ['-o', 'command=', '-p', String(processId)], {
            encoding: 'utf8',
        });
        if (psResult.error || psResult.status !== 0) return '';
        return psResult.stdout.trim();
    }
};

const readChildProcessIds = (processId) => {
    try {
        const raw = fileSystem.readFileSync(
            `/proc/${processId}/task/${processId}/children`,
            'utf8',
        );
        return raw.split(/\s+/).filter(Boolean).map(Number);
    } catch {
        const pgrepResult = spawnSync('pgrep', ['-P', String(processId)], { encoding: 'utf8' });
        if (pgrepResult.error || pgrepResult.status !== 0) return [];
        return pgrepResult.stdout
            .split('\n')
            .map((line) => Number.parseInt(line.trim(), 10))
            .filter((childProcessId) => Number.isInteger(childProcessId));
    }
};

export const processTree = (rootProcessId) => {
    const collected = new Set();
    const pending = [rootProcessId];
    while (pending.length > 0) {
        const processId = pending.pop();
        if (processId === undefined || collected.has(processId)) continue;
        collected.add(processId);
        pending.push(...readChildProcessIds(processId));
    }
    return [...collected];
};

export const signalProcesses = (processIds, signal) => {
    for (const processId of processIds) {
        try {
            process.kill(processId, signal);
        } catch (error) {
            console.warn(
                `warn: failed to send ${signal} to pid ${processId}: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }
};

const portIsFree = (port) => {
    const ssResult = spawnSync('ss', ['-ltnp'], { encoding: 'utf8' });
    if (!ssResult.error && ssResult.status === 0) {
        return parseSsOutput(ssResult.stdout, port).length === 0;
    }
    return listenerProcessIds(port).length === 0;
};

export const processIsRunning = (processId) => {
    try {
        const raw = fileSystem.readFileSync(`/proc/${processId}/stat`, 'utf8');
        const state = raw.slice(raw.lastIndexOf(')') + 2).charAt(0);
        return state !== 'Z' && state !== 'X';
    } catch {
        try {
            process.kill(processId, 0);
            return true;
        } catch {
            return false;
        }
    }
};

export const waitForExit = async (processIds, timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    const exited = () => !processIds.some(processIsRunning);
    while (Date.now() < deadline) {
        if (exited()) return true;
        await sleep(pollIntervalMs);
    }
    return exited();
};

export const waitForTermination = async (port, processIds, timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    const stopped = () => !processIds.some(processIsRunning) && portIsFree(port);
    while (Date.now() < deadline) {
        if (stopped()) return true;
        await sleep(pollIntervalMs);
    }
    return stopped();
};

const canBind = (host, port) =>
    new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false));
        server.listen({ host, port }, () => server.close(() => resolve(true)));
    });

export const waitForBindable = async (host, port, timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await canBind(host, port)) return true;
        await sleep(pollIntervalMs);
    }
    return canBind(host, port);
};
