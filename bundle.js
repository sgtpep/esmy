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

async function bundleModule(name) {
  const esModulePath = path.join(await findESModulesPath(), name);
  const versionPath = path.join(esModulePath, '.version');
  const { version } = require(path.join(
    await findModulesPath(),
    name,
    'package.json',
  ));
  if (
    !fs.existsSync(versionPath) ||
    fs.readFileSync(versionPath, 'utf8') !== version
  ) {
    const bundle = await rollup
      .rollup({
        input: await resolveModuleEntry(name),
        onwarn: warning => {
          throw warning;
        },
        plugins: rollupPlugins,
      })
      .catch(error => console.error(error));
    if (bundle) {
      await bundle.write({
        file: path.join(esModulePath, 'index.js'),
        format: 'es',
        sourcemap: true,
      });
      fs.writeFileSync(versionPath, version);
    } else {
      await removeESModule(name);
    }
  }
}

async function findBundlableModules() {
  const modulesPath = await findModulesPath();
  const packagePath = path.join(await findPrefixPath(), 'package.json');
  return fs.existsSync(packagePath)
    ? Object.keys(require(packagePath).dependencies || {}).filter(name =>
        fs.statSync(path.join(modulesPath, name)).isDirectory(),
      )
    : await findModules(await findModulesPath());
}

async function findESModules() {
  const modulesPath = await findESModulesPath();
  return fs
    .readdirSync(modulesPath)
    .reduce(
      (names, name) => [
        ...names,
        ...(name.startsWith('@')
          ? fs
              .readdirSync(path.join(modulesPath, name))
              .map(subname => `${name}/${subname}`)
          : [name]),
      ],
      [],
    );
}

async function findESModulesPath() {
  return path.join(await findPrefixPath(), 'es_modules');
}

async function findExcessiveESModules(names) {
  return (await findModules(await findESModulesPath())).filter(
    name => !names.includes(name),
  );
}

function findModules(modulesPath) {
  return fs
    .readdirSync(modulesPath)
    .filter(
      filename =>
        fs.statSync(path.join(modulesPath, filename)).isDirectory() &&
        !path.basename(filename).startsWith('.'),
    )
    .reduce(
      (names, name) => [
        ...names,
        ...(name.startsWith('@')
          ? fs
              .readdirSync(path.join(modulesPath, name))
              .map(subname => `${name}/${subname}`)
          : [name]),
      ],
      [],
    );
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

async function removeESModule(name) {
  const modulesPath = await findESModulesPath();
  rimraf.sync(path.join(modulesPath, name));
  const namespacePath = path.join(modulesPath, path.dirname(name));
  if (name.startsWith('@') && !fs.readdirSync(namespacePath).length) {
    fs.rmdirSync(namespacePath);
  }
}

async function resolveModuleEntry(name) {
  return rollupPlugins
    .find(plugin => plugin.name === 'node-resolve')
    .resolveId(name, await findModulesPath());
}

module.exports = async function bundle() {
  const names = await findBundlableModules();
  for (const name of names) {
    await bundleModule(name);
  }
  for (const name of await findExcessiveESModules(names)) {
    await removeESModule(name);
  }
};
