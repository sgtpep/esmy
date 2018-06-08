import bundle from './bundle';
import findNPMPrefix from 'find-npm-prefix';
import fs from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';

async function detectCommand() {
  if (
    fs.existsSync(path.join(await findNPMPrefix(process.cwd()), 'yarn.lock'))
  ) {
    return ['yarn', 'add'];
  } else {
    const command =
      process.platform === 'win32' ? 'where yarn' : 'command -v yarn';
    try {
      execSync(command);
    } catch (error) {
      return ['npm', 'install'];
    }
    return ['yarn', 'add'];
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (process.argv.length > 2) {
    const [command, ...commandArgs] = await detectCommand();
    const { status } = spawnSync(command, [...commandArgs, ...args], {
      stdio: 'inherit',
    });
    if (status) {
      process.exit(status);
    }
  }
  await bundle(args);
}

main();
