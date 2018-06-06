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
  await bundle.write({ file: outputPath, format: 'es', sourcemap: true });
}

async function findModulePaths() {
  const prefix = await findNPMPrefix(process.cwd());
  const names = await findModules();
  return names
    .map(name => path.join(prefix, 'node_modules', name))
    .filter(modulePath => fs.statSync(modulePath).isDirectory());
}

async function findModules() {
  const prefix = await findNPMPrefix(process.cwd());
  const packagePath = path.join(prefix, 'package.json');
  if (fs.existsSync(packagePath)) {
    return Object.keys(require(packagePath).dependencies || {});
  } else {
    return fs
      .readdirSync(path.join(prefix, 'node_modules'))
      .filter(name => !path.basename(name).startsWith('.'));
  }
}

function resolveModuleEntry(modulePath) {
  return rollupPlugins
    .find(plugin => plugin.name === 'node-resolve')
    .resolveId(path.basename(modulePath), path.dirname(modulePath));
}

module.exports = async function bundle() {
  const modulePaths = await findModulePaths();
  for (const modulePath of modulePaths) {
    await bundleModule(modulePath);
  }
};
