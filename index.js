const commonJS = require('rollup-plugin-commonjs');
const findNPMPrefix = require('find-npm-prefix');
const fs = require('fs');
const nodeBuiltins = require('rollup-plugin-node-builtins');
const nodeGlobals = require('rollup-plugin-node-globals');
const nodeResolve = require('rollup-plugin-node-resolve');
const path = require('path');
const rollup = require('rollup');

async function bundleModule(input) {
  input = '../node_modules/hyperscript/index.js';
  const bundle = await rollup.rollup({
    input,
    plugins: [
      commonJS(),
      nodeBuiltins(),
      nodeGlobals(),
      nodeResolve({ jsnext: true }),
    ],
  });
  const { code } = await bundle.generate({ format: 'es' });
  console.log(code);
}

module.exports = async function sync() {
  const prefix = await findNPMPrefix(process.cwd());
  const modulesPath = path.join(prefix, 'node_modules');
  if (fs.existsSync(modulesPath)) {
    for (const filename of fs.readdirSync(modulesPath)) {
      if (
        fs.statSync(path.join(modulesPath, filename)).isDirectory() &&
        !filename.startsWith('.')
      ) {
        await bundleModule(filename);
        process.exit();
      }
    }
  }
};
