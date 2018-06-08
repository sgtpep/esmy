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
  if (process.argv.length > 2) {
    const [command, ...args] = await detectCommand();
    const { status } = spawnSync(command, [...args, ...process.argv.slice(2)], {
      stdio: 'inherit',
    });
    if (status) {
      process.exit(status);
    }
  }
  await bundle();
}

main();
