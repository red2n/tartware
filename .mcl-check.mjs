import { chromium } from 'playwright';
const b = await chromium.launch();
const page = await b.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0,200)));
page.on('response', r => { if (r.url().includes('/v1/') && r.status() >= 400) console.log('[HTTP', r.status()+']', r.url().replace('http://localhost:4200','').slice(0,140)); });
await page.goto('http://localhost:4200/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
(await page.$$('input'))[0].fill('setup.admin');
await page.fill('input[type="password"]', 'TempPass1234');
await (await page.$('button[type="submit"]')).click();
await page.waitForTimeout(10000);
console.log('URL:', page.url());
for (const city of ['Tokyo','Kuwait']) {
  const tid = await page.evaluate((c) => JSON.parse(localStorage.getItem('memberships')||'[]').find(m=>m.tenant_name.includes(c))?.tenant_id, city);
  await page.evaluate((t) => { localStorage.setItem('tenant_id', t); localStorage.removeItem('property_id'); }, tid);
  await page.goto('http://localhost:4200/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  console.log(city, '->', (await page.innerText('body')).replace(/\s+/g,' ').match(/Tartware \/ .{0,70}/)?.[0]);
}
await b.close();
