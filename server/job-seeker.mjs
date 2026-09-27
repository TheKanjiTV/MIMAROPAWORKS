import { randomUUID } from 'node:crypto';
import { basename, resolve, sep } from 'node:path';

const failure = (res, status, message) => res.status(status).json({ message });
const parse = (value, fallback) => {
  try { return typeof value === 'string' ? JSON.parse(value) : value ?? fallback; }
  catch { return fallback; }
};
const uniqueConflict = (error) => error.code === 'ER_DUP_ENTRY' || String(error.message).includes('UNIQUE');
const companyColumns = 'ep.user_id AS id,ep.company_name,ep.industry,ep.description,ep.province,ep.municipality,ep.website,ep.contact_person,ep.contact_position,ep.company_size';
const visibleCompany = "ep.verification_status='verified' AND eu.role='employer' AND eu.account_status='active'";
const visibleJob = "j.status='active' AND (j.application_deadline IS NULL OR j.application_deadline>=?)";
const jobColumns = 'j.id,j.employer_id,j.title,j.description,j.industry,j.province,j.municipality,j.employment_type,j.work_setup,j.salary_min,j.salary_max,j.required_skills,j.preferred_skills,j.education_required,j.experience_required,j.status,j.created_at,j.updated_at,j.vacancies,j.application_deadline,ep.company_name,ep.description AS company_description,ep.industry AS company_industry,ep.province AS company_province,ep.municipality AS company_municipality,ep.website AS company_website';
const safeWebsite = (value) => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
};
const safeCompany = (company) => ({ ...company, website: safeWebsite(company.website), open_jobs: Number(company.open_jobs || 0), contact_person: company.contact_person || '', contact_position: company.contact_position || '', company_size: company.company_size || '' });
const safeJob = (row) => {
  const { company_description, company_industry, company_province, company_municipality, company_website, ...job } = row;
  return { ...job, company_id: job.employer_id, verification_status: 'verified', required_skills: parse(job.required_skills, []), preferred_skills: parse(job.preferred_skills, []), company: { id: job.employer_id, company_name: job.company_name, description: company_description, industry: company_industry, province: company_province, municipality: company_municipality, website: safeWebsite(company_website) } };
};

export const notificationOperation = (userId, { title, body, href, type }, now = Date.now()) => ({
  sql: 'INSERT INTO notifications (id,user_id,title,body,href,type,created_at,read_at) VALUES (?,?,?,?,?,?,?,NULL)',
  params: [randomUUID(), userId, title, body, href, type, now],
});

export function registerJobSeekerRoutes(app, { db, authenticated, normalizeSkills, normalizedProfile, provinces }) {
  const seeker = (req, res, next) => req.user.role === 'job_seeker' && req.user.role_selected ? next() : failure(res, 403, 'This page is for job seekers.');
  const participantRole = (req, res, next) => ['job_seeker', 'employer'].includes(req.user.role) && req.user.role_selected ? next() : failure(res, 403, 'Applicant or employer access required.');
  const jobsFor = async (companyId) => (await db.prepare(`SELECT ${jobColumns} FROM jobs j JOIN employer_profiles ep ON ep.user_id=j.employer_id JOIN users eu ON eu.id=ep.user_id WHERE ${visibleCompany} AND ${visibleJob}${companyId ? ' AND ep.user_id=?' : ''} ORDER BY j.created_at DESC,j.id`).all(Date.now(), ...(companyId ? [companyId] : []))).map(safeJob);
  const companiesFor = async (companyId) => (await db.prepare(`SELECT ${companyColumns},(SELECT COUNT(*) FROM jobs j WHERE j.employer_id=ep.user_id AND ${visibleJob}) AS open_jobs FROM employer_profiles ep JOIN users eu ON eu.id=ep.user_id WHERE ${visibleCompany}${companyId ? ' AND ep.user_id=?' : ''} ORDER BY ep.company_name,ep.user_id`).all(Date.now(), ...(companyId ? [companyId] : []))).map(safeCompany);

  app.get('/api/discovery/jobs', authenticated, async (_req, res) => res.json({ jobs: await jobsFor() }));
  app.get('/api/discovery/companies', authenticated, async (_req, res) => res.json({ companies: await companiesFor() }));
  app.get('/api/discovery/companies/:id', authenticated, async (req, res) => {
    const company = (await companiesFor(req.params.id))[0];
    if (!company) return failure(res, 404, 'Company not found.');
    res.json({ company, jobs: await jobsFor(req.params.id) });
  });
  app.get('/api/saved-jobs', authenticated, seeker, async (req, res) => {
    const rows = await db.prepare('SELECT job_id FROM saved_jobs WHERE user_id=? ORDER BY created_at DESC,job_id').all(req.user.id);
    res.json({ job_ids: rows.map((row) => row.job_id) });
  });
  app.put('/api/saved-jobs/:id', authenticated, seeker, async (req, res) => {
    const job = await db.prepare(`SELECT j.id FROM jobs j JOIN employer_profiles ep ON ep.user_id=j.employer_id JOIN users eu ON eu.id=ep.user_id WHERE j.id=? AND ${visibleCompany} AND ${visibleJob}`).get(req.params.id, Date.now());
    if (!job) return failure(res, 404, 'Job is unavailable.');
    try { await db.prepare('INSERT INTO saved_jobs (user_id,job_id,created_at) VALUES (?,?,?)').run(req.user.id, job.id, Date.now()); }
    catch (error) { if (!uniqueConflict(error)) throw error; }
    res.json({ saved: true, job_id: job.id });
  });
  app.delete('/api/saved-jobs/:id', authenticated, seeker, async (req, res) => {
    await db.prepare('DELETE FROM saved_jobs WHERE user_id=? AND job_id=?').run(req.user.id, req.params.id);
    res.json({ saved: false, job_id: req.params.id });
  });

  const readProfessionalProfile = async (userId) => {
    const base = await db.prepare('SELECT province,municipality,education,skills,preferred_job,work_setup FROM profiles WHERE user_id=?').get(userId);
    const row = await db.prepare('SELECT data FROM job_seeker_profiles WHERE user_id=?').get(userId);
    const data = parse(row?.data, {});
    const resume = await db.prepare('SELECT id,original_filename,file_size,parsing_status,uploaded_at,parsed_at FROM resumes WHERE user_id=? ORDER BY uploaded_at DESC,id DESC LIMIT 1').get(userId);
    // Professional fields are an allowlist: account credentials and parser text never leave this endpoint.
    const profile = { about: '', course: '', recent_job_title: '', experience_snippets: [], experience_years: 0, career_interests: [], province: '', municipality: '', education: '', preferred_job: '', work_setup: '', ...base };
    for (const key of Object.keys(profile)) if (Object.hasOwn(data, key)) profile[key] = data[key];
    profile.skills = normalizeSkills(Array.isArray(data.skills) ? data.skills : String(base?.skills || '').split(','));
    profile.career_interests = Array.isArray(data.career_interests) ? data.career_interests : [];
    profile.experience_snippets = Array.isArray(data.experience_snippets) ? data.experience_snippets : [];
    return { ...profile, resume: resume ?? null };
  };
  app.get('/api/job-seeker/professional-profile', authenticated, seeker, async (req, res) => res.json({ profile: await readProfessionalProfile(req.user.id) }));
  app.put('/api/job-seeker/professional-profile', authenticated, seeker, async (req, res) => {
    const limits = { about: 3000, course: 150, recent_job_title: 150, province: 100, municipality: 150, education: 150, preferred_job: 150, work_setup: 40 };
    const listLimits = { skills: [60, 80], career_interests: [20, 150], experience_snippets: [20, 1000] };
    const allowed = new Set([...Object.keys(limits), ...Object.keys(listLimits), 'experience_years', 'willing_to_relocate']);
    const patch = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (!allowed.has(key)) return failure(res, 400, 'Only professional profile fields may be updated here.');
      if (Object.hasOwn(limits, key)) {
        if (typeof value !== 'string' || value.length > limits[key]) return failure(res, 400, 'Please check your profile details.');
        patch[key] = value.trim();
      } else if (listLimits[key]) {
        const [count, length] = listLimits[key];
        if (!Array.isArray(value) || value.length > count || value.some((item) => typeof item !== 'string' || item.length > length)) return failure(res, 400, 'Please check your profile lists.');
        patch[key] = key === 'skills' ? normalizeSkills(value) : [...new Set(value.map((item) => item.trim()).filter(Boolean))];
      } else if (key === 'experience_years') {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 80) return failure(res, 400, 'Enter experience between 0 and 80 years.');
        patch[key] = value;
      } else {
        if (typeof value !== 'boolean') return failure(res, 400, 'Please check your relocation preference.');
        patch[key] = value;
      }
    }
    if (patch.province && !provinces.includes(patch.province)) return failure(res, 400, 'Choose a province in MIMAROPA.');
    const base = await db.prepare('SELECT * FROM profiles WHERE user_id=?').get(req.user.id);
    const row = await db.prepare('SELECT * FROM job_seeker_profiles WHERE user_id=?').get(req.user.id);
    if (!base) return failure(res, 409, 'Start your basic profile before editing professional details.');
    const { resume: _resume, ...current } = await readProfessionalProfile(req.user.id);
    const data = { ...parse(row?.data, {}), ...current, ...patch };
    const fields = ['province', 'municipality', 'education', 'skills', 'preferred_job', 'work_setup'];
    const updatedBase = { ...base, ...data, skills: data.skills.join(', ') };
    const text = `${normalizedProfile(updatedBase, data)}\nAbout: ${data.about}\nExperience Years: ${data.experience_years}\nCareer Interests: ${data.career_interests.join(', ')}`;
    await db.batch([
      { sql: 'UPDATE profiles SET province=?,municipality=?,education=?,skills=?,preferred_job=?,work_setup=? WHERE user_id=?', params: [...fields.map((key) => updatedBase[key]), req.user.id] },
      { sql: 'INSERT INTO job_seeker_profiles (user_id,data,normalized_profile_text,onboarding_step,completed,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,normalized_profile_text=excluded.normalized_profile_text,updated_at=excluded.updated_at', params: [req.user.id, JSON.stringify(data), text, row?.onboarding_step ?? 0, row?.completed ?? 0, Date.now()] },
    ]);
    res.json({ profile: await readProfessionalProfile(req.user.id) });
  });
  app.get('/api/resume/:id/file', authenticated, seeker, async (req, res) => {
    const resume = await db.prepare('SELECT storage_path,original_filename FROM resumes WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
    if (!resume) return failure(res, 404, 'Resume not found.');
    const root = resolve('server/data/resumes');
    const path = resolve(resume.storage_path);
    if (!path.startsWith(root + sep)) return failure(res, 404, 'Resume not found.');
    res.download(path, basename(resume.original_filename), (error) => { if (error && !res.headersSent) failure(res, 404, 'Resume file is unavailable.'); });
  });

  const conversationJoin = "FROM conversations c JOIN applications a ON a.id=c.application_id JOIN jobs j ON j.id=a.job_id JOIN users su ON su.id=a.job_seeker_id JOIN users eu ON eu.id=j.employer_id LEFT JOIN employer_profiles ep ON ep.user_id=eu.id";
  const validParticipants = "su.role='job_seeker' AND eu.role='employer' AND su.account_status='active' AND eu.account_status='active'";
  const ownedConversation = async (id, userId) => db.prepare(`SELECT c.*,a.job_seeker_id,j.employer_id,j.title AS job_title,su.full_name AS seeker_name,COALESCE(ep.company_name,eu.full_name) AS employer_name ${conversationJoin} WHERE c.id=? AND (a.job_seeker_id=? OR j.employer_id=?) AND ${validParticipants}`).get(id, userId, userId);
  const conversationView = async (row, userId) => {
    const last = await db.prepare('SELECT body FROM messages WHERE conversation_id=? ORDER BY created_at DESC,id DESC LIMIT 1').get(row.id);
    const readAt = row.job_seeker_id === userId ? row.seeker_read_at : row.employer_read_at;
    const unread = await db.prepare('SELECT COUNT(*) AS count FROM messages WHERE conversation_id=? AND sender_id<>? AND created_at>?').get(row.id, userId, readAt || 0);
    return { id: row.id, application_id: row.application_id, job_title: row.job_title, other_name: row.job_seeker_id === userId ? row.employer_name : row.seeker_name, last_message: last?.body ?? null, updated_at: row.updated_at, unread_count: Number(unread.count) };
  };
  app.get('/api/conversations', authenticated, participantRole, async (req, res) => {
    const rows = await db.prepare(`SELECT c.*,a.job_seeker_id,j.employer_id,j.title AS job_title,su.full_name AS seeker_name,COALESCE(ep.company_name,eu.full_name) AS employer_name ${conversationJoin} WHERE (a.job_seeker_id=? OR j.employer_id=?) AND ${validParticipants} ORDER BY c.updated_at DESC,c.id`).all(req.user.id, req.user.id);
    res.json({ conversations: await Promise.all(rows.map((row) => conversationView(row, req.user.id))) });
  });
  app.post('/api/conversations', authenticated, participantRole, async (req, res) => {
    if (typeof req.body.application_id !== 'string') return failure(res, 400, 'Choose an application.');
    const application = await db.prepare(`SELECT a.id FROM applications a JOIN jobs j ON j.id=a.job_id JOIN users su ON su.id=a.job_seeker_id JOIN users eu ON eu.id=j.employer_id WHERE a.id=? AND (a.job_seeker_id=? OR j.employer_id=?) AND ${validParticipants}`).get(req.body.application_id, req.user.id, req.user.id);
    if (!application) return failure(res, 404, 'Application not found.');
    let conversation = await db.prepare('SELECT id FROM conversations WHERE application_id=?').get(application.id);
    if (!conversation) {
      const id = randomUUID(), now = Date.now();
      try { await db.prepare('INSERT INTO conversations (id,application_id,seeker_read_at,employer_read_at,created_at,updated_at) VALUES (?,?,0,0,?,?)').run(id, application.id, now, now); }
      catch (error) { if (!uniqueConflict(error)) throw error; }
      conversation = await db.prepare('SELECT id FROM conversations WHERE application_id=?').get(application.id);
    }
    res.json({ conversation });
  });
  app.get('/api/conversations/:id/messages', authenticated, participantRole, async (req, res) => {
    const conversation = await ownedConversation(req.params.id, req.user.id);
    if (!conversation) return failure(res, 404, 'Conversation not found.');
    const rows = await db.prepare('SELECT m.id,m.body,m.sender_id,u.full_name AS sender_name,m.created_at FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.conversation_id=? ORDER BY m.created_at,m.id').all(conversation.id);
    // Mark only messages included in this response; a concurrently arriving message remains unread.
    const readAt = rows.reduce((latest, row) => Math.max(latest, Number(row.created_at)), 0);
    const column = conversation.job_seeker_id === req.user.id ? 'seeker_read_at' : 'employer_read_at';
    await db.prepare(`UPDATE conversations SET ${column}=CASE WHEN ${column}<? THEN ? ELSE ${column} END WHERE id=?`).run(readAt, readAt, conversation.id);
    conversation[column] = Math.max(Number(conversation[column]), readAt);
    res.json({ conversation: await conversationView(conversation, req.user.id), messages: rows.map((row) => ({ ...row, is_own: row.sender_id === req.user.id })) });
  });
  app.post('/api/conversations/:id/messages', authenticated, participantRole, async (req, res) => {
    if (typeof req.body.body !== 'string' || !req.body.body.trim() || req.body.body.length > 2000) return failure(res, 400, 'Write a message between 1 and 2,000 characters.');
    const conversation = await ownedConversation(req.params.id, req.user.id);
    if (!conversation) return failure(res, 404, 'Conversation not found.');
    const id = randomUUID(), now = Math.max(Date.now(), Number(conversation.updated_at) + 1), body = req.body.body.trim();
    const receiver = conversation.job_seeker_id === req.user.id ? conversation.employer_id : conversation.job_seeker_id;
    await db.batch([
      { sql: 'INSERT INTO messages (id,conversation_id,sender_id,body,created_at) VALUES (?,?,?,?,?)', params: [id, conversation.id, req.user.id, body, now] },
      { sql: 'UPDATE conversations SET updated_at=? WHERE id=?', params: [now, conversation.id] },
      notificationOperation(receiver, { title: 'New message', body: `You have a new message about ${conversation.job_title}.`, href: `/messages?conversation=${conversation.id}`, type: 'message' }, now),
    ]);
    res.status(201).json({ message: { id, body, sender_id: req.user.id, sender_name: req.user.full_name, created_at: now, is_own: true } });
  });
  app.get('/api/notifications', authenticated, async (req, res) => {
    const notifications = await db.prepare('SELECT id,title,body,href,created_at,read_at,type FROM notifications WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 100').all(req.user.id);
    const unread = await db.prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id=? AND read_at IS NULL').get(req.user.id);
    res.json({ notifications, unread_count: Number(unread.count) });
  });
  app.post('/api/notifications/:id/read', authenticated, async (req, res) => {
    const notification = await db.prepare('SELECT id,read_at FROM notifications WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
    if (!notification) return failure(res, 404, 'Notification not found.');
    const readAt = notification.read_at ?? Date.now();
    await db.prepare('UPDATE notifications SET read_at=? WHERE id=? AND user_id=?').run(readAt, notification.id, req.user.id);
    res.json({ id: notification.id, read_at: readAt });
  });
}
