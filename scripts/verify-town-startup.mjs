// Build first. Serves dist/ with gzip to measure cold production loads, not Vite dev.
// PLAYWRIGHT_CHANNEL=chrome npm run verify:startup
// PLAYWRIGHT_CHANNEL=chrome npm run verify:desktop-startup
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright';

const desktop = process.argv.includes('--desktop');
const root = resolve('dist'), cache = new Map();
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const server = createServer(async (request, response) => {
  try {
    let file = resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (file !== root && !file.startsWith(root + sep)) throw new Error('Outside build');
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    let entry = cache.get(file);
    if (!entry) {
      const body = await readFile(file), extension = extname(file);
      const compressed = ['.html', '.css', '.js', '.json', '.svg'].includes(extension);
      entry = { body: compressed ? gzipSync(body) : body, compressed, type: types[extension] ?? 'application/octet-stream' };
      cache.set(file, entry);
    }
    response.writeHead(200, { 'Content-Type': entry.type, 'Content-Length': entry.body.length, 'Cache-Control': 'no-store', ...(entry.compressed ? { 'Content-Encoding': 'gzip' } : {}) });
    response.end(entry.body);
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  const context = await browser.newContext({ viewport: desktop ? { width: 1440, height: 1000 } : { width: 390, height: 844 }, deviceScaleFactor: desktop ? 1.25 : 1, isMobile: !desktop, hasTouch: !desktop, colorScheme: 'light' });
  const page = await context.newPage(), errors = [], requests = [], fontRequests = [], imageErrors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) imageErrors.push(response.url()); });
  page.on('request', request => {
    requests.push(request.url());
    if (/\.(woff2?|ttf|otf)(\?|$)/.test(request.url())) fontRequests.push(Date.now());
  });
  const client = await context.newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.setCacheDisabled', { cacheDisabled: true });
  // Repeatable lab conditions, not a prediction of every handset/network.
  await client.send('Network.emulateNetworkConditions', { offline: false, latency: desktop ? 60 : 80, downloadThroughput: desktop ? 625000 : 200000, uploadThroughput: 100000, connectionType: desktop ? 'wifi' : 'cellular4g' });
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    window.__townStartup = { ready: 0, fontRequest: 0, longTasks: [] };
    new PerformanceObserver(list => window.__townStartup.longTasks.push(...list.getEntries().map(entry => entry.duration))).observe({ type: 'longtask', buffered: true });
    window.addEventListener('town:load-fonts', () => { window.__townStartup.fontRequest ||= performance.now(); });
    new MutationObserver(() => {
      if (!window.__townStartup.ready && document.querySelector('.brick-town-host canvas')?.dataset.loadingMs) window.__townStartup.ready = performance.now();
    }).observe(document, { subtree: true, attributes: true });
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__townStartup.ready > 0, null, { timeout: 60000 });
  const metrics = await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource');
    return { ...window.__townStartup, timeOrigin: performance.timeOrigin, canvas: { ...document.querySelector('.brick-town-host canvas').dataset },
      runtimeStart: resources.find(entry => /\/runtime\.[^/]+\.js$/.test(new URL(entry.name).pathname))?.startTime,
      fontsBeforeReady: resources.filter(entry => /\.(woff2?|ttf|otf)(\?|$)/.test(entry.name) && entry.startTime < window.__townStartup.fontRequest).length,
      bytes: resources.filter(entry => entry.responseEnd <= window.__townStartup.ready).reduce((sum, entry) => sum + entry.encodedBodySize, 0),
      environmentRequests: resources.filter(entry => entry.name.endsWith('/studio.env')).length };
  });
  assert(metrics.runtimeStart < 2000, `town runtime was discovered late: ${metrics.runtimeStart}ms`);
  assert(metrics.fontRequest >= metrics.ready - 100, 'font loading was requested before the town was ready');
  assert(fontRequests.every(start => start >= metrics.timeOrigin + metrics.fontRequest - 20), 'font downloads started before the deferred request');
  assert.equal(metrics.fontsBeforeReady, 0, 'font downloads competed with the base town');
  assert.equal(metrics.environmentRequests, 1, 'environment preload was downloaded again');
  assert.equal(await page.locator('.brick-town-loader').count(), 0, 'loader remained after the town was ready');
  assert(metrics.ready < 12000, `cold startup exceeded the 12s regression budget: ${Math.round(metrics.ready)}ms`);
  // The deferred typography must still be applied, with the original families.
  await page.waitForSelector('style[data-town-fonts]', { state: 'attached', timeout: 30000 });
  assert(await page.locator('style[data-town-fonts]').evaluate(element => element.textContent.includes('ZCOOL QingKe HuangYou') && element.textContent.includes('IBM Plex Sans SC')));
  const sidebarSources = await page.locator('.brand-image source, .profile-panel source').evaluateAll(elements => elements.map(element => new URL(element.srcset, location.href).href));
  assert.equal(sidebarSources.length, 2);
  if (desktop) {
    await page.waitForFunction(() => document.querySelector('.brick-town-host canvas')?.dataset.effectsReady === 'true', null, { timeout: 30000 });
    const resolution = await page.locator('.brick-town-host canvas').evaluate(canvas => ({ width: canvas.width, height: canvas.height, cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight }));
    assert(Math.abs(resolution.width - resolution.cssWidth * 1.25) <= 1 && Math.abs(resolution.height - resolution.cssHeight * 1.25) <= 1, 'desktop rendering resolution was degraded');
    assert.equal(await page.locator('.brick-town-host canvas').getAttribute('data-contact-shadows'), 'on', 'desktop contact shadow pipeline was not initialized');
    await page.waitForFunction(() => [...document.querySelectorAll('.brand-image img, .profile-avatar')].every(image => image.complete && image.naturalWidth > 0));
    assert(sidebarSources.every(url => requests.includes(url)), 'desktop artwork was not loaded');
  } else {
    assert(!requests.some(url => /ssao2RenderingPipeline|desktop-pipeline/.test(url)), 'mobile fetched desktop-only contact shadows');
    assert(sidebarSources.every(url => !requests.includes(url)), 'hidden mobile artwork downloaded during startup');
    await page.getByRole('button', { name: '打开侧边栏', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('.brand-image img, .profile-avatar')].every(image => image.complete && image.naturalWidth > 0));
    assert(sidebarSources.every(url => requests.includes(url)), 'opening the mobile sidebar did not load original artwork');
  }
  assert.equal(metrics.canvas.renderer, 'webgl2');
  assert.deepEqual(errors, []);
  assert.deepEqual(imageErrors, []);
  console.log(JSON.stringify({ message: 'PASS: cold production startup, early runtime, deferred original fonts, single environment fetch, no runtime errors', device: desktop ? 'desktop' : 'mobile', readyMs: Math.round(metrics.ready), sceneBuildMs: Number(metrics.canvas.sceneBuildMs), worldBuildMs: Number(metrics.canvas.worldBuildMs), bytesBeforeReady: metrics.bytes, longTaskMs: Math.round(metrics.longTasks.reduce((sum, duration) => sum + duration, 0)) }, null, 2));
  await context.close();
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
