import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/**
 * Mirrors drift's root config, deliberately: two repos that lint differently
 * disagree about what good looks like, and this one is read alongside the app
 * it tests.
 *
 * The one addition is `no-explicit-any` as a warning rather than an error. Five
 * remain, all response bodies, and they are waiting on types generated from
 * drift's published `openapi.yaml` — see AUDIT-drift-tests.md B1. A warning
 * keeps the count visible without failing CI on a known, dated decision; make
 * it an error once the generated types land.
 */
export default defineConfig([
  globalIgnores(['node_modules', 'reports']),

  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  {
    files: ['*.config.{js,mjs}', 'cucumber.mjs'],
    languageOptions: { globals: globals.node },
  },
])
