/**
 * Browser walkthrough of the whole flow: sign in, create an event, add guests,
 * send, RSVP, ticket page, door check-in, phone layout.
 * Needs a running dev server on a fresh database (npm run dev) and Playwright.
 * Usage: node tests/e2e/walkthrough.cjs   (screenshots go to .e2e-output/)
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const P = path.resolve(__dirname, '../../node_modules') + '/';
const jsQR = require(P + 'jsqr');
const { PNG } = require(P + 'pngjs');
const B = process.env.BASE_URL || 'http://localhost:5173';
const PASSWORD = process.env.ADMIN_PASSWORD || 'local-dev-password';
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, '.e2e-output'); fs.mkdirSync(OUT, { recursive: true });
const out = (f) => (f === 'guests.csv' ? path.join(__dirname, f) : path.join(OUT, f));
const log = (...a) => console.log(...a);
/** A plain portrait test flyer (dark gradient), so the tests need no real artwork. */
function makeTestFlyer() {
  const width = 1122, height = 1402;
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (width * y + x) << 2, t = (x + y) / (width + height);
    png.data[i] = 25 + 150 * t; png.data[i + 1] = 22 + 50 * t; png.data[i + 2] = 18; png.data[i + 3] = 255;
  }
  const file = out('test-flyer.png');
  fs.writeFileSync(file, PNG.sync.write(png));
  return file;
}
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(B, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
  await page.screenshot({ path: out('01-login.png') });
  await page.fill('input[type=password]', 'wrong');
  await page.click('button:has-text("Sign in")');
  await page.waitForSelector('text=That password is not correct.');
  await page.fill('input[type=password]', PASSWORD);
  await page.click('button:has-text("Sign in")');
  await page.waitForSelector('text=Create your first event');
  await page.fill('input[placeholder="e.g. Annual Gala Night"]', 'Annual Gala Night');
  await page.click('button:has-text("Create event")');
  await page.waitForSelector('text=Add a guest manually');
  log('event created');

  // Flyer
  await page.setInputFiles('input[type=file][accept="image/*"]', makeTestFlyer());
  await page.waitForSelector('text=Flyer saved.', { timeout: 30000 });
  log('flyer uploaded');

  // Manual guest, Ghana code, local number with leading 0
  await page.selectOption('select[aria-label="Country code"]', { label: '+233 · Ghana' });
  await page.fill('input[placeholder="e.g. Amara Okafor"]', 'Ama Boateng');
  await page.fill('input[placeholder="803 555 0147"]', '024 555 0123');
  await page.click('button:has-text("Add guest")');
  await page.waitForSelector('text=Ama Boateng was added.');
  // duplicate
  await page.fill('input[placeholder="e.g. Amara Okafor"]', 'Ama Again');
  await page.fill('input[placeholder="803 555 0147"]', '+233245550123');
  await page.click('button:has-text("Add guest")');
  await page.waitForSelector('text=already on the list');
  log('manual add + duplicate check ok');

  // Back to Nigeria for spreadsheet import default
  await page.selectOption('select[aria-label="Country code"]', { label: '+234 · Nigeria' });
  await page.waitForTimeout(800);
  await page.setInputFiles('input[type=file][accept=".xlsx,.xls,.csv"]', out('guests.csv'));
  await page.waitForSelector('text=3 guests imported');
  log('import notice:', await page.locator('[role=status]').first().innerText());

  await page.waitForTimeout(1200);
  await page.screenshot({ path: out('02-dashboard.png'), fullPage: true });

  // Send to the first guest (Ama). Capture WhatsApp popup + download.
  await page.locator('tr:has-text("Ama Boateng")').click();
  const [popup, download] = await Promise.all([
    page.waitForEvent('popup'),
    page.waitForEvent('download'),
    page.click('button:has-text("Open WhatsApp invite")'),
  ]);
  const waUrl = popup.url();
  log('whatsapp url starts:', decodeURIComponent(waUrl).slice(0, 140));
  await popup.close();
  const pngPath = out('invite-ama.png');
  await download.saveAs(pngPath);
  await page.waitForSelector('tr:has-text("Ama Boateng") >> text=Sent');
  const selectedRow = await page.locator('tr.bg-orange-50\\/70').innerText();
  log('next selected guest:', selectedRow.split('\n')[0]);

  // Decode the QR in the exported PNG
  const png = PNG.sync.read(fs.readFileSync(pngPath));
  const qr = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  log('QR in exported invite:', qr && qr.data);
  const token = qr.data.split('/t/')[1];

  // Long name export
  await page.locator('tr:has-text("Maximilian")').click();
  await page.waitForTimeout(500);
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Download PNG")')]);
  await dl2.saveAs(out('invite-longname.png'));

  // RSVP as a guest in a separate browser context
  const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const g = await guestCtx.newPage();
  await g.goto(`${B}/rsvp/${token}?r=yes`, { waitUntil: 'networkidle' });
  await g.screenshot({ path: out('03-rsvp-preselected.png') });
  await g.click('button:has-text("Confirm")');
  await g.waitForSelector('text=Thank you, your response is saved');
  await g.screenshot({ path: out('04-rsvp-done.png') });
  await g.goto(`${B}/rsvp/${token}?r=no`);
  await g.waitForSelector('text=You have already responded');
  log('rsvp locked after first answer');
  await g.goto(`${B}/t/${token}`);
  await g.screenshot({ path: out('05-ticket.png'), fullPage: true });
  await g.goto(`${B}/rsvp/notarealtoken123`);
  log('bad token page:', await g.locator('h1').innerText());

  // Door staff
  const pin = (await page.locator('p.font-mono.text-2xl').innerText()).trim();
  const staffCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const s = await staffCtx.newPage();
  await s.goto(`${B}/checkin`, { waitUntil: 'networkidle' });
  await s.screenshot({ path: out('06-checkin-pin.png') });
  await s.fill('input[aria-label="Event PIN"]', '000000');
  await s.click('button:has-text("Start scanning")');
  await s.waitForSelector('text=That PIN does not match');
  await s.fill('input[aria-label="Event PIN"]', pin);
  await s.click('button:has-text("Start scanning")');
  await s.waitForSelector('text=Tap to start the camera');
  // Simulate a camera scan by posting the decoded QR content
  const scan = await s.evaluate(async (code) => (await fetch('/api/checkin/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) })).json(), qr.data);
  log('scan result:', scan.result, scan.guest && scan.guest.name);
  await s.fill('input[aria-label="Search guests"]', 'chidi');
  await s.click('button:has-text("Check in")');
  await s.waitForSelector('text=✓ Welcome');
  await s.screenshot({ path: out('07-checkin-done.png'), fullPage: true });
  const staffPeek = await s.evaluate(async () => (await fetch('/api/events')).status);
  log('staff trying organiser API ->', staffPeek);

  // Dashboard shows live data after reload (persistence)
  await page.reload();
  await page.waitForSelector('tr:has-text("Ama Boateng")');
  const amaRow = await page.locator('tr:has-text("Ama Boateng")').innerText();
  log('Ama row after reload:', amaRow.replace(/\s+/g, ' '));
  await page.selectOption('select[aria-label="Filter guests"]', 'checked_in');
  log('checked-in filter rows:', await page.locator('tbody tr').count());
  await page.selectOption('select[aria-label="Filter guests"]', 'all');

  // Mobile dashboard
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, storageState: await ctx.storageState() });
  const mp = await m.newPage();
  await mp.goto(B);
  await mp.waitForSelector('tr:has-text("Ama Boateng")');
  await mp.waitForTimeout(800);
  const overflow = await mp.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  log('mobile scrollWidth vs viewport:', overflow);
  await mp.screenshot({ path: out('08-mobile-top.png') });
  await mp.screenshot({ path: out('09-mobile-full.png'), fullPage: true });

  log('page errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
