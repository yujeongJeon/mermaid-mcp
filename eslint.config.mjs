import naverPayConfig from '@naverpay/eslint-config'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import {defineConfig} from 'eslint/config'

export default defineConfig([
    {
        ignores: ['**/node_modules/**', '**/dist/**'],
    },
    ...naverPayConfig.configs.node,
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                project: './tsconfig.json',
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
    },
    ...naverPayConfig.configs.packageJson,
])
