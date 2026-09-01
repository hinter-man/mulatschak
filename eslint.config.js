'use strict';

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    {
        ignores: ['node_modules/**']
    },
    js.configs.recommended,
    {
        files: ['*.js', 'test/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            globals: globals.node
        },
        rules: {
            quotes: ['error', 'single'],
            semi: ['error', 'always']
        }
    },
    {
        files: ['public/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            globals: Object.assign({}, globals.browser, globals.jquery, {
                io: 'readonly'
            })
        },
        rules: {
            quotes: ['error', 'single'],
            semi: ['error', 'always']
        }
    }
];
