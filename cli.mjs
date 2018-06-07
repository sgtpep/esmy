#!/bin/sh
':' //#; exec /usr/bin/env node --experimental-modules "$0" "$@"
import bundle from './bundle';
import findNPMPrefix from 'find-npm-prefix';
import fs from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';

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
