// Requires a running blog with at least one article in a series.
// TOWN_BLOG_TEST_URL=http://127.0.0.1:4325 PLAYWRIGHT_CHANNEL=chrome npm run verify:mobile-view
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.TOWN_BLOG_TEST_URL ?? 'http://127.0.0.1:4321';
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: 'light' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector('.brick-town-host canvas')?.dataset.loadingMs, null, { timeout: 60000 });
  const canvas = page.locator('.brick-town-host canvas');
  const settle = async () => {
    const frames = await canvas.evaluate(element => Number(element.dataset.frames));
    await page.waitForFunction(previous => Number(document.querySelector('.brick-town-host canvas')?.dataset.frames) >= previous + 16, frames);
  };
  const anchors = () => page.locator('.town-new-post-label').evaluateAll(labels => Object.fromEntries(labels.map((label, index) => {
    const point = label.parentElement.querySelectorAll('.town-new-post-anchor')[index];
    return [label.dataset.postId, { x: +point.getAttribute('cx'), y: +point.getAttribute('cy') }];
  })));
  const client = await context.newCDPSession(page), box = await canvas.boundingBox();
  const x = box.x + 100, y = box.y + 250;
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 8; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + i * 3, y: y - i * 3 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle();
  const before = await anchors();
  assert(Object.keys(before).length, 'verification needs a visible article notice');
  const cameraBefore = await canvas.evaluate(element => ({ x: element.dataset.cameraX, z: element.dataset.cameraZ, zoom: element.dataset.zoom, loading: element.dataset.loadingMs }));
  const failures = [];
  // Model the same-width viewport-height changes accompanying mobile browser chrome.
  for (const [height, scheme] of [[844, 'dark'], [740, 'light'], [844, 'dark']]) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 390, height });
    await settle();
    const current = await anchors();
    for (const [id, point] of Object.entries(before)) {
      if (!current[id] || Math.hypot(current[id].x - point.x, current[id].y - point.y) > 1) failures.push(`notice ${id} moved after ${scheme}/${height}`);
    }
    assert.deepEqual(await canvas.evaluate(element => ({ x: element.dataset.cameraX, z: element.dataset.cameraZ, zoom: element.dataset.zoom, loading: element.dataset.loadingMs })), cameraBefore, 'theme/viewport update reset the camera or remounted the scene');
    assert.equal(await page.locator('.main-scroll').evaluate(element => element.scrollTop), 0);
  }
  // Zoom after a height change must scale the current view, without refitting it.
  await page.setViewportSize({ width: 390, height: 740 });
  await settle();
  const pointsBeforeZoom = await anchors();
  const previousZoom = await canvas.evaluate(element => Number(element.dataset.zoom));
  const touches = distance => [{ x: 195 - distance, y: 300, id: 1 }, { x: 195 + distance, y: 300, id: 2 }];
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches(40) });
  for (let i = 1; i <= 4; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touches(40 + i * 2) });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle();
  const pointsAfterZoom = await anchors(), zoom = await canvas.evaluate(element => Number(element.dataset.zoom));
  assert(zoom > previousZoom, 'pinching after viewport change did not zoom');
  const ids = Object.keys(pointsBeforeZoom).filter(id => pointsAfterZoom[id]);
  if (ids.length >= 2) {
    const distance = (points, [a, b]) => Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y);
    assert(Math.abs(distance(pointsAfterZoom, ids) / distance(pointsBeforeZoom, ids) - zoom / previousZoom) < .02, 'pinching refit the view after a height-only resize');
  }
  await page.goto(`${base}/posts/`);
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
  // Discover an actual series article without depending on personal article names.
  const articles = await page.locator('.archive-row').count();
  let found = false;
  for (let i = 0; i < articles; i++) {
    await page.locator('.archive-row').nth(i).click();
    await page.locator('.article-body').waitFor();
    if (await page.locator('.series-drawer').count()) { found = true; break; }
    await page.goto(`${base}/posts/`);
    await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
  }
  assert(found, 'verification needs at least two articles in one series');
  await page.locator('.main-scroll').evaluate(element => element.scrollTo({ top: 900, behavior: 'instant' }));
  const sticky = await page.evaluate(() => ({ root: document.querySelector('.main-scroll').getBoundingClientRect().top, drawer: document.querySelector('.series-drawer').getBoundingClientRect().top }));
  if (Math.abs(sticky.root - sticky.drawer) > 1) failures.push('mobile series entry did not stick to the scroll root');
  if (!failures.length) {
    await page.locator('.series-drawer-toggle').click();
    assert.equal(await page.locator('.series-drawer-toggle').getAttribute('aria-expanded'), 'true');
    await page.locator('.series-drawer-list button:not(.is-current)').first().click();
    await page.waitForFunction(() => document.querySelector('.main-scroll').scrollTop < 1);
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  console.log('PASS: system theme and height-only viewport changes preserve the panned town; mobile series drawer sticks, expands, and opens the next article at the top.');
} finally { await browser.close(); }
