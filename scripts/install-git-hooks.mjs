import { chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

try {
  execFileSync('git', ['rev-parse', '--show-toplevel'], { stdio: 'ignore' });
  chmodSync('.githooks/pre-commit', 0o755);
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
    stdio: 'inherit',
  });
  console.log('Git hooks enabled from .githooks/.');
} catch (_error) {
  console.error(
    'Could not enable Git hooks. Run this command from a writable local Git clone.',
  );
  process.exitCode = 1;
}
