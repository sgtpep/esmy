# esmy

[![Build Status](https://travis-ci.com/sgtpep/esmy.svg)](https://travis-ci.com/sgtpep/esmy)
[![npm Package](https://img.shields.io/npm/v/esmy.svg?colorB=44cc11)](https://www.npmjs.com/package/esmy)
[![License](https://img.shields.io/badge/license-ISC-brightgreen.svg)](https://opensource.org/licenses/ISC)

Converts npm packages to native [ES6 modules](http://exploringjs.com/es6/ch_modules.html) which can be imported directly from browsers without bundlers and transpilers.

For example, to install the `react` package as a browser-compatible ES6 module run this command: `npx esmy react`, or: `yarn create esmy react`. The file `./es_modules/react/index.js` will be created. Modern browsers can import it like this:

```html
<script type="module">
import React from './es_modules/react/index.js';
console.log(React);
</script>
```

## Usage

TODO
