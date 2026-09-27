import { emailLayout, escapeHtml, firstName } from './layout.mjs';

export function testEmail({ fullName }) {
  const name = firstName(fullName);
  return {
    subject: 'InnoHack Email Test',
    text: `Hi ${name},\n\nIt works!\n\nYour InnoHack platform is now connected to Brevo.`,
    html: emailLayout({
      title: 'InnoHack Email Test',
      body: `<h1 style="margin:0 0 16px;font-size:24px">It works!</h1><p>Hi ${escapeHtml(name)},</p><p>Your InnoHack platform is now connected to Brevo.</p>`,
    }),
  };
}
