const suffix = ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
export const mysqlSchema = [
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY, full_name VARCHAR(100) NOT NULL,
    email VARCHAR(254) COLLATE utf8mb4_bin NOT NULL UNIQUE, password_hash VARCHAR(255),
    google_id VARCHAR(255) COLLATE utf8mb4_bin UNIQUE, profile_photo TEXT,
    auth_provider VARCHAR(30) NOT NULL DEFAULT 'password', email_verified TINYINT NOT NULL DEFAULT 0,
    role ENUM('job_seeker','employer','admin') NOT NULL DEFAULT 'job_seeker',
    profile_completion INT NOT NULL DEFAULT 0, account_status VARCHAR(30) NOT NULL DEFAULT 'active',
    terms_accepted_at BIGINT, terms_version VARCHAR(30), created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    user_id VARCHAR(36), csrf CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    expires_at BIGINT NOT NULL, INDEX (expires_at), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS action_tokens (
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL, purpose VARCHAR(20) NOT NULL, expires_at BIGINT NOT NULL,
    INDEX (expires_at), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS profiles (
    user_id VARCHAR(36) PRIMARY KEY, province VARCHAR(150) NOT NULL DEFAULT '',
    municipality VARCHAR(150) NOT NULL DEFAULT '', education VARCHAR(150) NOT NULL DEFAULT '',
    skills VARCHAR(1000) NOT NULL DEFAULT '', preferred_job VARCHAR(150) NOT NULL DEFAULT '',
    work_setup VARCHAR(150) NOT NULL DEFAULT '', step INT NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS mail_queue (
    id VARCHAR(36) PRIMARY KEY, recipient VARCHAR(254) NOT NULL, subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL, html MEDIUMTEXT NULL, created_at BIGINT NOT NULL, attempts INT NOT NULL DEFAULT 0
  )`,
].map((sql) => sql + suffix);
