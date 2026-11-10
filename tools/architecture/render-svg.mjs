import { spawnSync } from 'node:child_process';
import fileSystem from 'node:fs';
import path from 'node:path';

import {
    ensureDirectory,
    localBinaryPath,
    readManifest,
    root,
    runCapture,
} from '../bootstrap/lib.mjs';

const [input, output] = process.argv.slice(2);

if (!input || !output) {
    console.error('usage: bun tools/architecture/render-svg.mjs <input.mmd> <output.svg>');
    process.exit(1);
}

const inputPath = path.resolve(process.cwd(), input);
const outputPath = path.resolve(process.cwd(), output);

if (!fileSystem.existsSync(inputPath)) {
    console.error(`error: input not found: ${inputPath}`);
    process.exit(1);
}

const mermaidCliPath = localBinaryPath('mmdc');
if (!fileSystem.existsSync(mermaidCliPath)) {
    console.error('error: local Mermaid CLI not found. Run: bun run bootstrap');
    process.exit(1);
}

function firefoxPath() {
    if (process.env.FIREFOX) return process.env.FIREFOX;
    const probe = runCapture('which', ['firefox']);
    if (probe.ok) return probe.stdout;
    for (const candidate of ['/usr/bin/firefox', '/usr/local/bin/firefox']) {
        if (fileSystem.existsSync(candidate)) return candidate;
    }
    return null;
}

const firefoxExecutablePath = firefoxPath();
if (!firefoxExecutablePath) {
    console.error(
        'error: Firefox not found. Set FIREFOX=/path/to/firefox or use fenced Mermaid diagrams.',
    );
    process.exit(1);
}

const manifest = readManifest();
const configPath = path.join(root, manifest.browser.config);
ensureDirectory(path.dirname(configPath));
fileSystem.writeFileSync(
    configPath,
    `${JSON.stringify({ browser: 'firefox', executablePath: firefoxExecutablePath, headless: true }, null, 2)}\n`,
);

const environment = {
    ...process.env,
    PUPPETEER_SKIP_DOWNLOAD: '1',
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: '1',
};

const result = spawnSync(mermaidCliPath, ['-p', configPath, '-i', inputPath, '-o', outputPath], {
    cwd: root,
    env: environment,
    stdio: 'inherit',
});

if (result.error) {
    console.error(`error: failed to start Mermaid CLI: ${result.error.message}`);
    process.exit(1);
}

if (result.status !== 0) {
    console.error(`error: Mermaid CLI failed with Firefox at ${firefoxExecutablePath}`);
    process.exit(result.status ?? 1);
}

console.log(`wrote ${path.relative(process.cwd(), outputPath)} using ${firefoxExecutablePath}`);
