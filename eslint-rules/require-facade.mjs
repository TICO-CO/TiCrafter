import fs from 'node:fs';
import path from 'node:path';

const extensionPattern = /\.(?:[cm]?[jt]s)$/;
const facadeNames = new Set(['index', 'main']);
const facadeFiles = ['index.ts', 'index.mts', 'index.cts', 'index.js', 'index.mjs', 'index.cjs'];

const isRelative = (specifier) => specifier.startsWith('./') || specifier.startsWith('../');

const directoryHasFacade = (dir) =>
    facadeFiles.some((name) => fs.existsSync(path.join(dir, name)));

const isFacadeTarget = (target) => {
    const base = path.basename(target).replace(extensionPattern, '');
    if (facadeNames.has(base)) return true;
    try {
        return fs.statSync(target).isDirectory() && directoryHasFacade(target);
    } catch {
        return false;
    }
};

const sourceOf = (node) => node.source?.value;

export default {
    meta: {
        type: 'problem',
        docs: {
            description: 'Require relative imports from outside a folder to target its facade.',
        },
        schema: [],
        messages: {
            nonFacadeImport:
                'Import the nearest index facade instead of reaching into "{{source}}".',
        },
    },
    create(context) {
        const filename = context.filename ?? context.getFilename();
        const fromDir = path.dirname(filename);

        const check = (node) => {
            const source = sourceOf(node);
            if (!source || !isRelative(source)) return;

            const target = path.resolve(fromDir, source);
            if (path.dirname(target) === fromDir) return;
            if (isFacadeTarget(target)) return;

            context.report({ node, messageId: 'nonFacadeImport', data: { source } });
        };

        return {
            ImportDeclaration: check,
            ExportAllDeclaration: check,
            ExportNamedDeclaration: check,
        };
    },
};
