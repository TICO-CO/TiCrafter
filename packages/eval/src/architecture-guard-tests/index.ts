import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ArchitectureGuardResult {
    ok: boolean;
    status: number | null;
    stdout: string;
    stderr: string;
}

export class ArchitectureGuard {
    constructor(private readonly repositoryRoot: string) {}

    static atRepositoryRoot(): ArchitectureGuard {
        return new ArchitectureGuard(
            path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..'),
        );
    }

    validate(): ArchitectureGuardResult {
        return this.run('tools/architecture/validate-graph.mjs');
    }

    validateComponents(): ArchitectureGuardResult {
        return this.run('tools/architecture/check-component-paths.mjs');
    }

    private run(script: string): ArchitectureGuardResult {
        const result = spawnSync('bun', [script], {
            cwd: this.repositoryRoot,
            encoding: 'utf8',
        });
        return {
            ok: result.status === 0,
            status: result.status,
            stdout: result.stdout,
            stderr: result.stderr,
        };
    }
}
