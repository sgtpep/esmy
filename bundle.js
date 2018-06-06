const commonJS = require('rollup-plugin-commonjs');
const findNPMPrefix = require('find-npm-prefix');
const fs = require('fs');
const nodeBuiltins = require('rollup-plugin-node-builtins');
const nodeGlobals = require('rollup-plugin-node-globals');
const nodeResolve = require('rollup-plugin-node-resolve');
const path = require('path');
const readline = require('readline');
const rollup = require('rollup');

const rollupPlugins = [
  commonJS(),
  nodeBuiltins(),
  nodeGlobals(),
  nodeResolve({ jsnext: true }),
];

async function bundleModule(modulePath) {
  const outputPath = path.join(
    await findESModulesPath(),
    `${path.basename(modulePath)}.js`,
  );
  const { version } = require(path.join(modulePath, 'package.json'));
  if (
    !fs.existsSync(outputPath) ||
    (await parseESModuleVersion(outputPath)) !== version
  ) {
    await (await rollup.rollup({
      input: await resolveModuleEntry(modulePath),
      plugins: rollupPlugins,
    })).write({
      banner: `/* version ${version} */`,
      file: outputPath,
      format: 'es',
      sourcemap: true,
    });
  }
}

async function findESModuleNames() {
  return fs
    .readdirSync(await findESModulesPath())
    .filter(filename => filename.endsWith('.js'))
    .map(filename => filename.replace(/\.js$/, ''));
}

async function findESModulesPath() {
  return path.join(await findPrefixPath(), 'es_modules');
}

async function findExcessiveESModuleNames(modulePaths) {
  const names = modulePaths.map(modulePath => path.basename(modulePath));
  return (await findESModuleNames()).filter(name => !names.includes(name));
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

function parseESModuleVersion(modulePath) {
  return new Promise((resolve, reject) => {
    let firstLine;
    const interface = readline.createInterface({
      input: fs.createReadStream(modulePath),
    });
    interface.on('close', () =>
      resolve(firstLine.match(/^\/\* version (.+?) \*\/$/)[1]),
    );
    interface.on('line', line => {
      firstLine = line;
      interface.close();
    });
  });
}

async function removeESModule(name) {
  const scriptPath = path.join(await findESModulesPath(), `${name}.js`);
  for (const removePath of [scriptPath, `${scriptPath}.map`]) {
    if (fs.existsSync(removePath)) {
      fs.unlinkSync(removePath);
    }
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
  for (const name of await findExcessiveESModuleNames(modulePaths)) {
    await removeESModule(name);
  }
};
