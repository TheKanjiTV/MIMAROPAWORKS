import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { openDatabase, connectDatabase, createDatabase, databaseConfig, migrateDatabase } from './database.mjs';
import { createApp, hashPassword } from './app.mjs';

const origin = 'http://127.0.0.1:5173';
const testPassword = 'Professional Profile Test 2026!';
const profilePath = '/job-seeker/professional-profile';

async function fixture(t) {
  const mysqlTest = process.env.TEST_DB_CONNECTION === 'mysql';
  const testDatabase = `innohack_profile_test_${randomUUID().replaceAll('-', '')}`;
  const config = databaseConfig({ ...process.env, DB_CONNECTION: 'mysql', DB_DATABASE: testDatabase });
  if (mysqlTest) await createDatabase(config);
  const db = mysqlTest ? await connectDatabase(config) : openDatabase(':memory:');
  let server;
  t.after(async () => {
    try {
      if (server) {
        server.closeAllConnections();
        await new Promise((done) => server.close(done));
      }
      if (mysqlTest) {
        assert.match(testDatabase, /^innohack_profile_test_[a-f0-9]{32}$/);
        assert.equal(config.database, testDatabase, 'Cleanup must target only this isolated test database');
        await db.exec(`DROP DATABASE \`${testDatabase}\``);
      }
    } finally {
      await db.close();
    }
  });
  await migrateDatabase(db);
  const app = await createApp({ db, origin, aiServiceUrl: '' });
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const client = () => {
    let cookie = '';
    let csrf = '';
    return {
      async call(path, body, method = 'PUT') {
        const response = await fetch(base + path, {
          method: body === undefined ? 'GET' : method,
          headers: {
            Origin: origin, Cookie: cookie,
            ...(body === undefined ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) cookie = setCookie.split(';')[0];
        const data = await response.json();
        if (data.csrf) csrf = data.csrf;
        return { status: response.status, data };
      },
    };
  };
  const seedSeeker = async (label) => {
    const id = randomUUID();
    const email = `${label}@example.test`;
    const now = Date.now();
    const data = {
      about: `${label} original introduction`, course: 'Business Studies', recent_job_title: 'Office Assistant',
      experience_snippets: ['Kept office records.'], experience_years: 1, career_interests: ['Administration'],
      province: 'Oriental Mindoro', municipality: 'Calapan City', education: 'Senior High School',
      preferred_job: 'Administrative Assistant', work_setup: 'On-site', skills: ['Microsoft Office'],
    };
    await db.prepare('INSERT INTO users (id,full_name,email,password_hash,email_verified,role,role_selected,profile_completion,account_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(id, `${label} Test Seeker`, email, await hashPassword(testPassword), 1, 'job_seeker', 1, 100, 'active', now, now);
    await db.prepare('INSERT INTO profiles (user_id,province,municipality,education,skills,preferred_job,work_setup,step) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, data.province, data.municipality, data.education, data.skills.join(', '), data.preferred_job, data.work_setup, 2);
    await db.prepare('INSERT INTO job_seeker_profiles (user_id,data,normalized_profile_text,resume_text,onboarding_step,completed,updated_at) VALUES (?,?,?,?,?,?,?)')
      .run(id, JSON.stringify(data), 'Administrative Assistant with Microsoft Office skills', `${label} private parsed resume text`, 6, 1, now);
    const resumeId = randomUUID();
    await db.prepare('INSERT INTO resumes (id,user_id,storage_path,original_filename,file_size,parsing_status,analysis,uploaded_at,parsed_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(resumeId, id, `server/data/resumes/${resumeId}.pdf`, `${label}-resume.pdf`, 2048, 'completed', JSON.stringify({ resume_text: `${label} private document analysis`, detected_skills: ['Microsoft Office'] }), now, now);
    const session = client();
    assert.equal((await session.call('/auth/session')).status, 200);
    assert.equal((await session.call('/auth/login', { email, password: testPassword }, 'POST')).status, 200);
    return { id, email, data, resumeId, session };
  };
  return { db, client, seedSeeker };
}

test('professional profile saves Associate Degree and editable fields without changing resume or authentication', async (t) => {
  const { db, seedSeeker } = await fixture(t);
  const owner = await seedSeeker('profile-owner');
  const authBefore = await db.prepare('SELECT * FROM users WHERE id=?').get(owner.id);
  const resumeBefore = await db.prepare('SELECT * FROM resumes WHERE id=?').get(owner.resumeId);
  const parsedBefore = await db.prepare('SELECT resume_text,onboarding_step,completed FROM job_seeker_profiles WHERE user_id=?').get(owner.id);
  const before = await owner.session.call(profilePath);
  assert.equal(before.status, 200);
  assert.equal(before.data.profile.resume.id, owner.resumeId);
  assert.equal(before.data.profile.resume.original_filename, 'profile-owner-resume.pdf');
  assert.equal(before.data.profile.resume.storage_path, undefined);
  assert.equal(before.data.profile.resume.analysis, undefined);
  assert.equal(before.data.profile.resume_text, undefined);
  assert.equal(before.data.profile.password_hash, undefined);

  // Mirrors the frontend's explicit editable payload, excluding GET-only resume metadata.
  const editable = {
    preferred_job: 'Customer Service Associate',
    about: 'I support local customers and keep accurate service records.',
    education: 'Associate Degree', course: 'Associate in Information Technology',
    province: 'Oriental Mindoro', municipality: 'Calapan City', work_setup: 'Hybrid',
    skills: ['customer support', 'excel', 'Communication'], recent_job_title: 'Customer Support Assistant',
    experience_years: 2, experience_snippets: ['Resolved service requests and maintained weekly reports.'],
    career_interests: ['Customer Service', 'Information Technology'],
  };
  const saved = await owner.session.call(profilePath, editable);
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  const reloaded = await owner.session.call(profilePath);
  assert.equal(reloaded.status, 200);
  for (const [key, value] of Object.entries(editable)) {
    if (key === 'skills') assert.deepEqual(reloaded.data.profile.skills, ['Customer Service', 'Microsoft Excel', 'Communication']);
    else assert.deepEqual(reloaded.data.profile[key], value, `${key} must persist after reload`);
  }
  assert.deepEqual(saved.data.profile, reloaded.data.profile);
  assert.deepEqual(reloaded.data.profile.resume, before.data.profile.resume);
  assert.deepEqual(await db.prepare('SELECT * FROM resumes WHERE id=?').get(owner.resumeId), resumeBefore);
  assert.deepEqual(await db.prepare('SELECT * FROM users WHERE id=?').get(owner.id), authBefore);
  assert.deepEqual(await db.prepare('SELECT resume_text,onboarding_step,completed FROM job_seeker_profiles WHERE user_id=?').get(owner.id), parsedBefore);
  const base = await db.prepare('SELECT * FROM profiles WHERE user_id=?').get(owner.id);
  assert.equal(base.education, 'Associate Degree');
  assert.equal(base.skills, 'Customer Service, Microsoft Excel, Communication');
  const stored = await db.prepare('SELECT data,normalized_profile_text FROM job_seeker_profiles WHERE user_id=?').get(owner.id);
  assert.equal(JSON.parse(stored.data).resume, undefined, 'Read-only resume metadata must not be copied into editable profile data');
  assert.match(stored.normalized_profile_text, /Education: Associate Degree in Associate in Information Technology/);
  assert.match(stored.normalized_profile_text, /Experience Years: 2/);
  const authenticated = await owner.session.call('/auth/session');
  assert.equal(authenticated.data.user.id, owner.id);
  assert.equal(authenticated.data.user.role, 'job_seeker');
  assert.equal(authenticated.data.user.email, owner.email);
});

test('professional profile rejects read-only fields atomically and isolates two owners', async (t) => {
  const { db, client, seedSeeker } = await fixture(t);
  const owner = await seedSeeker('first-owner');
  const other = await seedSeeker('second-owner');
  const snapshot = async (id) => ({
    auth: await db.prepare('SELECT * FROM users WHERE id=?').get(id),
    base: await db.prepare('SELECT * FROM profiles WHERE user_id=?').get(id),
    professional: await db.prepare('SELECT * FROM job_seeker_profiles WHERE user_id=?').get(id),
    resumes: await db.prepare('SELECT * FROM resumes WHERE user_id=?').all(id),
  });
  const ownerBefore = await snapshot(owner.id);
  const otherBefore = await snapshot(other.id);
  const profile = (await owner.session.call(profilePath)).data.profile;
  // A raw GET response used to be sent by the editor. The server must keep refusing
  // its read-only metadata rather than weakening the write allowlist.
  assert.equal((await owner.session.call(profilePath, { ...profile, about: 'Must not save' })).status, 400);
  for (const forbidden of [
    { resume: profile.resume }, { role: 'admin' }, { email: 'changed@example.test' },
    { user_id: other.id }, { password_hash: 'replacement' }, { email_verified: false },
  ]) {
    const result = await owner.session.call(profilePath, { about: 'Must not partially save', ...forbidden });
    assert.equal(result.status, 400);
    assert.match(result.data.message, /Only professional profile fields/);
  }
  assert.deepEqual(await snapshot(owner.id), ownerBefore);
  assert.deepEqual(await snapshot(other.id), otherBefore);
  const otherRead = await other.session.call(`${profilePath}?user_id=${owner.id}`);
  assert.equal(otherRead.data.profile.about, other.data.about);
  assert.equal(otherRead.data.profile.resume.id, other.resumeId);
  assert.equal((await other.session.call(`/resume/${owner.resumeId}/file`)).status, 404);
  assert.equal((await other.session.call(profilePath, { about: 'Second owner updated their own introduction.' })).status, 200);
  assert.equal((await other.session.call(profilePath)).data.profile.about, 'Second owner updated their own introduction.');
  assert.deepEqual(await snapshot(owner.id), ownerBefore);
  assert.deepEqual((await snapshot(other.id)).auth, otherBefore.auth);
  assert.deepEqual((await snapshot(other.id)).resumes, otherBefore.resumes);
  const anonymous = client();
  await anonymous.call('/auth/session');
  assert.equal((await anonymous.call(profilePath)).status, 401);
  assert.equal((await anonymous.call(profilePath, { about: 'Unauthorized update' })).status, 401);
});

test('recommendation education scores place Associate Degree between lower levels and Bachelor, including legacy values', async (t) => {
  const { db, seedSeeker } = await fixture(t);
  const owner = await seedSeeker('education-owner');
  const employerId = randomUUID();
  const now = Date.now();
  await db.prepare('INSERT INTO users (id,full_name,email,role,role_selected,account_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(employerId, 'Education Test Recruiter', 'education-employer@example.test', 'employer', 1, 'active', now, now);
  await db.prepare('INSERT INTO employer_profiles (user_id,company_name,industry,province,municipality,contact_person,contact_position,business_email,contact_number,verification_status,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(employerId, 'Education Test Company', 'Administration', 'Oriental Mindoro', 'Calapan City', 'Test Recruiter', 'Manager', 'education-employer@example.test', '0000', 'verified', now);
  const requirements = ['Vocational / TESDA', 'Associate Degree', "Bachelor's Degree"];
  const jobIds = new Map();
  for (const education of requirements) {
    const id = randomUUID();
    jobIds.set(education, id);
    await db.prepare('INSERT INTO jobs (id,employer_id,title,company_name,description,industry,province,municipality,employment_type,work_setup,required_skills,preferred_skills,education_required,experience_required,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(id, employerId, 'Administrative Assistant', 'Education Test Company', 'Maintain office records.', 'Administration', 'Oriental Mindoro', 'Calapan City', 'Full-time', 'On-site', '["Microsoft Office"]', '[]', education, 0, 'active', now);
  }
  for (const [education, expected] of [
    ['Senior High School', [0.5, 0, 0]],
    ['College Undergraduate', [1, 0.5, 0]],
    ['Associate Degree', [1, 1, 0.5]],
    ["Bachelor's Degree", [1, 1, 1]],
    ['college graduate', [1, 1, 1]],
    ['associate', [1, 1, 0.5]],
  ]) {
    assert.equal((await owner.session.call(profilePath, { education })).status, 200);
    const response = await owner.session.call('/jobs/recommended');
    assert.equal(response.status, 200);
    assert.equal(response.data.recommendations.length, requirements.length);
    for (const [index, requirement] of requirements.entries()) {
      const recommendation = response.data.recommendations.find((job) => job.id === jobIds.get(requirement));
      assert.equal(recommendation.education_score, expected[index], `${education} against ${requirement}`);
      assert.equal(recommendation.semantic_engine, 'text_overlap_fallback');
    }
  }
});
