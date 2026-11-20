const { spawnSync } = require('node:child_process');

// Client builds contain no .env asset; news credentials are server-side only.
const result = spawnSync('flutter', ['build', 'web', '--release'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
