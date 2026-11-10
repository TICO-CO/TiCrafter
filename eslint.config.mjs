import prettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

import noComments from './eslint-rules/no-comments.mjs';
import noThrowStatements from './eslint-rules/no-throw-statements.mjs';
import noTryStatements from './eslint-rules/no-try-statements.mjs';
import requireFacade from './eslint-rules/require-facade.mjs';

const localPlugin = {
    rules: {
        'no-comments': noComments,
        'no-throw-statements': noThrowStatements,
        'no-try-statements': noTryStatements,
        'require-facade': requireFacade,
    },
};

const sqliteBoundary = [
    'error',
    {
        patterns: [
            {
                group: ['bun:sqlite', 'node:sqlite', 'better-sqlite3'],
                message: 'SQLite access is limited to packages/memory.',
            },
        ],
    },
];

const corePurity = [
    'error',
    {
        patterns: [
            {
                group: ['node:*', 'bun:*', 'fs', 'fs/promises'],
                message: 'packages/core must stay pure and browser-safe.',
            },
        ],
    },
];

export default tseslint.config(
    {
        ignores: [
            'node_modules/**',
            '.venv/**',
            '.cache/**',
            '.toolchain/**',
            'coverage/**',
            'data/**',
            'docs/architecture/graphs/**',
            'dist/**',
            'models/**',
        ],
    },
    {
        files: ['**/*.{ts,mts,cts}'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
                ecmaVersion: 'latest',
                sourceType: 'module',
            },
        },
        plugins: {
            '@ticrafter': localPlugin,
            '@typescript-eslint': tseslint.plugin,
            'simple-import-sort': simpleImportSort,
        },
        settings: {
            'import/resolver': {
                typescript: {
                    alwaysTryTypes: true,
                    project: './tsconfig.json',
                },
            },
        },
        rules: {
            '@ticrafter/no-comments': 'error',
            '@ticrafter/no-throw-statements': 'error',
            '@ticrafter/no-try-statements': 'error',
            '@ticrafter/require-facade': 'error',
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-non-null-assertion': 'error',
            '@typescript-eslint/switch-exhaustiveness-check': 'error',
            'no-restricted-imports': sqliteBoundary,
            'simple-import-sort/exports': 'error',
            'simple-import-sort/imports': 'error',
        },
    },
    {
        files: ['packages/core/src/kernel/result.ts'],
        rules: {
            '@ticrafter/no-try-statements': 'off',
        },
    },
    {
        files: ['packages/core/src/kernel/assert.ts'],
        rules: {
            '@ticrafter/no-throw-statements': 'off',
        },
    },
    {
        files: ['packages/core/**/*.{ts,mts,cts}'],
        rules: {
            'no-restricted-imports': corePurity,
        },
    },
    {
        files: ['packages/core/**/*.test.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['node:*', 'fs', 'fs/promises', 'bun:sqlite', 'bun:ffi'],
                            message: 'packages/core tests may only use bun:test from Bun.',
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ['packages/memory/**/*.{ts,mts,cts}'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['node:sqlite', 'better-sqlite3'],
                            message: 'Use bun:sqlite inside packages/memory.',
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ['tools/**/*.mjs', 'eslint-rules/**/*.mjs', 'eslint.config.mjs'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
        },
        plugins: {
            '@ticrafter': localPlugin,
            'simple-import-sort': simpleImportSort,
        },
        rules: {
            '@ticrafter/no-comments': 'error',
            'simple-import-sort/exports': 'error',
            'simple-import-sort/imports': 'error',
        },
    },
    prettier,
);
