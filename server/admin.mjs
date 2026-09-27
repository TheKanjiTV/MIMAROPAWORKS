import { randomUUID } from 'node:crypto';

// Audit events intentionally exclude request bodies, credentials and document paths.
const detailKeys = new Set([
  'companyName',
  'title',
  'status',
  'previousStatus',
  'reason',
  'count',
  'source',
]);
export async function ensureAdminSchema(db) {
  await db.exec(
    db.driver === 'mysql'
      ? 'CREATE TABLE IF NOT EXISTS admin_audit_logs (id VARCHAR(36) PRIMARY KEY, actor_id VARCHAR(36), action VARCHAR(80) NOT NULL, entity_type VARCHAR(40) NOT NULL, entity_id VARCHAR(100), details TEXT NOT NULL, created_at BIGINT NOT NULL, INDEX admin_audit_created (created_at), INDEX admin_audit_action (action)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
      : 'CREATE TABLE IF NOT EXISTS admin_audit_logs (id TEXT PRIMARY KEY, actor_id TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, details TEXT NOT NULL, created_at INTEGER NOT NULL)',
  );
  if (db.driver !== 'mysql') {
    await db.exec('CREATE INDEX IF NOT EXISTS admin_audit_created ON admin_audit_logs(created_at)');
    await db.exec('CREATE INDEX IF NOT EXISTS admin_audit_action ON admin_audit_logs(action)');
  }
}

export function auditOperation({
  actorId = null,
  action,
  entityType,
  entityId = null,
  details = {},
}) {
  const safe = {};
  for (const [key, value] of Object.entries(details || {})) {
    if (detailKeys.has(key) && ['string', 'number', 'boolean'].includes(typeof value))
      safe[key] = typeof value === 'string' ? value.slice(0, 500) : value;
  }
  const id = randomUUID();
  return {
    sql: 'INSERT INTO admin_audit_logs (id,actor_id,action,entity_type,entity_id,details,created_at) VALUES (?,?,?,?,?,?,?)',
    params: [
      id,
      actorId,
      String(action).slice(0, 80),
      String(entityType).slice(0, 40),
      entityId == null ? null : String(entityId).slice(0, 100),
      JSON.stringify(safe),
      Date.now(),
    ],
  };
}

export async function writeAudit(db, event) {
  const operation = auditOperation(event);
  await db.prepare(operation.sql).run(...operation.params);
  return operation.params[0];
}

const countRows = (rows, key) =>
  Object.fromEntries(rows.map((row) => [row[key], Number(row.count)]));
const queryText = (value) => (typeof value === 'string' ? value.trim().slice(0, 100) : '');
const searchValue = (value) => `%${queryText(value).replace(/[!%_]/g, '!$&')}%`;
const pageOptions = (query) => ({
  page: Math.min(100000, Math.max(1, Math.floor(Number(query.page) || 1))),
  limit: Math.min(50, Math.max(1, Math.floor(Number(query.limit) || 15))),
});

export function registerAdminRoutes(app, { db, authenticated }) {
  const admin = (req, res, next) =>
    req.user?.role === 'admin'
      ? next()
      : res.status(403).json({ message: 'Admin access required.' });
  const route = (path, handler) => app.get(`/api/admin/${path}`, authenticated, admin, handler);
  const paginated = async (req, res, { from, columns, conditions = [], values = [], order }) => {
    const { page, limit } = pageOptions(req.query);
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const total = Number(
      (await db.prepare(`SELECT COUNT(*) AS count FROM ${from}${where}`).get(...values)).count,
    );
    const actualPage = Math.min(page, Math.max(1, Math.ceil(total / limit)));
    const items = await db
      .prepare(
        `SELECT ${columns} FROM ${from}${where} ORDER BY ${order} LIMIT ${limit} OFFSET ${(actualPage - 1) * limit}`,
      )
      .all(...values);
    res.json({ items, total, page: actualPage, limit });
  };

  route('overview', async (_req, res) => {
    const now = Date.now(),
      dayMs = 86400000,
      start = Math.floor(now / dayMs) * dayMs - 29 * dayMs;
    const [
      roles,
      companies,
      jobs,
      applications,
      provinces,
      industries,
      demos,
      health,
      rawActivity,
    ] = await Promise.all([
      db.prepare('SELECT role,COUNT(*) AS count FROM users GROUP BY role').all(),
      db
        .prepare(
          'SELECT verification_status,COUNT(*) AS count FROM employer_profiles GROUP BY verification_status',
        )
        .all(),
      db.prepare('SELECT status,COUNT(*) AS count FROM jobs GROUP BY status').all(),
      db.prepare('SELECT status,COUNT(*) AS count FROM applications GROUP BY status').all(),
      db
        .prepare(
          "SELECT province AS label,COUNT(*) AS count FROM jobs WHERE status='active' AND (application_deadline IS NULL OR application_deadline>=?) GROUP BY province ORDER BY count DESC,province",
        )
        .all(now),
      db
        .prepare(
          "SELECT industry AS label,COUNT(*) AS count FROM jobs WHERE status='active' AND (application_deadline IS NULL OR application_deadline>=?) GROUP BY industry ORDER BY count DESC,industry LIMIT 8",
        )
        .all(now),
      db
        .prepare(
          "SELECT (SELECT COUNT(*) FROM users WHERE role='employer' AND email LIKE '%@demo.mimaropa.test') AS companies,(SELECT COUNT(*) FROM jobs j JOIN users u ON u.id=j.employer_id WHERE u.email LIKE '%@demo.mimaropa.test') AS jobs",
        )
        .get(),
      db
        .prepare(
          "SELECT (SELECT COUNT(*) FROM jobs WHERE status='active' AND application_deadline IS NOT NULL AND application_deadline<?) AS expiredJobs,(SELECT COUNT(*) FROM jobs j LEFT JOIN employer_profiles p ON p.user_id=j.employer_id WHERE j.status='active' AND (p.user_id IS NULL OR p.verification_status<>'verified')) AS unverifiedJobs,(SELECT COUNT(*) FROM employer_profiles p WHERE p.verification_status='pending' AND NOT EXISTS (SELECT 1 FROM employer_documents d WHERE d.user_id=p.user_id)) AS missingDocuments",
        )
        .get(now),
      Promise.all(
        [
          ['users', 'created_at'],
          ['jobs', 'created_at'],
          ['applications', 'applied_at'],
        ].map(async ([table, field]) => {
          const expression =
            db.driver === 'mysql'
              ? `FLOOR(${field}/${dayMs})`
              : `CAST(${field}/${dayMs} AS INTEGER)`;
          return db
            .prepare(
              `SELECT ${expression} AS day,COUNT(*) AS count FROM ${table} WHERE ${field}>=? GROUP BY ${expression}`,
            )
            .all(start);
        }),
      ),
    ]);
    const activity = Array.from({ length: 30 }, (_, index) => {
      const timestamp = start + index * dayMs,
        day = timestamp / dayMs;
      return {
        date: new Date(timestamp).toISOString().slice(0, 10),
        accounts: Number(rawActivity[0].find((r) => Number(r.day) === day)?.count || 0),
        jobs: Number(rawActivity[1].find((r) => Number(r.day) === day)?.count || 0),
        applications: Number(rawActivity[2].find((r) => Number(r.day) === day)?.count || 0),
      };
    });
    res.json({
      generatedAt: now,
      roles: countRows(roles, 'role'),
      companies: countRows(companies, 'verification_status'),
      jobs: countRows(jobs, 'status'),
      applications: countRows(applications, 'status'),
      provinces,
      industries,
      demos,
      health,
      activity,
    });
  });

  route('companies', async (req, res) => {
    const status = queryText(req.query.status) || 'pending';
    if (!['pending', 'verified', 'rejected', 'all'].includes(status))
      return res.status(400).json({ message: 'Choose a valid verification status.' });
    const conditions = [],
      values = [];
    if (status !== 'all') {
      conditions.push('p.verification_status=?');
      values.push(status);
    }
    if (queryText(req.query.q)) {
      conditions.push(
        "(p.company_name LIKE ? ESCAPE '!' OR p.contact_person LIKE ? ESCAPE '!' OR p.province LIKE ? ESCAPE '!')",
      );
      values.push(...Array(3).fill(searchValue(req.query.q)));
    }
    return paginated(req, res, {
      from: 'employer_profiles p JOIN users u ON u.id=p.user_id',
      columns:
        "p.user_id,p.company_name,p.industry,p.province,p.municipality,p.contact_person,p.verification_status,p.updated_at,(SELECT COUNT(*) FROM jobs j WHERE j.employer_id=p.user_id) AS job_count,(SELECT COUNT(*) FROM employer_documents d WHERE d.user_id=p.user_id) AS document_count,CASE WHEN u.email LIKE '%@demo.mimaropa.test' THEN 1 ELSE 0 END AS is_demo",
      conditions,
      values,
      order: 'p.updated_at DESC,p.user_id',
    });
  });

  route('jobs', async (req, res) => {
    const status = queryText(req.query.status) || 'all';
    if (!['all', 'active', 'draft', 'closed'].includes(status))
      return res.status(400).json({ message: 'Choose a valid job status.' });
    const conditions = [],
      values = [];
    if (status !== 'all') {
      conditions.push('j.status=?');
      values.push(status);
    }
    if (queryText(req.query.q)) {
      conditions.push(
        "(j.title LIKE ? ESCAPE '!' OR j.company_name LIKE ? ESCAPE '!' OR j.province LIKE ? ESCAPE '!')",
      );
      values.push(...Array(3).fill(searchValue(req.query.q)));
    }
    return paginated(req, res, {
      from: 'jobs j LEFT JOIN users u ON u.id=j.employer_id',
      columns:
        "j.id,j.title,j.company_name,j.province,j.municipality,j.industry,j.status,j.work_setup,j.vacancies,j.application_deadline,j.created_at,(SELECT COUNT(*) FROM applications a WHERE a.job_id=j.id) AS application_count,CASE WHEN u.email LIKE '%@demo.mimaropa.test' THEN 1 ELSE 0 END AS is_demo",
      conditions,
      values,
      order: 'j.created_at DESC,j.id',
    });
  });

  route('accounts', async (req, res) => {
    const role = queryText(req.query.role) || 'all';
    if (!['all', 'admin', 'employer', 'job_seeker'].includes(role))
      return res.status(400).json({ message: 'Choose a valid account role.' });
    const conditions = [],
      values = [];
    if (role !== 'all') {
      conditions.push('u.role=?');
      values.push(role);
    }
    if (queryText(req.query.q)) {
      conditions.push("(u.full_name LIKE ? ESCAPE '!' OR u.email LIKE ? ESCAPE '!')");
      values.push(...Array(2).fill(searchValue(req.query.q)));
    }
    return paginated(req, res, {
      from: 'users u',
      columns:
        "u.id,u.full_name,u.email,u.role,u.account_status,u.email_verified,u.created_at,CASE WHEN u.email LIKE '%@demo.mimaropa.test' THEN 1 ELSE 0 END AS is_demo",
      conditions,
      values,
      order: 'u.created_at DESC,u.id',
    });
  });

  route('audit-logs', async (req, res) => {
    const conditions = [],
      values = [],
      action = queryText(req.query.action);
    if (action && action !== 'all') {
      conditions.push('a.action=?');
      values.push(action);
    }
    if (queryText(req.query.q)) {
      conditions.push(
        "(a.action LIKE ? ESCAPE '!' OR a.entity_type LIKE ? ESCAPE '!' OR a.entity_id LIKE ? ESCAPE '!' OR u.full_name LIKE ? ESCAPE '!' OR a.details LIKE ? ESCAPE '!')",
      );
      values.push(...Array(5).fill(searchValue(req.query.q)));
    }
    // Parse only the allowlisted metadata; never expose unknown historical keys.
    const send = {
      json: (data) =>
        res.json({
          ...data,
          items: data.items.map((item) => {
            let details = {};
            try {
              details = JSON.parse(item.details);
            } catch {
              /* Keep malformed metadata empty. */
            }
            return {
              ...item,
              details: Object.fromEntries(
                Object.entries(details || {}).filter(
                  ([key, value]) =>
                    detailKeys.has(key) && ['string', 'number', 'boolean'].includes(typeof value),
                ),
              ),
            };
          }),
        }),
    };
    return paginated(req, send, {
      from: 'admin_audit_logs a LEFT JOIN users u ON u.id=a.actor_id',
      columns:
        'a.id,a.action,a.entity_type,a.entity_id,a.details,a.created_at,u.full_name AS actor_name',
      conditions,
      values,
      order: 'a.created_at DESC,a.id',
    });
  });
}
