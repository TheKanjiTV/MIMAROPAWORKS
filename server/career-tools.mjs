import { trainingCatalog } from './career.mjs';

export const readinessQuestions = [
  {
    id: 'direction',
    title: 'I can describe the role I want and why it fits me.',
    action: 'Choose one target role and compare its requirements with your profile.',
    href: '/career/suggestions',
  },
  {
    id: 'evidence',
    title: 'I have a real example that demonstrates each of my main skills.',
    action: 'Write one example from work, school, volunteering, or a personal project.',
    href: '/career/resume-optimizer',
  },
  {
    id: 'resume',
    title: 'My resume and contact details are accurate and up to date.',
    action: 'Review your resume and remove claims you cannot explain or support.',
    href: '/profile/resume',
  },
  {
    id: 'interview',
    title: 'I can explain a challenge, my actions, and the result in an interview.',
    action: 'Practice one answer using the situation, task, action, result structure.',
    href: '/career/interview',
  },
  {
    id: 'communication',
    title: 'I can write a clear workplace message and ask for clarification.',
    action: 'Practice a customer reply with a clear next step and timeline.',
    href: '/career/training/communication',
  },
  {
    id: 'planning',
    title: 'I have a realistic plan for learning and following up on applications.',
    action: 'Set aside time this week for one learning activity and one application.',
    href: '/career/coach',
  },
];
export const interviewQuestions = [
  {
    id: 'introduction',
    title: 'Tell me about yourself and the role you are looking for.',
    tip: 'Connect your present skills, one relevant example, and your next step.',
  },
  {
    id: 'challenge',
    title: 'Tell me about a challenge you worked through.',
    tip: 'Describe the situation, your responsibility, what you did, and the outcome.',
  },
  {
    id: 'teamwork',
    title: 'How have you worked with someone whose approach was different from yours?',
    tip: 'Explain how you listened, agreed on a next step, and worked together.',
  },
  {
    id: 'learning',
    title: 'Describe a skill you had to learn and how you practiced it.',
    tip: 'Use a real work, school, volunteer, or personal project example.',
  },
  {
    id: 'motivation',
    title: 'Why are you interested in this type of work?',
    tip: 'Connect the role responsibilities with your interests and evidence of your skills.',
  },
];
const parse = (value, fallback = {}) => {
  try {
    return typeof value === 'string' ? JSON.parse(value) : (value ?? fallback);
  } catch {
    return fallback;
  }
};
const strings = (value) =>
  Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
const bad = (message) => {
  throw new Error(message);
};
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
const text = (value, max, label) =>
  typeof value === 'string' && value.length <= max
    ? value
    : bad(`${label} must be text of at most ${max} characters.`);
const allowed = (body, fields) => {
  if (!object(body) || Object.keys(body).some((key) => !fields.includes(key)))
    bad('Only the displayed tool fields may be saved.');
};

export async function ensureCareerToolsSchema(db) {
  await db.exec(
    db.driver === 'mysql'
      ? 'CREATE TABLE IF NOT EXISTS career_tool_progress (user_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,tool VARCHAR(80) NOT NULL,data JSON NOT NULL,updated_at BIGINT NOT NULL,PRIMARY KEY (user_id,tool),FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
      : 'CREATE TABLE IF NOT EXISTS career_tool_progress (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,tool TEXT NOT NULL,data TEXT NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY (user_id,tool))',
  );
}

function validate(tool, body) {
  if (tool === 'readiness') {
    allowed(body, ['answers']);
    if (
      !object(body.answers) ||
      Object.keys(body.answers).some((id) => !readinessQuestions.some((q) => q.id === id)) ||
      Object.values(body.answers).some((v) => !Number.isInteger(v) || v < 0 || v > 2)
    )
      bad('Choose a listed answer for each readiness question.');
    return { answers: body.answers };
  }
  if (tool === 'interview') {
    allowed(body, ['answers']);
    if (
      !object(body.answers) ||
      Object.keys(body.answers).some((id) => !interviewQuestions.some((q) => q.id === id))
    )
      bad('Choose a listed interview question.');
    return {
      answers: Object.fromEntries(
        Object.entries(body.answers).map(([id, answer]) => [id, text(answer, 5000, 'Your answer')]),
      ),
    };
  }
  if (tool === 'resume') {
    allowed(body, ['target_role', 'summary', 'bullets']);
    if (!Array.isArray(body.bullets) || body.bullets.length > 20)
      bad('Add up to 20 experience bullets.');
    return {
      target_role: text(body.target_role, 150, 'Target role'),
      summary: text(body.summary, 3000, 'Summary'),
      bullets: body.bullets.map((bullet) => text(bullet, 1000, 'Experience bullet')),
    };
  }
  if (tool === 'coach') {
    allowed(body, ['goal', 'weekly_hours', 'completed']);
    if (!['first-job', 'change-role', 'build-skills', 'interview'].includes(body.goal))
      bad('Choose a career goal.');
    if (!Number.isInteger(body.weekly_hours) || body.weekly_hours < 1 || body.weekly_hours > 20)
      bad('Choose between 1 and 20 hours per week.');
    if (
      !Array.isArray(body.completed) ||
      body.completed.length > 4 ||
      body.completed.some((id) => !['profile', 'practice', 'evidence', 'apply'].includes(id))
    )
      bad('Choose a listed plan activity.');
    return {
      goal: body.goal,
      weekly_hours: body.weekly_hours,
      completed: [...new Set(body.completed)],
    };
  }
  const guide = trainingCatalog.find((item) => tool === `training:${item.id}`);
  if (!guide) bad('Career tool not found.');
  allowed(body, ['completed', 'notes']);
  if (
    !Array.isArray(body.completed) ||
    body.completed.length > guide.activities.length ||
    body.completed.some((id) => !Number.isInteger(id) || id < 0 || id >= guide.activities.length)
  )
    bad('Choose a listed practice activity.');
  return {
    completed: [...new Set(body.completed)],
    notes: text(body.notes, 5000, 'Practice notes'),
  };
}

export function readinessFeedback(data) {
  const answers = data.answers || {};
  const answered = readinessQuestions.filter((q) => Object.hasOwn(answers, q.id));
  return {
    answered: answered.length,
    total: readinessQuestions.length,
    confident: answered.filter((q) => answers[q.id] === 2).length,
    next_steps: readinessQuestions.filter((q) => answers[q.id] !== 2),
    note: 'A reflection on your own answers, not a hiring score or a test of ability. Responses stay in your career workspace.',
  };
}
export function interviewFeedback(answer) {
  const word_count = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  const checks = [
    {
      label: 'Give enough context',
      passed: word_count >= 40,
      advice: 'Add a few sentences explaining the setting and your responsibility.',
    },
    {
      label: 'Describe your own actions',
      passed:
        /\b(I|my|ako|ko|akin)\b/i.test(answer) &&
        /\b(created|helped|built|organized|learnt|learned|resolved|reviewed|practiced|supported|prepared|improved|designed|wrote|asked|checked|ginawa|tumulong|natutunan)\b/i.test(
          answer,
        ),
      advice: 'Explain what you personally did, using a specific action verb.',
    },
    {
      label: 'Explain the outcome or lesson',
      passed:
        /\b(result|outcome|learned|learnt|improved|completed|resolved|feedback|lesson|natutunan|resulta)\b/i.test(
          answer,
        ),
      advice: 'Say what happened next or what you learned; only use figures you can support.',
    },
    {
      label: 'Keep it focused',
      passed: word_count > 0 && word_count <= 250,
      advice: 'Aim for a focused spoken answer of about 40–250 words.',
    },
  ];
  return {
    word_count,
    checks,
    note: 'Guided wording checks only. They can miss good answers and do not evaluate your employability, truthfulness, or tone.',
  };
}
export function coachPlan(data, profile) {
  const role = profile.preferred_job || 'your target role';
  const goalText = {
    'first-job': 'Prepare for your first application',
    'change-role': 'Explore a move into a different role',
    'build-skills': 'Build evidence of a useful skill',
    interview: 'Prepare for your next interview',
  };
  return {
    title: goalText[data.goal],
    time_note: `${data.weekly_hours} hour${data.weekly_hours === 1 ? '' : 's'} available each week. Work through one step at a time and adjust the pace to your schedule.`,
    steps: [
      {
        id: 'profile',
        title: `Clarify your direction: ${role}`,
        detail:
          data.goal === 'change-role'
            ? 'Compare two career ideas and record the skills you already bring.'
            : 'Check your profile skills, preferred role, location, and contact details.',
        href: data.goal === 'change-role' ? '/career/suggestions' : '/profile',
      },
      {
        id: 'practice',
        title:
          data.goal === 'interview'
            ? 'Practice one interview answer'
            : 'Practice one skill from a vacancy',
        detail:
          data.goal === 'interview'
            ? 'Use a real example and revise it with the guided feedback.'
            : 'Choose one skill gap and complete a practice activity. Save a note about what you learned.',
        href: data.goal === 'interview' ? '/career/interview' : '/career/training',
      },
      {
        id: 'evidence',
        title: 'Turn your practice into an honest example',
        detail:
          'Add a resume bullet describing the task, your action, and a result you can explain.',
        href: '/career/resume-optimizer',
      },
      {
        id: 'apply',
        title: 'Choose your next opportunity',
        detail:
          'Read the full requirements, tailor your application, and track any follow-up in My Applications.',
        href: '/jobs',
      },
    ],
    note: 'A guided plan based on your chosen goal and profile. It does not use generative AI or promise a job outcome.',
  };
}

async function sourceFor(db, userId) {
  const row = await db.prepare('SELECT data FROM job_seeker_profiles WHERE user_id=?').get(userId);
  const base = await db
    .prepare('SELECT preferred_job,skills,education FROM profiles WHERE user_id=?')
    .get(userId);
  const data = parse(row?.data);
  const resume = await db
    .prepare(
      'SELECT original_filename,parsing_status,analysis FROM resumes WHERE user_id=? ORDER BY uploaded_at DESC LIMIT 1',
    )
    .get(userId);
  const analysis = parse(resume?.analysis);
  const detected = analysis.extracted_profile || analysis;
  return {
    profile: {
      preferred_job: data.preferred_job || base?.preferred_job || '',
      about: data.about || '',
      education: data.education || base?.education || '',
      skills: Array.isArray(data.skills)
        ? strings(data.skills)
        : (base?.skills || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
      experience_snippets: strings(data.experience_snippets),
    },
    resume: resume
      ? {
          original_filename: resume.original_filename,
          parsing_status: resume.parsing_status,
          experience_snippets: strings(detected.experience_snippets),
          detected_skills: strings(detected.detected_skills),
        }
      : null,
  };
}
function feedbackFor(tool, data, profile) {
  if (tool === 'readiness') return readinessFeedback(data);
  if (tool === 'interview')
    return Object.fromEntries(
      Object.entries(data.answers).map(([id, answer]) => [id, interviewFeedback(answer)]),
    );
  if (tool === 'coach') return coachPlan(data, profile);
  return null;
}

export function registerCareerToolRoutes(app, { db, authenticated }) {
  const seeker = (req, res, next) =>
    req.user.role === 'job_seeker' && req.user.role_selected
      ? next()
      : res.status(403).json({ message: 'Career tools are available to job seekers.' });
  app.get('/api/career/tools', authenticated, seeker, async (req, res) => {
    const source = await sourceFor(db, req.user.id);
    const records = await db
      .prepare('SELECT tool,data,updated_at FROM career_tool_progress WHERE user_id=?')
      .all(req.user.id);
    res.json({
      ...source,
      readiness_questions: readinessQuestions,
      interview_questions: interviewQuestions,
      training: trainingCatalog.map((guide) => ({
        ...guide,
        catalog_note: 'Self-guided practice; not an accredited course or certification.',
      })),
      states: Object.fromEntries(
        records.map((record) => {
          const data = parse(record.data);
          return [
            record.tool,
            {
              data,
              updated_at: record.updated_at,
              feedback: feedbackFor(record.tool, data, source.profile),
            },
          ];
        }),
      ),
    });
  });
  app.put('/api/career/tools/:tool', authenticated, seeker, async (req, res) => {
    let data;
    try {
      data = validate(req.params.tool, req.body);
    } catch (error) {
      return res
        .status(error.message === 'Career tool not found.' ? 404 : 400)
        .json({ message: error.message });
    }
    const now = Date.now();
    const sql =
      db.driver === 'mysql'
        ? 'INSERT INTO career_tool_progress (user_id,tool,data,updated_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data),updated_at=VALUES(updated_at)'
        : 'INSERT INTO career_tool_progress (user_id,tool,data,updated_at) VALUES (?,?,?,?) ON CONFLICT(user_id,tool) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at';
    await db.prepare(sql).run(req.user.id, req.params.tool, JSON.stringify(data), now);
    const { profile } = await sourceFor(db, req.user.id);
    res.json({ data, updated_at: now, feedback: feedbackFor(req.params.tool, data, profile) });
  });
}
