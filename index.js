const commonJS = require('rollup-plugin-commonjs');
const findNPMPrefix = require('find-npm-prefix');
const fs = require('fs');
const nodeBuiltins = require('rollup-plugin-node-builtins');
const nodeGlobals = require('rollup-plugin-node-globals');
const nodeResolve = require('rollup-plugin-node-resolve');
const path = require('path');
const rollup = require('rollup');

const rollupPlugins = [
  commonJS(),
  nodeBuiltins(),
  nodeGlobals(),
  nodeResolve({ jsnext: true }),
];

async function bundleModule(modulePath) {
  const entryPath = await resolveModuleEntry(modulePath);
  const bundle = await rollup.rollup({
    input: entryPath,
    plugins: rollupPlugins,
  });
  const outputPath = path.join(
    path.dirname(modulePath),
    '../es_modules',
    `${path.basename(modulePath)}.js`,
  );
  await bundle.write({ file: outputPath, format: 'es' });
}

function resolveModuleEntry(modulePath) {
  return rollupPlugins
    .find(plugin => plugin.name === 'node-resolve')
    .resolveId(path.basename(modulePath), path.dirname(modulePath));
}

module.exports = async function sync() {
  const prefix = await findNPMPrefix(process.cwd());
  const modulesPath = path.join(prefix, 'node_modules');
  if (fs.existsSync(modulesPath)) {
    //    for (const name of fs.readdirSync(modulesPath)) {
    const name = 'hyperscript';
    const modulePath = path.join(modulesPath, name);
    if (fs.statSync(modulePath).isDirectory() && !name.startsWith('.')) {
      await bundleModule(modulePath);
      process.exit();
    }
    //    }
  }
};
