import { chromium } from 'file:///C:/Users/kenji/AppData/Local/Temp/innohack-ui-qa/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { startQa, attachQa } from './integrated-fixture.mjs';
import { buildDemoEmployers } from '../../server/seed-demo-employers.mjs';
const fixture = await startQa();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
await attachQa(context, fixture, 'seeker');
const page = await context.newPage(), checks = [];
const pass = async (name) => { checks.push(name); console.log('PASS', name); await writeFile('.impeccable/review/career-functional-results.json', JSON.stringify({ checks, count: checks.length }, null, 2)); };
const goto = async (path) => { await page.goto('http://127.0.0.1:5173' + path, { waitUntil: 'domcontentloaded' }); await page.getByRole('heading', { level: 1 }).waitFor(); };
const save = async (name, endpoint) => {
  const response = page.waitForResponse((r) => r.url().includes(endpoint) && r.request().method() === 'PUT');
  await page.getByRole('button', { name, exact: true }).click();
  assert.equal((await response).status(), 200);
  await page.getByText('Saved to your account.', { exact: true }).waitFor();
};
try {
  await goto('/career/readiness');
  await page.getByRole('radio', { name: 'Confident', exact: true }).nth(0).check();
  await page.getByRole('radio', { name: 'Working on it', exact: true }).nth(1).check();
  await save('Save reflection', '/career/tools/readiness');
  await page.reload();
  await page.getByRole('radio', { name: 'Confident', exact: true }).nth(0).waitFor();
  assert.equal(await page.getByRole('radio', { name: 'Confident', exact: true }).nth(0).isChecked(), true);
  assert.equal(await page.getByRole('radio', { name: 'Working on it', exact: true }).nth(1).isChecked(), true);
  pass('Readiness answers and feedback survive reload');

  await goto('/career/interview');
  const answer = 'I helped organize a school project with a team of four classmates. I prepared our schedule, asked each person about their tasks, and reviewed progress every afternoon. As a result we completed the work two days early and learned how to communicate more clearly.';
  await page.locator('.ct-field textarea').fill(answer);
  await save('Save answers & review', '/career/tools/interview');
  await page.reload(); await page.locator('.ct-field textarea').waitFor();
  assert.equal(await page.locator('.ct-field textarea').inputValue(), answer);
  await page.getByRole('button', { name: 'Next question', exact: true }).click();
  assert.equal(await page.locator('.ct-field textarea').inputValue(), '');
  pass('Interview saves answer, returns feedback, and changes question');

  await goto('/career/resume-optimizer');
  await page.getByLabel('Target role', { exact: true }).fill('Administrative Assistant');
  await page.getByRole('textbox', { name: /Professional summary/ }).fill('Customer service professional with experience organizing records and supporting customers.');
  await page.getByLabel('Example 1', { exact: true }).fill('Organized school project records and reviewed the team schedule to meet our deadline.');
  await save('Save resume draft', '/career/tools/resume');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download text draft' }).click();
  assert.equal((await downloadPromise).suggestedFilename(), 'mimaropa-resume-draft.txt');
  await page.reload(); await page.getByLabel('Target role', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Target role', { exact: true }).inputValue(), 'Administrative Assistant');
  pass('Resume draft saves, reloads, and downloads');

  await goto('/career/coach');
  await page.getByLabel('Your current goal').selectOption('change-role');
  await page.getByLabel('Hours available each week').fill('4');
  await save('Create my plan', '/career/tools/coach');
  await page.getByRole('checkbox').first().check();
  await save('Save plan progress', '/career/tools/coach');
  await page.reload(); await page.getByRole('checkbox').first().waitFor();
  assert.equal(await page.getByRole('checkbox').first().isChecked(), true);
  pass('Coach creates plan and persists completed step');

  await goto('/career/training/excel');
  await page.getByRole('checkbox').first().check();
  await page.getByRole('textbox').fill('Created a sample monthly expenses worksheet and checked totals.');
  await save('Save progress', '/career/tools/training');
  await page.reload(); await page.getByRole('checkbox').first().waitFor();
  assert.equal(await page.getByRole('checkbox').first().isChecked(), true);
  assert.match(await page.getByRole('textbox').inputValue(), /monthly expenses/);
  pass('Training checklist and notes survive reload');

  await goto('/profile?edit=1');
  await page.getByRole('dialog').waitFor();
  await page.getByLabel('Education Level', { exact: true }).selectOption('Associate Degree');
  await page.getByLabel('About Me', { exact: true }).fill('Updated profile from mobile browser verification.');
  await page.getByLabel('Skills', { exact: true }).fill('Microsoft Excel');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByText('Experience and career interests', { exact: true }).click();
  await page.getByLabel('Most recent role', { exact: true }).fill('Customer Service Assistant');
  await page.getByLabel('Years of experience', { exact: true }).fill('2.5');
  await page.getByLabel('Experience highlights', { exact: true }).fill('Organized records for a school project.');
  await page.getByLabel('Career interests', { exact: true }).fill('Customer support\nAdministration');
  const profileResponse = page.waitForResponse((r) => r.url().includes('/professional-profile') && r.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  const savedProfile = await profileResponse;
  assert.equal(savedProfile.status(), 200);
  const savedBody = await savedProfile.json();
  assert.equal(savedBody.profile.education, 'Associate Degree');
  assert.equal(savedBody.profile.experience_years, 2.5);
  assert.deepEqual(savedBody.profile.career_interests, ['Customer support', 'Administration']);
  assert.equal(Object.hasOwn(savedProfile.request().postDataJSON(), 'resume'), false);
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.reload();
  await page.getByText('Updated profile from mobile browser verification.', { exact: true }).waitFor();
  pass('Mobile profile editor adds skill and saves real profile');

  await goto('/people/' + buildDemoEmployers()[0].id);
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(new URL(page.url()).pathname, '/people');
  pass('Company modal closes with Escape and restores directory route');

  const jobFixture = await startQa();
  const jobContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await attachQa(jobContext, jobFixture, 'seeker');
  const jobPage = await jobContext.newPage();
  try {
    await jobPage.goto('http://127.0.0.1:5173/jobs', { waitUntil: 'domcontentloaded' });
    await jobPage.getByText('300 opportunities', { exact: true }).waitFor();
    assert.equal(await jobPage.locator('.sw-vacancy').count(), 20);
    await jobPage.getByRole('navigation', { name: 'Results pages' }).getByRole('button', { name: 'Next', exact: true }).click();
    await jobPage.getByText('Page 2 of 15', { exact: true }).waitFor();
    assert.equal(new URL(jobPage.url()).searchParams.get('page'), '2');
    await pass('300 jobs paginate in groups of 20 with stable URL navigation');
  } finally { await jobContext.close(); await jobFixture.close(); }

  await writeFile('.impeccable/review/career-functional-results.json', JSON.stringify({ checks, count: checks.length }, null, 2));
} finally { await context.close(); await browser.close(); await fixture.close(); }
