import 'dotenv/config';
import express from 'express';
import { resolve } from 'node:path';
import { connectDatabase, assertMigrated } from './database.mjs';
import { createApp } from './app.mjs';
import { createEmailService } from './services/emailService.mjs';
const production = process.env.NODE_ENV === 'production';
const origin = process.env.APP_ORIGIN || 'http://127.0.0.1:5173';
const brevoConfigured = Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
const legacyProviderConfigured = Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM) || Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM);
if (production && (!origin.startsWith('https://') || (!brevoConfigured && !legacyProviderConfigured)))
  throw new Error('Production requires an HTTPS APP_ORIGIN and a configured Brevo, Resend, or SMTP sender.');
const db = await connectDatabase();
await assertMigrated(db);
const app = await createApp({
  db,
  origin,
  production,
  googleClientId: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '',
});
if (production) {
  app.use(express.static(resolve('dist')));
  app.get('/{*path}', (req, res) => res.sendFile(resolve('dist/index.html')));
}
const emailService = createEmailService();
let sending = false;
const timer = setInterval(async () => {
  if (sending) return;
  sending = true;
  try {
    const now = Date.now();
    await db.prepare('DELETE FROM sessions WHERE expires_at<?').run(now);
    await db.prepare('DELETE FROM action_tokens WHERE expires_at<?').run(now);
    await db.prepare('DELETE FROM mail_queue WHERE created_at<?').run(now - 86400000);
    for (const mail of await db
      .prepare('SELECT * FROM mail_queue WHERE attempts<5 ORDER BY created_at LIMIT 5')
      .all()) {
      try {
        const delivery = await emailService.sendEmail({
          id: mail.id,
          to: mail.recipient,
          subject: mail.subject,
          text: mail.body,
          html: mail.html ?? undefined,
        });
        if (!delivery.success) throw new Error(delivery.error);
        await db.prepare('DELETE FROM mail_queue WHERE id=?').run(mail.id);
      } catch {
        await db.prepare('UPDATE mail_queue SET attempts=attempts+1 WHERE id=?').run(mail.id);
        console.error('Mail delivery failed. Check the transactional email configuration.');
      }
    }
  } catch {
    console.error('Mail worker could not reach the database; it will retry.');
  } finally {
    sending = false;
  }
}, 5000);
const server = app.listen(Number(process.env.API_PORT || 3001), '127.0.0.1', () => {
  console.log(`Authentication API ready on port ${process.env.API_PORT || 3001}.`);
  if (emailService.provider === 'development_preview')
    console.log('Development mail is written to server/data/mail-preview (not sent).');
  else console.log(`Transactional email provider: ${emailService.provider}.`);
});
const close = () => {
  clearInterval(timer);
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
};
process.on('SIGINT', close);
process.on('SIGTERM', close);
