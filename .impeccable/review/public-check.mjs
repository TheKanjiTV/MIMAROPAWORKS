import {chromium} from 'file:///C:/Users/kenji/AppData/Local/Temp/innohack-ui-qa/node_modules/playwright/index.mjs';
import AxeBuilder from 'file:///C:/Users/kenji/AppData/Local/Temp/innohack-ui-qa/node_modules/@axe-core/playwright/dist/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext();
await context.route('https://**',r=>r.abort());
await context.route('**/api/auth/session',r=>r.fulfill({json:{user:null,csrf:'test-csrf'}}));
const page=await context.newPage();const results=[];
for (const [size,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
 await page.setViewportSize({width,height});
 for(const path of ['/','/login']){
  await page.goto('http://127.0.0.1:5173'+path,{waitUntil:'domcontentloaded'});await page.waitForLoadState('networkidle');await page.evaluate(()=>document.fonts.ready);
  const data=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  results.push({size,path,...data,violations:a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
  await page.screenshot({path:`.impeccable/review/public-${path==='/'?'landing':'login'}-${size}.png`,fullPage:true});
 }
}
await writeFile('.impeccable/review/public-report.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));await browser.close();
