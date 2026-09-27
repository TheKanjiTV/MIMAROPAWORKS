import { chromium } from 'file:///C:/Users/kenji/AppData/Local/Temp/innohack-ui-qa/node_modules/playwright/index.mjs';
import AxeBuilder from 'file:///C:/Users/kenji/AppData/Local/Temp/innohack-ui-qa/node_modules/@axe-core/playwright/dist/index.mjs';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { startQa, attachQa } from './integrated-fixture.mjs';
const fixture = await startQa(), browser = await chromium.launch({ channel: 'msedge', headless: true }), results = [];
try {
  const context = await browser.newContext();
  await attachQa(context, fixture, 'seeker');
  const page = await context.newPage();
  for (const [label, width, height] of [['desktop', 1920, 1080], ['small-mobile', 320, 740]]) {
    await page.setViewportSize({ width, height });
    await page.goto('http://127.0.0.1:5173/profile?edit=1', { waitUntil: 'domcontentloaded' });
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    assert.equal(await page.getByLabel('Education Level').locator('option[value="Associate Degree"]').count(), 1);
    await page.getByText('Experience and career interests', { exact: true }).click();
    await page.getByLabel('Most recent role').fill('Support Assistant');
    const violations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }));
    const bounds = await dialog.evaluate((d) => ({ width: d.getBoundingClientRect().width, scrollWidth: d.scrollWidth, clientWidth: d.clientWidth, pageWidth: document.documentElement.scrollWidth }));
    assert.equal(bounds.pageWidth, width); assert.equal(bounds.scrollWidth, bounds.clientWidth); assert.equal(violations.length, 0);
    await page.getByRole('button', { name: 'Save Changes', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `.impeccable/review/profile-final-${label}.png` });
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    results.push({ label, bounds, violations, associateOption: true, experienceFields: true, escape: true });
  }
  await context.close();
} finally { await browser.close(); await fixture.close(); }
await writeFile('.impeccable/review/profile-final-results.json', JSON.stringify(results, null, 2));
console.log(results);
