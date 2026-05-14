import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

const reactHooksConfig = reactHooks.configs.flat.recommended

export default [
  { ignores: ['dist'] },
  js.configs.recommended,
  {
    ...reactHooksConfig,
    files: ['**/*.{js,jsx}'],
    plugins: {
      ...reactHooksConfig.plugins,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooksConfig.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', destructuredArrayIgnorePattern: '^_' }],
    },
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
  },
]
