// Run against a built preview (or a ready dev server), with published articles.
// TOWN_BLOG_TEST_URL=http://127.0.0.1:4325 PLAYWRIGHT_CHANNEL=chrome npm run verify:runtime
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.env.TOWN_BLOG_TEST_URL ?? 'http://127.0.0.1:4321';
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', reducedMotion: 'reduce' });
  const page = await context.newPage(), client = await context.newCDPSession(page), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    window.__townDraws = 0;
    const counted = new WeakSet();
    for (const Type of [WebGLRenderingContext, WebGL2RenderingContext]) {
      for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
        const original = Type.prototype[name];
        if (!original || counted.has(original)) continue;
        const wrapped = function (...args) { window.__townDraws++; return original.apply(this, args); };
        counted.add(wrapped); Type.prototype[name] = wrapped;
      }
    }
  });
  await page.goto(base);
  const canvas = page.locator('.brick-town-host canvas');
  await page.waitForFunction(() => document.querySelector('.brick-town-host canvas')?.dataset.loadingMs && document.querySelector('.brick-town-host canvas')?.dataset.effectsReady === 'true', null, { timeout: 60000 });
  const idle = () => page.waitForFunction(() => document.querySelector('.brick-town-host canvas')?.dataset.renderLoop === 'idle', null, { timeout: 20000 });
  const snapshot = () => page.evaluate(() => ({ draws: window.__townDraws, frames: +document.querySelector('.brick-town-host canvas').dataset.frames }));
  // Red-capable even before the new render-loop diagnostic exists.
  await page.waitForTimeout(1500);
  const before = await snapshot(); await page.waitForTimeout(1200); const after = await snapshot();
  assert.equal(after.draws, before.draws, 'static reduced-motion town is still issuing GPU draws');
  await idle();

  const box = await canvas.boundingBox();
  const priorZoom = await canvas.getAttribute('data-zoom');
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .6);
  await page.mouse.wheel(0, 120);
  await page.waitForFunction(previous => document.querySelector('.brick-town-host canvas').dataset.zoom !== previous, priorZoom);
  await idle();
  assert((await snapshot()).draws > after.draws, 'zoom did not redraw the static scene');

  await page.mouse.move(box.x + box.width * .4, box.y + box.height * .6); await page.mouse.down();
  const target = await canvas.getAttribute('data-camera-x');
  await page.mouse.move(box.x + box.width * .4 + 65, box.y + box.height * .6 + 22, { steps: 8 }); await page.mouse.up();
  await page.waitForFunction(previous => document.querySelector('.brick-town-host canvas').dataset.cameraX !== previous, target); await idle();

  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    await page.getByLabel('小镇季节', { exact: true }).selectOption(season);
    await page.waitForFunction(value => document.querySelector('.brick-town-host canvas').dataset.season === value, season); await idle();
  }
  await page.getByRole('button', { name: '切换昼夜模式', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.brick-town-host canvas').dataset.colorMode === 'night'); await idle();
  await page.setViewportSize({ width: 1300, height: 900 }); await idle();
  const size = await canvas.evaluate(element => ({ width: element.width, height: element.height, cssWidth: element.clientWidth, cssHeight: element.clientHeight }));
  assert(size.width > 0 && size.height > 0);

  // Timer must wake the static scene at the same weather-slot boundary. Only
  // this test accelerates the long setTimeout; it does not alter product timers.
  await page.evaluate(() => {
    const native = window.setTimeout;
    window.setTimeout = function (callback, delay, ...args) { return native(callback, delay > 60000 ? 1200 : delay, ...args); };
  });
  await page.getByRole('button', { name: '切换昼夜模式', exact: true }).click(); await idle();
  const slotFrames = (await snapshot()).frames;
  await page.evaluate(() => { const now = Date.now; Date.now = () => now() + 900000; });
  await page.waitForFunction(previous => +document.querySelector('.brick-town-host canvas').dataset.frames > previous, slotFrames, { timeout: 10000 });
  await page.reload(); await page.waitForFunction(() => document.querySelector('.brick-town-host canvas')?.dataset.effectsReady === 'true', null, { timeout: 60000 }); await idle();

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => document.querySelector('.brick-town-host canvas').dataset.reducedMotion === 'false');
  const animated = await snapshot(); await page.waitForTimeout(1200);
  assert((await snapshot()).draws > animated.draws + 50, 'normal motion did not resume continuous rendering');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  const hidden = await snapshot(); await page.waitForTimeout(1000);
  assert.equal((await snapshot()).draws, hidden.draws, 'hidden town kept rendering');
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForFunction(previous => window.__townDraws > previous, hidden.draws);

  // Observe browser GC / DOM counts across complete scene mount/disposal cycles.
  await client.send('Performance.enable');
  const heaps = [];
  for (let cycle = 0; cycle < 4; cycle++) {
    await page.getByRole('button', { name: '档案', exact: true }).click();
    assert.equal(await canvas.count(), 0, 'town stayed mounted on archive');
    await client.send('HeapProfiler.collectGarbage');
    const values = Object.fromEntries((await client.send('Performance.getMetrics')).metrics.map(metric => [metric.name, metric.value]));
    heaps.push({ heap: values.JSHeapUsedSize, nodes: values.Nodes });
    if (cycle < 3) {
      await page.getByRole('button', { name: '小镇', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.brick-town-host canvas')?.dataset.effectsReady === 'true', null, { timeout: 60000 });
    }
  }
  assert(heaps.at(-1).heap - heaps[0].heap < 8 * 1024 * 1024, 'retained heap grew by more than 8 MiB across scene disposal');
  assert(heaps.at(-1).nodes - heaps[0].nodes < 100, 'detached DOM nodes accumulated after scene disposal');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ message: 'PASS: static idle has zero draws; zoom/pan/resize/theme/seasons/weather wake; normal motion resumes; background sleeps; scene disposal heap/DOM stable', retained: heaps.map(item => ({ heapMiB: +(item.heap / 1024 / 1024).toFixed(1), nodes: item.nodes })) }, null, 2));
  await context.close();
} finally { await browser.close(); }
