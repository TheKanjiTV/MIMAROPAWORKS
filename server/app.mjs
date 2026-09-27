import { skillsGap, trainingFor, careerSuggestions } from './career.mjs';
import { registerJobSeekerRoutes } from './job-seeker.mjs';
import { ensureAdminSchema, registerAdminRoutes, writeAudit, auditOperation } from './admin.mjs';
import { ensureCareerToolsSchema, registerCareerToolRoutes } from './career-tools.mjs';
import { createSemanticScorer } from './semantic-scorer.mjs';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import argon2 from 'argon2';
import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import multer from 'multer';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { verificationEmail } from './emails/verificationEmail.mjs';
import { passwordResetEmail } from './emails/passwordResetEmail.mjs';
import { employerApprovedEmail, employerRejectedEmail, employerSubmittedEmail } from './emails/employerVerificationEmail.mjs';
import { testEmail } from './emails/testEmail.mjs';
const randomToken = () => randomBytes(32).toString('hex');
export const digest = (value) => createHash('sha256').update(value).digest('hex');
const hashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};
export const hashPassword = (password) => argon2.hash(password, hashOptions);
const emailValue = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const validEmail = (email) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validPassword = (p) => typeof p === 'string' && p.length >= 8 && p.length <= 128;
const failure = (res, status, message) =>
  res.status(status).json({
    message,
  });
const publicUser = (u) => ({
  id: u.id,
  name: u.full_name,
  email: u.email,
  picture: u.profile_photo ?? undefined,
  role: u.role,
  roleSelected: Boolean(u.role_selected),
  emailVerified: Boolean(u.email_verified),
  profileCompletion: u.profile_completion,
  provider: u.auth_provider,
});
const redirectFor = (u) =>
  u.role === 'admin' ? '/admin' : !u.role_selected ? '/onboarding/select-role' : u.role === 'employer' ? '/onboarding/employer' : u.profile_completion < 100 ? '/onboarding/job-seeker' : '/jobs';
const provinces = ['Oriental Mindoro', 'Occidental Mindoro', 'Marinduque', 'Romblon', 'Palawan'];
const clamp = (value) => Math.max(0, Math.min(1, value));
const educationRank = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  const level = normalized === 'college graduate' ? "bachelor's degree" : normalized === 'associate' ? 'associate degree' : normalized;
  return Math.max(0, ['elementary', 'junior high school', 'senior high school', 'vocational / tesda', 'college undergraduate', 'associate degree', "bachelor's degree", 'postgraduate'].indexOf(level));
};
const skillAliases = { 'customer support': 'Customer Service', 'client support': 'Customer Service', 'customer service': 'Customer Service', 'facebook page management': 'Social Media Management', 'fb page management': 'Social Media Management', 'social media handling': 'Social Media Management', 'social media management': 'Social Media Management', canva: 'Canva', excel: 'Microsoft Excel', 'ms excel': 'Microsoft Excel', 'microsoft excel': 'Microsoft Excel', 'ms office': 'Microsoft Office', 'microsoft office': 'Microsoft Office', communication: 'Communication' };
const normalizeSkills = (values) => [...new Set(values.map((value) => skillAliases[String(value).trim().toLowerCase()] ?? String(value).trim()).filter((value) => value && value.length <= 80))];
const normalizedProfile = (base, extra = {}) => `Preferred Role: ${base.preferred_job}\nEducation: ${extra.education ?? base.education}${extra.course ? ` in ${extra.course}` : ''}\nSkills: ${normalizeSkills([...(base.skills || '').split(','), ...(extra.skills || [])]).join(', ')}\nExperience: ${extra.recent_job_title ?? ''}. ${(extra.experience_snippets || []).join(' ')}\nWork Setup: ${base.work_setup}\nPreferred Location: ${base.municipality}, ${base.province}`;
async function semanticScore(candidateText, jobText, aiServiceUrl) {
  if (!aiServiceUrl) throw new Error('AI service URL is not configured.');
  const response = await fetch(`${aiServiceUrl.replace(/\/$/, '')}/ai/semantic-score`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidate_text: candidateText, job_text: jobText }),
    signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) throw new Error(`AI service returned ${response.status}`);
  const body = await response.json();
  if (body.engine !== 'sentence_transformer' || !Number.isFinite(body.semantic_score)) throw new Error('Invalid AI response.');
  return clamp(body.semantic_score);
}
export async function createApp({
  db,
  origin,
  googleClientId = '',
  production = false,
  verifyGoogle,
  aiServiceUrl = process.env.AI_SERVICE_URL || '',
}) {
  await ensureAdminSchema(db);
  await ensureCareerToolsSchema(db);
  const app = express();
  const scoreSemantic = createSemanticScorer(semanticScore);
  const resumeUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, done) => done(null, file.mimetype === 'application/pdf' && /\.pdf$/i.test(file.originalname)) });
  const verificationUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 3 }, fileFilter: (_req, file, done) => done(null, /^(application\/pdf|image\/(png|jpeg))$/.test(file.mimetype)) });
  const google = new OAuth2Client(googleClientId);
  const dummyHash = await hashPassword(randomToken());
  const cookieName = production ? '__Host-innohack' : 'innohack_session';
  const cookieOptions = {
    httpOnly: true,
    secure: production,
    sameSite: 'lax',
    path: '/',
  };
  app.disable('x-powered-by');
  app.use(
    helmet({
      crossOriginOpenerPolicy: {
        policy: 'same-origin-allow-popups',
      },
      referrerPolicy: {
        policy: 'no-referrer',
      },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://accounts.google.com/gsi/client'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com'],
          frameSrc: ['https://accounts.google.com'],
          connectSrc: ["'self'", 'https://accounts.google.com'],
          imgSrc: ["'self'", 'data:', 'https://lh3.googleusercontent.com'],
          upgradeInsecureRequests: production ? [] : null,
        },
      },
    }),
  );
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(
    '/api',
    rateLimit({
      windowMs: 60000,
      limit: 120,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        message: 'Too many requests. Please wait a minute and try again.',
      },
    }),
  );
  app.use(['/api/career/tools', '/api/job-seeker/professional-profile'], express.json({ limit: '128kb' }));
  app.use(
    express.json({
      limit: '16kb',
    }),
  );
  app.use('/api', async (req, res, next) => {
    const raw = (req.headers.cookie ?? '')
      .split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    req.sessionHash = raw && /^[a-f0-9]{64}$/.test(raw) ? digest(raw) : null;
    req.session = req.sessionHash
      ? await db
          .prepare('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?')
          .get(req.sessionHash, Date.now())
      : null;
    req.user = req.session?.user_id
      ? await db
          .prepare("SELECT * FROM users WHERE id=? AND account_status='active'")
          .get(req.session.user_id)
      : null;
    next();
  });
  const newSession = async (req, res, user, remember = false) => {
    const token = randomToken();
    const csrf = randomToken();
    const duration = user ? (remember ? 30 * 86400000 : 12 * 3600000) : 3600000;
    await db.batch([
      ...(user
        ? [
            {
              sql: "UPDATE users SET updated_at=updated_at WHERE id=? AND account_status='active' AND (password_hash=? OR (password_hash IS NULL AND ? IS NULL))",
              params: [user.id, user.password_hash ?? null, user.password_hash ?? null],
              requireChanges: 1,
            },
          ]
        : []),
      ...(req.sessionHash
        ? [{ sql: 'DELETE FROM sessions WHERE token_hash=?', params: [req.sessionHash] }]
        : []),
      {
        sql: 'INSERT INTO sessions VALUES (?,?,?,?)',
        params: [digest(token), user?.id ?? null, csrf, Date.now() + duration],
      },
    ]);
    res.cookie(cookieName, token, {
      ...cookieOptions,
      ...(remember
        ? {
            maxAge: duration,
          }
        : {}),
    });
    return csrf;
  };
  app.get('/api/auth/session', async (req, res) => {
    const csrf = req.session?.csrf ?? (await newSession(req, res, null));
    res.json({
      user: req.user ? publicUser(req.user) : null,
      csrf,
    });
  });
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const header = req.get('X-CSRF-Token') ?? '';
    const resumeMultipart = ['/resume', '/employer/verification'].includes(req.path) && req.is('multipart/form-data');
    if (
      req.get('Origin') !== origin ||
      (!req.is('application/json') && !resumeMultipart) ||
      !req.session ||
      !/^[a-f0-9]{64}$/.test(header) ||
      !timingSafeEqual(Buffer.from(header), Buffer.from(req.session.csrf))
    )
      return failure(res, 403, 'Your session expired. Refresh the page and try again.');
    if (!resumeMultipart && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)))
      return failure(res, 400, 'Invalid request.');
    next();
  });
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      message: 'Too many attempts. Please try again in 15 minutes.',
    },
  });
  const recoveryLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      message: 'Too many requests. Please try again in 15 minutes.',
    },
  });
  const authenticated = (req, res, next) =>
    req.user ? next() : failure(res, 401, 'Please log in to continue.');
  const success = async (req, res, user, remember) => {
    let redirect = redirectFor(user);
    if (user.role === 'employer' && user.role_selected) {
      const company = await db.prepare('SELECT verification_status FROM employer_profiles WHERE user_id=?').get(user.id);
      if (company) redirect = company.verification_status === 'verified' ? '/employer/dashboard' : '/employer/verification-status';
    }
    if (user.role === 'admin') await writeAudit(db, { actorId: user.id, action: 'admin.signed_in', entityType: 'account', entityId: user.id });
    return res.json({
      user: publicUser(user),
      csrf: await newSession(req, res, user, remember),
      redirect,
    });
  };
  const queueEmail = async ({ recipient, subject, text, html }) => {
    await db.prepare('INSERT INTO mail_queue (id,recipient,subject,body,html,created_at) VALUES (?,?,?,?,?,?)')
      .run(randomUUID(), recipient, subject, text, html ?? null, Date.now());
  };
  const enqueue = async (user, purpose) => {
    const token = randomToken();
    const now = Date.now();
    const route = purpose === 'reset' ? 'reset-password' : 'verify-email';
    const url = `${origin}/${route}#token=${token}`;
    const email = purpose === 'reset'
      ? passwordResetEmail({ fullName: user.full_name, resetUrl: url })
      : verificationEmail({ fullName: user.full_name, verificationUrl: url });
    await db.batch([
      { sql: 'UPDATE users SET updated_at=updated_at WHERE id=?', params: [user.id] },
      {
        sql: 'DELETE FROM action_tokens WHERE user_id=? AND purpose=?',
        params: [user.id, purpose],
      },
      {
        sql: 'INSERT INTO action_tokens VALUES (?,?,?,?)',
        params: [digest(token), user.id, purpose, now + (purpose === 'reset' ? 1800000 : 86400000)],
      },
      {
        sql: 'INSERT INTO mail_queue (id,recipient,subject,body,html,created_at) VALUES (?,?,?,?,?,?)',
        params: [
          randomUUID(),
          user.email,
          email.subject,
          email.text,
          email.html,
          now,
        ],
      },
    ]);
  };
  app.post('/api/auth/register', authLimit, async (req, res) => {
    const { fullName, password, confirmPassword, agree } = req.body;
    const email = emailValue(req.body.email);
    if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 100)
      return failure(res, 400, 'Please enter your full name (2–100 characters).');
    if (!validEmail(email)) return failure(res, 400, 'Enter a valid email address.');
    if (!validPassword(password))
      return failure(res, 400, 'Password must contain 8–128 characters.');
    if (password !== confirmPassword) return failure(res, 400, 'Passwords do not match.');
    if (agree !== true)
      return failure(res, 400, 'Please agree to the Terms of Use and Privacy Policy.');
    const passwordHash = await hashPassword(password);
    const now = Date.now();
    const id = randomUUID();
    try {
      await db
        .prepare(
          `INSERT INTO users (id,full_name,email,password_hash,terms_accepted_at,terms_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`,
        )
        .run(id, fullName.trim(), email, passwordHash, now, '2026-09-12', now, now);
    } catch (error) {
      if (String(error.message).includes('UNIQUE') || error.code === 'ER_DUP_ENTRY')
        return failure(
          res,
          409,
          'Unable to create this account. Try logging in or resetting your password.',
        );
      throw error;
    }
    const user = await db.prepare('SELECT * FROM users WHERE id=?').get(id);
    await enqueue(user, 'verify');
    await success(req, res, user, false);
  });
  const login =
    (admin = false) =>
    async (req, res) => {
      const email = emailValue(req.body.email);
      const user = validEmail(email)
        ? await db.prepare('SELECT * FROM users WHERE email=?').get(email)
        : null;
      const password =
        typeof req.body.password === 'string' && req.body.password.length <= 128
          ? req.body.password
          : '';
      const correct = await argon2.verify(user?.password_hash ?? dummyHash, password);
      if (
        !correct ||
        !user?.password_hash ||
        user.account_status !== 'active' ||
        (admin ? user.role !== 'admin' : user.role === 'admin')
      )
        return failure(res, 401, 'Email or password is incorrect.');
      await success(req, res, user, req.body.remember === true);
    };
  app.post('/api/auth/login', authLimit, login());
  app.post('/api/auth/admin/login', authLimit, login(true));
  app.post('/api/auth/logout', async (req, res) => {
    if (req.sessionHash)
      await db.prepare('DELETE FROM sessions WHERE token_hash=?').run(req.sessionHash);
    res.clearCookie(cookieName, cookieOptions);
    res.json({
      ok: true,
    });
  });
  app.post('/api/auth/forgot-password', recoveryLimit, async (req, res) => {
    const email = emailValue(req.body.email);
    if (!validEmail(email)) return failure(res, 400, 'Enter a valid email address.');
    const user = await db
      .prepare("SELECT * FROM users WHERE email=? AND account_status='active'")
      .get(email);
    if (user) await enqueue(user, 'reset');
    res.json({
      message: 'If an account exists for this email, we sent password reset instructions.',
    });
  });
  app.post('/api/auth/reset-password', authLimit, async (req, res) => {
    const { token, password, confirmPassword } = req.body;
    if (!validPassword(password))
      return failure(res, 400, 'Password must contain 8–128 characters.');
    if (password !== confirmPassword) return failure(res, 400, 'Passwords do not match.');
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token))
      return failure(res, 400, 'This reset link is invalid or expired. Request a new link.');
    const passwordHash = await hashPassword(password);
    const item = await db
      .prepare(
        "SELECT * FROM action_tokens WHERE token_hash=? AND purpose='reset' AND expires_at>?",
      )
      .get(digest(token), Date.now());
    if (!item)
      return failure(res, 400, 'This reset link is invalid or expired. Request a new link.');
    await db.batch([
      {
        sql: "DELETE FROM action_tokens WHERE token_hash=? AND purpose='reset' AND expires_at>?",
        params: [digest(token), Date.now()],
        requireChanges: 1,
      },
      {
        sql: "UPDATE users SET password_hash=?,email_verified=1,auth_provider=CASE WHEN google_id IS NULL THEN 'password' ELSE 'password+google' END,updated_at=? WHERE id=?",
        params: [passwordHash, Date.now(), item.user_id],
      },
      {
        sql: 'DELETE FROM sessions WHERE user_id=?',
        params: [item.user_id],
      },
      {
        sql: 'DELETE FROM action_tokens WHERE user_id=?',
        params: [item.user_id],
      },
    ]);
    res.clearCookie(cookieName, cookieOptions);
    res.json({
      message: 'Your password has been reset. Log in with your new password.',
    });
  });
  app.post('/api/auth/resend-verification', recoveryLimit, authenticated, async (req, res) => {
    if (!req.user.email_verified) await enqueue(req.user, 'verify');
    res.json({
      message: 'Check your email for a verification link.',
    });
  });
  app.post('/api/test-email', authenticated, async (req, res) => {
    if (production || req.user.role !== 'admin') return failure(res, 404, 'Not found.');
    const recipient = emailValue(req.body.email);
    if (!validEmail(recipient)) return failure(res, 400, 'Enter a valid email address.');
    await queueEmail({ recipient, ...testEmail({ fullName: req.user.full_name }) });
    res.status(202).json({ message: 'Test email queued for delivery.' });
  });
  app.post('/api/auth/verify-email', authLimit, async (req, res) => {
    const token = req.body.token;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token))
      return failure(res, 400, 'This verification link is invalid or expired.');
    const item = await db
      .prepare(
        "SELECT * FROM action_tokens WHERE token_hash=? AND purpose='verify' AND expires_at>?",
      )
      .get(digest(token), Date.now());
    if (!item) return failure(res, 400, 'This verification link is invalid or expired.');
    await db.batch([
      {
        sql: "DELETE FROM action_tokens WHERE token_hash=? AND purpose='verify' AND expires_at>?",
        params: [digest(token), Date.now()],
        requireChanges: 1,
      },
      {
        sql: 'UPDATE users SET email_verified=1,updated_at=? WHERE id=?',
        params: [Date.now(), item.user_id],
      },
    ]);
    res.json({
      message: 'Your email is verified. You can continue setting up your profile.',
    });
  });
  app.post('/api/auth/google', authLimit, async (req, res) => {
    if (!googleClientId)
      return failure(res, 503, 'Google sign-in is unavailable. Use your email instead.');
    if (typeof req.body.credential !== 'string' || req.body.credential.length > 10000)
      return failure(res, 400, 'Google sign-in did not finish. Please try again.');
    let payload;
    try {
      payload = verifyGoogle
        ? await verifyGoogle(req.body.credential)
        : (
            await google.verifyIdToken({
              idToken: req.body.credential,
              audience: googleClientId,
            })
          ).getPayload();
      if (!payload?.sub || !payload.email_verified || !validEmail(emailValue(payload.email)))
        throw new Error('Invalid Google identity');
    } catch {
      return failure(res, 401, 'Google sign-in could not be verified. Please try again.');
    }
    let user = await db.prepare('SELECT * FROM users WHERE google_id=?').get(payload.sub);
    const email = emailValue(payload.email);
    if (!user) {
      const existing = await db.prepare('SELECT * FROM users WHERE email=?').get(email);
      if (existing) {
        // Prove ownership of the existing account before linking, even for verified Google email.
        if (
          !req.user ||
          req.user.id !== existing.id ||
          !existing.email_verified ||
          existing.google_id ||
          existing.role !== 'job_seeker'
        )
          return failure(
            res,
            409,
            'To connect this Google account, log in with your email and password first, verify your email, then use Connect Google in your account.',
          );
        if (
          typeof req.body.linkingPassword !== 'string' ||
          req.body.linkingPassword.length > 128 ||
          !existing.password_hash ||
          !(await argon2.verify(existing.password_hash, req.body.linkingPassword))
        )
          return failure(res, 401, 'Confirm your current password to connect Google.');
        await db
          .prepare(
            "UPDATE users SET google_id=?,auth_provider='password+google',updated_at=? WHERE id=?",
          )
          .run(payload.sub, Date.now(), existing.id);
        user = await db.prepare('SELECT * FROM users WHERE id=?').get(existing.id);
      } else {
        if (req.user)
          return failure(
            res,
            409,
            'Choose the Google account with the same email as your account.',
          );
        if (req.body.agree !== true)
          return failure(
            res,
            400,
            'Please agree to the Terms of Use and Privacy Policy to create an account with Google.',
          );
        const id = randomUUID();
        const now = Date.now();
        const authoritative = email.endsWith('@gmail.com') || Boolean(payload.hd);
        let photo = null;
        try {
          if (payload.picture && new URL(payload.picture).protocol === 'https:')
            photo = payload.picture;
        } catch {
          /* Optional photo. */
        }
        await db
          .prepare(
            `INSERT INTO users (id,full_name,email,google_id,profile_photo,auth_provider,email_verified,terms_accepted_at,terms_version,created_at,updated_at) VALUES (?,?,?,?,?,'google',?,?,?,?,?)`,
          )
          .run(
            id,
            (payload.name || email.split('@')[0]).slice(0, 100),
            email,
            payload.sub,
            photo,
            authoritative ? 1 : 0,
            now,
            '2026-09-12',
            now,
            now,
          );
        user = await db.prepare('SELECT * FROM users WHERE id=?').get(id);
        if (!authoritative) await enqueue(user, 'verify');
      }
    }
    if (user.account_status !== 'active' || user.role === 'admin')
      return failure(res, 401, 'Unable to sign in with this account.');
    if (req.user && req.user.id !== user.id)
      return failure(res, 409, 'Choose the Google account with the same email as your account.');
    await success(req, res, user, req.body.remember === true);
  });
  app.get('/api/profile', authenticated, async (req, res) => {
    const profile =
      (await db
        .prepare(
          'SELECT province,municipality,education,skills,preferred_job,work_setup,step FROM profiles WHERE user_id=?',
        )
        .get(req.user.id)) ?? null;
    res.json({
      user: publicUser(req.user),
      profile,
    });
  });
  app.post('/api/role', authenticated, async (req, res) => {
    const role = req.body.role;
    if (!['job_seeker', 'employer'].includes(role)) return failure(res, 400, 'Choose Job Seeker or Employer.');
    if (req.user.role_selected) return failure(res, 409, 'Your role has already been selected.');
    await db.prepare('UPDATE users SET role=?,role_selected=1,updated_at=? WHERE id=?').run(role, Date.now(), req.user.id);
    const user = await db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
    res.json({ user: publicUser(user), redirect: role === 'job_seeker' ? '/onboarding/job-seeker' : '/onboarding/employer' });
  });
  app.get('/api/employer/profile', authenticated, async (req, res) => {
    if (req.user.role !== 'employer') return failure(res, 403, 'This profile is for employers.');
    res.json({ profile: await db.prepare('SELECT * FROM employer_profiles WHERE user_id=?').get(req.user.id) ?? null });
  });
  app.put('/api/employer/profile', authenticated, async (req, res) => {
    if (req.user.role !== 'employer') return failure(res, 403, 'This profile is for employers.');
    const b=req.body, required=['company_name','industry','province','municipality','contact_person','contact_position','business_email','contact_number'];
    if (required.some((key)=>typeof b[key] !== 'string'||!b[key].trim()) || !validEmail(emailValue(b.business_email))) return failure(res,400,'Complete the required company and contact details.');
    const values=['company_name','industry','description','address','province','municipality','company_size','contact_person','contact_position','business_email','contact_number','website'].map((key)=>String(b[key]??'').trim().slice(0,key==='description'||key==='address'?2000:255));
    await db.prepare('INSERT INTO employer_profiles (user_id,company_name,industry,description,address,province,municipality,company_size,contact_person,contact_position,business_email,contact_number,website,verification_status,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,? ,\'pending\',?) ON CONFLICT(user_id) DO UPDATE SET company_name=excluded.company_name,industry=excluded.industry,description=excluded.description,address=excluded.address,province=excluded.province,municipality=excluded.municipality,company_size=excluded.company_size,contact_person=excluded.contact_person,contact_position=excluded.contact_position,business_email=excluded.business_email,contact_number=excluded.contact_number,website=excluded.website,updated_at=excluded.updated_at').run(req.user.id,...values,Date.now());
    await writeAudit(db, { actorId: req.user.id, action: 'company.profile_updated', entityType: 'company', entityId: req.user.id, details: { companyName: values[0] } });
    res.json({ message:'Company profile saved.' });
  });
  app.post('/api/employer/verification', authenticated, verificationUpload.array('documents',3), async (req,res) => {
    if(req.user.role!=='employer') return failure(res,403,'This action is for employers.'); const profile=await db.prepare('SELECT * FROM employer_profiles WHERE user_id=?').get(req.user.id); if(!profile||!req.files?.length) return failure(res,400,'Save your company profile and add at least one document.');
    await mkdir(join('server','data','verification-documents'),{recursive:true}); const now=Date.now();
    for(const file of req.files){const id=randomUUID(), path=join('server','data','verification-documents',`${req.user.id}-${id}`);await writeFile(path,file.buffer,{mode:0o600});await db.prepare('INSERT INTO employer_documents VALUES (?,?,?,?,?,?,?)').run(id,req.user.id,'verification',path,basename(file.originalname).slice(0,255),file.size,now);}
    await db.prepare("UPDATE employer_profiles SET verification_status='pending',verification_reason=NULL,updated_at=? WHERE user_id=?").run(now,req.user.id);
    await queueEmail({ recipient: profile.business_email, ...employerSubmittedEmail({ fullName: profile.contact_person, companyName: profile.company_name }) });
    await writeAudit(db, { actorId: req.user.id, action: 'company.submitted', entityType: 'company', entityId: req.user.id, details: { companyName: profile.company_name, status: 'pending', previousStatus: profile.verification_status, count: req.files.length } });
    res.json({message:'Your company is under review.'});
  });
  const employerProfile = async (userId) => db.prepare('SELECT * FROM employer_profiles WHERE user_id=?').get(userId);
  const normalizedJob = (b) => `Job Title: ${b.title}\nIndustry: ${b.industry}\nDescription: ${b.description}\nRequired Skills: ${(b.required_skills || []).join(', ')}\nPreferred Skills: ${(b.preferred_skills || []).join(', ')}\nEducation: ${b.education_required || 'Not specified'}\nExperience: ${b.experience_required || 0} years\nWork Setup: ${b.work_setup}\nLocation: ${b.municipality}, ${b.province}`;
  const jobBody = (b) => ({ title:String(b.title||'').trim(),description:String(b.description||'').trim(),industry:String(b.industry||'').trim(),province:String(b.province||'').trim(),municipality:String(b.municipality||'').trim(),employment_type:String(b.employment_type||'').trim(),work_setup:String(b.work_setup||'').trim(),salary_min:Number(b.salary_min)||null,salary_max:Number(b.salary_max)||null,vacancies:Math.max(1,Number(b.vacancies)||1),education_required:String(b.education_required||'').trim()||null,experience_required:Math.max(0,Number(b.experience_required)||0),required_skills:normalizeSkills(Array.isArray(b.required_skills)?b.required_skills:[]),preferred_skills:normalizeSkills(Array.isArray(b.preferred_skills)?b.preferred_skills:[]),application_deadline:b.application_deadline?Number(b.application_deadline):null });
  const applicationScore = async (profile, job) => {
    const candidate=JSON.parse(profile.data), required=JSON.parse(job.required_skills).map(String), skills=new Set((candidate.skills??[]).map((x)=>String(x).toLowerCase()));
    const matched=required.filter((x)=>skills.has(x.toLowerCase())), missing=required.filter((x)=>!skills.has(x.toLowerCase()));
    const rank = educationRank;
    const skills_score=required.length?matched.length/required.length:1, location_score=job.work_setup==='Remote'?1:job.municipality===candidate.municipality?1:job.province===candidate.province?.8:.4, education_score=!job.education_required||rank(candidate.education)>=rank(job.education_required)?1:0, experience_score=Number(candidate.experience_years??0)>=job.experience_required?1:job.experience_required===0?1:Number(candidate.experience_years??0)/job.experience_required;
    let semantic_score=0, semantic_engine='text_overlap_fallback'; const words=new Set(`${candidate.preferred_job??''} ${(candidate.skills??[]).join(' ')}`.toLowerCase().split(/\W+/)); const jobWords=`${job.title} ${job.description} ${required.join(' ')}`.toLowerCase().split(/\W+/).filter(Boolean); semantic_score=jobWords.length?jobWords.filter((x)=>words.has(x)).length/new Set(jobWords).size:0;
    try { semantic_score=await scoreSemantic(profile.normalized_profile_text,job.normalized_job_text||normalizedJob({...job,required_skills:required,preferred_skills:JSON.parse(job.preferred_skills)}),aiServiceUrl); semantic_engine='sentence_transformer'; } catch {}
    const final_score=clamp(semantic_score*.45+skills_score*.25+location_score*.15+education_score*.1+experience_score*.05);
    return {matched_skills:matched,missing_skills:missing,semantic_score,semantic_engine,skills_score,location_score,education_score,experience_score,final_score,match_percentage:Math.round(final_score*100)};
  };
  app.get('/api/employer/jobs', authenticated, async (req,res)=>{ if(req.user.role!=='employer') return failure(res,403,'Employer access required.'); res.json({jobs:await db.prepare('SELECT * FROM jobs WHERE employer_id=? ORDER BY created_at DESC').all(req.user.id)}); });
  app.post('/api/employer/jobs', authenticated, async (req, res) => {
    if (req.user.role !== 'employer') return failure(res, 403, 'Employer access required.');
    const p = await employerProfile(req.user.id), b = jobBody(req.body);
    if (!p || !b.title || !b.description || !b.industry || !b.province || !b.municipality) return failure(res, 400, 'Complete required job details.');
    const status = req.body.publish === true ? 'active' : 'draft';
    if (status === 'active' && p.verification_status !== 'verified') return failure(res, 403, 'Company verification is required before publishing jobs.');
    const id = randomUUID(), now = Date.now();
    await db.batch([
      { sql: 'INSERT INTO jobs (id,employer_id,title,company_name,description,industry,province,municipality,employment_type,work_setup,salary_min,salary_max,required_skills,preferred_skills,education_required,experience_required,status,created_at,vacancies,application_deadline,normalized_job_text,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', params: [id, req.user.id, b.title, p.company_name, b.description, b.industry, b.province, b.municipality, b.employment_type, b.work_setup, b.salary_min, b.salary_max, JSON.stringify(b.required_skills), JSON.stringify(b.preferred_skills), b.education_required, b.experience_required, status, now, b.vacancies, b.application_deadline, normalizedJob(b), now] },
      auditOperation({ actorId: req.user.id, action: 'job.created', entityType: 'job', entityId: id, details: { companyName: p.company_name, title: b.title, status } }),
    ]);
    res.status(201).json({ id, status });
  });
  for (const [action, previousStatus, status] of [['publish', 'draft', 'active'], ['close', 'active', 'closed']]) {
    app.post(`/api/employer/jobs/:id/${action}`, authenticated, async (req, res) => {
      if (req.user.role !== 'employer') return failure(res, 403, 'Employer access required.');
      const company = await employerProfile(req.user.id);
      if (action === 'publish' && company?.verification_status !== 'verified') return failure(res, 403, 'Company verification is required before publishing jobs.');
      const job = await db.prepare('SELECT title FROM jobs WHERE id=? AND employer_id=? AND status=?').get(req.params.id, req.user.id, previousStatus);
      if (!job) return failure(res, 404, 'Job not found in the required status.');
      try {
        await db.batch([
          { sql: 'UPDATE jobs SET status=?,updated_at=? WHERE id=? AND employer_id=? AND status=?', params: [status, Date.now(), req.params.id, req.user.id, previousStatus], requireChanges: 1 },
          auditOperation({ actorId: req.user.id, action: action === 'publish' ? 'job.published' : 'job.closed', entityType: 'job', entityId: req.params.id, details: { title: job.title, status, previousStatus } }),
        ]);
      } catch (error) {
        if (error.code === 'ACTION_CONFLICT') return failure(res, 409, 'This job changed. Refresh the list and try again.');
        throw error;
      }
      res.json({ status });
    });
  }
  app.get('/api/admin/employer-verifications', authenticated, async (req,res)=>{if(req.user.role!=='admin')return failure(res,403,'Admin access required.'); const status = req.query.status || 'pending'; if (!['pending','verified','rejected'].includes(status)) return failure(res,400,'Invalid status.'); res.json({employers:await db.prepare('SELECT * FROM employer_profiles WHERE verification_status=? ORDER BY updated_at DESC').all(status)});});
  app.get('/api/admin/employer-verifications/:id', authenticated, async (req,res) => {
    if(req.user.role !== 'admin') return failure(res,403,'Admin access required.');
    const profile = await employerProfile(req.params.id);
    if(!profile) return failure(res,404,'Company not found.');
    const documents = await db.prepare('SELECT id,document_type,original_filename,file_size,uploaded_at FROM employer_documents WHERE user_id=? ORDER BY uploaded_at DESC').all(req.params.id);
    res.json({profile,documents});
  });
  app.get('/api/admin/verification-documents/:id', authenticated, async (req,res) => {
    if(req.user.role !== 'admin') return failure(res,403,'Admin access required.');
    const doc = await db.prepare('SELECT storage_path,original_filename FROM employer_documents WHERE id=?').get(req.params.id);
    if(!doc) return failure(res,404,'Document not found.');
    const root = resolve('server/data/verification-documents'); const path = resolve(doc.storage_path);
    if(!path.startsWith(root + '\\') && !path.startsWith(root + '/')) return failure(res,404,'Document not found.');
    res.download(path, basename(doc.original_filename));
  });
  for (const action of ['approve', 'reject']) {
    app.post(`/api/admin/employer-verifications/:id/${action}`, authenticated, async (req, res) => {
      if (req.user.role !== 'admin') return failure(res, 403, 'Admin access required.');
      const reason = String(req.body.rejection_reason || '').trim();
      if (action === 'reject' && (!reason || reason.length > 500)) return failure(res, 400, 'Provide a rejection reason.');
      const profile = await employerProfile(req.params.id);
      if (!profile) return failure(res, 404, 'Employer not found.');
      const status = action === 'approve' ? 'verified' : 'rejected';
      if (profile.verification_status === status) return failure(res, 409, `This company is already ${status}. Refresh the queue.`);
      const now = Date.now();
      const operations = [
        { sql: 'UPDATE employer_profiles SET verification_status=?,verification_reason=?,verified_at=?,verified_by=?,updated_at=? WHERE user_id=? AND verification_status=?', params: [status, action === 'reject' ? reason : null, action === 'approve' ? now : null, req.user.id, now, req.params.id, profile.verification_status], requireChanges: 1 },
        auditOperation({ actorId: req.user.id, action: `company.${status}`, entityType: 'company', entityId: req.params.id, details: { companyName: profile.company_name, status, previousStatus: profile.verification_status, ...(reason ? { reason } : {}) } }),
      ];
      // Reserved local demo accounts have no deliverable mailbox.
      if (!profile.business_email.endsWith('@demo.mimaropa.test')) {
        const email = action === 'approve' ? employerApprovedEmail({ fullName: profile.contact_person, companyName: profile.company_name }) : employerRejectedEmail({ fullName: profile.contact_person, companyName: profile.company_name, reason });
        operations.push({ sql: 'INSERT INTO mail_queue (id,recipient,subject,body,html,created_at) VALUES (?,?,?,?,?,?)', params: [randomUUID(), profile.business_email, email.subject, email.text, email.html ?? null, now] });
      }
      try { await db.batch(operations); }
      catch (error) {
        if (error.code === 'ACTION_CONFLICT') return failure(res, 409, 'This company changed. Refresh the queue and try again.');
        throw error;
      }
      res.json({ status });
    });
  }
  const recommendationsFor = async (profile) => {
    const candidate = JSON.parse(profile.data);
    const skills = new Set((candidate.skills ?? []).map((value) => String(value).trim().toLowerCase()));
    const rank = educationRank;
    const jobs = await db.prepare("SELECT j.* FROM jobs j JOIN employer_profiles ep ON ep.user_id=j.employer_id JOIN users u ON u.id=j.employer_id WHERE j.status='active' AND ep.verification_status='verified' AND u.account_status='active' AND u.role='employer' AND (j.application_deadline IS NULL OR j.application_deadline>=?) ORDER BY j.created_at DESC,j.id").all(Date.now());
    const candidateText = profile.normalized_profile_text;
    const recommendations = await Promise.all(jobs.map(async (job) => {
      const required = JSON.parse(job.required_skills).map((s) => String(s));
      const matched = required.filter((s) => skills.has(s.toLowerCase()));
      const missing = required.filter((s) => !skills.has(s.toLowerCase()));
      const skillsScore = required.length ? matched.length / required.length : 1;
      const locationScore = job.work_setup === 'Remote' ? 1 : job.municipality === candidate.municipality ? 1 : job.province === candidate.province ? .8 : candidate.willing_to_relocate ? .4 : .4;
      const educationScore = !job.education_required ? 1 : rank(candidate.education) >= rank(job.education_required) ? 1 : rank(candidate.education) === rank(job.education_required) - 1 ? .5 : 0;
      const experienceScore = Number(candidate.experience_years ?? 0) >= job.experience_required ? 1 : job.experience_required === 0 ? 1 : Number(candidate.experience_years ?? 0) / job.experience_required;
      const candidateWords = new Set(`${candidate.preferred_job ?? ''} ${(candidate.skills ?? []).join(' ')}`.toLowerCase().split(/\W+/));
      const jobWords = `${job.title} ${job.description} ${required.join(' ')}`.toLowerCase().split(/\W+/).filter(Boolean);
      const fallback = jobWords.length ? jobWords.filter((word) => candidateWords.has(word)).length / new Set(jobWords).size : 0;
      const jobText = `Job Title: ${job.title}\nIndustry: ${job.industry}\nDescription: ${job.description}\nRequired Skills: ${required.join(', ')}\nPreferred Skills: ${JSON.parse(job.preferred_skills).join(', ')}\nEducation: ${job.education_required ?? 'Not specified'}\nExperience: ${job.experience_required} years\nLocation: ${job.municipality}, ${job.province}`;
      let semantic = fallback, semanticEngine = 'text_overlap_fallback';
      try { semantic = await scoreSemantic(candidateText, jobText, aiServiceUrl); semanticEngine = 'sentence_transformer'; }
      catch {}
      const finalScore = clamp(semantic*.45 + skillsScore*.25 + locationScore*.15 + educationScore*.1 + experienceScore*.05);
      if (process.env.DEBUG_MATCHING === 'true') console.info(`[AI MATCH] Job: ${job.title}; Semantic engine: ${semanticEngine}; Semantic score: ${semantic.toFixed(2)}; Skills score: ${skillsScore.toFixed(2)}; Location score: ${locationScore.toFixed(2)}; Education score: ${educationScore.toFixed(2)}; Experience score: ${experienceScore.toFixed(2)}; Final score: ${finalScore.toFixed(2)}`);
      return { ...job, required_skills: required, preferred_skills: JSON.parse(job.preferred_skills), matched_skills: matched, missing_skills: missing, semantic_score: semantic, semantic_engine: semanticEngine, skills_score: skillsScore, location_score: locationScore, education_score: educationScore, experience_score: experienceScore, final_score: finalScore, match_percentage: Math.round(finalScore * 100) };
    }));
    recommendations.sort((a,b) => b.final_score-a.final_score);
    return recommendations;
  };
  const seekerProfile = async (req,res) => {
    if(req.user.role!=='job_seeker'||!req.user.role_selected){failure(res,403,'This page is for job seekers.');return null;}
    const profile=await db.prepare('SELECT * FROM job_seeker_profiles WHERE user_id=?').get(req.user.id);
    if(!profile?.completed){failure(res,403,'Complete your profile first.');return null;}
    return profile;
  };
  app.get('/api/jobs/recommended',authenticated,async(req,res)=>{
    const profile=await seekerProfile(req,res);if(!profile)return;
    res.json({recommendations:await recommendationsFor(profile)});
  });
  app.get('/api/job-seeker/home',authenticated,async(req,res)=>{
    const profile=await seekerProfile(req,res);if(!profile)return;
    const all=await recommendationsFor(profile);
    const recommendations=all.filter(j=>!j.application_deadline||Number(j.application_deadline)>=Date.now());
    const gap=skillsGap(recommendations,normalizeSkills(JSON.parse(profile.data).skills||[]));
    const careers=await careerSuggestions(profile,(candidate,occupation)=>scoreSemantic(candidate,occupation,aiServiceUrl));
    const applications=await db.prepare('SELECT status,COUNT(*) AS count FROM applications WHERE job_seeker_id=? GROUP BY status').all(req.user.id);
    res.json({recommendations,skills_gap:gap,careers,training:trainingFor(gap),applications:applications.map(a=>({status:a.status,count:Number(a.count)}))});
  });
  app.get('/api/jobs/:id', authenticated, async (req,res)=>{const job=await db.prepare('SELECT j.*,ep.verification_status FROM jobs j LEFT JOIN employer_profiles ep ON ep.user_id=j.employer_id WHERE j.id=?').get(req.params.id);if(!job||job.status!=='active'||(job.application_deadline&&job.application_deadline<Date.now()))return failure(res,404,'Job is unavailable.');let match=null,applied=false;if(req.user.role==='job_seeker'){const p=await db.prepare('SELECT * FROM job_seeker_profiles WHERE user_id=?').get(req.user.id);if(p?.completed)match=await applicationScore(p,job);applied=Boolean(await db.prepare('SELECT id FROM applications WHERE job_id=? AND job_seeker_id=?').get(job.id,req.user.id));}res.json({job:{...job,required_skills:JSON.parse(job.required_skills),preferred_skills:JSON.parse(job.preferred_skills)},match,applied});});
  app.post('/api/jobs/:id/apply', authenticated, async (req,res)=>{if(req.user.role!=='job_seeker')return failure(res,403,'Only job seekers can apply.');const job=await db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);if(!job||job.status!=='active'||(job.application_deadline&&job.application_deadline<Date.now()))return failure(res,400,'This job is no longer accepting applications.');const profile=await db.prepare('SELECT * FROM job_seeker_profiles WHERE user_id=?').get(req.user.id);if(!profile?.completed)return failure(res,403,'Complete your profile before applying.');if(await db.prepare('SELECT id FROM applications WHERE job_id=? AND job_seeker_id=?').get(job.id,req.user.id))return failure(res,409,'You have already applied for this job.');const score=await applicationScore(profile,job),now=Date.now();try{await db.prepare('INSERT INTO applications VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),job.id,req.user.id,'submitted',score.match_percentage,score.semantic_score,score.skills_score,score.location_score,score.education_score,score.experience_score,JSON.stringify(score.matched_skills),JSON.stringify(score.missing_skills),now,now);res.status(201).json({message:'Application submitted.',application:{status:'submitted',...score}})}catch(error){if(error.code==='ER_DUP_ENTRY'||String(error.message).includes('UNIQUE'))return failure(res,409,'You have already applied for this job.');throw error}});
  app.get('/api/applications', authenticated, async (req,res)=>{if(req.user.role!=='job_seeker')return failure(res,403,'This page is for job seekers.');const rows=await db.prepare('SELECT a.*,j.title,j.company_name,j.municipality,j.province FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.job_seeker_id=? ORDER BY a.applied_at DESC').all(req.user.id);res.json({applications:rows.map((a)=>({...a,matched_skills:JSON.parse(a.matched_skills),missing_skills:JSON.parse(a.missing_skills)}))});});
  app.post('/api/applications/:id/withdraw', authenticated, async (req,res)=>{if(req.user.role!=='job_seeker')return failure(res,403,'This action is for job seekers.');const r=await db.prepare("UPDATE applications SET status='withdrawn',updated_at=? WHERE id=? AND job_seeker_id=? AND status IN ('submitted','under_review','shortlisted')").run(Date.now(),req.params.id,req.user.id);if(!r.changes)return failure(res,400,'This application cannot be withdrawn.');res.json({status:'withdrawn'});});
  app.get('/api/employer/applicants', authenticated, async (req,res)=>{if(req.user.role!=='employer')return failure(res,403,'Employer access required.');const rows=await db.prepare('SELECT a.*,j.title,j.company_name,u.full_name,p.data FROM applications a JOIN jobs j ON j.id=a.job_id JOIN users u ON u.id=a.job_seeker_id LEFT JOIN job_seeker_profiles p ON p.user_id=u.id WHERE j.employer_id=? ORDER BY a.match_score DESC,a.applied_at DESC').all(req.user.id);res.json({applications:await Promise.all(rows.map(async (a)=>{ const profile=a.data?JSON.parse(a.data):{}; const resume=await db.prepare('SELECT original_filename FROM resumes WHERE user_id=? ORDER BY uploaded_at DESC LIMIT 1').get(a.job_seeker_id); const {data,job_seeker_id,...safe}=a; return {...safe,matched_skills:JSON.parse(a.matched_skills),missing_skills:JSON.parse(a.missing_skills),resume:{available:Boolean(resume),original_filename:resume?.original_filename},profile:{province:profile.province,municipality:profile.municipality,education:profile.education,course:profile.course,skills:profile.skills,recent_job_title:profile.recent_job_title,experience_snippets:profile.experience_snippets}};}))});});
  app.get('/api/employer/applications/:id/resume', authenticated, async (req,res)=>{if(req.user.role!=='employer')return failure(res,403,'Employer access required.');const resume=await db.prepare('SELECT r.storage_path,r.original_filename FROM applications a JOIN jobs j ON j.id=a.job_id JOIN resumes r ON r.user_id=a.job_seeker_id WHERE a.id=? AND j.employer_id=? ORDER BY r.uploaded_at DESC LIMIT 1').get(req.params.id,req.user.id);if(!resume)return failure(res,404,'Resume not available.');const root=resolve('server/data/resumes');const path=resolve(resume.storage_path);if(!path.startsWith(root+'\\')&&!path.startsWith(root+'/'))return failure(res,404,'Resume not available.');res.download(path,basename(resume.original_filename));});
  app.post('/api/employer/applications/:id/status', authenticated, async (req,res)=>{if(req.user.role!=='employer')return failure(res,403,'Employer access required.');const status=String(req.body.status||'');if(!['under_review','shortlisted','rejected'].includes(status))return failure(res,400,'Invalid application status.');const r=await db.prepare("UPDATE applications SET status=?,updated_at=? WHERE id=? AND status IN ('submitted','under_review') AND job_id IN (SELECT id FROM jobs WHERE employer_id=?)").run(status,Date.now(),req.params.id,req.user.id);if(!r.changes)return failure(res,404,'Application not found.');res.json({status});});
  app.get('/api/resume', authenticated, async (req, res) => {
    const resume = await db.prepare('SELECT id,original_filename,file_size,parsing_status,analysis,uploaded_at,parsed_at FROM resumes WHERE user_id=? ORDER BY uploaded_at DESC LIMIT 1').get(req.user.id);
    res.json({ resume: resume ? { ...resume, analysis: resume.analysis ? JSON.parse(resume.analysis) : null } : null });
  });
  app.post('/api/resume', authenticated, resumeUpload.single('resume'), async (req, res) => {
    if (req.user.role !== 'job_seeker') return failure(res, 403, 'Only job seekers can upload a resume.');
    if (!req.file || !req.file.buffer.length) return failure(res, 400, 'Choose a non-empty PDF file up to 5 MB.');
    const id = randomUUID(), filename = `${req.user.id}-${id}.pdf`, storagePath = join('server', 'data', 'resumes', filename);
    await mkdir(join('server', 'data', 'resumes'), { recursive: true });
    await writeFile(storagePath, req.file.buffer, { mode: 0o600 });
    const now = Date.now();
    await db.prepare('INSERT INTO resumes VALUES (?,?,?,?,?,?,?,?,?)').run(id, req.user.id, storagePath, basename(req.file.originalname).slice(0,255), req.file.size, 'processing', null, now, null);
    try {
      const form = new FormData(); form.append('file', new Blob([req.file.buffer], { type: 'application/pdf' }), 'resume.pdf');
      const response = await fetch(`${aiServiceUrl.replace(/\/$/, '')}/ai/resume/analyze`, { method: 'POST', body: form, signal: AbortSignal.timeout(10000) });
      const analysis = await response.json(); if (!response.ok) throw new Error('Resume parsing failed.');
      await db.prepare('UPDATE resumes SET parsing_status=?,analysis=?,parsed_at=? WHERE id=? AND user_id=?').run(analysis.resume_text_available ? 'completed' : 'failed', JSON.stringify(analysis), Date.now(), id, req.user.id);
      res.status(201).json({ resume: { id, original_filename: basename(req.file.originalname), file_size: req.file.size, parsing_status: analysis.resume_text_available ? 'completed' : 'failed', analysis } });
    } catch (error) {
      await db.prepare('UPDATE resumes SET parsing_status=? WHERE id=? AND user_id=?').run('failed', id, req.user.id);
      res.status(202).json({ resume: { id, original_filename: basename(req.file.originalname), file_size: req.file.size, parsing_status: 'failed' }, message: 'We could not automatically read this resume. Your existing profile is safe.' });
    }
  });
  app.delete('/api/resume/:id', authenticated, async (req, res) => {
    const resume = await db.prepare('SELECT storage_path FROM resumes WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
    if (!resume) return failure(res, 404, 'Resume not found.');
    await db.prepare('DELETE FROM resumes WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
    await unlink(resume.storage_path).catch(() => {}); res.status(204).end();
  });
  app.post('/api/resume/:id/merge', authenticated, async (req, res) => {
    if (req.user.role !== 'job_seeker') return failure(res, 403, 'Only job seekers can update this profile.');
    const resume = await db.prepare('SELECT analysis FROM resumes WHERE id=? AND user_id=? AND parsing_status=?').get(req.params.id, req.user.id, 'completed');
    const base = await db.prepare('SELECT * FROM profiles WHERE user_id=?').get(req.user.id);
    if (!resume || !base) return failure(res, 404, 'Analyzed resume or profile not found.');
    const detected = JSON.parse(resume.analysis); const requested = Array.isArray(req.body.skills) ? req.body.skills : [];
    const allowed = new Set(detected.detected_skills || []);
    const accepted = requested.filter((skill) => typeof skill === 'string' && (allowed.has(skill) || skill.length <= 80));
    const skills = normalizeSkills([...base.skills.split(',').map((value) => value.trim()), ...accepted]);
    const use = req.body.use_resume === true;
    const extra = { skills, education: use && detected.detected_education ? detected.detected_education : base.education, course: use ? detected.detected_course : null, recent_job_title: use ? detected.detected_job_titles?.[0] : null, experience_snippets: use ? detected.experience_snippets ?? [] : [] };
    const dataRow = await db.prepare('SELECT data FROM job_seeker_profiles WHERE user_id=?').get(req.user.id);
    const data = { ...(dataRow ? JSON.parse(dataRow.data) : {}), ...extra, skills };
    await db.batch([{ sql: 'UPDATE profiles SET skills=?,education=? WHERE user_id=?', params: [skills.join(', '), extra.education, req.user.id] }, { sql: 'INSERT INTO job_seeker_profiles (user_id,data,normalized_profile_text,onboarding_step,completed,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,normalized_profile_text=excluded.normalized_profile_text,updated_at=excluded.updated_at', params: [req.user.id, JSON.stringify(data), normalizedProfile(base, extra), 6, 1, Date.now()] }]);
    res.json({ message: 'Your profile has been updated. Your job recommendations have been refreshed.', skills });
  });
  app.put('/api/profile', authenticated, async (req, res) => {
    if (req.user.role !== 'job_seeker')
      return failure(res, 403, 'This profile is for job seekers.');
    const b = req.body;
    const fields = [
      'province',
      'municipality',
      'education',
      'skills',
      'preferred_job',
      'work_setup',
    ];
    if (
      fields.some(
        (key) => typeof b[key] !== 'string' || b[key].length > (key === 'skills' ? 1000 : 150),
      )
    )
      return failure(res, 400, 'Please check your profile details.');
    if (!Number.isInteger(b.step) || b.step < 0 || b.step > 2)
      return failure(res, 400, 'Invalid profile step.');
    if (b.province && !provinces.includes(b.province))
      return failure(res, 400, 'Choose a province in MIMAROPA.');
    const fieldLabels = {
      province: 'Province', municipality: 'Municipality or city', education: 'Educational attainment',
      skills: 'Skills', preferred_job: 'Preferred job', work_setup: 'Work setup',
    };
    const missing = fields.filter((key) => !b[key].trim()).map((key) => fieldLabels[key]);
    if (b.complete && (missing.length || !provinces.includes(b.province)))
      return failure(res, 400, `Complete: ${missing.join(', ') || 'a province in MIMAROPA'}.`);
    if (b.complete && !req.user.email_verified)
      return failure(
        res,
        403,
        'Verify your email before completing your profile. Your progress can still be saved.',
      );
    const completion = b.complete
      ? 100
      : Math.min(
          90,
          Math.round((fields.filter((key) => b[key].trim()).length / fields.length) * 90),
        );
    await db.batch([
      {
        sql: 'INSERT INTO profiles VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET province=excluded.province,municipality=excluded.municipality,education=excluded.education,skills=excluded.skills,preferred_job=excluded.preferred_job,work_setup=excluded.work_setup,step=excluded.step',
        params: [req.user.id, ...fields.map((key) => b[key].trim()), b.step],
      },
      {
        sql: 'UPDATE users SET profile_completion=?,updated_at=? WHERE id=?',
        params: [completion, Date.now(), req.user.id],
      },
      ...(b.complete ? [{
        sql: 'INSERT INTO job_seeker_profiles (user_id,data,normalized_profile_text,onboarding_step,completed,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,normalized_profile_text=excluded.normalized_profile_text,onboarding_step=excluded.onboarding_step,completed=excluded.completed,updated_at=excluded.updated_at',
        params: [req.user.id, JSON.stringify({ province: b.province.trim(), municipality: b.municipality.trim(), education: b.education.trim(), skills: b.skills.split(',').map((s) => s.trim()).filter(Boolean), preferred_job: b.preferred_job.trim(), work_setup: b.work_setup.trim(), experience_years: 0, willing_to_relocate: false }), `Preferred role: ${b.preferred_job.trim()}\nSkills: ${b.skills.trim()}\nEducation: ${b.education.trim()}\nLocation: ${b.municipality.trim()}, ${b.province.trim()}`, 6, 1, Date.now()],
      }] : []),
    ]);
    const user = await db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
    res.json({
      user: publicUser(user),
      redirect: redirectFor(user),
    });
  });
  app.get('/api/dashboard', authenticated, async (req, res) => {
    if (req.user.role !== 'job_seeker')
      return failure(res, 403, 'This dashboard is for job seekers.');
    if (req.user.profile_completion < 100 || !req.user.email_verified)
      return res.status(403).json({
        message: 'Complete your profile first.',
        redirect: '/onboarding',
      });
    res.json({
      user: publicUser(req.user),
      message:
        'Your basic profile is ready. Documents and AI matching will be available in the next module.',
    });
  });
  app.get('/api/admin', authenticated, async (req, res) =>
    req.user.role === 'admin'
      ? res.json({
          user: publicUser(req.user),
        })
      : failure(res, 403, 'Access denied.'),
  );
  registerJobSeekerRoutes(app, { db, authenticated, normalizeSkills, normalizedProfile, provinces });
  registerAdminRoutes(app, { db, authenticated });
  registerCareerToolRoutes(app, { db, authenticated });
  app.use('/api', async (req, res) => failure(res, 404, 'This endpoint does not exist.'));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large')
      return failure(res, 400, 'Invalid request.');
    if (error instanceof multer.MulterError || error.code === 'LIMIT_FILE_SIZE')
      return failure(res, 400, 'Choose a PDF file up to 5 MB.');
    if (error.code === 'ACTION_CONFLICT')
      return failure(res, 400, 'This link has already been used or expired. Request a new link.');
    console.error('API request failed:', error.code ?? error.name);
    failure(res, 500, 'Something went wrong. Please try again.');
  });
  return app;
}
