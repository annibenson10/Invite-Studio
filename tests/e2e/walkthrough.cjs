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
  const dialog = () => page.locator('[role=dialog]');

  // Sign in
  await page.goto(B, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
  await page.screenshot({ path: out('01-login.png') });
  await page.fill('input[type=password]', 'wrong');
  await page.click('button:has-text("Sign in")');
  await page.waitForSelector('text=That password is not correct.');
  await page.fill('input[type=password]', PASSWORD);
  await page.click('button:has-text("Sign in")');

  // First event
  await page.waitForSelector('text=Create your first event');
  await page.fill('input[placeholder="e.g. Annual Gala Night"]', 'Annual Gala Night');
  await page.click('button:has-text("Create event")');
  await page.waitForSelector('text=No guests yet');
  log('event created');

  // Flyer
  await page.setInputFiles('input[aria-label="Flyer image"]', makeTestFlyer());
  await page.waitForSelector('text=Flyer saved', { timeout: 30000 });
  log('flyer uploaded');

  // One guest by hand: Ghana code, local number with a leading 0
  await page.click('button:has-text("Add guests")');
  await dialog().locator('select[aria-label="Country code"]').selectOption({ label: '+233 Ghana' });
  await dialog().locator('input[placeholder="e.g. Amara Okafor"]').fill('Ama Boateng');
  await dialog().locator('input[placeholder="803 555 0147"]').fill('024 555 0123');
  await dialog().locator('button[type=submit]').click();
  await page.waitForSelector('text=Ama Boateng added');
  // The same number again is refused
  await dialog().locator('input[placeholder="e.g. Amara Okafor"]').fill('Ama Again');
  await dialog().locator('input[placeholder="803 555 0147"]').fill('+233245550123');
  await dialog().locator('button[type=submit]').click();
  await page.waitForSelector('text=already on the list');
  log('manual add + duplicate check ok');

  // Spreadsheet: numbers without a code use Nigeria
  await dialog().locator('select[aria-label="Country code"]').selectOption({ label: '+234 Nigeria' });
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
  await page.setInputFiles('input[aria-label="Guest list file"]', out('guests.csv'));
  await page.waitForSelector('text=3 guests imported');
  log('spreadsheet imported');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: out('02-dashboard.png'), fullPage: true });

  // Send to Ama: WhatsApp opens and her flyer downloads
  const [popup, download] = await Promise.all([
    page.waitForEvent('popup'),
    page.waitForEvent('download'),
    page.click('button[aria-label="Send invite to Ama Boateng"]'),
  ]);
  log('whatsapp url starts:', decodeURIComponent(popup.url()).slice(0, 110));
  await popup.close();
  const pngPath = out('invite-ama.png');
  await download.saveAs(pngPath);
  await page.waitForSelector('button[aria-label="Resend invite to Ama Boateng"]');

  // The QR code in the downloaded flyer must lead to Ama's ticket
  const png = PNG.sync.read(fs.readFileSync(pngPath));
  const qr = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  log('QR in exported invite:', qr && qr.data);
  const token = qr.data.split('/t/')[1];

  // Long name: download from the guest's menu
  await page.click('button[aria-label^="More options for Maximilian"]');
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('[role=menuitem]:has-text("Download invite")')]);
  await dl2.saveAs(out('invite-longname.png'));

  // The guest answers Yes with a single tap
  const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const g = await guestCtx.newPage();
  await g.goto(`${B}/rsvp/${token}?r=yes`, { waitUntil: 'networkidle' });
  await g.screenshot({ path: out('03-rsvp.png') });
  await g.click('button:has-text("Yes, I’ll be there")');
  await g.waitForSelector('text=See you there');
  await g.screenshot({ path: out('04-rsvp-done.png') });
  await g.goto(`${B}/rsvp/${token}?r=no`, { waitUntil: 'networkidle' });
  await g.waitForSelector('text=You’ve already responded');
  log('rsvp: one tap, locked after first answer');
  await g.goto(`${B}/t/${token}`);
  await g.screenshot({ path: out('05-ticket.png'), fullPage: true });
  await g.goto(`${B}/rsvp/notarealtoken123`);
  log('bad token page:', await g.locator('h1').innerText());

  // Door staff
  await page.click('aside button:has-text("Door check-in")');
  const pin = (await page.locator('p.font-mono').first().innerText()).trim();
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
  const scan = await s.evaluate(async (code) => (await fetch('/api/checkin/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) })).json(), qr.data);
  log('scan result:', scan.result, scan.guest && scan.guest.name);
  await s.fill('input[aria-label="Search guests"]', 'chidi');
  await s.click('button:has-text("Check in")');
  await s.waitForSelector('text=✓ Welcome');
  await s.screenshot({ path: out('07-checkin-done.png'), fullPage: true });
  log('staff trying organiser API ->', await s.evaluate(async () => (await fetch('/api/events')).status));

  // Dashboard keeps everything after a reload
  await page.reload();
  await page.waitForSelector('text=Ama Boateng');
  const amaRow = await page.locator('li:has-text("Ama Boateng")').innerText();
  log('Ama row after reload:', amaRow.replace(/\s+/g, ' '));
  await page.click('[role=tab]:has-text("Checked in")');
  log('checked-in filter rows:', await page.locator('main ul > li').count());

  // Phone layout
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, storageState: await ctx.storageState() });
  const mp = await m.newPage();
  await mp.goto(B, { waitUntil: 'networkidle' });
  await mp.waitForSelector('text=Ama Boateng');
  await mp.waitForTimeout(800);
  log('mobile scrollWidth vs viewport:', await mp.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]));
  await mp.screenshot({ path: out('08-mobile.png') });

  log('page errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
