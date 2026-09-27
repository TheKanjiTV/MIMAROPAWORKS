import 'dotenv/config';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { connectDatabase, databaseConfig } from '../../server/database.mjs';
import { applyDemoSeed, assertLocalSeed } from '../../server/seed-demo-employers.mjs';
const config = databaseConfig();
assertLocalSeed(config);
const db = await connectDatabase(config);
try {
  const originalUsers = await db.prepare("SELECT * FROM users WHERE email NOT LIKE '%@demo.mimaropa.test' ORDER BY id").all();
  const originalCompanies = await db.prepare("SELECT p.* FROM employer_profiles p JOIN users u ON u.id=p.user_id WHERE u.email NOT LIKE '%@demo.mimaropa.test' ORDER BY p.user_id").all();
  const result = await applyDemoSeed(db);
  assert.deepEqual(await db.prepare("SELECT * FROM users WHERE email NOT LIKE '%@demo.mimaropa.test' ORDER BY id").all(), originalUsers);
  assert.deepEqual(await db.prepare("SELECT p.* FROM employer_profiles p JOIN users u ON u.id=p.user_id WHERE u.email NOT LIKE '%@demo.mimaropa.test' ORDER BY p.user_id").all(), originalCompanies);
  const rerun = await applyDemoSeed(db);
  assert.equal(rerun.created, 0);
  const counts = await db.prepare('SELECT (SELECT COUNT(*) FROM users) AS accounts,(SELECT COUNT(*) FROM employer_profiles) AS companies,(SELECT COUNT(*) FROM jobs) AS jobs').get();
  const report = { result, rerun, counts, originalAccountsPreserved: originalUsers.length, originalCompaniesPreserved: originalCompanies.length };
  await writeFile('.impeccable/review/seed-local-results.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await db.close(); }
