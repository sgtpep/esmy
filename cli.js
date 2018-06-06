#!/usr/bin/env node
const findNPMPrefix = require('find-npm-prefix');
const fs = require('fs');
const path = require('path');
const sync = require('.');
const { execSync, spawnSync } = require('child_process');

async function detectCommand() {
  const prefix = await findNPMPrefix(process.cwd());
  if (fs.existsSync(path.join(prefix, 'yarn.lock'))) {
    return 'yarn';
  } else {
    try {
      execSync(process.platform === 'win32' ? 'where yarn' : 'command -v yarn');
    } catch (error) {
      return 'npm';
    }
    return 'yarn';
  }
}

async function main() {
  if (process.argv.length > 2) {
    const command = await detectCommand();
    spawnSync(command, process.argv.slice(2), { stdio: 'inherit' });
  }
  sync();
}

main();
