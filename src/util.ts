import { ChildProcess, fork } from 'child_process';
import path from 'path';
import { ChildProcessConfig } from './common';

const modulePath = path.resolve(__dirname, './scripts/start_instance.js');

export const forkChild = async (
  topic: string,
  tasksPath: string,
  childProcessConfig?: ChildProcessConfig
) => {
  if (!childProcessConfig) {
    throw new Error('Config to fork child processes is missing');
  }
  return new Promise<ChildProcess>(resolve => {
    const child = fork(modulePath, [topic], {
      env: {
        ...process.env,
        INSTANCE: childProcessConfig.instancePath,
        TASKS: tasksPath,
      },
      execArgv: childProcessConfig.args ?? [],
      stdio: 'inherit',
    });
    resolve(child);
  });
};
