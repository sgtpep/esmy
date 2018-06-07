import commonJS from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';
import nodeResolve from 'rollup-plugin-node-resolve';
import replace from 'rollup-plugin-replace';
import { bin } from './package.json';

export default {
  acorn: { allowHashBang: true },
  input: './cli.mjs',
  output: {
    file: bin,
    format: 'cjs',
  },
  plugins: [
    commonJS(),
    json(),
    nodeResolve({ module: false, preferBuiltins: true }),
    replace({ '#!/bin/sh': '', delimiters: ['', ''] }),
  ],
};
