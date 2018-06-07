import { bin } from './package.json';

export default {
  acorn: { allowHashBang: true },
  input: './cli.js',
  output: {
    file: bin,
    format: 'cjs',
  },
};
