import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import mysql from 'mysql2/promise';
import { sqliteSchema } from './schema-sqlite.mjs';
import { mysqlSchema } from './schema-mysql.mjs';

export function databaseConfig(env = process.env) {
  const driver = env.DB_CONNECTION || 'mysql';
  if (!['mysql', 'sqlite'].includes(driver))
    throw new Error('DB_CONNECTION must be mysql or sqlite.');
  if (driver === 'sqlite')
    return {
      driver,
      filename: env.DB_DATABASE || env.DATABASE_PATH || 'server/data/innohack.sqlite',
    };
  const database = env.DB_DATABASE || 'innohack';
  if (!/^[a-zA-Z0-9_]{1,64}$/.test(database))
    throw new Error('DB_DATABASE must contain only letters, numbers, and underscores.');
  const port = Number(env.DB_PORT || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('DB_PORT must be a valid TCP port.');
  return {
    driver,
    database,
    host: env.DB_HOST || '127.0.0.1',
    port,
    user: env.DB_USERNAME || 'root',
    password: env.DB_PASSWORD ?? '',
  };
}
export class DatabaseConflict extends Error {
  constructor() {
    super('This action has already been used or expired.');
    this.code = 'ACTION_CONFLICT';
  }
}
export function openDatabase(path, { migrate = true } = {}) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  if (migrate) db.exec(sqliteSchema);
  db.driver = 'sqlite';
  db.batch = (operations) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const { sql, params = [], requireChanges } of operations) {
        const result = db.prepare(sql).run(...params);
        if (requireChanges && result.changes !== requireChanges) throw new DatabaseConflict();
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
  return db;
}
function mysqlSQL(sql) {
  return sql.replace(
    /ON CONFLICT\(user_id\) DO UPDATE SET (.*)$/s,
    (_, assignments) =>
      `ON DUPLICATE KEY UPDATE ${assignments.replace(/excluded\.(\w+)/g, 'VALUES($1)')}`,
  );
}
export async function connectDatabase(config = databaseConfig()) {
  if (config.driver === 'sqlite') return openDatabase(config.filename, { migrate: false });
  const { driver, ...options } = config;
  const pool = mysql.createPool({
    ...options,
    charset: 'utf8mb4',
    connectionLimit: 5,
    connectTimeout: 5000,
    supportBigNumbers: true,
    bigNumberStrings: false,
    jsonStrings: true,
    multipleStatements: false,
  });
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    await pool.end();
    throw error;
  }
  const execute = async (sql, params, connection = pool) =>
    (await connection.execute(mysqlSQL(sql), params))[0];
  return {
    driver,
    prepare: (sql) => ({
      get: async (...params) => (await execute(sql, params))[0],
      all: (...params) => execute(sql, params),
      run: async (...params) => {
        const result = await execute(sql, params);
        return { changes: result.affectedRows };
      },
    }),
    exec: (sql) => pool.query(sql),
    close: () => pool.end(),
    batch: async (operations) => {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        for (const { sql, params = [], requireChanges } of operations) {
          const result = await execute(sql, params, connection);
          if (requireChanges && result.affectedRows !== requireChanges)
            throw new DatabaseConflict();
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
  };
}
export async function createDatabase(config = databaseConfig()) {
  if (config.driver === 'sqlite') {
    const db = openDatabase(config.filename, { migrate: false });
    db.close();
    return;
  }
  const { driver: _driver, database, ...options } = config;
  const connection = await mysql.createConnection({ ...options, connectTimeout: 5000 });
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await connection.end();
  }
}
export const MIGRATION = '001_auth_and_profiles';
export const ROLE_FLOW_MIGRATION = '002_role_flow_and_matching';
export const RESUME_MIGRATION = '003_private_resumes';
export const EMPLOYER_MIGRATION = '004_employer_workflow';
export const JOB_LIFECYCLE_MIGRATION = '005_job_lifecycle';
export const EMAIL_SERVICE_MIGRATION = '006_email_service';
export const APPLICATION_MIGRATION = '007_applications';
export const COMMUNITY_MIGRATION = '008_seeker_community';
export async function migrateDatabase(db) {
  await db.exec(
    db.driver === 'mysql'
      ? 'CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(100) PRIMARY KEY, applied_at BIGINT NOT NULL) ENGINE=InnoDB'
      : 'CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)',
  );
  let changed = false;
  if (!(await db.prepare('SELECT version FROM schema_migrations WHERE version=?').get(MIGRATION))) {
    if (db.driver === 'mysql') for (const statement of mysqlSchema) await db.exec(statement);
    else await db.exec(sqliteSchema);
    await db.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(MIGRATION, Date.now());
    changed = true;
  }
  if (!(await db.prepare('SELECT version FROM schema_migrations WHERE version=?').get(ROLE_FLOW_MIGRATION))) {
    if (db.driver === 'mysql') {
      try { await db.exec('ALTER TABLE users ADD COLUMN role_selected TINYINT NOT NULL DEFAULT 0'); } catch (error) { if (error.code !== 'ER_DUP_FIELDNAME') throw error; }
      await db.exec('CREATE TABLE IF NOT EXISTS job_seeker_profiles (user_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY, data JSON NOT NULL, normalized_profile_text TEXT NOT NULL, resume_text MEDIUMTEXT, onboarding_step INT NOT NULL DEFAULT 0, completed TINYINT NOT NULL DEFAULT 0, updated_at BIGINT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
      await db.exec("CREATE TABLE IF NOT EXISTS jobs (id VARCHAR(36) PRIMARY KEY, employer_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci, title VARCHAR(150) NOT NULL, company_name VARCHAR(150) NOT NULL, description TEXT NOT NULL, industry VARCHAR(100) NOT NULL, province VARCHAR(100) NOT NULL, municipality VARCHAR(100) NOT NULL, employment_type VARCHAR(40) NOT NULL, work_setup VARCHAR(40) NOT NULL, salary_min INT, salary_max INT, required_skills JSON NOT NULL, preferred_skills JSON NOT NULL, education_required VARCHAR(100), experience_required INT NOT NULL DEFAULT 0, status VARCHAR(20) NOT NULL DEFAULT 'active', created_at BIGINT NOT NULL, FOREIGN KEY (employer_id) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    } else {
      try { await db.exec('ALTER TABLE users ADD COLUMN role_selected INTEGER NOT NULL DEFAULT 0'); } catch (error) { if (!String(error.message).includes('duplicate column')) throw error; }
      await db.exec('CREATE TABLE IF NOT EXISTS job_seeker_profiles (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL, normalized_profile_text TEXT NOT NULL, resume_text TEXT, onboarding_step INTEGER NOT NULL DEFAULT 0, completed INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL)');
      await db.exec("CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, employer_id TEXT REFERENCES users(id) ON DELETE SET NULL, title TEXT NOT NULL, company_name TEXT NOT NULL, description TEXT NOT NULL, industry TEXT NOT NULL, province TEXT NOT NULL, municipality TEXT NOT NULL, employment_type TEXT NOT NULL, work_setup TEXT NOT NULL, salary_min INTEGER, salary_max INTEGER, required_skills TEXT NOT NULL, preferred_skills TEXT NOT NULL, education_required TEXT, experience_required INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active', created_at INTEGER NOT NULL)");
    }
    await db.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(ROLE_FLOW_MIGRATION, Date.now());
    changed = true;
  }
  if (!(await db.prepare('SELECT version FROM schema_migrations WHERE version=?').get(RESUME_MIGRATION))) {
    await db.exec(db.driver === 'mysql'
      ? 'CREATE TABLE IF NOT EXISTS resumes (id VARCHAR(36) PRIMARY KEY,user_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,storage_path VARCHAR(500) NOT NULL,original_filename VARCHAR(255) NOT NULL,file_size INT NOT NULL,parsing_status VARCHAR(20) NOT NULL,analysis JSON,uploaded_at BIGINT NOT NULL,parsed_at BIGINT,FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
      : 'CREATE TABLE IF NOT EXISTS resumes (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,storage_path TEXT NOT NULL,original_filename TEXT NOT NULL,file_size INTEGER NOT NULL,parsing_status TEXT NOT NULL,analysis TEXT,uploaded_at INTEGER NOT NULL,parsed_at INTEGER)');
    await db.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(RESUME_MIGRATION, Date.now()); changed = true;
  }
  if (!(await db.prepare('SELECT version FROM schema_migrations WHERE version=?').get(EMPLOYER_MIGRATION))) {
    await db.exec(db.driver === 'mysql'
      ? "CREATE TABLE IF NOT EXISTS employer_profiles (user_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY,company_name VARCHAR(150) NOT NULL,industry VARCHAR(100) NOT NULL,description TEXT,address TEXT,province VARCHAR(100) NOT NULL,municipality VARCHAR(100) NOT NULL,company_size VARCHAR(30),contact_person VARCHAR(150) NOT NULL,contact_position VARCHAR(100) NOT NULL,business_email VARCHAR(254) NOT NULL,contact_number VARCHAR(50) NOT NULL,website VARCHAR(255),verification_status VARCHAR(20) NOT NULL DEFAULT 'pending',verification_reason TEXT,verified_at BIGINT,verified_by VARCHAR(36),updated_at BIGINT NOT NULL,FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
      : "CREATE TABLE IF NOT EXISTS employer_profiles (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,company_name TEXT NOT NULL,industry TEXT NOT NULL,description TEXT,address TEXT,province TEXT NOT NULL,municipality TEXT NOT NULL,company_size TEXT,contact_person TEXT NOT NULL,contact_position TEXT NOT NULL,business_email TEXT NOT NULL,contact_number TEXT NOT NULL,website TEXT,verification_status TEXT NOT NULL DEFAULT 'pending',verification_reason TEXT,verified_at INTEGER,verified_by TEXT,updated_at INTEGER NOT NULL)");
    await db.exec(db.driver === 'mysql' ? 'CREATE TABLE IF NOT EXISTS employer_documents (id VARCHAR(36) PRIMARY KEY,user_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,document_type VARCHAR(40) NOT NULL,storage_path VARCHAR(500) NOT NULL,original_filename VARCHAR(255) NOT NULL,file_size INT NOT NULL,uploaded_at BIGINT NOT NULL,FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : 'CREATE TABLE IF NOT EXISTS employer_documents (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,document_type TEXT NOT NULL,storage_path TEXT NOT NULL,original_filename TEXT NOT NULL,file_size INTEGER NOT NULL,uploaded_at INTEGER NOT NULL)');
    await db.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(EMPLOYER_MIGRATION, Date.now()); changed = true;
  }
  if (!(await db.prepare('SELECT version FROM schema_migrations WHERE version=?').get(JOB_LIFECYCLE_MIGRATION))) {
    const alters = db.driver === 'mysql'
      ? ['ALTER TABLE jobs ADD COLUMN vacancies INT NOT NULL DEFAULT 1','ALTER TABLE jobs ADD COLUMN application_deadline BIGINT NULL','ALTER TABLE jobs ADD COLUMN normalized_job_text TEXT NULL','ALTER TABLE jobs ADD COLUMN updated_at BIGINT NULL']
      : ['ALTER TABLE jobs ADD COLUMN vacancies INTEGER NOT NULL DEFAULT 1','ALTER TABLE jobs ADD COLUMN application_deadline INTEGER','ALTER TABLE jobs ADD COLUMN normalized_job_text TEXT','ALTER TABLE jobs ADD COLUMN updated_at INTEGER'];
    for (const sql of alters) try { await db.exec(sql); } catch (error) { if (!String(error.code ?? error.message).includes('Duplicate') && !String(error.message).includes('duplicate column')) throw error; }
    await db.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(JOB_LIFECYCLE_MIGRATION, Date.now()); changed = true;
  }
  if (!(await db.prepare('SELECT version FROM schema_migrations WHERE version=?').get(EMAIL_SERVICE_MIGRATION))) {
    try {
      await db.exec(db.driver === 'mysql' ? 'ALTER TABLE mail_queue ADD COLUMN html MEDIUMTEXT NULL' : 'ALTER TABLE mail_queue ADD COLUMN html TEXT');
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME' && !String(error.code ?? error.message).includes('Duplicate') && !String(error.message).includes('duplicate column')) throw error;
    }
    await db.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(EMAIL_SERVICE_MIGRATION, Date.now());
    changed = true;
  }
  if (!(await db.prepare('SELECT version FROM schema_migrations WHERE version=?').get(APPLICATION_MIGRATION))) {
    await db.exec(db.driver === 'mysql'
      ? "CREATE TABLE IF NOT EXISTS applications (id VARCHAR(36) PRIMARY KEY,job_id VARCHAR(36) NOT NULL,job_seeker_id VARCHAR(36) NOT NULL,status VARCHAR(30) NOT NULL DEFAULT 'submitted',match_score INT NOT NULL,semantic_score DECIMAL(7,5) NOT NULL,skills_score DECIMAL(7,5) NOT NULL,location_score DECIMAL(7,5) NOT NULL,education_score DECIMAL(7,5) NOT NULL,experience_score DECIMAL(7,5) NOT NULL,matched_skills JSON NOT NULL,missing_skills JSON NOT NULL,applied_at BIGINT NOT NULL,updated_at BIGINT NOT NULL,UNIQUE KEY applications_job_seeker (job_id,job_seeker_id),INDEX applications_job (job_id),FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE RESTRICT,FOREIGN KEY (job_seeker_id) REFERENCES users(id) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
      : "CREATE TABLE IF NOT EXISTS applications (id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,job_seeker_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,status TEXT NOT NULL DEFAULT 'submitted',match_score INTEGER NOT NULL,semantic_score REAL NOT NULL,skills_score REAL NOT NULL,location_score REAL NOT NULL,education_score REAL NOT NULL,experience_score REAL NOT NULL,matched_skills TEXT NOT NULL,missing_skills TEXT NOT NULL,applied_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,UNIQUE(job_id,job_seeker_id))");
    await db.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(APPLICATION_MIGRATION, Date.now());
    changed = true;
  }
  if (!(await db.prepare('SELECT version FROM schema_migrations WHERE version=?').get(COMMUNITY_MIGRATION))) {
    if (db.driver === 'mysql') {
      await db.exec("CREATE TABLE IF NOT EXISTS saved_jobs (user_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL, job_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY (user_id, job_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
      await db.exec("CREATE TABLE IF NOT EXISTS conversations (id VARCHAR(36) PRIMARY KEY, application_id VARCHAR(36) NOT NULL UNIQUE, seeker_read_at BIGINT NOT NULL DEFAULT 0, employer_read_at BIGINT NOT NULL DEFAULT 0, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
      await db.exec("CREATE TABLE IF NOT EXISTS messages (id VARCHAR(36) PRIMARY KEY, conversation_id VARCHAR(36) NOT NULL, sender_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL, body TEXT NOT NULL, created_at BIGINT NOT NULL, FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE, FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
      await db.exec("CREATE TABLE IF NOT EXISTS notifications (id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL, title VARCHAR(255) NOT NULL, body TEXT NOT NULL, href VARCHAR(500) NULL, type VARCHAR(50) NULL, created_at BIGINT NOT NULL, read_at BIGINT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    } else {
      await db.exec("CREATE TABLE IF NOT EXISTS saved_jobs (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, created_at INTEGER NOT NULL, PRIMARY KEY (user_id, job_id))");
      await db.exec("CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, application_id TEXT NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE, seeker_read_at INTEGER NOT NULL DEFAULT 0, employer_read_at INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)");
      await db.exec("CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, body TEXT NOT NULL, created_at INTEGER NOT NULL)");
      await db.exec("CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, body TEXT NOT NULL, href TEXT, type TEXT, created_at INTEGER NOT NULL, read_at INTEGER)");
    }
    await db.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(COMMUNITY_MIGRATION, Date.now());
    changed = true;
  }
  return changed;
}
export async function assertMigrated(db) {
  try {
    if (await db.prepare('SELECT version FROM schema_migrations WHERE version=?').get(APPLICATION_MIGRATION)) {
      await migrateDatabase(db);
      return;
    }
  } catch (error) {
    if (!['ER_NO_SUCH_TABLE', 'ERR_SQLITE_ERROR'].includes(error.code)) throw error;
  }
  throw new Error('Database migration is pending. Run npm run db:migrate before starting the API.');
}
