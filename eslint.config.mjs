import js from '@eslint/js';
import globals from 'globals';
import shiftbridge from './scripts/static-rules.mjs';

export default [
  { ignores: ['node_modules/**', '.agents/**', '.specify/**', '.specify-tool-cache/**', 'deliverables/**', 'input_data/**'] },
  { files: ['src/**/*.js', 'scripts/**/*.mjs', 'tests/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' }, plugins: { shiftbridge },
    rules: { ...js.configs.recommended.rules, 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }], 'no-constant-binary-expression': 'error', 'no-unsafe-optional-chaining': 'error', 'no-unsafe-finally': 'error', 'no-promise-executor-return': 'error', 'no-async-promise-executor': 'error', 'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-func': 'error', 'no-throw-literal': 'error', 'no-prototype-builtins': 'error', 'eqeqeq': ['error', 'always', { null: 'ignore' }], 'shiftbridge/bounded-call-arguments': 'error' } },
  { files: ['src/**/*.js'], languageOptions: { globals: globals.browser }, rules: { 'shiftbridge/layer-boundaries': 'error', 'shiftbridge/trusted-html': 'error', 'shiftbridge/event-error-boundary': 'error' } },
  { files: ['src/domain/**/*.js', 'src/data/**/*.js', 'src/view/**/*.js'], rules: { 'no-restricted-globals': ['error', 'document', 'window', 'navigator', 'fetch', 'localStorage', 'sessionStorage', 'XMLHttpRequest', 'WebSocket'], 'shiftbridge/explicit-clock': 'error' } },
  { files: ['scripts/**/*.mjs', 'tests/**/*.mjs', 'eslint.config.mjs'], languageOptions: { globals: globals.node } }
];
