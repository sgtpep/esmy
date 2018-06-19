import commonJS from 'rollup-plugin-commonjs';
import findNPMPrefix from 'find-npm-prefix';
import fs from 'fs';
import json from 'rollup-plugin-json';
import nodeResolve from 'rollup-plugin-node-resolve';
import npmPackageArg from 'npm-package-arg';
import path from 'path';
import readline from 'readline';
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
    'process.env.NODE_ENV': JSON.stringify(getEnv()),
  }),
];

async function buildPackage(name) {
  const [packageVersion, packageEnv] = await parseESPackageVersion(name);
  const { version } = JSON.parse(
    fs.readFileSync(await findPackageManifestPath(name), 'utf8'),
  );
  const env = getEnv();
  if (packageVersion !== version || packageEnv !== env) {
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
        banner: `/* version ${version} ${env} */`,
        file: await findESPackagePath(name),
        format: 'es',
        paths: externalPackages.reduce(
          (paths, name) => ({ ...paths, [name]: `../${name}/index.js` }),
          {},
        ),
        sourcemap: true,
      });
    }
  }
}

async function detectBundlablePackages(args) {
  return args.length ? filterPackageArgs(args) : detectDependencies();
}

async function detectDependencies() {
  const manifestPath = path.join(await findPrefixPath(), 'package.json');
  return fs.existsSync(manifestPath)
    ? Object.keys(
        JSON.parse(fs.readFileSync(manifestPath, 'utf8')).dependencies || {},
      ).filter(async name => fs.existsSync(await findPackageManifestPath(name)))
    : [];
}

async function detectExcessiveESPackages() {
  const dependencies = await detectDependencies();
  const names = dependencies.length
    ? dependencies
    : await listPackages(await findPackagesPath());
  return (await listPackages(await findESPackagesPath(), true)).filter(
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

async function findESPackagePath(name) {
  return path.join(await findESPackagesPath(), `${name}.js`);
}

async function findESPackagesPath() {
  return path.join(await findPrefixPath(), 'es_modules');
}

async function findPackageManifestPath(name) {
  return path.join(await findPackagesPath(), name, 'package.json');
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

function getEnv() {
  return process.env.NODE_ENV || defaultEnv;
}

function listPackages(packagesPath, es = false) {
  return fs.existsSync(packagesPath) && fs.statSync(packagesPath).isDirectory()
    ? fs
        .readdirSync(packagesPath)
        .reduce(
          (names, filename) => [
            ...names,
            ...(filename.startsWith('@')
              ? listPackages(path.join(packagesPath, filename), es).map(
                  name => `${filename}/${name}${es ? '.js' : ''}`,
                )
              : [filename]),
          ],
          [],
        )
        .filter(name => {
          const packagePath = path.join(packagesPath, name);
          return es
            ? fs.statSync(packagePath).isFile() &&
                path.extname(packagePath) === '.js'
            : fs.statSync(packagePath).isDirectory() &&
                fs.existsSync(path.join(packagePath, 'package.json'));
        })
        .map(name => (es ? name.replace(/\.js$/, '') : name))
    : [];
}

async function parseESPackageVersion(name) {
  const packagePath = await findESPackagePath(name);
  return fs.existsSync(packagePath)
    ? new Promise((resolve, reject) => {
        let firstLine;
        const stream = readline.createInterface({
          input: fs.createReadStream(packagePath),
        });
        stream.on('close', () =>
          resolve(firstLine.match(/^\/\* version (.+?) (.+?) \*\/$/).slice(1)),
        );
        stream.on('line', line => {
          firstLine = line;
          stream.close();
        });
      })
    : ['', defaultEnv];
}

async function removeESPackage(name) {
  const packagePath = await findESPackagePath(name);
  rimraf.sync(packagePath);
  rimraf.sync(`${packagePath}.map`);
  if (name.startsWith('@')) {
    const namespacePath = path.dirname(packagePath);
    if (
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
