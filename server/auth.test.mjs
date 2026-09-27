import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { unlink } from 'node:fs/promises';
import {
  openDatabase,
  connectDatabase,
  createDatabase,
  databaseConfig,
  migrateDatabase,
} from './database.mjs';
import { createApp, hashPassword } from './app.mjs';

test('employer verification, private documents and draft-active-closed recommendation lifecycle', async (t) => {
  const {db,c,client}=await fixture(t,{aiServiceUrl:process.env.LIVE_AI_TEST ? 'http://127.0.0.1:8000' : ''});
  const auditCount = async () => Number((await db.prepare('SELECT COUNT(*) AS count FROM admin_audit_logs').get()).count);
  const expectAudit = async (action, actorId, entityType, entityId, details) => {
    const events = await db.prepare('SELECT * FROM admin_audit_logs WHERE action=? AND entity_id=?').all(action, entityId);
    assert.equal(events.length, 1, `${action} must record exactly one successful action`);
    assert.equal(events[0].actor_id, actorId);
    assert.equal(events[0].entity_type, entityType);
    assert.equal(events[0].entity_id, entityId);
    assert.ok(Number(events[0].created_at) > 0);
    assert.deepEqual(JSON.parse(events[0].details), details);
  };
  const register=async (email,role)=>{const session=client();await session.call('/auth/session');const r=await session.call('/auth/register',{...registration,email});assert.equal(r.status,200);if(role==='admin')await db.prepare("UPDATE users SET role='admin' WHERE id=?").run(r.data.user.id);else assert.equal((await session.call('/role',{role})).status,200);return {session,id:r.data.user.id};};
  const employer=await register('company@example.test','employer'), other=await register('other-company@example.test','employer'), admin=await register('reviewer@example.test','admin');
  const profile={company_name:'MIMAROPA Digital Solutions',industry:'Marketing / Digital Services',province:'Oriental Mindoro',municipality:'Calapan City',contact_person:'Company Representative',contact_position:'Manager',business_email:'office@example.test',contact_number:'09171234567',description:'Digital services',address:'Calapan',company_size:'1–9',website:''};
  assert.equal((await employer.session.call('/employer/profile',profile,'PUT')).status,200);
  await expectAudit('company.profile_updated', employer.id, 'company', employer.id, { companyName: profile.company_name });
  const form=new FormData();form.append('documents',new Blob(['%PDF-1.4\nDemo verification document\n%%EOF'],{type:'application/pdf'}),'business-registration.pdf');
  assert.equal((await employer.session.call('/employer/verification',form)).status,200);
  await expectAudit('company.submitted', employer.id, 'company', employer.id, { companyName: profile.company_name, status: 'pending', previousStatus: 'pending', count: 1 });
  const docs=await db.prepare('SELECT * FROM employer_documents WHERE user_id=?').all(employer.id);
  t.after(async()=>{for(const d of docs)await unlink(d.storage_path).catch(()=>{});});
  assert.equal((await employer.session.call(`/admin/verification-documents/${docs[0].id}`)).status,403);
  assert.equal((await admin.session.call(`/admin/verification-documents/${docs[0].id}`)).status,200);
  assert.equal((await admin.session.call(`/admin/employer-verifications/${employer.id}`)).data.documents.length,1);
  const beforeFailedReview = await auditCount();
  assert.equal((await employer.session.call(`/admin/employer-verifications/${employer.id}/approve`,{})).status,403);
  assert.equal((await admin.session.call(`/admin/employer-verifications/${employer.id}/reject`,{})).status,400);
  assert.equal(await auditCount(), beforeFailedReview, 'Denied or invalid reviews must not create a successful audit event');
  assert.equal((await admin.session.call(`/admin/employer-verifications/${employer.id}/reject`,{rejection_reason:'Information mismatch'})).status,200);
  await expectAudit('company.rejected', admin.id, 'company', employer.id, { companyName: profile.company_name, status: 'rejected', previousStatus: 'pending', reason: 'Information mismatch' });
  assert.equal((await admin.session.call('/admin/employer-verifications?status=rejected')).data.employers.length,1);
  const job={title:'Marketing Assistant',description:'Assist with Canva, social media content, customer communication and marketing.',industry:profile.industry,province:profile.province,municipality:profile.municipality,employment_type:'Full-time',work_setup:'On-site',vacancies:2,required_skills:['Canva','Social Media Management','Customer Service','Communication'],preferred_skills:['Microsoft Excel'],education_required:"Bachelor's Degree",experience_required:0};
  const draft=await employer.session.call('/employer/jobs',job);assert.equal(draft.status,201);const id=draft.data.id;
  await expectAudit('job.created', employer.id, 'job', id, { companyName: profile.company_name, title: job.title, status: 'draft' });
  const beforeFailedPublish = await auditCount();
  assert.equal((await employer.session.call(`/employer/jobs/${id}/publish`,{})).status,403);
  assert.equal((await employer.session.call('/employer/jobs',{...job,publish:true})).status,403);
  assert.equal(await auditCount(), beforeFailedPublish, 'Unverified employers cannot generate create or publish audit events');
  assert.equal((await admin.session.call(`/admin/employer-verifications/${employer.id}/approve`,{})).status,200);
  await expectAudit('company.verified', admin.id, 'company', employer.id, { companyName: profile.company_name, status: 'verified', previousStatus: 'rejected' });
  assert.equal((await admin.session.call('/admin/employer-verifications?status=verified')).data.employers.length,1);
  assert.equal((await employer.session.call('/auth/login',{email:'company@example.test',password:registration.password})).data.redirect,'/employer/dashboard');
  await c.call('/auth/register',{...registration,email:'candidate@example.test'});await c.call('/role',{role:'job_seeker'});
  await db.prepare("UPDATE users SET email_verified=1 WHERE email=?").run('candidate@example.test');
  assert.equal((await c.call('/profile',{province:profile.province,municipality:profile.municipality,education:"Bachelor's Degree",skills:'Customer Service, Canva, Social Media Management, Microsoft Excel',preferred_job:'Marketing Assistant',work_setup:'On-site',step:2,complete:true},'PUT')).status,200);
  assert.equal((await c.call('/employer/jobs')).status,403);
  assert.equal((await c.call('/jobs/recommended')).data.recommendations.length,0);
  assert.equal((await employer.session.call(`/employer/jobs/${id}/publish`,{})).status,200);
  await expectAudit('job.published', employer.id, 'job', id, { title: job.title, status: 'active', previousStatus: 'draft' });
  const active=(await c.call('/jobs/recommended')).data.recommendations;
  assert.equal(active.length,1);assert.equal(active[0].id,id);
  assert.equal(active[0].semantic_engine,process.env.LIVE_AI_TEST?'sentence_transformer':'text_overlap_fallback');
  assert.match((await db.prepare('SELECT normalized_job_text FROM jobs WHERE id=?').get(id)).normalized_job_text,/Required Skills: Canva/);

  assert.equal((await employer.session.call('/job-seeker/home')).status,403);
  const home=await c.call('/job-seeker/home');assert.equal(home.status,200);
  assert.equal(home.data.recommendations[0].id,id);
  assert.equal(home.data.recommendations[0].match_percentage,active[0].match_percentage);
  assert.deepEqual(home.data.skills_gap.missing_skills.map(s=>s.skill),['Communication']);
  assert.equal(home.data.training[0].skill,'Communication');
  assert.equal(home.data.careers.length,10);
  assert.ok(home.data.careers.every(c=>c.semantic_engine===(process.env.LIVE_AI_TEST?'sentence_transformer':'skills_overlap_fallback')));
  assert.ok(home.data.careers.every((c,i,a)=>!i||a[i-1].similarity_percentage>=c.similarity_percentage));
  const applied = await c.call('/jobs/'+id+'/apply', {});
  assert.equal(applied.status,201,JSON.stringify(applied.data));
  assert.equal((await c.call('/jobs/'+id+'/apply',{})).status,409);
  const application=(await c.call('/applications')).data.applications[0];
  assert.equal((await other.session.call('/employer/applicants')).data.applications.length,0);
  assert.equal((await c.call('/employer/applicants')).status,403);
  assert.equal((await other.session.call('/employer/applications/'+application.id+'/resume')).status,404);
  assert.equal((await other.session.call('/employer/applications/'+application.id+'/status',{status:'shortlisted'})).status,404);
  const snapshot=application.match_score;
  for(const status of ['under_review','shortlisted']){
    assert.equal((await employer.session.call('/employer/applications/'+application.id+'/status',{status})).status,200);
    assert.equal((await c.call('/applications')).data.applications[0].status,status);
  }
  assert.equal((await c.call('/applications/'+application.id+'/withdraw',{})).status,200);
  for (const status of ['under_review','shortlisted','rejected']) assert.equal((await employer.session.call('/employer/applications/'+application.id+'/status',{status})).status,404);
  const historical=(await employer.session.call('/employer/applicants')).data.applications[0];
  assert.equal(historical.status,'withdrawn');assert.equal(historical.match_score,snapshot);
  const beforeUnauthorizedClose = await auditCount();
  assert.equal((await other.session.call(`/employer/jobs/${id}/close`,{})).status,404);
  assert.equal(await auditCount(), beforeUnauthorizedClose, 'Another employer cannot generate a close audit event');
  assert.equal((await other.session.call('/employer/jobs')).data.jobs.length,0);
  assert.equal((await employer.session.call(`/employer/jobs/${id}/close`,{})).status,200);
  await expectAudit('job.closed', employer.id, 'job', id, { title: job.title, status: 'closed', previousStatus: 'active' });
  assert.equal((await c.call('/jobs/recommended')).data.recommendations.length,0);
  const auditRows = await db.prepare('SELECT * FROM admin_audit_logs').all();
  assert.equal(auditRows.length, 7);
  const auditText = JSON.stringify(auditRows);
  const passwordHash = (await db.prepare('SELECT password_hash FROM users WHERE id=?').get(employer.id)).password_hash;
  for (const privateValue of [registration.password, passwordHash, profile.business_email, profile.contact_number, docs[0].storage_path, docs[0].original_filename, '%PDF-1.4'])
    assert.equal(auditText.includes(privateValue), false, 'Audit history must not expose credentials, private contacts, or verification document data');
  console.log(`EMPLOYER PROOF: draft=0 active=1 closed=0 engine=${active[0].semantic_engine} match=${active[0].match_percentage}%`);
});

test('database configuration defaults to MySQL and SQLite only needs a file', () => {
  assert.equal(databaseConfig({}).driver, 'mysql');
  assert.equal(databaseConfig({}).database, 'innohack');
  assert.deepEqual(databaseConfig({ DB_CONNECTION: 'sqlite', DB_DATABASE: ':memory:' }), {
    driver: 'sqlite',
    filename: ':memory:',
  });
  assert.throws(() => databaseConfig({ DB_CONNECTION: 'postgres' }), /DB_CONNECTION/);
  assert.throws(
    () => databaseConfig({ DB_DATABASE: 'unsafe; DROP DATABASE users' }),
    /DB_DATABASE/,
  );
});
const origin = 'http://127.0.0.1:5173';
const registration = {
  fullName: 'Test Applicant',
  email: 'applicant@example.test',
  password: 'Correct Horse 123',
  confirmPassword: 'Correct Horse 123',
  agree: true,
};
async function fixture(t, options = {}) {
  const mysqlTest = process.env.TEST_DB_CONNECTION === 'mysql';
  const testDatabase = `innohack_test_${randomUUID().replaceAll('-', '')}`;
  const config = databaseConfig({
    ...process.env,
    DB_CONNECTION: 'mysql',
    DB_DATABASE: testDatabase,
  });
  if (mysqlTest) await createDatabase(config);
  const db = mysqlTest ? await connectDatabase(config) : openDatabase(':memory:');
  await migrateDatabase(db);
  assert.equal(await migrateDatabase(db), false, 'Migrations must be safe to rerun');
  const app = await createApp({
    db,
    origin,
    ...options,
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    if (mysqlTest) {
      assert.match(testDatabase, /^innohack_test_[a-f0-9]{32}$/);
      await db.exec(`DROP DATABASE \`${testDatabase}\``);
    }
    await db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const client = () => {
    let cookie = '';
    let csrf = '';
    const call = async (path, body, method = 'POST', headers = {}) => {
      const response = await fetch(base + path, {
        method: body === undefined ? 'GET' : method,
        headers: {
          Cookie: cookie,
          Origin: origin,
          ...(body instanceof FormData ? { 'X-CSRF-Token': csrf } : body === undefined
            ? {}
            : {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrf,
              }),
          ...headers,
        },
        ...(body === undefined
          ? {}
          : {
              body: body instanceof FormData ? body : JSON.stringify(body),
            }),
      });
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';')[0];
      const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text();
      if (data.csrf) csrf = data.csrf;
      return {
        status: response.status,
        data,
        setCookie,
        cookie,
        headers: response.headers,
      };
    };
    return {
      call,
    };
  };
  const c = client();
  await c.call('/auth/session');
  const token = async (purpose) =>
    (
      await db
        .prepare(
          'SELECT body FROM mail_queue WHERE subject LIKE ? ORDER BY created_at DESC LIMIT 1',
        )
        .get(purpose === 'reset' ? 'Reset%' : 'Verify%')
    ).body.match(/#token=([a-f0-9]{64})/)[1];
  return {
    db,
    c,
    client,
    token,
  };
}
test('registration hashes passwords, fixes the role, rotates session and protects dashboard', async (t) => {
  const { db, c } = await fixture(t);
  const before = await c.call('/auth/session');
  const result = await c.call('/auth/register', {
    ...registration,
    role: 'admin',
    email_verified: true,
    profile_completion: 100,
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.redirect, '/onboarding/select-role');
  assert.notEqual(result.cookie, before.cookie);
  assert.match(result.setCookie, /HttpOnly/);
  assert.match(result.setCookie, /SameSite=Lax/);
  assert.equal(result.data.user.role, 'job_seeker');
  assert.equal(result.data.user.emailVerified, false);
  assert.equal(result.data.user.password_hash, undefined);
  const row = await db.prepare('SELECT * FROM users').get();
  assert.match(row.password_hash, /^\$argon2id\$/);
  assert.ok(await argon2.verify(row.password_hash, registration.password));
  assert.equal((await c.call('/auth/session')).data.user.id, row.id);
  assert.equal((await c.call('/dashboard')).status, 403);
  assert.equal((await c.call('/admin')).status, 403);
  assert.equal((await c.call('/auth/register', registration)).status, 409);
});
test('server validates credentials, consent and CSRF independently of the UI', async (t) => {
  const { c, db } = await fixture(t);
  assert.equal(
    (
      await c.call('/auth/register', registration, 'POST', {
        Origin: 'https://attacker.invalid',
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await c.call('/auth/register', registration, 'POST', {
        'X-CSRF-Token': 'wrong',
      })
    ).status,
    403,
  );
  for (const override of [
    {
      agree: false,
    },
    {
      password: 'short',
    },
    {
      confirmPassword: 'different',
    },
    {
      email: 'invalid',
    },
    {
      fullName: '',
    },
  ])
    assert.equal(
      (
        await c.call('/auth/register', {
          ...registration,
          ...override,
        })
      ).status,
      400,
    );
  assert.equal((await c.call('/auth/register', null)).status, 400);
  assert.equal((await db.prepare('SELECT count(*) AS count FROM users').get()).count, 0);
});
test('generic login errors, remember cookie, logout revocation, and unauthenticated access', async (t) => {
  const { c, client } = await fixture(t);
  await c.call('/auth/register', registration);
  await c.call('/auth/logout', {});
  await c.call('/auth/session');
  const wrong = await c.call('/auth/login', {
    email: registration.email,
    password: 'wrong',
  });
  const unknown = await c.call('/auth/login', {
    email: 'unknown@example.test',
    password: 'wrong',
  });
  assert.deepEqual(wrong.data, unknown.data);
  assert.equal(wrong.status, 401);
  const result = await c.call('/auth/login', {
    email: registration.email.toUpperCase(),
    password: registration.password,
    remember: true,
  });
  assert.equal(result.status, 200);
  assert.match(result.setCookie, /Max-Age=2592000/);
  const oldCookie = result.cookie;
  await c.call('/auth/logout', {});
  assert.equal(
    (
      await c.call('/profile', undefined, 'GET', {
        Cookie: oldCookie,
      })
    ).status,
    401,
  );
  assert.equal((await client().call('/profile')).status, 401);
});
test('reset responses do not enumerate accounts; links expire, are single-use and revoke sessions', async (t) => {
  const { c, db, token, client } = await fixture(t);
  const registered = await c.call('/auth/register', registration);
  const known = await c.call('/auth/forgot-password', {
    email: registration.email,
  });
  const unknown = await c.call('/auth/forgot-password', {
    email: 'missing@example.test',
  });
  assert.deepEqual(known.data, unknown.data);
  const reset = await token('reset');
  const body = {
    token: reset,
    password: 'New Correct Horse 456',
    confirmPassword: 'New Correct Horse 456',
  };
  assert.equal((await c.call('/auth/reset-password', body)).status, 200);
  assert.equal(
    (
      await client().call('/profile', undefined, 'GET', {
        Cookie: registered.cookie,
      })
    ).status,
    401,
  );
  await c.call('/auth/session');
  assert.equal((await c.call('/auth/reset-password', body)).status, 400);
  assert.equal(
    (
      await c.call('/auth/login', {
        email: registration.email,
        password: registration.password,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await c.call('/auth/login', {
        email: registration.email,
        password: body.password,
      })
    ).status,
    200,
  );
  await c.call('/auth/forgot-password', {
    email: registration.email,
  });
  const expired = await token('reset');
  await db.prepare("UPDATE action_tokens SET expires_at=0 WHERE purpose='reset'").run();
  assert.equal(
    (
      await c.call('/auth/reset-password', {
        ...body,
        token: expired,
      })
    ).status,
    400,
  );
});
test('profile is saved by owner, completion requires verified email and complete data', async (t) => {
  const { c, client, token } = await fixture(t);
  await c.call('/auth/register', registration);
  assert.equal((await c.call('/role', { role: 'job_seeker' })).status, 200);
  const profile = {
    province: 'Oriental Mindoro',
    municipality: 'Calapan City',
    education: 'College graduate',
    skills: 'Excel, customer service',
    preferred_job: 'Office assistant',
    work_setup: 'On-site',
    step: 2,
  };
  assert.equal(
    (
      await c.call(
        '/profile',
        {
          ...profile,
          complete: true,
        },
        'PUT',
      )
    ).status,
    403,
  );
  assert.equal((await c.call('/profile', profile, 'PUT')).status, 200);
  assert.equal((await c.call('/profile')).data.profile.skills, profile.skills);
  const verification = await token('verify');
  assert.equal(
    (
      await c.call('/auth/verify-email', {
        token: verification,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await c.call('/auth/verify-email', {
        token: verification,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await c.call(
        '/profile',
        {
          ...profile,
          skills: '',
          complete: true,
        },
        'PUT',
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await c.call(
        '/profile',
        {
          ...profile,
          complete: true,
        },
        'PUT',
      )
    ).data.redirect,
    '/jobs',
  );
  assert.equal((await c.call('/dashboard')).status, 200);
  assert.equal((await c.call('/jobs/recommended')).status, 200);
  const other = client();
  await other.call('/auth/session');
  await other.call('/auth/register', {
    ...registration,
    email: 'other@example.test',
  });
  assert.equal((await other.call('/profile')).data.profile, null);
});
test('Google verifies token, creates one account and requires proof before linking existing emails', async (t) => {
  const payloads = {
    new: {
      sub: 'google-one',
      email: 'google@gmail.com',
      email_verified: true,
      name: 'Google Applicant',
    },
    link: {
      sub: 'google-two',
      email: registration.email,
      email_verified: true,
      name: 'Test',
    },
  };
  const { c, db, token } = await fixture(t, {
    googleClientId: 'test-client',
    verifyGoogle: async (credential) => {
      if (!payloads[credential]) throw new Error('bad signature');
      return payloads[credential];
    },
  });
  assert.equal(
    (
      await c.call('/auth/google', {
        credential: 'forged',
        agree: true,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await c.call('/auth/google', {
        credential: 'new',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await c.call('/auth/google', {
        credential: 'new',
        agree: true,
      })
    ).data.redirect,
    '/onboarding/select-role',
  );
  assert.equal(
    (
      await c.call('/auth/google', {
        credential: 'new',
      })
    ).status,
    200,
  );
  assert.equal((await db.prepare('SELECT count(*) AS count FROM users').get()).count, 1);
  await c.call('/auth/logout', {});
  await c.call('/auth/session');
  await c.call('/auth/register', registration);
  await c.call('/auth/verify-email', {
    token: await token('verify'),
  });
  await c.call('/auth/logout', {});
  await c.call('/auth/session');
  assert.equal(
    (
      await c.call('/auth/google', {
        credential: 'link',
        agree: true,
      })
    ).status,
    409,
  );
  await c.call('/auth/login', {
    email: registration.email,
    password: registration.password,
  });
  assert.equal(
    (
      await c.call('/auth/google', {
        credential: 'link',
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await c.call('/auth/google', {
        credential: 'link',
        linkingPassword: registration.password,
      })
    ).status,
    200,
  );
  assert.equal((await db.prepare('SELECT count(*) AS count FROM users').get()).count, 2);
  assert.equal(
    (await db.prepare('SELECT auth_provider FROM users WHERE email=?').get(registration.email))
      .auth_provider,
    'password+google',
  );
});
test('admin login is separate, public login cannot authenticate admins', async (t) => {
  const { c, db } = await fixture(t);
  const adminId = randomUUID();
  await db
    .prepare(
      "INSERT INTO users (id,full_name,email,password_hash,email_verified,role,created_at,updated_at) VALUES (?,?,?,?,1,'admin',?,?)",
    )
    .run(
      adminId,
      'Admin',
      'admin@example.test',
      await hashPassword(registration.password),
      Date.now(),
      Date.now(),
    );
  const credentials = {
    email: 'admin@example.test',
    password: registration.password,
  };
  assert.equal((await c.call('/auth/login', credentials)).status, 401);
  assert.equal((await c.call('/auth/admin/login', { ...credentials, password: 'incorrect-password' })).status, 401);
  assert.equal(Number((await db.prepare('SELECT COUNT(*) AS count FROM admin_audit_logs').get()).count), 0, 'Failed public or admin login must not record an admin sign-in');
  const login = await c.call('/auth/admin/login', credentials);
  assert.equal(login.status, 200);
  assert.equal(login.data.redirect, '/admin');
  assert.equal((await c.call('/admin')).status, 200);
  const audits = await db.prepare('SELECT * FROM admin_audit_logs').all();
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, 'admin.signed_in');
  assert.equal(audits[0].actor_id, adminId);
  assert.equal(audits[0].entity_type, 'account');
  assert.equal(audits[0].entity_id, adminId);
  assert.deepEqual(JSON.parse(audits[0].details), {});
  assert.ok(Number(audits[0].created_at) > 0);
  const auditText = JSON.stringify(audits);
  const passwordHash = (await db.prepare('SELECT password_hash FROM users WHERE id=?').get(adminId)).password_hash;
  for (const secret of [credentials.password, credentials.email, passwordHash, login.data.csrf, login.cookie])
    assert.equal(auditText.includes(secret), false, 'Admin sign-in audit must not include credentials, session cookies, or CSRF tokens');
});
test('rate limiting blocks repeated authentication attempts', async (t) => {
  const { c } = await fixture(t);
  for (let i = 0; i < 20; i++)
    await c.call('/auth/login', {
      email: 'missing@example.test',
      password: 'wrong',
    });
  assert.equal(
    (
      await c.call('/auth/login', {
        email: 'missing@example.test',
        password: 'wrong',
      })
    ).status,
    429,
  );
});
test('production cookies are secure and Google forgery never creates a session', async (t) => {
  const { c } = await fixture(t, {
    production: true,
    googleClientId: 'test-client',
  });
  const session = await c.call('/auth/session');
  assert.match(session.cookie, /^__Host-innohack=/);
  // A newly created session emits the cookie; the first request already set it.
  const result = await c.call('/auth/register', registration);
  assert.match(result.setCookie, /; Secure/);
  assert.match(result.setCookie, /HttpOnly/);
  assert.equal(
    (
      await c.call('/auth/google', {
        credential: 'unsigned.fake.jwt',
        agree: true,
      })
    ).status,
    401,
  );
});

test('concurrent reset consumption succeeds only once and rolls back the other request', async (t) => {
  const { c, client, token } = await fixture(t);
  await c.call('/auth/register', registration);
  await c.call('/auth/forgot-password', { email: registration.email });
  const body = {
    token: await token('reset'),
    password: 'Concurrent New Pass 456',
    confirmPassword: 'Concurrent New Pass 456',
  };
  const a = client(),
    b = client();
  await a.call('/auth/session');
  await b.call('/auth/session');
  const results = await Promise.all([
    a.call('/auth/reset-password', body),
    b.call('/auth/reset-password', body),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
});

test('concurrent reset requests leave only the latest active token', async (t) => {
  const { c, db } = await fixture(t);
  await c.call('/auth/register', registration);
  const results = await Promise.all([
    c.call('/auth/forgot-password', { email: registration.email }),
    c.call('/auth/forgot-password', { email: registration.email }),
  ]);
  assert.ok(results.every((r) => r.status === 200));
  assert.equal(
    (await db.prepare("SELECT count(*) AS count FROM action_tokens WHERE purpose='reset'").get())
      .count,
    1,
  );
});


test('career home requires a completed authenticated Job Seeker profile', async t=>{
  const {c}=await fixture(t);
  assert.equal((await c.call('/job-seeker/home')).status,401);
  await c.call('/auth/register',registration);
  assert.equal((await c.call('/job-seeker/home')).status,403);
  await c.call('/role',{role:'job_seeker'});
  assert.equal((await c.call('/job-seeker/home')).status,403);
});
