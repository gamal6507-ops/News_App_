const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

// Flutter requires this declared asset. Web credentials stay on the API server.
const originalEnv = fs.existsSync('.env') ? fs.readFileSync('.env') : null;
let exitCode = 1;
try {
  fs.writeFileSync('.env', '');
  const result = spawnSync('flutter', ['build', 'web', '--release'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) console.error(result.error.message);
  exitCode = result.status ?? 1;
  if (exitCode === 0) fs.rmSync('build/web/assets/.env', { force: true });
} finally {
  if (originalEnv === null) fs.rmSync('.env', { force: true });
  else fs.writeFileSync('.env', originalEnv);
}
process.exitCode = exitCode;
