import { chromium } from 'file:///C:/Users/kenji/AppData/Local/Temp/innohack-ui-qa/node_modules/playwright/index.mjs';
import AxeBuilder from 'file:///C:/Users/kenji/AppData/Local/Temp/innohack-ui-qa/node_modules/@axe-core/playwright/dist/index.mjs';
import { fixtures, jobs } from './fixtures.mjs';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({channel:'msedge',headless:true});
const context = await browser.newContext();
await fixtures(context);
await context.route('https://**', route => route.abort());
console.log('Browser ready');
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
const routes=['/dashboard','/jobs','/jobs/recommended','/jobs/job-0','/applications','/people','/people/company-0','/messages','/notifications','/profile','/profile/resume','/settings','/career','/career/skills-gap','/career/training'];
const reports=[];
for(const [size,width,height] of [['desktop',1440,1000],['mobile',390,844]]) {
 await page.setViewportSize({width,height});
 for(const path of routes){
  await page.goto('http://127.0.0.1:5173'+path, {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForLoadState('networkidle');
  await page.evaluate(()=>document.fonts.ready);
  const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,h1:document.querySelector('h1')?.textContent,overflow:[...document.querySelectorAll('body *')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&b.right>innerWidth+1&&getComputedStyle(e).position!=='fixed'&&!e.closest('.sw-discovery-tabs')}).slice(0,8).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent?.slice(0,50)}))}));
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  const report={size,path,...layout,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))};
  reports.push(report);console.log(JSON.stringify({size,path,scroll:layout.scroll,violations:report.violations.map(v=>v.id)}));
  await page.screenshot({path:`.impeccable/review/after-${path.slice(1).replaceAll('/','-')}-${size}.png`,fullPage:true});
 }
}
await page.setViewportSize({width:320,height:900});
for(const path of ['/dashboard','/jobs','/people','/profile','/settings']){await page.goto('http://127.0.0.1:5173'+path, {waitUntil:'domcontentloaded',timeout:60000});await page.waitForLoadState('networkidle');reports.push({size:'small',path,...await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}))});}
await page.setViewportSize({width:1024,height:900});
await page.goto('http://127.0.0.1:5173/dashboard');await page.waitForLoadState('networkidle');reports.push({size:'tablet',path:'/dashboard',...await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}))});
await writeFile('.impeccable/review/route-report.json',JSON.stringify({reports,errors},null,2));
await browser.close();
console.log('Browser errors:',errors);

