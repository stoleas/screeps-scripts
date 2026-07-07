'use strict';

const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const typescript = require('@rollup/plugin-typescript');

const ignoreWarnings = [
    'Circular dependency',
    "The 'this' keyword is equivalent to 'undefined'",
];

module.exports = {
    input: 'src/main.ts',

    plugins: [
        resolve(),
        commonjs(),
        typescript({ tsconfig: './tsconfig.json' }),
    ],

    onwarn(warning) {
        for (const ignore of ignoreWarnings) {
            if (warning.toString().includes(ignore)) return;
        }
        console.warn(warning.message);
    },

    treeshake: false,

    output: {
        file: 'dist/main.js',
        format: 'cjs',
        sourcemap: false,
    },
};