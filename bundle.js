const commonJS = require('rollup-plugin-commonjs');
const findNPMPrefix = require('find-npm-prefix');
const fs = require('fs');
const nodeBuiltins = require('rollup-plugin-node-builtins');
const nodeGlobals = require('rollup-plugin-node-globals');
const nodeResolve = require('rollup-plugin-node-resolve');
const path = require('path');
const rimraf = require('rimraf');
const rollup = require('rollup');

const rollupPlugins = [
  commonJS(),
  nodeBuiltins(),
  nodeGlobals(),
  nodeResolve({ jsnext: true }),
];

async function bundleModule(modulePath) {
  const esModulePath = path.join(
    await findESModulesPath(),
    path.basename(modulePath),
  );
  const versionPath = path.join(esModulePath, '.version');
  const { version } = require(path.join(modulePath, 'package.json'));
  if (
    !fs.existsSync(versionPath) ||
    fs.readFileSync(versionPath, 'utf8') !== version
  ) {
    await (await rollup.rollup({
      input: await resolveModuleEntry(modulePath),
      plugins: rollupPlugins,
    })).write({
      file: path.join(esModulePath, 'index.js'),
      format: 'es',
      sourcemap: true,
    });
    fs.writeFileSync(versionPath, version);
  }
}

async function findESModulesPath() {
  return path.join(await findPrefixPath(), 'es_modules');
}

async function findExcessiveESModulePaths(modulePaths) {
  const modulesPath = await findESModulesPath();
  const names = modulePaths.map(modulePath => path.basename(modulePath));
  return fs
    .readdirSync(modulesPath)
    .filter(filename => !names.includes(filename))
    .map(filename => path.join(modulesPath, filename));
}

async function findModuleNames() {
  const packagePath = path.join(await findPrefixPath(), 'package.json');
  if (fs.existsSync(packagePath)) {
    return Object.keys(require(packagePath).dependencies || {});
  } else {
    return fs
      .readdirSync(await findModulesPath())
      .filter(filename => !path.basename(filename).startsWith('.'));
  }
}

async function findModulePaths() {
  const modulesPath = await findModulesPath();
  return (await findModuleNames())
    .map(name => path.join(modulesPath, name))
    .filter(modulePath => fs.statSync(modulePath).isDirectory());
}

async function findModulesPath() {
  return path.join(await findPrefixPath(), 'node_modules');
}

async function findPrefixPath() {
  if (!findPrefixPath.prefixPath) {
    findPrefixPath.prefixPath = await findNPMPrefix(process.cwd());
  }
  return findPrefixPath.prefixPath;
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
  for (const modulePath of await findExcessiveESModulePaths(modulePaths)) {
    rimraf.sync(modulePath);
  }
};
