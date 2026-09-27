import { emailLayout, escapeHtml, firstName } from './layout.mjs';

export function verificationEmail({ fullName, verificationUrl }) {
  const name = firstName(fullName);
  return {
    subject: 'Verify your MIMAROPA Jobs account',
    text: `Hi ${name},\n\nOpen this link to verify your MIMAROPA Jobs account:\n${verificationUrl}\n\nThis link expires in 24 hours. If you did not create this account, you can ignore this email.`,
    html: emailLayout({
      title: 'Verify your MIMAROPA Jobs account',
      body: `<h1 style="margin:0 0 16px;font-size:24px">Verify your email</h1><p>Hi ${escapeHtml(name)},</p><p>Confirm your MIMAROPA Jobs account to continue building your profile.</p><p style="margin:24px 0"><a href="${escapeHtml(verificationUrl)}" style="display:inline-block;padding:12px 18px;background:#0f6d57;color:#ffffff;text-decoration:none;border-radius:7px;font-weight:700">Verify email address</a></p><p style="font-size:14px;color:#5a6863">This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>`,
    }),
  };
}
