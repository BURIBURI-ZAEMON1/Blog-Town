// Run against a running blog or preview with at least one published article.
// TOWN_BLOG_TEST_URL=http://127.0.0.1:4325 PLAYWRIGHT_CHANNEL=chrome npm run verify:mobile-ui
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.TOWN_BLOG_TEST_URL ?? 'http://127.0.0.1:4321';
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' });
  let page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Inspect the server-rendered page before React starts: no light first paint.
  await page.route('**/*.js*', route => route.abort());
  await page.goto(`${base}/posts/`, { waitUntil: 'domcontentloaded' });
  assert.equal(await page.title().then(title => title.includes('全部文章')), true);
  assert(await page.locator('html').evaluate(element => element.classList.contains('mode-night')), 'initial document ignored system dark mode');
  // A fresh page isolates hydration checks from intentionally aborted modules.
  await page.close();
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/posts/`);
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]') && document.querySelector('.app-shell.mode-night'));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForFunction(() => !document.querySelector('.app-shell.mode-night') && !document.documentElement.classList.contains('mode-night'));
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForFunction(() => document.querySelector('.app-shell.mode-night'));
  await page.getByRole('button', { name: '切换昼夜模式', exact: true }).click();
  assert.equal(await page.locator('.app-shell.mode-night').count(), 0, 'manual toggle failed');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  assert.equal(await page.locator('.app-shell.mode-night').count(), 0, 'system change overrode the manual choice');
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]') && document.querySelector('.app-shell.mode-night'));
  await context.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'light' });
  const town = await mobile.newPage();
  town.on('pageerror', error => errors.push(error.message));
  await town.goto(base);
  await town.waitForFunction(() => document.querySelector('.brick-town-host canvas')?.dataset.loadingMs, null, { timeout: 60000 });
  const canvas = town.locator('.brick-town-host canvas');
  assert.equal(await canvas.evaluate(element => getComputedStyle(element).touchAction), 'none');
  assert.match(await town.locator('.mobile-town-hint').textContent(), /单指任意方向拖动小镇/);
  const client = await mobile.newCDPSession(town);
  const anchor = () => town.locator('.town-new-post-anchor').first().evaluate(element => ({ x: +element.getAttribute('cx'), y: +element.getAttribute('cy') }));
  const box = await canvas.boundingBox();
  const scrollTop = await town.locator('.main-scroll').evaluate(element => element.scrollTop);
  const id = await town.locator('.town-new-post-label').first().getAttribute('data-post-id');
  const offset = () => town.locator(`.town-new-post-label[data-post-id="${id}"]`).evaluate(element => {
    const labels = [...element.parentElement.querySelectorAll('.town-new-post-label')];
    const point = element.parentElement.querySelectorAll('.town-new-post-anchor')[labels.indexOf(element)];
    return { x: parseFloat(element.style.left) - +point.getAttribute('cx'), y: parseFloat(element.style.top) - +point.getAttribute('cy') };
  });
  const initialOffset = await offset();
  const swipe = async (dx, dy) => {
    const x = box.x + box.width * .35, y = box.y + box.height * .55;
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 8; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 8, y: y + dy * i / 8 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  for (const [dx, dy] of [[0, -48], [48, 0], [-24, 24]]) {
    const before = await anchor();
    await swipe(dx, dy);
    await town.waitForFunction(({ x, y }) => {
      const point = document.querySelector('.town-new-post-anchor');
      return point && Math.hypot(+point.getAttribute('cx') - x, +point.getAttribute('cy') - y) > 10;
    }, before);
    assert.equal(await town.locator('.main-scroll').evaluate(element => element.scrollTop), scrollTop, 'map gesture scrolled the page');
    const current = await offset();
    assert(Math.abs(current.x - initialOffset.x) < .01 && Math.abs(current.y - initialOffset.y) < .01, 'panning reassigned the notice lane');
    assert.equal(await town.locator('.town-touch-preview').count(), 0, 'drag accidentally selected a building');
  }
  // Pinch must continue zooming the map rather than the browser viewport.
  const beforePinch = await anchor();
  const cx = box.x + box.width * .5, cy = box.y + box.height * .6;
  const touches = distance => [{ x: cx - distance, y: cy, id: 1 }, { x: cx + distance, y: cy, id: 2 }];
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches(40) });
  for (let i = 1; i <= 6; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touches(40 + i * 4) });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await town.waitForFunction(({ x, y }) => {
    const point = document.querySelector('.town-new-post-anchor');
    return point && Math.hypot(+point.getAttribute('cx') - x, +point.getAttribute('cy') - y) > 5;
  }, beforePinch);
  assert.equal(await town.evaluate(() => visualViewport.scale), 1, 'pinch zoomed the page');
  assert(await town.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile page overflows');
  assert.deepEqual(errors, []);
  await mobile.close();
  console.log('PASS: system theme before hydration and on change, manual override/reset, vertical/horizontal/diagonal touch pan, stable notice lanes, pinch zoom, no page scrolling or accidental selection.');
} finally { await browser.close(); }
