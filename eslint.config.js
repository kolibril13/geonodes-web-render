import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // src/shims are vendored ports of React's use-sync-external-store shim;
  // keep them byte-faithful to upstream rather than lint-clean.
  globalIgnores(['dist', 'src/shims']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Library entry: exporting mountGraphView/unmountGraphView next to the
    // component is the package API, so fast refresh can't apply here anyway.
    files: ['src/embed.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
