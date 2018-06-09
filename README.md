# esmy

[![Build Status](https://travis-ci.com/sgtpep/esmy.svg)](https://travis-ci.com/sgtpep/esmy)
[![npm Package](https://img.shields.io/npm/v/esmy.svg?colorB=44cc11)](https://www.npmjs.com/package/esmy)
[![License](https://img.shields.io/badge/license-ISC-brightgreen.svg)](https://opensource.org/licenses/ISC)

Converts npm packages to native [ES6 modules](http://exploringjs.com/es6/ch_modules.html) which can be imported directly from modern browsers without bundlers and transpilers.

For example, to install the `react` package as a browser-compatible ES6 module run this command: `npx esmy react`, or: `yarn create esmy react`. The file `./es_modules/react/index.js` will be created. Modern browsers can import it like this:

```html
<script type="module">
import React from './es_modules/react/index.js';
console.log(React);
</script>
```

## Why

All modern browsers now [support](https://caniuse.com/#feat=es6-module) importing ES6 modules within `<script type="module">`. They also support most of other ES6+ features. So it makes feasable to get rid of the bloat of bundlers and transpilers at least during development.

Also it's tempting to use the [npm](https://www.npmjs.com/) package registry as the largest source of third-party JavaScript code. But at the moment of writing most of its packages are provided in the CommonJS format which is incompatible with ES6 modules. Although some of them are distributed as ES6 modules as well, package authors assume that they will be used in conjunction with bundles like [webpack](https://webpack.js.org/) which are not strictly compatible with browsers' implementation of ES6 modules (e.g. extensions in `import`s may be ommitted: `import './foo'`, or there may be 'unqualified' imports from `node_modules` or Node.js packages: `import 'foo'`, etc.)

`esmy` solves this problem trying to build browser-compatible ES6 modules from npm packages on install time with the help of the [Rollup](https://rollupjs.org/guide/en) bundler.

This project was inspired by [jspm.io](https://jspm.io/) (not to be confused with the seemed to be obsolete [jspm](https://jspm.org/) package manager) which provides CDN for browser-compatible ES6 modules compiled from npm packages.

## Usage

To quickly install npm packages as browser-compatible ES6 modules, without installing `esmy` itself, run (if you have `npm >= 5.2.0` installed):

```shell
npx esmy react
```

Or if you prefer `yarn` and have it installed:

```shell
yarn create esmy react
```

If you have a project with `package.json` and want to declare browser-compatible ES6 modules as dependencies than install `esmy` as a development dependency either using yarn:

```shell
yarn add -D esmy
```

or using npm:

```shell
npm install -D esmy
```

It will install the `esmy` command locally which can be run using one of these commands: `yarn esmy`, `npx esmy`, or `./node_modules/.bin/esmy`.

Than add the `esmy` command to the `"install"` script entry of `package.json`:

```json
{
  "scripts": {
    "install": "esmy"
  }
}
```

It will build browser-compatible ES6 modules from npm packages declared in the `"dependencies"` section in `package.json` and put them in the `./es_modules` directory every time `yarn install` or `npm install` is performed.

If you pass any arguments to the `esmy` command it will first try to run `yarn` with these arguments if it's available, otherwise it will run `npm` with them. So you can pass any arguments (or options) `yarn` or `npm` understand.

## Special cases

Some npm packages (like `react`) rely on the `NODE_ENV` environment variable to provide different beheviour under different environments like `development` or `production`. `esmy` builds them with `NODE_ENV=development` by default. You can override it (if you need to) passing an actual environment variable `NODE_ENV` like this:

```shell
NODE_ENV=production esmy react
```

Some npm packages use the [Node.js](https://nodejs.org/) [standard library](https://nodejs.org/api/index.html) which is not available in browsers and needs to be polyfilled. To make `esmy` build them install npm packages `rollup-plugin-node-builtins` and `rollup-plugin-node-globals` as development dependencies and run `esmy` locally which will use these plugins on build. Note that not all standard Node.js modules can be polyfilled, see (rollup-plugin-node-builtins's readme)(https://github.com/calvinmetcalf/rollup-plugin-node-builtins/blob/master/readme.md) for details.
