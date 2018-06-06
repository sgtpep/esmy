const findNPMPrefix = require('find-npm-prefix');
const fs = require('fs');
const path = require('path');

module.exports = async function sync() {
  const prefix = await findNPMPrefix(process.cwd());
  const modulesPath = path.join(prefix, 'node_modules');
  if (fs.existsSync(modulesPath)) {
    for (const filename of fs.readdirSync(modulesPath)) {
      const modulePath = path.join(modulesPath, filename);
      if (fs.statSync(modulePath).isDirectory()) {
        console.log(modulePath);
      }
    }
  }
};
