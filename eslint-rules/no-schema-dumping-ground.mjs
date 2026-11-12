import path from 'node:path';

const extensionPattern = /\.(?:[cm]?[jt]s)$/;
const schemaImportPattern = /(^|\/)schemas(?:$|\/index\.(?:[cm]?[jt]s)$|\.(?:[cm]?[jt]s)$)/;

const normalized = (filename) => filename.replaceAll('\\', '/');

const isRelative = (source) => source.startsWith('./') || source.startsWith('../');

const isTransportFile = (filename) =>
    normalized(filename).includes('/packages/core/src/transport/');

const isCanonicalSchemaTarget = (filename, source) => {
    if (!isRelative(source)) return false;
    const target = path.resolve(path.dirname(filename), source);
    return normalized(target).includes('/packages/core/src/schemas/');
};

const sourceOf = (node) => node.source?.value;

export default {
    meta: {
        type: 'problem',
        docs: {
            description: 'Require schemas to live in the canonical schemas directory.',
        },
        schema: [],
        messages: {
            schemaDumpingGround:
                'Schema dumping grounds are forbidden. Put schemas in packages/core/src/schemas/<name>.ts.',
            schemaImport:
                'Import schemas from packages/core/src/schemas/index.ts, not "{{source}}".',
            transportSchema:
                'Transport must not define domain payload schemas. Move "{{name}}" to packages/core/src/schemas.',
        },
    },
    create(context) {
        const filename = context.filename ?? context.getFilename();
        const baseName = path.basename(filename).replace(extensionPattern, '');

        return {
            Program(node) {
                if (baseName !== 'schemas') return;
                context.report({ node, messageId: 'schemaDumpingGround' });
            },
            ImportDeclaration(node) {
                const source = sourceOf(node);
                if (!source || !schemaImportPattern.test(source)) return;
                if (isCanonicalSchemaTarget(filename, source)) return;
                context.report({ node, messageId: 'schemaImport', data: { source } });
            },
            ExportNamedDeclaration(node) {
                if (!isTransportFile(filename)) return;
                if (node.declaration?.type !== 'VariableDeclaration') return;
                for (const declaration of node.declaration.declarations) {
                    if (declaration.id.type !== 'Identifier') continue;
                    if (!declaration.id.name.endsWith('Schema')) continue;
                    context.report({
                        node: declaration,
                        messageId: 'transportSchema',
                        data: { name: declaration.id.name },
                    });
                }
            },
        };
    },
};
