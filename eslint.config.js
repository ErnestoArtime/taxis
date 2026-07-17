export default [
  {
    ignores: ['dist/**', 'node_modules/**', '.angular/**']
  },
  {
    files: ['packages/**/*.ts', 'apps/**/*.ts'],
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error'
    }
  }
];
