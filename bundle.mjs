import commonJS from 'rollup-plugin-commonjs';
import findNPMPrefix from 'find-npm-prefix';
import fs from 'fs';
import json from 'rollup-plugin-json';
import nodeBuiltins from 'rollup-plugin-node-builtins';
import nodeGlobals from 'rollup-plugin-node-globals';
import nodeResolve from 'rollup-plugin-node-resolve';
import path from 'path';
import rimraf from 'rimraf';
import rollup from 'rollup';

const rollupPlugins = [
  commonJS(),
  json(),
  nodeBuiltins(),
  nodeGlobals(),
  nodeResolve({ jsnext: true }),
];

async function bundleModule(name) {
  const esModulePath = path.join(await findESModulesPath(), name);
  const versionPath = path.join(esModulePath, '.version');
  const { version } = JSON.parse(
    fs.readFileSync(
      path.join(await findModulesPath(), name, 'package.json'),
      'utf8',
    ),
  );
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
      .catch(error =>
        // eslint-disable-next-line no-console
        console.error(`Failed to build '${name}': ${error.message}`),
      );
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
    ? Object.keys(
        JSON.parse(fs.readFileSync(packagePath, 'utf8')).dependencies || {},
      ).filter(name => fs.statSync(path.join(modulesPath, name)).isDirectory())
    : await findModules(await findModulesPath());
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
  return fs.existsSync(modulesPath) && fs.statSync(modulesPath).isDirectory()
    ? fs
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
        )
    : [];
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

export default async function bundle() {
  const names = await findBundlableModules();
  for (const name of names) {
    await bundleModule(name);
  }
  for (const name of await findExcessiveESModules(names)) {
    await removeESModule(name);
  }
}
