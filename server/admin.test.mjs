import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { openDatabase, migrateDatabase } from './database.mjs';
import { ensureAdminSchema, registerAdminRoutes, writeAudit, auditOperation } from './admin.mjs';

async function fixture(t) {
  const db = openDatabase(':memory:');
  await migrateDatabase(db);
  await ensureAdminSchema(db);
  const app = express();
  const authenticated = (req, res, next) => {
    const role = req.headers['x-test-role'];
    if (!role) return res.status(401).json({ message: 'Sign in required.' });
    req.user = { id: 'administrator', role };
    next();
  };
  registerAdminRoutes(app, { db, authenticated });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  });
  const get = async (path, role = 'admin') => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/${path}`, {
      headers: role ? { 'x-test-role': role } : {},
    });
    return { status: response.status, body: await response.json() };
  };
  const now = Date.now();
  const user = (id, role = 'employer', email = `${id}@example.test`) =>
    db
      .prepare(
        'INSERT INTO users (id,full_name,email,password_hash,role,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
      )
      .run(id, `${id} Person`, email, 'private-password-hash', role, now, now);
  const company = (id, status = 'pending', name = `${id} Company`) => {
    user(id, 'employer', id === 'demo' ? 'demo@demo.mimaropa.test' : `${id}@example.test`);
    db.prepare(
      'INSERT INTO employer_profiles (user_id,company_name,industry,province,municipality,contact_person,contact_position,business_email,contact_number,verification_status,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    ).run(
      id,
      name,
      'Technology',
      'Oriental Mindoro',
      'Calapan City',
      `${id} Contact`,
      'Recruiter',
      `${id}@example.test`,
      '09000000000',
      status,
      now,
    );
  };
  const job = (id, employer = 'demo', status = 'active', deadline = null) =>
    db
      .prepare(
        'INSERT INTO jobs (id,employer_id,title,company_name,description,industry,province,municipality,employment_type,work_setup,required_skills,preferred_skills,status,created_at,application_deadline) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      )
      .run(
        id,
        employer,
        `${id} Designer`,
        `${employer} Company`,
        'A local role.',
        'Technology',
        'Oriental Mindoro',
        'Calapan City',
        'Full-time',
        'On-site',
        '[]',
        '[]',
        status,
        now,
        deadline,
      );
  return { db, get, user, company, job, now };
}

test('every admin read endpoint rejects anonymous users and non-admin roles', async (t) => {
  const { get } = await fixture(t);
  for (const endpoint of ['overview', 'companies', 'jobs', 'accounts', 'audit-logs']) {
    assert.equal((await get(endpoint, null)).status, 401, endpoint);
    assert.equal((await get(endpoint, 'employer')).status, 403, endpoint);
    assert.equal((await get(endpoint, 'job_seeker')).status, 403, endpoint);
  }
});

test('overview reports stored totals, real demo attribution and only available jobs in charts', async (t) => {
  const { get, db, user, company, job, now } = await fixture(t);
  user('administrator', 'admin');
  user('seeker', 'job_seeker');
  company('demo', 'verified');
  company('review', 'pending');
  company('declined', 'rejected');
  job('available');
  job('expired', 'demo', 'active', now - 1000);
  job('draft', 'review', 'draft');
  job('unverified', 'review', 'active');
  job('closed', 'demo', 'closed');
  db.prepare(
    'INSERT INTO applications (id,job_id,job_seeker_id,status,match_score,semantic_score,skills_score,location_score,education_score,experience_score,matched_skills,missing_skills,applied_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
  ).run(
    'application',
    'available',
    'seeker',
    'submitted',
    75,
    0.75,
    0.75,
    0.75,
    0.75,
    0.75,
    '[]',
    '[]',
    now,
    now,
  );
  const { status, body } = await get('overview');
  assert.equal(status, 200);
  assert.deepEqual(body.roles, { admin: 1, employer: 3, job_seeker: 1 });
  assert.deepEqual(body.companies, { pending: 1, rejected: 1, verified: 1 });
  assert.deepEqual(body.jobs, { active: 3, closed: 1, draft: 1 });
  assert.deepEqual(body.applications, { submitted: 1 });
  assert.deepEqual(body.demos, { companies: 1, jobs: 3 });
  assert.equal(body.provinces[0].count, 2);
  assert.deepEqual(body.health, { expiredJobs: 1, unverifiedJobs: 1, missingDocuments: 1 });
  assert.equal(body.activity.length, 30);
  assert.equal(
    body.activity.reduce((sum, day) => sum + day.accounts, 0),
    5,
  );
  assert.equal(
    body.activity.reduce((sum, day) => sum + day.jobs, 0),
    5,
  );
  assert.equal(
    body.activity.reduce((sum, day) => sum + day.applications, 0),
    1,
  );
});

test('company filters preserve pending, verified and rejected; search escapes wildcard input and paginates', async (t) => {
  const { company, get } = await fixture(t);
  company('pending1', 'pending', '100% Local Company');
  company('pending2');
  company('demo', 'verified');
  company('declined', 'rejected');
  for (const [status, total] of [
    ['pending', 2],
    ['verified', 1],
    ['rejected', 1],
    ['all', 4],
  ]) {
    assert.equal((await get(`companies?status=${status}`)).body.total, total);
  }
  const limited = (await get('companies?status=all&limit=1&page=2')).body;
  assert.equal(limited.items.length, 1);
  assert.equal(limited.page, 2);
  assert.equal(limited.total, 4);
  const literalPercent = (await get('companies?status=all&q=%25')).body;
  assert.equal(literalPercent.total, 1);
  assert.equal(literalPercent.items[0].company_name, '100% Local Company');
  assert.equal((await get('companies?status=all&q=%27%20OR%201%3D1--')).body.total, 0);
  assert.equal((await get('companies?status=invalid')).status, 400);
  assert.equal((await get('companies?limit=900')).body.limit, 50);
  assert.equal((await get('companies?page=99999')).body.page, 1);
});

test('account and job registries are filtered and expose no credentials or private profile fields', async (t) => {
  const { get, user, company, job } = await fixture(t);
  user('administrator', 'admin');
  user('seeker', 'job_seeker');
  company('demo', 'verified');
  job('open');
  job('draft', 'demo', 'draft');
  const accounts = (await get('accounts?role=employer&q=demo')).body;
  assert.equal(accounts.total, 1);
  assert.equal(accounts.items[0].is_demo, 1);
  assert.equal('password_hash' in accounts.items[0], false);
  assert.equal('google_id' in accounts.items[0], false);
  const jobs = (await get('jobs?status=draft&q=Designer')).body;
  assert.equal(jobs.total, 1);
  assert.equal(jobs.items[0].id, 'draft');
  assert.equal('normalized_job_text' in jobs.items[0], false);
  assert.equal((await get('jobs?status=invalid')).status, 400);
  assert.equal((await get('accounts?role=owner')).status, 400);
});

test('audit log starts empty and stores only allowlisted metadata with searchable actions', async (t) => {
  const { get, db, user } = await fixture(t);
  user('administrator', 'admin');
  await ensureAdminSchema(db);
  assert.equal((await get('audit-logs')).body.total, 0);
  await writeAudit(db, {
    actorId: 'administrator',
    action: 'company.verified',
    entityType: 'company',
    entityId: 'demo',
    details: {
      companyName: 'Example Company',
      status: 'verified',
      password: 'DO-NOT-EXPOSE',
      token: 'secret-token',
      documentPath: '/private/path',
      nested: { secret: 'hidden' },
    },
  });
  await writeAudit(db, {
    action: 'job.created',
    entityType: 'job',
    entityId: 'job',
    details: { title: 'Designer' },
  });
  const result = (await get('audit-logs?action=company.verified&q=Example')).body;
  assert.equal(result.total, 1);
  assert.equal(result.items[0].actor_name, 'administrator Person');
  assert.deepEqual(result.items[0].details, { companyName: 'Example Company', status: 'verified' });
  const stored = db
    .prepare('SELECT details FROM admin_audit_logs WHERE action=?')
    .get('company.verified');
  assert.equal(stored.details.includes('DO-NOT-EXPOSE'), false);
  assert.equal((await get('audit-logs?limit=1')).body.items.length, 1);
  db.prepare('UPDATE admin_audit_logs SET details=? WHERE action=?').run(
    JSON.stringify({ title: 'Designer', token: 'historical-secret' }),
    'job.created',
  );
  assert.deepEqual((await get('audit-logs?action=job.created')).body.items[0].details, {
    title: 'Designer',
  });
});

test('audit operation can participate in atomic mutation batches', async (t) => {
  const { db, user, get } = await fixture(t);
  user('administrator', 'admin');
  const event = auditOperation({
    actorId: 'administrator',
    action: 'company.verified',
    entityType: 'company',
    entityId: 'missing',
  });
  assert.throws(() =>
    db.batch([
      event,
      {
        sql: 'UPDATE users SET account_status=? WHERE id=?',
        params: ['active', 'missing'],
        requireChanges: 1,
      },
    ]),
  );
  assert.equal((await get('audit-logs')).body.total, 0);
});
