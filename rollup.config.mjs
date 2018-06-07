import commonJS from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';
import nodeResolve from 'rollup-plugin-node-resolve';
import { bin } from './package.json';

export default {
  acorn: { allowHashBang: true },
  input: './cli.mjs',
  output: {
    file: bin,
    format: 'cjs',
  },
  plugins: [commonJS(), json(), nodeResolve()],
};
