import { chromium } from 'file:///C:/Users/kenji/AppData/Local/Temp/innohack-ui-qa/node_modules/playwright/index.mjs';
import AxeBuilder from 'file:///C:/Users/kenji/AppData/Local/Temp/innohack-ui-qa/node_modules/@axe-core/playwright/dist/index.mjs';
import { writeFile } from 'node:fs/promises';
import { startQa, attachQa } from './integrated-fixture.mjs';
import { buildDemoEmployers } from '../../server/seed-demo-employers.mjs';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [], failures = [];
try {
  for (const [label, width, height] of [['desktop', 1920, 1080], ['mobile', 390, 844]]) {
    const fixture = await startQa();
    const context = await browser.newContext({ viewport: { width, height } });
    await attachQa(context, fixture, 'seeker');
    const page = await context.newPage();
    page.on('pageerror', (error) => failures.push({ label, pageerror: error.message }));
    try {
      for (const [name, path, dialog] of [
        ['career', '/career'], ['readiness', '/career/readiness'], ['interview', '/career/interview'],
        ['resume-tool', '/career/resume-optimizer'], ['coach', '/career/coach'], ['training', '/career/training'],
        ['training-detail', '/career/training/excel'], ['skills-gap', '/career/skills-gap'], ['suggestions', '/career/suggestions'],
        ['profile-modal', '/profile?edit=1', true], ['company-modal', '/people/' + buildDemoEmployers()[0].id, true],
        ['jobs-300', '/jobs'],
      ]) {
        if (process.env.QA_ONLY && !process.env.QA_ONLY.split(',').includes(name)) continue;
        if (process.env.QA_VIEW && process.env.QA_VIEW !== label) continue;
        await page.goto('http://127.0.0.1:5173' + path, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { level: 1 }).waitFor();
        await page.waitForFunction(() => !document.body.innerText.includes('Loading your saved career workspace') && !document.body.innerText.includes('Comparing your profile with current opportunities') && !document.body.innerText.includes('Opening company details') && !document.querySelector('.sw-skeleton'));
        if (dialog) await page.getByRole('dialog').waitFor();
        await page.evaluate(() => document.fonts.ready);
        const bounds = await page.evaluate(() => {
          const d = document.querySelector('dialog[open]'), r = d?.getBoundingClientRect();
          return { viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, dialog: r ? { width: r.width, height: r.height, left: r.left, top: r.top, padding: getComputedStyle(d).padding, scrollWidth: d.scrollWidth, clientWidth: d.clientWidth } : null };
        });
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        const violations = axe.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => ({ html: n.html.slice(0, 240), summary: n.failureSummary })) }));
        const result = { label, name, bounds, violations };
        report.push(result);
        await writeFile(`.impeccable/review/career-modal-${label}-partial.json`, JSON.stringify(report, null, 2));
        if (bounds.scrollWidth > width || violations.length || (bounds.dialog && bounds.dialog.scrollWidth > bounds.dialog.clientWidth)) failures.push(result);
        await page.screenshot({ path: `.impeccable/review/${name}-${label}.png`, fullPage: !dialog });
        console.log(label, name, 'width', bounds.scrollWidth, 'axe', violations.length, bounds.dialog ? `dialog ${bounds.dialog.width}px / ${bounds.dialog.padding}` : '');
        if (violations.length) console.log(JSON.stringify(violations));
      }
    } finally { await context.close(); await fixture.close(); }
  }
} finally { await browser.close(); }
await writeFile('.impeccable/review/career-modal-results.json', JSON.stringify({ report, failures }, null, 2));
console.log('Failures:', failures.length);
if (failures.length) process.exitCode = 1;
