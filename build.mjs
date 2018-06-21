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

const env = process.env.NODE_ENV || 'development';
const externalPackages = ['jquery', 'react'];

const rollupPlugins = [
  commonJS(),
  json(),
  nodeResolve({ jsnext: true }),
  replace({
    'process.env.NODE_ENV': JSON.stringify(env),
  }),
];

const buildPackage = async name => {
  const [packageVersion, packageEnv] = await parseESPackageVersion(name);
  const { version } = JSON.parse(
    fs.readFileSync(await findPackageManifestPath(name), 'utf8'),
  );
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
};

const detectBundlablePackages = async args =>
  args.length ? filterPackageArgs(args) : detectDependencies();

const detectDependencies = async () => {
  const manifestPath = path.join(await findPrefixPath(), 'package.json');
  return fs.existsSync(manifestPath)
    ? Object.keys(
        JSON.parse(fs.readFileSync(manifestPath, 'utf8')).dependencies || {},
      ).filter(async name => fs.existsSync(await findPackageManifestPath(name)))
    : [];
};

const detectExcessiveESPackages = async () => {
  const dependencies = await detectDependencies();
  const names = dependencies.length
    ? dependencies
    : await listPackages(await findPackagesPath());
  return (await listPackages(await findESPackagesPath(), true)).filter(
    name => !names.includes(name),
  );
};

const filterPackageArgs = args =>
  args
    .map(arg => {
      try {
        var { name } = npmPackageArg(arg);
      } catch (error) {
        return;
      }
      return name;
    })
    .filter(Boolean);

const findESPackagePath = async name =>
  path.join(await findESPackagesPath(), `${name}.js`);

const findESPackagesPath = async () =>
  path.join(await findPrefixPath(), 'es_modules');

const findPackageManifestPath = async name =>
  path.join(await findPackagesPath(), name, 'package.json');

const findPackagesPath = async () =>
  path.join(await findPrefixPath(), 'node_modules');

const findPrefixPath = async () => {
  if (!findPrefixPath.prefixPath) {
    findPrefixPath.prefixPath = await findNPMPrefix(process.cwd());
  }
  return findPrefixPath.prefixPath;
};

const listPackages = (packagesPath, es = false) =>
  fs.existsSync(packagesPath) && fs.statSync(packagesPath).isDirectory()
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

const parseESPackageVersion = async name => {
  const packagePath = await findESPackagePath(name);
  return fs.existsSync(packagePath)
    ? new Promise(resolve => {
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
    : ['', 'development'];
};

const removeESPackage = async name => {
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
};

const resolvePackageEntry = async name =>
  rollupPlugins
    .find(plugin => plugin.name === 'node-resolve')
    .resolveId(name, await findPackagesPath());

export default async args => {
  for (const name of await detectBundlablePackages(args)) {
    await buildPackage(name);
  }
  for (const name of await detectExcessiveESPackages()) {
    await removeESPackage(name);
  }
};
