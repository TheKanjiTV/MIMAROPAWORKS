import { emailLayout, escapeHtml, firstName } from './layout.mjs';

const message = ({ fullName, heading, paragraphs }) => {
  const name = firstName(fullName);
  const text = [`Hi ${name},`, '', ...paragraphs, '', 'MIMAROPA Jobs'].join('\n');
  return {
    text,
    html: emailLayout({
      title: heading,
      body: `<h1 style="margin:0 0 16px;font-size:24px">${escapeHtml(heading)}</h1><p>Hi ${escapeHtml(name)},</p>${paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}`,
    }),
  };
};

export const employerSubmittedEmail = ({ fullName, companyName }) => ({
  subject: 'Employer verification received',
  ...message({ fullName, heading: 'Verification received', paragraphs: [`We received the verification documents for ${companyName}.`, 'Your company is under review. You can save drafts while job publishing remains unavailable.'] }),
});

export const employerApprovedEmail = ({ fullName, companyName }) => ({
  subject: 'Your employer account has been approved',
  ...message({ fullName, heading: 'Company verified', paragraphs: [`${companyName} has been verified.`, 'You can now publish job opportunities on MIMAROPA Jobs.'] }),
});

export const employerRejectedEmail = ({ fullName, companyName, reason }) => ({
  subject: 'Action required for your employer verification',
  ...message({ fullName, heading: 'Verification needs an update', paragraphs: [`We could not verify ${companyName} yet.`, `Reason: ${reason}`, 'Update your company details or verification documents, then submit them again.'] }),
});
