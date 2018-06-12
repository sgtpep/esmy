import commonJS from 'rollup-plugin-commonjs';
import findNPMPrefix from 'find-npm-prefix';
import fs from 'fs';
import json from 'rollup-plugin-json';
import nodeResolve from 'rollup-plugin-node-resolve';
import npmPackageArg from 'npm-package-arg';
import path from 'path';
import replace from 'rollup-plugin-replace';
import rimraf from 'rimraf';
import rollup from 'rollup';

const defaultEnv = 'development';
const externalPackages = ['jquery', 'react'];

const rollupPlugins = [
  commonJS(),
  json(),
  nodeResolve({ jsnext: true }),
  replace({
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || defaultEnv),
  }),
];

async function buildPackage(name) {
  const packagePath = path.join(await findESPackagesPath(), name);
  const versionPath = path.join(packagePath, '.version');
  const version = fs.existsSync(versionPath)
    ? fs.readFileSync(versionPath, 'utf8')
    : '';
  const requiredVersion = JSON.parse(
    fs.readFileSync(
      path.join(await findPackagesPath(), name, 'package.json'),
      'utf8',
    ),
  ).version;
  const envPath = path.join(packagePath, '.node_env');
  const env = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, 'utf8')
    : defaultEnv;
  const requiredEnv = process.env.NODE_ENV || defaultEnv;
  if (version !== requiredVersion || env !== requiredEnv) {
    const entryPath = await resolvePackageEntry(name);
    if (entryPath) {
      try {
        var optionalPlugins = [
          require('rollup-plugin-node-builtins'),
          require('rollup-plugin-node-globals'),
        ];
      } catch (error) {
        optionalPlugins = [];
      }
      await (await rollup.rollup({
        external: externalPackages,
        input: entryPath,
        plugins: [...rollupPlugins, ...optionalPlugins],
      })).write({
        file: path.join(packagePath, 'index.js'),
        format: 'es',
        paths: externalPackages.reduce(
          (paths, name) => ({ ...paths, [name]: `../${name}/index.js` }),
          {},
        ),
        sourcemap: true,
      });
      fs.writeFileSync(versionPath, version);
      requiredEnv === defaultEnv
        ? rimraf.sync(envPath)
        : fs.writeFileSync(envPath, requiredEnv);
    }
  }
}

async function detectBundlablePackages(args) {
  return args.length ? filterPackageArgs(args) : detectDependencies();
}

async function detectDependencies() {
  const manifestPath = path.join(await findPrefixPath(), 'package.json');
  const packagesPath = await findPackagesPath();
  return fs.existsSync(manifestPath)
    ? Object.keys(
        JSON.parse(fs.readFileSync(manifestPath, 'utf8')).dependencies || {},
      ).filter(name =>
        fs.existsSync(path.join(packagesPath, name, 'package.json')),
      )
    : [];
}

async function detectExcessiveESPackages() {
  const dependencies = await detectDependencies();
  const names = dependencies.length
    ? dependencies
    : await listPackages(await findPackagesPath());
  return (await listPackages(await findESPackagesPath())).filter(
    name => !names.includes(name),
  );
}

function filterPackageArgs(args) {
  return args
    .map(arg => {
      try {
        var { name } = npmPackageArg(arg);
      } catch (error) {
        return;
      }
      return name;
    })
    .filter(Boolean);
}

async function findESPackagesPath() {
  return path.join(await findPrefixPath(), 'es_modules');
}

async function findPackagesPath() {
  return path.join(await findPrefixPath(), 'node_modules');
}

async function findPrefixPath() {
  if (!findPrefixPath.prefixPath) {
    findPrefixPath.prefixPath = await findNPMPrefix(process.cwd());
  }
  return findPrefixPath.prefixPath;
}

async function listPackages(packagesPath) {
  return fs.existsSync(packagesPath) && fs.statSync(packagesPath).isDirectory()
    ? fs
        .readdirSync(packagesPath)
        .filter(
          filename =>
            !filename.startsWith('.') &&
            fs.statSync(path.join(packagesPath, filename)).isDirectory(),
        )
        .reduce(
          (names, name) => [
            ...names,
            ...(name.startsWith('@')
              ? fs
                  .readdirSync(path.join(packagesPath, name))
                  .map(subname => `${name}/${subname}`)
              : [name]),
          ],
          [],
        )
    : [];
}

async function removeESPackage(name) {
  const packagesPath = await findESPackagesPath();
  rimraf.sync(path.join(packagesPath, name));
  if (name.startsWith('@')) {
    const namespacePath = path.join(packagesPath, path.dirname(name));
    if (
      fs.existsSync(namespacePath) &&
      fs.statSync(namespacePath).isDirectory() &&
      !fs.readdirSync(namespacePath).length
    ) {
      fs.rmdirSync(namespacePath);
    }
  }
}

async function resolvePackageEntry(name) {
  return rollupPlugins
    .find(plugin => plugin.name === 'node-resolve')
    .resolveId(name, await findPackagesPath());
}

export default async function build(args) {
  for (const name of await detectBundlablePackages(args)) {
    await buildPackage(name);
  }
  for (const name of await detectExcessiveESPackages()) {
    await removeESPackage(name);
  }
}
