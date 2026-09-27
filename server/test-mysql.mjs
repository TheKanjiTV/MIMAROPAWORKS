import 'dotenv/config';
import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['--test', 'server/auth.test.mjs'], {
  env: { ...process.env, TEST_DB_CONNECTION: 'mysql' },
  stdio: 'inherit',
  windowsHide: true,
});
process.exitCode = result.status ?? 1;
