import 'dotenv/config';
import {
  databaseConfig,
  connectDatabase,
  createDatabase,
  migrateDatabase,
  MIGRATION,
  ROLE_FLOW_MIGRATION,
  RESUME_MIGRATION,
  EMPLOYER_MIGRATION,
  JOB_LIFECYCLE_MIGRATION,
  EMAIL_SERVICE_MIGRATION,
  APPLICATION_MIGRATION,
  COMMUNITY_MIGRATION,
} from './database.mjs';
const config = databaseConfig();
let db;
try {
  if (process.argv[2] === 'create') {
    await createDatabase(config);
    console.log(`Database ready: ${config.driver} / ${config.database || config.filename}`);
  } else {
    db = await connectDatabase(config);
    if (process.argv[2] === 'migrate')
      console.log(
        (await migrateDatabase(db)) ? `Applied ${COMMUNITY_MIGRATION}` : 'All migrations already applied.',
      );
    else if (process.argv[2] === 'status') {
      let applied = false;
      try {
        applied = Boolean(
          await db.prepare('SELECT version FROM schema_migrations WHERE version=?').get(COMMUNITY_MIGRATION),
        );
      } catch (error) {
        if (!['ER_NO_SUCH_TABLE', 'ERR_SQLITE_ERROR'].includes(error.code)) throw error;
      }
      console.log(`${config.driver}: ${COMMUNITY_MIGRATION} - ${applied ? 'applied' : 'pending'}`);
      if (!applied) process.exitCode = 1;
    } else throw new Error('Use db:create, db:migrate, or db:status.');
  }
} catch (error) {
  console.error(
    `Database command failed (${error.code || error.message}). Check DB_* settings and start MySQL if selected. Run db:create before db:migrate.`,
  );
  process.exitCode = 1;
} finally {
  if (db) await db.close();
}
