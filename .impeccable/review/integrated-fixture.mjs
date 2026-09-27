import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { openDatabase, migrateDatabase } from '../../server/database.mjs';
import { createApp, digest } from '../../server/app.mjs';
import { buildDemoEmployers } from '../../server/seed-demo-employers.mjs';
import { writeAudit } from '../../server/admin.mjs';
import { profile } from './fixtures.mjs';

export async function startQa() {
  const db = openDatabase(':memory:');
  await migrateDatabase(db);
  const now = Date.now();
  const insert = (table, object) => {
    const columns = Object.keys(object);
    return db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...columns.map((key) => object[key]));
  };
  const user = (id, role, name, email = `${id}@demo.mimaropa.test`) => insert('users', { id, role, full_name: name, email, role_selected: 1, profile_completion: 100, email_verified: 1, created_at: now, updated_at: now });
  user('qa-seeker', 'job_seeker', 'Maria Santos');
  user('qa-admin', 'admin', 'QA Administrator');
  const p = { ...profile, municipality: 'Calapan City' };
  insert('profiles', { user_id: 'qa-seeker', province: p.province, municipality: p.municipality, education: p.education, skills: p.skills.join(', '), preferred_job: p.preferred_job, work_setup: p.work_setup, step: 2 });
  insert('job_seeker_profiles', { user_id: 'qa-seeker', data: JSON.stringify(p), normalized_profile_text: `Customer support ${p.skills.join(' ')}`, completed: 1, onboarding_step: 5, updated_at: now });
  for (const entry of buildDemoEmployers()) {
    user(entry.id, 'employer', entry.name, entry.email);
    insert('employer_profiles', { user_id: entry.id, ...entry.company, verification_status: 'verified', verification_reason: 'Fictional local QA company; no documents reviewed.', updated_at: now });
    insert('jobs', { ...entry.job, required_skills: JSON.stringify(entry.job.required_skills), preferred_skills: JSON.stringify(entry.job.preferred_skills), employer_id: entry.id, status: 'active', created_at: now - (entry.number % 30) * 86400000, updated_at: now });
  }
  user('qa-pending', 'employer', 'Pending Recruiter');
  insert('employer_profiles', { user_id: 'qa-pending', company_name: 'QA Company Awaiting Review', industry: 'Services', province: 'Palawan', municipality: 'Coron', contact_person: 'Pending Recruiter', contact_position: 'Manager', business_email: 'qa-pending@demo.mimaropa.test', contact_number: '0000', verification_status: 'pending', updated_at: now });
  const sessions = {};
  for (const role of ['seeker', 'admin']) {
    const token = randomBytes(32).toString('hex'), csrf = randomBytes(32).toString('hex');
    insert('sessions', { token_hash: digest(token), csrf, user_id: `qa-${role}`, expires_at: now + 3600000 });
    sessions[role] = { token, csrf };
  }
  const app = await createApp({ db, origin: 'http://127.0.0.1:5173', aiServiceUrl: '' });
  await writeAudit(db, { action: 'demo.seeded', entityType: 'dataset', details: { count: 300, source: 'Isolated QA fixture' } });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    db, sessions, base: `http://127.0.0.1:${server.address().port}`,
    async close() { server.closeAllConnections(); await new Promise((done) => server.close(done)); db.close(); },
  };
}

export async function attachQa(context, fixture, role) {
  await context.addCookies([{ name: 'innohack_session', value: fixture.sessions[role].token, domain: '127.0.0.1', path: '/' }]);
  await context.route('https://**', (route) => route.abort());
  await context.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: fixture.base + url.pathname + url.search });
    await route.fulfill({ response });
  });
}
