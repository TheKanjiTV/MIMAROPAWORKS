import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'file:///C:/Users/kenji/AppData/Local/Temp/innohack-ui-qa/node_modules/playwright/index.mjs';
import AxeBuilder from 'file:///C:/Users/kenji/AppData/Local/Temp/innohack-ui-qa/node_modules/@axe-core/playwright/dist/index.mjs';
import { startQa, attachQa } from './integrated-fixture.mjs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { views: [], interactions: [], consoleErrors: [], apiFailures: [], failures: [] };
const base = 'http://127.0.0.1:5173';
try {
  for (const [name, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
    const fixture = await startQa();
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    await attachQa(context, fixture, 'admin');
    const page = await context.newPage();
    page.on('pageerror', error => report.consoleErrors.push({ name, message: error.message }));
    page.on('response', response => { if (response.url().includes('/api/') && response.status() >= 400) report.apiFailures.push({ name, url: response.url(), status: response.status() }); });
    const inspect = async (view) => {
      await page.screenshot({ path: `.impeccable/review/admin-${view}-${name}.png`, fullPage: true });
      const bounds = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, dialogs: document.querySelectorAll('dialog[open]').length }));
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      report.views.push({ name, view, ...bounds, violations: axe.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) });
      assert.ok(bounds.documentWidth <= bounds.width, `${name}/${view} document overflow`);
    };
    try {
      await page.goto(`${base}/admin`);
      await page.getByRole('heading', { name: 'Platform activity' }).waitFor();
      assert.equal(await page.getByRole('heading', { name: '1 company needs a review' }).count(), 1);
      await inspect('overview');
      await page.getByText('View daily values', { exact: true }).click();
      assert.equal(await page.getByRole('region', { name: 'Daily activity values' }).locator('tbody tr').count(), 30);
      report.interactions.push(`${name}: 30 daily analytics values accessible`);

      await page.goto(`${base}/admin/verifications`);
      await page.getByRole('button', { name: 'Review QA Company Awaiting Review', exact: true }).waitFor();
      await inspect('verifications');
      await page.getByRole('button', { name: 'Review QA Company Awaiting Review', exact: true }).click();
      await page.getByRole('heading', { name: 'QA Company Awaiting Review', exact: true }).waitFor();
      await inspect('company-review');
      await page.getByRole('button', { name: 'Reject company', exact: true }).click();
      await page.getByLabel('Reason for rejection').fill('Please submit the current business registration document.');
      await inspect('rejection-dialog');
      await page.getByRole('button', { name: 'Confirm rejection', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'rejected. The decision is saved.' }).waitFor();
      await page.getByRole('button', { name: 'Rejected', exact: true }).click();
      await page.getByRole('button', { name: 'Review QA Company Awaiting Review', exact: true }).click();
      await page.getByRole('button', { name: 'Verify company', exact: true }).click();
      await page.getByRole('button', { name: 'Confirm verification', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'verified. The decision is saved.' }).waitFor();
      await page.getByRole('button', { name: 'Verified', exact: true }).click();
      await page.getByText('Page 1 of 21', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Next page', exact: true }).click();
      await page.getByText('Page 2 of 21', { exact: true }).waitFor();
      await page.getByLabel('Search company, contact or province', { exact: true }).fill('QA Company Awaiting Review');
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await page.getByText('1–1 of 1', { exact: true }).waitFor();
      report.interactions.push(`${name}: Pending → Rejected → Verified persisted; verified search and pagination passed`);

      await page.goto(`${base}/admin/jobs`);
      await page.getByText('1–15 of 300', { exact: true }).waitFor();
      await inspect('jobs');
      await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('draft');
      await page.getByText('0 results', { exact: true }).waitFor();
      await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('active');
      await page.getByText('1–15 of 300', { exact: true }).waitFor();
      report.interactions.push(`${name}: job status filters passed`);

      await page.goto(`${base}/admin/accounts`);
      await page.getByRole('heading', { name: /Registered accounts/ }).waitFor();
      await inspect('accounts');
      await page.getByRole('combobox', { name: 'Role', exact: true }).selectOption('admin');
      await page.getByText('1–1 of 1', { exact: true }).waitFor();
      report.interactions.push(`${name}: account role filter passed`);

      await page.goto(`${base}/admin/audit-logs`);
      await page.getByText('1–3 of 3', { exact: true }).waitFor();
      await inspect('audit-logs');
      await page.getByRole('combobox', { name: 'Action', exact: true }).selectOption('company.verified');
      await page.getByText('1–1 of 1', { exact: true }).waitFor();
      assert.match(await page.locator('tbody').innerText(), /Company Verified/);
      assert.match(await page.locator('tbody').innerText(), /QA Administrator/);
      await page.getByLabel('Search action, actor or record', { exact: true }).fill('QA Company Awaiting Review');
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await page.getByText('1–1 of 1', { exact: true }).waitFor();
      report.interactions.push(`${name}: real verification/rejection audit records with actor and searchable metadata passed`);
    } catch (error) {
      report.failures.push({ name, message: error.message });
      await page.screenshot({ path: `.impeccable/review/admin-failure-${name}.png`, fullPage: true });
    } finally { await context.close(); await fixture.close(); }
  }
} finally {
  await browser.close();
  await writeFile('.impeccable/review/admin-browser-report.json', JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report));
if (report.failures.length || report.consoleErrors.length || report.apiFailures.length || report.views.some(view => view.violations.length)) process.exitCode = 1;
