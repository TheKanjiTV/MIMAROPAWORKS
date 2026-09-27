import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmailService } from './services/emailService.mjs';

test('Brevo delivery uses the official client server-side and returns a safe result', async () => {
  let request;
  const service = createEmailService({
    env: {
      BREVO_API_KEY: 'test-key',
      BREVO_SENDER_EMAIL: 'sender@example.test',
      BREVO_SENDER_NAME: 'MIMAROPA Jobs',
    },
    brevoClient: {
      transactionalEmails: {
        sendTransacEmail: async (payload) => {
          request = payload;
          return { messageId: 'brevo-message-id' };
        },
      },
    },
  });
  const result = await service.sendEmail({
    id: 'test-id',
    to: 'recipient@example.test',
    name: 'Recipient',
    subject: 'Email test',
    text: 'It works!',
    html: '<p>It works!</p>',
  });
  assert.deepEqual(result, { success: true, messageId: 'brevo-message-id', provider: 'brevo' });
  assert.deepEqual(request.sender, { name: 'MIMAROPA Jobs', email: 'sender@example.test' });
  assert.equal(request.to[0].email, 'recipient@example.test');
  assert.equal(request.to[0].name, 'Recipient');
  assert.equal(request.htmlContent, '<p>It works!</p>');
});

test('Brevo omits an empty recipient name instead of sending an invalid field', async () => {
  let request;
  const service = createEmailService({
    env: { BREVO_API_KEY: 'test-key', BREVO_SENDER_EMAIL: 'sender@example.test' },
    brevoClient: { transactionalEmails: { sendTransacEmail: async (payload) => { request = payload; return {}; } } },
  });
  await service.sendEmail({ to: 'recipient@example.test', subject: 'Test', text: 'Body' });
  assert.deepEqual(request.to, [{ email: 'recipient@example.test' }]);
});

test('failed provider calls are predictable and do not expose provider details', async () => {
  const service = createEmailService({
    env: { BREVO_API_KEY: 'test-key', BREVO_SENDER_EMAIL: 'sender@example.test' },
    brevoClient: { transactionalEmails: { sendTransacEmail: async () => { throw new Error('secret provider response'); } } },
  });
  const result = await service.sendEmail({ to: 'recipient@example.test', subject: 'Test', text: 'Body' });
  assert.deepEqual(result, { success: false, error: 'delivery_failed', provider: 'brevo' });
});

test('development preview remains available with no configured provider', async () => {
  let preview;
  const service = createEmailService({
    env: {},
    previewWriter: async (message) => { preview = message; },
  });
  const result = await service.sendEmail({ id: 'preview', to: 'recipient@example.test', subject: 'Preview', text: 'Body' });
  assert.deepEqual(result, { success: true, messageId: 'preview', provider: 'development_preview' });
  assert.equal(preview.subject, 'Preview');
});
