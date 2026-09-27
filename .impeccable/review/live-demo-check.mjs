import 'dotenv/config';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { connectDatabase } from '../../server/database.mjs';
import { buildDemoEmployers, loadDemoCredentials } from '../../server/seed-demo-employers.mjs';
import { ensureAdminSchema, writeAudit } from '../../server/admin.mjs';
const entries = buildDemoEmployers(), entry = entries[0];
const credentials = await loadDemoCredentials(entries);
const base = 'http://127.0.0.1:3001/api', origin = 'http://127.0.0.1:5173';
let cookie = '', csrf = '';
async function call(path, body) {
  const res = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { Origin: origin, Cookie: cookie, ...(body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
  const data = await res.json();
  if (data.csrf) csrf = data.csrf;
  assert.equal(res.status, 200, `HTTP ${res.status} for ${path}`);
  return data;
}
await call('/auth/session');
const login = await call('/auth/login', { email: entry.email, password: credentials.get(entry.email) });
assert.equal(login.redirect, '/employer/dashboard');
const own = await call('/employer/jobs');
assert.equal(own.jobs.length, 1);
const jobs = await call('/discovery/jobs');
assert.equal(jobs.jobs.length, 300);
const directory = await call('/discovery/companies');
assert.equal(directory.companies.length, 301);
const detail = await call('/discovery/companies/' + entry.id);
assert.equal(detail.jobs.length, 1);
await call('/auth/logout', {});
const db = await connectDatabase();
try {
  await ensureAdminSchema(db);
  if (!await db.prepare("SELECT id FROM admin_audit_logs WHERE action='demo.seeded' AND entity_id='local-demo-employers-v1'").get())
    await writeAudit(db, { action: 'demo.seeded', entityType: 'dataset', entityId: 'local-demo-employers-v1', details: { count: 300, source: 'Local employer seed completed and verified', status: 'active' } });
} finally { await db.close(); }
const report = { employerLogin: 'passed', ownJobs: own.jobs.length, discoverableJobs: jobs.jobs.length, discoverableCompanies: directory.companies.length, linkedCompanyJob: 'passed', signOut: 'passed' };
await writeFile('.impeccable/review/live-demo-results.json', JSON.stringify(report, null, 2));
console.log(report);
