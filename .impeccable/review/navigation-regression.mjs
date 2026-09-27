import { chromium } from 'file:///C:/Users/kenji/AppData/Local/Temp/innohack-ui-qa/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { fixtures, user } from './fixtures.mjs';

const results = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
await context.route('https://**', route => route.abort());
await fixtures(context);
let resetFailure = false;
const resetPayloads = [];
await context.route('**/api/auth/forgot-password', async route => {
  resetPayloads.push(route.request().postDataJSON());
  await route.fulfill({ status: resetFailure ? 503 : 200, json: { message: resetFailure ? 'Reset instructions are temporarily unavailable. Please try again.' : 'If an account exists for this email, we sent password reset instructions.' } });
});
const notices = [
  { id: 'notice-ok', title: 'Application received', body: 'Your application was received.', type: 'application', href: null, read_at: null, created_at: Date.now() },
  { id: 'notice-fail', title: 'Application update', body: 'Your application has an update.', type: 'application', href: null, read_at: null, created_at: Date.now() },
];
await context.route('**/api/notifications**', async route => {
  const path = new URL(route.request().url()).pathname;
  if (path.endsWith('/read')) {
    if (path.includes('notice-fail')) return route.fulfill({ status: 503, json: { message: 'Notification service is temporarily unavailable.' } });
    notices[0].read_at = Date.now();
    return route.fulfill({ json: { success: true } });
  }
  await route.fulfill({ json: { notifications: notices, unread_count: notices.filter(n => !n.read_at).length } });
});
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
page.setDefaultTimeout(10000);
const go = async path => { await page.goto('http://127.0.0.1:5173' + path); await page.getByRole('heading', { level: 1 }).waitFor(); };
const test = async (name, action) => {
  try { const evidence = await action(); results.push({ name, status: 'pass', evidence }); }
  catch (error) { results.push({ name, status: 'fail', error: error.message }); }
};
try {
  await test('Global search updates twice on the same /jobs route', async () => {
    await go('/jobs');
    const search = page.getByRole('searchbox', { name: 'Search jobs, companies, or skills' });
    await search.fill('Customer'); await search.press('Enter');
    await page.waitForURL('**/jobs?q=Customer');
    await page.getByRole('heading', { name: 'Customer Service Associate', exact: true }).waitFor();
    await search.fill('Remote'); await search.press('Enter');
    await page.waitForURL('**/jobs?q=Remote');
    await page.getByRole('heading', { name: 'Remote Administrative Assistant', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Customer Service Associate', exact: true }).count(), 0);
    assert.equal(await search.inputValue(), 'Remote');
    return { url: page.url(), query: await search.inputValue() };
  });
  await test('Account menu Escape restores focus', async () => {
    const trigger = page.getByRole('button', { name: 'Account menu', exact: true });
    await trigger.click(); await page.getByRole('group', { name: 'Account', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('group', { name: 'Account', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    return 'Closed and returned focus to the Account menu button.';
  });
  await test('Both mobile dropdowns stay inside a 320px viewport', async () => {
    await page.setViewportSize({ width: 320, height: 780 });
    const bounds = {};
    for (const [name, trigger, panel] of [
      ['account', page.getByRole('button', { name: 'Account menu', exact: true }), page.locator('#seeker-account-menu')],
      ['notifications', page.getByRole('button', { name: /^Notifications/ }), page.locator('#seeker-notifications')],
    ]) {
      await trigger.click(); await panel.waitFor();
      const box = await panel.boundingBox();
      assert.ok(box && box.x >= -1 && box.x + box.width <= 321, JSON.stringify(box));
      bounds[name] = box;
      await page.keyboard.press('Escape');
    }
    return bounds;
  });
  await test('Profile edit query clears and editor reopens', async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await go('/profile');
    for (let round = 0; round < 2; round++) {
      await page.getByRole('button', { name: 'Account menu', exact: true }).click();
      await page.getByRole('group', { name: 'Account', exact: true }).getByRole('button', { name: 'Edit Profile', exact: true }).click();
      await page.getByRole('dialog').waitFor();
      assert.equal(new URL(page.url()).searchParams.get('edit'), '1');
      await page.getByRole('button', { name: 'Close profile editor' }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.waitForURL('**/profile');
    }
    return 'Opened and closed twice; URL returned to /profile each time.';
  });
  await test('Notification partial failure preserves failed unread record', async () => {
    await go('/notifications');
    await page.getByRole('button', { name: 'Mark all as read', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Some notifications could not' }).waitFor();
    await page.getByRole('button', { name: 'Unread (1)', exact: true }).click();
    assert.equal(await page.getByRole('heading', { name: 'Application received', exact: true }).count(), 0);
    await page.getByRole('heading', { name: 'Application update', exact: true }).waitFor();
    const failedButton = page.getByRole('button', { name: 'Mark Application update as read', exact: true });
    await failedButton.focus(); await page.keyboard.press('Enter');
    await page.getByRole('alert').filter({ hasText: 'Notification service is temporarily unavailable.' }).waitFor();
    assert.equal(await failedButton.count(), 1);
    return { unread: 1, failedItemKept: true, keyboardAction: true };
  });
  await test('Password reset uses mocked API success and failure without claiming a password change', async () => {
    await go('/settings');
    assert.equal(resetPayloads.length, 0);
    assert.equal(await page.locator('input[type="password"]').count(), 0);
    const button = page.getByRole('button', { name: 'Send password reset link', exact: true });
    await button.click();
    await page.getByRole('status').filter({ hasText: 'we sent password reset instructions' }).waitFor();
    assert.deepEqual(resetPayloads[0], { email: user.email });
    assert.equal(await page.getByText('Password updated successfully.', { exact: true }).count(), 0);
    resetFailure = true;
    await button.click();
    await page.getByRole('alert').filter({ hasText: 'Reset instructions are temporarily unavailable.' }).waitFor();
    assert.equal(await page.getByRole('status').filter({ hasText: 'we sent password reset instructions' }).count(), 0);
    assert.equal(await button.isEnabled(), true);
    return { mockedRequests: resetPayloads.length, successMessage: 'Server reset-instructions message', failureRecoverable: true };
  });
  results.push({ name: 'No browser runtime errors', status: pageErrors.length ? 'fail' : 'pass', evidence: pageErrors });
} finally {
  await writeFile('.impeccable/review/navigation-regression-results.json', JSON.stringify({ apiMode: 'All API requests mocked; external HTTPS blocked', results }, null, 2));
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
if (results.some(result => result.status === 'fail')) process.exitCode = 1;
