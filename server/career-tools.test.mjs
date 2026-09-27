import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { openDatabase, migrateDatabase } from './database.mjs';
import { createApp } from './app.mjs';
import {
  ensureCareerToolsSchema,
  interviewFeedback,
  readinessFeedback,
  coachPlan,
} from './career-tools.mjs';

const origin = 'http://127.0.0.1:5173';
async function fixture(t) {
  const db = openDatabase(':memory:');
  await migrateDatabase(db);
  const app = await createApp({ db, origin, aiServiceUrl: '' });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const client = () => {
    let cookie = '',
      csrf = '';
    return {
      async call(path, body, method = 'PUT', headers = {}) {
        const response = await fetch(base + path, {
          method: body === undefined ? 'GET' : method,
          headers: {
            Cookie: cookie,
            Origin: origin,
            ...(body === undefined
              ? {}
              : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }),
            ...headers,
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const updatedCookie = response.headers.get('set-cookie');
        if (updatedCookie) cookie = updatedCookie.split(';')[0];
        const data = await response.json();
        if (data.csrf) csrf = data.csrf;
        return { status: response.status, data };
      },
    };
  };
  const register = async (email, role = 'job_seeker') => {
    const user = client();
    await user.call('/auth/session');
    const result = await user.call(
      '/auth/register',
      {
        fullName: 'Career Tools Test',
        email,
        password: 'Career Tools Test 123',
        confirmPassword: 'Career Tools Test 123',
        agree: true,
      },
      'POST',
    );
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal((await user.call('/role', { role }, 'POST')).status, 200);
    return { ...user, id: result.data.user.id };
  };
  return { db, client, register };
}

test('career tools authenticate, protect writes with CSRF, persist all tools, and isolate owners', async (t) => {
  const { db, client, register } = await fixture(t);
  await ensureCareerToolsSchema(db); // Safe across app restarts.
  assert.equal((await client().call('/career/tools')).status, 401);
  const owner = await register('career-owner@example.test');
  const other = await register('career-other@example.test');
  const employer = await register('career-employer@example.test', 'employer');
  assert.equal((await employer.call('/career/tools')).status, 403);
  assert.equal((await employer.call('/career/tools/readiness', { answers: {} })).status, 403);
  assert.equal(
    (
      await owner.call('/career/tools/readiness', { answers: { direction: 2 } }, 'PUT', {
        'X-CSRF-Token': '',
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await owner.call('/career/tools/readiness', { answers: { direction: 2 } }, 'PUT', {
        Origin: 'https://untrusted.example',
      })
    ).status,
    403,
  );

  await db
    .prepare(
      'INSERT INTO job_seeker_profiles (user_id,data,normalized_profile_text,onboarding_step,completed,updated_at) VALUES (?,?,?,?,?,?)',
    )
    .run(
      owner.id,
      JSON.stringify({
        preferred_job: 'Office Assistant',
        about: 'I enjoy organizing information.',
        skills: ['Microsoft Excel'],
        experience_snippets: ['Organized records for a school project.'],
        private_field: 'must not leak',
      }),
      'Skills: Microsoft Excel',
      0,
      0,
      Date.now(),
    );
  await db
    .prepare(
      'INSERT INTO resumes (id,user_id,storage_path,original_filename,file_size,parsing_status,analysis,uploaded_at,parsed_at) VALUES (?,?,?,?,?,?,?,?,?)',
    )
    .run(
      'test-resume',
      owner.id,
      'private-do-not-expose.pdf',
      'my-resume.pdf',
      100,
      'completed',
      JSON.stringify({
        experience_snippets: ['Prepared a class event worksheet.'],
        detected_skills: ['Communication'],
        resume_text: 'Private raw parser text.',
      }),
      Date.now(),
      Date.now(),
    );
  const initial = await owner.call('/career/tools');
  assert.equal(initial.status, 200);
  assert.equal(initial.data.training.length, 10);
  assert.equal(initial.data.readiness_questions.length, 6);
  assert.equal(initial.data.interview_questions.length, 5);
  assert.deepEqual(initial.data.states, {});
  assert.equal(initial.data.profile.preferred_job, 'Office Assistant');
  assert.deepEqual(initial.data.resume.experience_snippets, ['Prepared a class event worksheet.']);
  assert.equal(initial.data.profile.private_field, undefined);
  assert.equal(initial.data.resume.storage_path, undefined);
  assert.equal(initial.data.resume.resume_text, undefined);

  const payloads = {
    readiness: {
      answers: {
        direction: 2,
        evidence: 1,
        resume: 0,
        interview: 1,
        communication: 2,
        planning: 0,
      },
    },
    interview: {
      answers: {
        introduction:
          'I helped organize a school event. My task was to prepare a worksheet and check the records. I reviewed the entries with a classmate, asked about missing information, and corrected the sheet. As a result, we completed the list and I learned to confirm details early.',
      },
    },
    resume: {
      target_role: 'Office Assistant',
      summary: 'I enjoy organizing information.',
      bullets: ['Organized records for a school project.'],
    },
    coach: { goal: 'build-skills', weekly_hours: 3, completed: ['profile'] },
    'training:excel': {
      completed: [0, 1],
      notes: 'Created my expense sheet and checked the totals.',
    },
  };
  for (const [tool, payload] of Object.entries(payloads)) {
    const result = await owner.call(`/career/tools/${encodeURIComponent(tool)}`, payload);
    assert.equal(result.status, 200, `${tool}: ${JSON.stringify(result.data)}`);
    assert.deepEqual(result.data.data, payload);
    assert.ok(result.data.updated_at > 0);
  }
  const reload = (await owner.call('/career/tools')).data;
  for (const [tool, payload] of Object.entries(payloads))
    assert.deepEqual(reload.states[tool].data, payload);
  assert.equal(reload.states.readiness.feedback.confident, 2);
  assert.equal(reload.states.readiness.feedback.next_steps.length, 4);
  assert.ok(reload.states.interview.feedback.introduction.checks.every((check) => check.passed));
  assert.match(reload.states.coach.feedback.steps[0].title, /Office Assistant/);
  assert.deepEqual((await other.call('/career/tools')).data.states, {});
  assert.deepEqual((await other.call('/career/tools')).data.profile.experience_snippets, []);
  assert.equal((await other.call('/career/tools')).data.resume, null);
  assert.equal(
    (await other.call('/career/tools/readiness', { answers: { direction: 0 } })).status,
    200,
  );
  assert.deepEqual(
    (await owner.call('/career/tools')).data.states.readiness.data,
    payloads.readiness,
  );

  const update = { completed: [0, 1, 2], notes: 'Finished all three exercises.' };
  assert.equal((await owner.call('/career/tools/training%3Aexcel', update)).status, 200);
  assert.deepEqual((await owner.call('/career/tools')).data.states['training:excel'].data, update);
  assert.equal(
    db.prepare('SELECT COUNT(*) AS total FROM career_tool_progress WHERE user_id=?').get(owner.id)
      .total,
    5,
  );
  assert.deepEqual(
    JSON.parse(
      db.prepare('SELECT data FROM job_seeker_profiles WHERE user_id=?').get(owner.id).data,
    ).experience_snippets,
    ['Organized records for a school project.'],
    'Resume draft must not silently replace profile evidence',
  );
});

test('career saves reject unknown tools, foreign owner fields, invalid answers and oversized text', async (t) => {
  const { register } = await fixture(t);
  const owner = await register('career-validation@example.test');
  const invalid = [
    ['unknown', {}, 404],
    ['training:unknown', { completed: [], notes: '' }, 404],
    ['readiness', { answers: { direction: 3 } }, 400],
    ['readiness', { answers: { unknown: 0 } }, 400],
    ['readiness', { answers: [] }, 400],
    ['readiness', { answers: {}, user_id: 'another-user' }, 400],
    ['interview', { answers: { challenge: 'x'.repeat(5001) } }, 400],
    ['interview', { answers: { unknown: 'an answer' } }, 400],
    ['resume', { target_role: '', summary: '', bullets: [42] }, 400],
    ['resume', { target_role: '', summary: '', bullets: Array(21).fill('too many') }, 400],
    ['coach', { goal: 'fake-ai', weekly_hours: 3, completed: [] }, 400],
    ['coach', { goal: 'first-job', weekly_hours: 0, completed: [] }, 400],
    ['coach', { goal: 'first-job', weekly_hours: 3.5, completed: [] }, 400],
    ['coach', { goal: 'first-job', weekly_hours: 3, completed: ['invented'] }, 400],
    ['training:excel', { completed: [3], notes: '' }, 400],
    ['training:excel', { completed: [-1], notes: '' }, 400],
    ['training:excel', { completed: [], notes: 'x'.repeat(5001) }, 400],
  ];
  for (const [tool, payload, status] of invalid) {
    const result = await owner.call(`/career/tools/${encodeURIComponent(tool)}`, payload);
    assert.equal(result.status, status, `${tool}: ${JSON.stringify(result.data)}`);
  }
  assert.deepEqual((await owner.call('/career/tools')).data.states, {});
  // Legal large drafts exceed the app's usual 16 KB parser limit and must still save.
  const large = {
    answers: Object.fromEntries(
      ['introduction', 'challenge', 'teamwork', 'learning', 'motivation'].map((id) => [
        id,
        'word '.repeat(900).trim(),
      ]),
    ),
  };
  assert.equal((await owner.call('/career/tools/interview', large)).status, 200);
  assert.deepEqual((await owner.call('/career/tools')).data.states.interview.data, large);
});

test('guided feedback reflects supplied evidence without hiring scores or generated experience', () => {
  const blank = readinessFeedback({ answers: {} });
  assert.equal(blank.answered, 0);
  assert.equal(blank.confident, 0);
  assert.equal(blank.next_steps.length, 6);
  assert.match(blank.note, /not a hiring score/);
  assert.equal(interviewFeedback('').word_count, 0);
  assert.ok(interviewFeedback('').checks.every((check) => !check.passed));
  assert.match(interviewFeedback('I helped.').note, /Guided wording checks only/);
  const plan = coachPlan({ goal: 'interview', weekly_hours: 1 }, { preferred_job: 'IT Support' });
  assert.equal(plan.steps[1].href, '/career/interview');
  assert.match(plan.time_note, /1 hour available/);
  assert.match(plan.note, /does not use generative AI/);
});
