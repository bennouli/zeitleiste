import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import { defineConfig, globalIgnores } from 'eslint/config'
import noTestOnlyExports from './eslint/no-test-only-exports.mjs'

const TESTS = ['src/**/__tests__/**', 'e2e/**']

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
    // Override default ignores of eslint-config-next.
    globalIgnores([
        // Default ignores of eslint-config-next:
        '.next/**',
        'out/**',
        'build/**',
        'next-env.d.ts',
        // Vendored upstream sources (AGENTS.md § Libraries)
        'repos/**',
    ]),
    {
        // AGENTS.md § Code Style: types, not interfaces.
        files: ['src/**/*.{ts,tsx}', 'e2e/**/*.ts'],
        rules: {
            '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
        },
    },
    {
        // AGENTS.md § Code Style: a helper that only the tests read is not a bare export;
        // it goes in PRIVATE_UNDER_TESTS, which production code never imports.
        files: ['src/**/*.{ts,tsx}'],
        ignores: TESTS,
        plugins: {
            local: { rules: { 'no-test-only-exports': noTestOnlyExports } },
        },
        rules: {
            // Route files and the test helpers are entry points, not modules with consumers.
            'local/no-test-only-exports': [
                'error',
                { exempt: ['src/app', 'src/test'] },
            ],
            'no-restricted-syntax': [
                'error',
                {
                    selector:
                        'ImportSpecifier[imported.name="PRIVATE_UNDER_TESTS"]',
                    message: 'PRIVATE_UNDER_TESTS is read by the tests only.',
                },
            ],
        },
    },
    {
        // AGENTS.md § Code Style: src/lib is shared logic and must not reach into components or routes.
        files: ['src/lib/**/*.ts'],
        ignores: TESTS,
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: [
                                '@/components/*',
                                '@/app/*',
                                '../components/*',
                                '../app/*',
                            ],
                            message:
                                'src/lib holds shared logic; it does not import from components or routes.',
                        },
                    ],
                },
            ],
        },
    },
])

export default eslintConfig
