import 'dotenv/config';
import { connectDatabase, assertMigrated } from './database.mjs';

const email = process.argv[2]?.trim().toLowerCase();

if (process.env.NODE_ENV === 'production')
  throw new Error('admin:promote is disabled when NODE_ENV=production.');
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  throw new Error('Usage: npm run admin:promote -- user@example.com');
if (process.argv.length !== 3)
  throw new Error('Provide exactly one existing account email.');

const db = await connectDatabase();
await assertMigrated(db);
try {
  const user = await db
    .prepare('SELECT id,email,role,account_status FROM users WHERE email=?')
    .get(email);
  if (!user) throw new Error(`No registered account was found for ${email}.`);
  if (user.account_status !== 'active')
    throw new Error(`The account for ${email} is not active and was not changed.`);
  if (user.role === 'admin') {
    console.log(`Account is already an Admin: ${email}. No fields were changed.`);
  } else {
    await db
      .prepare("UPDATE users SET role='admin',updated_at=? WHERE id=? AND account_status='active'")
      .run(Date.now(), user.id);
    console.log(`Promoted existing account to Admin: ${email}. Use /admin/login.`);
  }
} finally {
  await db.close();
}
