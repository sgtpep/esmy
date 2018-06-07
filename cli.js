#!/usr/bin/env node
const bundle = require('./bundle');
const findNPMPrefix = require('find-npm-prefix');
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

async function detectCommand() {
  if (fs.existsSync(await findYarnLockPath())) {
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

async function findYarnLockPath() {
  return path.join(await findNPMPrefix(process.cwd()), 'yarn.lock');
}

async function main() {
  if (process.argv.length > 2) {
    spawnSync(await detectCommand(), process.argv.slice(2), {
      stdio: 'inherit',
    });
  }
  await bundle();
}

main();
