export const sqliteSchema = `
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT,
      google_id TEXT UNIQUE, profile_photo TEXT,
      auth_provider TEXT NOT NULL DEFAULT 'password',
      email_verified INTEGER NOT NULL DEFAULT 0,
      role TEXT NOT NULL DEFAULT 'job_seeker' CHECK(role IN ('job_seeker','employer','admin')),
      profile_completion INTEGER NOT NULL DEFAULT 0,
      account_status TEXT NOT NULL DEFAULT 'active',
      terms_accepted_at INTEGER, terms_version TEXT,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      csrf TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS action_tokens (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      province TEXT NOT NULL DEFAULT '', municipality TEXT NOT NULL DEFAULT '',
      education TEXT NOT NULL DEFAULT '', skills TEXT NOT NULL DEFAULT '',
      preferred_job TEXT NOT NULL DEFAULT '', work_setup TEXT NOT NULL DEFAULT '',
      step INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS mail_queue (
      id TEXT PRIMARY KEY, recipient TEXT NOT NULL, subject TEXT NOT NULL,
      body TEXT NOT NULL, html TEXT, created_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0
    );
  `;
