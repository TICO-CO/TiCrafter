import { spawn } from 'node:child_process';
import path from 'node:path';

import { ConfigLoader } from '@ticrafter/core';

import { NodeConfigSource } from '../../apps/coordinator/src/config-source.ts';
import {
    listenerProcessIds,
    processIsRunning,
    processTree,
    readCommandLine,
    signalProcesses,
    waitForBindable,
    waitForExit,
    waitForTermination,
} from './process-control.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const coordinatorEntry = 'apps/coordinator/src/main.ts';
const terminationTimeoutMs = 5000;
const shutdownTimeoutMs = 10000;

const readTransport = () => {
    const [config, error] = new ConfigLoader({
        source: new NodeConfigSource(path.join(root, 'config')),
        environment: process.env,
    }).load();
    if (error) {
        console.error(`error: failed to load config: ${error.path}: ${error.message}`);
        process.exit(1);
    }
    if (config === null) {
        console.error('error: failed to load config: loader returned null');
        process.exit(1);
    }
    return config.transport;
};

const isCoordinatorProcess = (processId) => readCommandLine(processId).includes(coordinatorEntry);

const stopProcesses = async (processIds, port) => {
    const remainingProcessIds = processIds.filter(processIsRunning);
    if (remainingProcessIds.length === 0) return true;
    for (const processId of remainingProcessIds) {
        console.warn(`stale process (pid ${processId}) ignored SIGTERM; sending SIGKILL`);
    }
    signalProcesses(remainingProcessIds, 'SIGKILL');
    return waitForTermination(port, processIds, terminationTimeoutMs);
};

const reclaimPort = async ({ host, port }) => {
    const coordinatorProcessIds = listenerProcessIds(port);
    if (coordinatorProcessIds.length === 0) {
        if (await waitForBindable(host, port, terminationTimeoutMs)) return;
        console.error(`error: ${host}:${port} is not bindable`);
        process.exit(1);
    }

    const foreignProcessIds = coordinatorProcessIds.filter(
        (processId) => !isCoordinatorProcess(processId),
    );
    if (foreignProcessIds.length > 0) {
        for (const processId of foreignProcessIds) {
            console.error(
                `error: port ${port} held by pid ${processId} (${readCommandLine(processId) || 'unknown command'}); not a coordinator process`,
            );
        }
        console.error('refusing to kill it; free the port manually');
        process.exit(1);
    }

    const treeProcessIds = [...new Set(coordinatorProcessIds.flatMap(processTree))];
    const descendantProcessIds = treeProcessIds.filter(
        (processId) => !coordinatorProcessIds.includes(processId),
    );
    for (const processId of coordinatorProcessIds) {
        console.log(`stopping stale coordinator (pid ${processId}) on port ${port}`);
    }
    signalProcesses(descendantProcessIds, 'SIGTERM');
    await waitForExit(descendantProcessIds, terminationTimeoutMs);
    signalProcesses(descendantProcessIds.filter(processIsRunning), 'SIGKILL');
    await waitForExit(descendantProcessIds, terminationTimeoutMs);

    signalProcesses(coordinatorProcessIds, 'SIGTERM');
    if (!(await waitForTermination(port, treeProcessIds, terminationTimeoutMs))) {
        if (!(await stopProcesses(treeProcessIds, port))) {
            console.error(`error: port ${port} still in use after SIGKILL`);
            process.exit(1);
        }
    }

    if (await waitForBindable(host, port, terminationTimeoutMs)) return;
    console.error(`error: ${host}:${port} is not bindable after stopping the coordinator`);
    process.exit(1);
};

const startCoordinator = () => {
    const childProcess = spawn(process.execPath, [coordinatorEntry], {
        cwd: root,
        stdio: 'inherit',
        detached: true,
    });
    let shutdownTimer = null;
    const signalCoordinator = (signal) => {
        try {
            process.kill(-childProcess.pid, signal);
        } catch (error) {
            console.warn(
                `warn: failed to forward ${signal} to coordinator: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    };
    const forwardSignal = (signal) => () => {
        if (shutdownTimer !== null) {
            signalCoordinator('SIGKILL');
            return;
        }
        signalCoordinator(signal);
        shutdownTimer = setTimeout(() => {
            console.warn(
                `warn: coordinator did not stop after ${shutdownTimeoutMs}ms; sending SIGKILL`,
            );
            signalCoordinator('SIGKILL');
        }, shutdownTimeoutMs);
    };
    process.on('SIGINT', forwardSignal('SIGINT'));
    process.on('SIGTERM', forwardSignal('SIGTERM'));
    childProcess.on('exit', (code, signal) => {
        process.exit(code ?? (signal ? 1 : 0));
    });
    childProcess.on('error', (error) => {
        console.error(`error: failed to start coordinator: ${error.message}`);
        process.exit(1);
    });
};

const main = async () => {
    const transport = readTransport();
    await reclaimPort(transport);
    startCoordinator();
};

main().catch((error) => {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
