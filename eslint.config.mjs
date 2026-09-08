import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

/**
 * eslint-config-next v16 ships native flat configs, so they are spread
 * directly. The previous config ran them through FlatCompat — a shim for the
 * legacy .eslintrc format — which fed an already-flat config back through the
 * converter and threw "Converting circular structure to JSON". Lint had not
 * run at all since.
 */
export default [
  ...nextCoreWebVitals,
  ...nextTypescript,

  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'Employee performance tracking system/**'],
  },

  {
    rules: {
      // Unused code is dead weight, and this is how the audit found several
      // orphans after the dashboard rebuild. Args prefixed with _ are exempt
      // so a required-but-ignored callback parameter can still be named.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
]
