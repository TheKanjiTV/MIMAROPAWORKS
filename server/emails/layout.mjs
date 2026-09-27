const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const firstName = (fullName) => String(fullName ?? '').trim().split(/\s+/)[0] || 'there';

export const emailLayout = ({ title, body }) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f4f7f6;color:#17211f;font-family:Arial,sans-serif;line-height:1.55">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:32px 16px">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #dce5e1;border-radius:12px;overflow:hidden">
      <tr><td style="padding:24px 32px;background:#0f6d57;color:#ffffff;font-size:20px;font-weight:700">MIMAROPA Jobs</td></tr>
      <tr><td style="padding:30px 32px">${body}</td></tr>
      <tr><td style="padding:18px 32px;background:#f4f7f6;color:#5a6863;font-size:12px">MIMAROPA Jobs · Employment opportunities for MIMAROPA</td></tr>
    </table>
  </td></tr></table>
</body></html>`;

export const textToHtml = (text) =>
  emailLayout({
    title: 'MIMAROPA Jobs',
    body: `<p style="margin:0;white-space:pre-line">${escapeHtml(text)}</p>`,
  });

export { escapeHtml };
