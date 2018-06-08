import commonJS from 'rollup-plugin-commonjs';
import findNPMPrefix from 'find-npm-prefix';
import fs from 'fs';
import json from 'rollup-plugin-json';
import nodeResolve from 'rollup-plugin-node-resolve';
import npmPackageArg from 'npm-package-arg';
import path from 'path';
import rimraf from 'rimraf';
import rollup from 'rollup';

const rollupPlugins = [commonJS(), json(), nodeResolve({ jsnext: true })];

async function bundlePackage(name) {
  const esPackagePath = path.join(await findESPackagesPath(), name);
  const versionPath = path.join(esPackagePath, '.version');
  const { version } = JSON.parse(
    fs.readFileSync(
      path.join(await findPackagesPath(), name, 'package.json'),
      'utf8',
    ),
  );
  if (
    !fs.existsSync(versionPath) ||
    fs.readFileSync(versionPath, 'utf8') !== version
  ) {
    const entryPath = await resolvePackageEntry(name);
    if (entryPath) {
      try {
        var bundle = await rollup.rollup({
          input: entryPath,
          onwarn: warning => {
            throw warning;
          },
          plugins: rollupPlugins,
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Failed to build '${name}': ${error.message}`);
      }
      if (bundle) {
        await bundle.write({
          file: path.join(esPackagePath, 'index.js'),
          format: 'es',
          sourcemap: true,
        });
        fs.writeFileSync(versionPath, version);
      } else {
        await removeESPackage(name);
      }
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
  const names = await listPackages(await findPackagesPath());
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

export default async function bundle(args) {
  for (const name of await detectBundlablePackages(args)) {
    await bundlePackage(name);
  }
  for (const name of await detectExcessiveESPackages()) {
    await removeESPackage(name);
  }
}
