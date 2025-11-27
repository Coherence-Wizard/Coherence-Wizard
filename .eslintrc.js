module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
    },
    plugins: ['@typescript-eslint'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    rules: {
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/ban-ts-comment': 'off',
        'no-console': 'off',
        'no-async-promise-executor': 'off',
        '@typescript-eslint/no-floating-promises': 'warn'
    },
    env: {
        node: true,
        browser: true,
        es6: true,
    },
};
