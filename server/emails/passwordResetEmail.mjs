import { emailLayout, escapeHtml, firstName } from './layout.mjs';

export function passwordResetEmail({ fullName, resetUrl }) {
  const name = firstName(fullName);
  return {
    subject: 'Reset your MIMAROPA Jobs password',
    text: `Hi ${name},\n\nOpen this link to reset your MIMAROPA Jobs password:\n${resetUrl}\n\nThis link expires in 30 minutes. If you did not request this, ignore this email.`,
    html: emailLayout({
      title: 'Reset your MIMAROPA Jobs password',
      body: `<h1 style="margin:0 0 16px;font-size:24px">Reset your password</h1><p>Hi ${escapeHtml(name)},</p><p>Use the button below to choose a new MIMAROPA Jobs password.</p><p style="margin:24px 0"><a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 18px;background:#0f6d57;color:#ffffff;text-decoration:none;border-radius:7px;font-weight:700">Reset password</a></p><p style="font-size:14px;color:#5a6863">This link expires in 30 minutes. If you did not request a password reset, you can ignore this email.</p>`,
    }),
  };
}
