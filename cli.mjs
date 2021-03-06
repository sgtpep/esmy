import build from './build';
import findNPMPrefix from 'find-npm-prefix';
import fs from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';

const detectCommand = async () => {
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
};

const main = async () => {
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
  await build(args);
};

main();
