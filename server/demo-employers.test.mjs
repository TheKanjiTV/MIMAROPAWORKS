import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, access, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import argon2 from 'argon2';
import { openDatabase, migrateDatabase } from './database.mjs';
import { buildDemoEmployers, assertLocalSeed, inspectDemoSeed, loadDemoCredentials, applyDemoSeed } from './seed-demo-employers.mjs';

async function fixture(t) {
  const folder = await mkdtemp(join(tmpdir(), 'mimaropa-demo-seed-'));
  const db = openDatabase(':memory:');
  await migrateDatabase(db);
  t.after(async () => {
    await db.close();
    const resolvedFolder = resolve(folder);
    assert.ok(resolvedFolder.startsWith(resolve(tmpdir()) + sep + 'mimaropa-demo-seed-'));
    await rm(resolvedFolder, { recursive: true, force: true });
  });
  return { db, credentialsPath: join(folder, 'credentials.csv') };
}

test('demo catalog has 300 distinct companies and recruiters across all five provinces', () => {
  const entries = buildDemoEmployers();
  assert.deepEqual(entries, buildDemoEmployers(), 'identities remain deterministic');
  assert.equal(entries.length, 300);
  for (const project of [entry => entry.id, entry => entry.job.id, entry => entry.name, entry => entry.email, entry => entry.company.company_name])
    assert.equal(new Set(entries.map(project)).size, 300);
  assert.equal(new Set(entries.map(entry => entry.job.title)).size, 60);
  assert.equal(new Set(entries.map(entry => entry.company.industry)).size, 12);
  for (const province of ['Oriental Mindoro', 'Occidental Mindoro', 'Marinduque', 'Romblon', 'Palawan'])
    assert.equal(entries.filter(entry => entry.company.province === province).length, 60);
  for (const entry of entries) {
    assert.equal(entry.id.length, 36);
    assert.equal(entry.job.company_name, entry.company.company_name);
    assert.equal(entry.job.province, entry.company.province);
    assert.equal(entry.job.municipality, entry.company.municipality);
    assert.match(entry.company.description, /DEMO COMPANY/);
    assert.match(entry.job.description, /DEMO VACANCY/);
    assert.ok(entry.company.company_name.length <= 150);
    assert.ok(entry.job.salary_max > entry.job.salary_min);
    assert.ok(entry.job.required_skills.length >= 3);
  }
});

test('local demo guard rejects production, remote MySQL, and network SQLite paths', () => {
  for (const host of ['127.0.0.1', 'localhost', '::1']) assert.doesNotThrow(() => assertLocalSeed({ driver: 'mysql', host }, {}));
  assert.throws(() => assertLocalSeed({ driver: 'mysql', host: '127.0.0.1' }, { NODE_ENV: 'production' }), /production/);
  assert.throws(() => assertLocalSeed({ driver: 'mysql', host: 'db.example.test' }, {}), /local loopback/);
  assert.throws(() => assertLocalSeed({ driver: 'sqlite', filename: '\\\\server\\shared\\data.db' }, {}), /local SQLite/);
  assert.throws(() => assertLocalSeed({ driver: 'sqlite', filename: '//server/shared/data.db' }, {}), /local SQLite/);
  assert.doesNotThrow(() => assertLocalSeed({ driver: 'sqlite', filename: 'C:\\demo\\data.db' }, {}));
});

test('seed inserts 300 linked companies/jobs, signs in, and preserves data on rerun', async (t) => {
  const { db, credentialsPath } = await fixture(t);
  await db.prepare("INSERT INTO users (id,full_name,email,role,created_at,updated_at) VALUES (?,?,?,'employer',?,?)").run('existing-employer', 'Existing Recruiter', 'original@example.test', 1, 1);
  await db.prepare("INSERT INTO employer_profiles (user_id,company_name,industry,province,municipality,contact_person,contact_position,business_email,contact_number,verification_status,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'pending',?)").run('existing-employer', 'Original Company', 'Technology', 'Palawan', 'Coron', 'Existing Recruiter', 'Manager', 'original@example.test', '0000', 1);
  const originalUser = await db.prepare('SELECT * FROM users WHERE id=?').get('existing-employer');
  const originalCompany = await db.prepare('SELECT * FROM employer_profiles WHERE user_id=?').get('existing-employer');
  assert.equal((await inspectDemoSeed(db)).summary.to_create, 300);
  await assert.rejects(access(credentialsPath));
  const result = await applyDemoSeed(db, { credentialsPath });
  assert.equal(result.created, 300);
  assert.equal(result.existing_accounts, 300);
  assert.equal(result.existing_companies, 300);
  assert.equal(result.existing_seed_jobs, 300);
  assert.equal(result.active_seed_jobs, 300);
  const entries = buildDemoEmployers();
  const credentials = await loadDemoCredentials(entries, { path: credentialsPath });
  assert.equal(new Set(credentials.values()).size, 300);
  const first = entries[0];
  const account = await db.prepare('SELECT * FROM users WHERE id=?').get(first.id);
  assert.equal(account.role_selected, 1);
  assert.equal(account.email_verified, 1);
  assert.equal(account.profile_completion, 100);
  assert.ok(await argon2.verify(account.password_hash, credentials.get(first.email)));
  assert.match((await db.prepare('SELECT verification_reason FROM employer_profiles WHERE user_id=?').get(first.id)).verification_reason, /no business documents/);
  assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM employer_documents').get()).count, 0);
  assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM mail_queue').get()).count, 0);

  const origin = 'http://127.0.0.1:5173';
  const { createApp } = await import('./app.mjs');
  const app = await createApp({ db, origin });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const anonymous = await fetch(base + '/auth/session', { headers: { Origin: origin } });
    const { csrf } = await anonymous.json();
    const login = await fetch(base + '/auth/login', { method: 'POST', headers: { Origin: origin, Cookie: anonymous.headers.get('set-cookie').split(';')[0], 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify({ email: first.email, password: credentials.get(first.email) }) });
    assert.equal(login.status, 200);
    const loginData = await login.json();
    assert.equal(loginData.redirect, '/employer/dashboard');
    assert.equal(loginData.user.role, 'employer');
    const jobs = await fetch(base + '/employer/jobs', { headers: { Origin: origin, Cookie: login.headers.get('set-cookie').split(';')[0] } });
    assert.equal(jobs.status, 200);
    const body = await jobs.json();
    assert.equal(body.jobs.length, 1);
    assert.equal(body.jobs[0].id, first.job.id);
    assert.equal(body.jobs[0].status, 'active');
  } finally {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
  await db.prepare("UPDATE jobs SET status='closed' WHERE id=?").run(first.job.id);
  await db.prepare("UPDATE employer_profiles SET verification_status='rejected',verification_reason='Reviewed locally' WHERE user_id=?").run(first.id);
  const credentialsBefore = await readFile(credentialsPath, 'utf8');
  const rerun = await applyDemoSeed(db, { credentialsPath });
  assert.equal(rerun.created, 0);
  assert.equal(rerun.preserved, 300);
  assert.equal(rerun.active_seed_jobs, 299);
  assert.equal(await readFile(credentialsPath, 'utf8'), credentialsBefore);
  assert.deepEqual(await db.prepare('SELECT * FROM users WHERE id=?').get('existing-employer'), originalUser);
  assert.deepEqual(await db.prepare('SELECT * FROM employer_profiles WHERE user_id=?').get('existing-employer'), originalCompany);
  assert.equal((await db.prepare('SELECT password_hash FROM users WHERE id=?').get(first.id)).password_hash, account.password_hash);
  assert.equal((await db.prepare('SELECT verification_status FROM employer_profiles WHERE user_id=?').get(first.id)).verification_status, 'rejected');
});

test('identity collisions and incomplete seed records stop before credential creation', async (t) => {
  const { db, credentialsPath } = await fixture(t);
  const first = buildDemoEmployers()[0];
  await db.prepare('INSERT INTO users (id,full_name,email,role,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('other-owner', 'Existing Name', first.email, 'employer', 1, 1);
  await assert.rejects(applyDemoSeed(db, { credentialsPath }), /identity collision/);
  await assert.rejects(access(credentialsPath));
  assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM users').get()).count, 1);
  await db.prepare('UPDATE users SET id=? WHERE id=?').run(first.id, 'other-owner');
  await assert.rejects(applyDemoSeed(db, { credentialsPath }), /Incomplete seed record/);
  assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM jobs').get()).count, 0);
});

test('insert failure rolls back the entire seed and keeps credentials for a retry', async (t) => {
  const { db, credentialsPath } = await fixture(t);
  const batch = db.batch.bind(db);
  db.batch = (operations) => batch([...operations, { sql: 'INSERT INTO jobs (id) VALUES (?)', params: ['invalid-record'] }]);
  await assert.rejects(applyDemoSeed(db, { credentialsPath }));
  for (const table of ['users', 'employer_profiles', 'jobs'])
    assert.equal((await db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()).count, 0);
  assert.equal((await loadDemoCredentials(buildDemoEmployers(), { path: credentialsPath })).size, 300);
});

test('missing or malformed original credentials are never silently replaced', async (t) => {
  const { credentialsPath } = await fixture(t);
  const entries = buildDemoEmployers();
  await assert.rejects(loadDemoCredentials(entries, { path: credentialsPath }), /original local demo credentials/);
  await writeFile(credentialsPath, 'invalid-file');
  await assert.rejects(loadDemoCredentials(entries, { path: credentialsPath, allowCreate: true }), /header/);
  assert.equal(await readFile(credentialsPath, 'utf8'), 'invalid-file');
});
