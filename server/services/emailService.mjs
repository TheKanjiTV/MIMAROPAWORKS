import { BrevoClient } from '@getbrevo/brevo';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { textToHtml } from '../emails/layout.mjs';

const safeError = (error) => error?.name || error?.code || 'delivery_failed';

export function createEmailService({
  env = process.env,
  brevoClient,
  resendClient,
  smtpTransport,
  previewDirectory = 'server/data/mail-preview',
  previewWriter,
} = {}) {
  const senderName = env.BREVO_SENDER_NAME || 'MIMAROPA Jobs';
  const senderEmail = env.BREVO_SENDER_EMAIL || '';
  const hasBrevo = Boolean(env.BREVO_API_KEY && senderEmail);
  const brevo = hasBrevo ? (brevoClient ?? new BrevoClient({ apiKey: env.BREVO_API_KEY })) : null;
  const resend = !hasBrevo && env.RESEND_API_KEY ? (resendClient ?? new Resend(env.RESEND_API_KEY)) : null;
  const transport = !hasBrevo && !resend && (smtpTransport ?? (env.SMTP_HOST
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: Number(env.SMTP_PORT || 587),
        secure: env.SMTP_SECURE === 'true',
        requireTLS: env.SMTP_SECURE !== 'true',
        ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
      })
    : null));
  const provider = brevo ? 'brevo' : resend ? 'resend' : transport ? 'smtp' : 'development_preview';

  async function writePreview({ id, to, subject, text }) {
    if (previewWriter) return previewWriter({ id, to, subject, text });
    await mkdir(previewDirectory, { recursive: true });
    await writeFile(join(previewDirectory, `${id}.txt`), `To: ${to}\nSubject: ${subject}\n\n${text}`, { mode: 0o600 });
  }

  async function sendEmail({ id = 'message', to, name = '', subject, text = '', html }) {
    if (!to || !subject) return { success: false, error: 'invalid_email_payload', provider };
    const htmlContent = html || textToHtml(text);
    try {
      if (brevo) {
        const result = await brevo.transactionalEmails.sendTransacEmail({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: to, ...(name ? { name } : {}) }],
          subject,
          htmlContent,
          textContent: text,
        });
        return { success: true, messageId: result.messageId ?? result.messageIds?.[0] ?? null, provider };
      }
      if (resend) {
        const result = await resend.emails.send({ from: env.MAIL_FROM, to, subject, text, html: htmlContent });
        return { success: true, messageId: result.data?.id ?? null, provider };
      }
      if (transport) {
        const result = await transport.sendMail({ from: env.MAIL_FROM, to, subject, text, html: htmlContent });
        return { success: true, messageId: result.messageId ?? null, provider };
      }
      await writePreview({ id, to, subject, text });
      return { success: true, messageId: id, provider };
    } catch (error) {
      console.error(`Transactional email delivery failed via ${provider}: ${safeError(error)}`);
      return { success: false, error: 'delivery_failed', provider };
    }
  }

  return { provider, sendEmail };
}
