import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { connectDatabase, assertMigrated } from './database.mjs';
import { hashPassword } from './app.mjs';
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME?.trim() || 'Administrator';
if (
  !email ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
  !password ||
  password.length < 12 ||
  password.length > 128
)
  throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (12–128 characters) in this shell.');
const db = await connectDatabase();
await assertMigrated(db);
try {
  if (await db.prepare('SELECT id FROM users WHERE email=?').get(email))
    throw new Error('Account already exists; no role or password was changed.');
  const now = Date.now();
  await db
    .prepare(
      "INSERT INTO users (id,full_name,email,password_hash,email_verified,role,created_at,updated_at) VALUES (?,?,?,?,1,'admin',?,?)",
    )
    .run(randomUUID(), name, email, await hashPassword(password), now, now);
  console.log('Administrator created. Use /admin/login.');
} finally {
  delete process.env.ADMIN_PASSWORD;
  await db.close();
}
