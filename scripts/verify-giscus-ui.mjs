// Start the blog or its build preview first. Override the URL/browser if needed:
// For an enabled configuration, append --enabled.
// TOWN_BLOG_TEST_URL=http://127.0.0.1:4325 PLAYWRIGHT_CHANNEL=chrome npm run verify:giscus-ui
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.TOWN_BLOG_TEST_URL ?? 'http://127.0.0.1:4321';
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [], requests = [], componentRequests = [];
  let failFirst = true;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', request => { if (/\/ArticleComments[./-]/.test(new URL(request.url()).pathname)) componentRequests.push(request.url()); });
  // Exercise the real blog component against the documented iframe protocol,
  // without posting comments or depending on GitHub availability.
  await page.route('https://giscus.app/**', async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.endsWith('/widget')) { await route.abort(); return; }
    requests.push(url.searchParams.get('term'));
    const error = failFirst;
    failFirst = false;
    await route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><body>评论协议验证<script>
      window.addEventListener('message', event => {
        if (event.source === window.parent && event.data?.giscus?.setConfig?.theme) document.body.dataset.theme = event.data.giscus.setConfig.theme;
      });
      setTimeout(() => window.parent.postMessage({giscus: ${error ? "{error:'Service unavailable'}" : '{resizeHeight:432}'}}, ${JSON.stringify(new URL(base).origin)}), 50);
    </script></body></html>` });
  });
  await page.goto(`${base}/posts/`);
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
  assert(await page.locator('.archive-row').count() >= 2, 'UI verification needs two published articles');
  for (const selector of ['.archive-shell-heading', '.archive-heading', '.archive-list', '.archive-row']) {
    assert(await page.locator(selector).evaluateAll(elements => elements.every(element => ['borderTopWidth', 'borderBottomWidth'].every(property => getComputedStyle(element)[property] === '0px'))), 'archive retained a decorative divider');
  }
  await page.locator('.archive-row').first().click();
  if (!process.argv.includes('--enabled')) {
    await page.locator('.article-body').waitFor();
    assert.equal(await page.locator('#article-comments').count(), 0);
    assert.equal(await page.locator('.article-rule').count(), 0);
    await page.locator('.main-scroll').evaluate(element => element.scrollTo({ top: element.scrollHeight, behavior: 'instant' }));
    await page.getByRole('button', { name: '切换昼夜模式', exact: true }).click();
    assert.equal(await page.locator('#article-comments').count(), 0);
    assert.equal(requests.length, 0, 'disabled comments requested Giscus');
    assert.equal(componentRequests.length, 0, 'disabled comments downloaded the comment component');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('#article-comments').count(), 0);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    console.log('PASS: comments are disabled by default, no Giscus requests, no article divider, mobile layout fits.');
  } else {
    await page.locator('#article-comments').waitFor({ state: 'attached' });
    assert.equal(await page.locator('.article-rule').count(), 0);
    const firstId = decodeURIComponent(new URL(page.url()).pathname.split('/').filter(Boolean).at(-1));
    const longArticle = await page.evaluate(() => document.querySelector('#article-comments').getBoundingClientRect().top > innerHeight + 400);
    if (longArticle) assert.equal(requests.length, 0, 'comments loaded before reaching the article footer');
    await page.locator('#article-comments').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: '重新加载', exact: true }).waitFor();
    assert.deepEqual(requests, [firstId]);
    await page.getByRole('button', { name: '重新加载', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.article-comments-widget')?.getAttribute('aria-busy') === 'false' && getComputedStyle(document.querySelector('.giscus-frame')).display !== 'none');
    assert.deepEqual(requests, [firstId, firstId], 'retry must actually load another iframe');
    for (const selector of ['.article-comments', '.series-neighbor-grid button']) {
      assert(await page.locator(selector).evaluateAll(elements => elements.every(element => ['borderTopWidth', 'borderBottomWidth'].every(property => getComputedStyle(element)[property] === '0px'))), 'article footer retained a separator line');
    }
    const frameElement = page.locator('.giscus-frame');
    let url = new URL(await frameElement.getAttribute('src'));
    assert.equal(url.searchParams.get('term'), firstId);
    assert.equal(url.searchParams.get('strict'), '1');
    assert.match(url.searchParams.get('repo'), /^[^/]+\/[^/]+$/);
    assert((await page.locator('.reading-progress').getAttribute('aria-label')).includes('100%'), 'comments lowered the completed reading progress');
    const frame = await (await frameElement.elementHandle()).contentFrame();
    await page.getByRole('button', { name: '切换昼夜模式', exact: true }).click();
    await frame.waitForFunction(() => document.body.dataset.theme === 'transparent_dark');
    assert.equal(requests.length, 2, 'theme changes reloaded the comment thread');
    assert.equal(await frameElement.evaluate((element) => getComputedStyle(element).colorScheme), 'light', 'iframe scheme would turn the transparent dark theme white');
    for (const selector of ['.article-comments', '.series-neighbor-grid button']) {
      assert(await page.locator(selector).evaluateAll(elements => elements.every(element => ['borderTopWidth', 'borderBottomWidth'].every(property => getComputedStyle(element)[property] === '0px'))), 'dark article footer retained a separator line');
    }
    const height = await frameElement.evaluate((element) => element.style.height);
    await page.evaluate(() => window.postMessage({ giscus: { resizeHeight: 99999, error: 'forged' } }, '*'));
    assert.equal(await frameElement.evaluate((element) => element.style.height), height, 'untrusted messages changed the widget');
    await page.getByRole('button', { name: '档案', exact: true }).click();
    assert.equal(await page.locator('.giscus-frame').count(), 0);
    for (const selector of ['.archive-shell-heading', '.archive-heading', '.archive-list', '.archive-row']) {
      assert(await page.locator(selector).evaluateAll(elements => elements.every(element => ['borderTopWidth', 'borderBottomWidth'].every(property => getComputedStyle(element)[property] === '0px'))), 'dark archive retained a decorative divider');
    }
    await page.locator('.archive-row').nth(1).click();
    const secondId = decodeURIComponent(new URL(page.url()).pathname.split('/').filter(Boolean).at(-1));
    assert.notEqual(firstId, secondId);
    await page.locator('#article-comments').scrollIntoViewIfNeeded();
    await page.waitForSelector('.giscus-frame', { state: 'attached' });
    url = new URL(await page.locator('.giscus-frame').getAttribute('src'));
    assert.equal(url.searchParams.get('term'), secondId, 'articles reused the wrong discussion');
    // Simulate the OAuth callback only in this isolated/mocked browser context.
    const callback = new URL(page.url());
    callback.searchParams.set('giscus', 'synthetic-session'); callback.hash = 'article-comments';
    await page.goto(callback.href);
    await page.waitForFunction(() => !new URL(location.href).searchParams.has('giscus'));
    await page.waitForSelector('.giscus-frame', { state: 'attached' });
    url = new URL(await page.locator('.giscus-frame').getAttribute('src'));
    assert.equal(url.searchParams.get('session'), 'synthetic-session');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('giscus-session'))), 'synthetic-session');
    assert(await page.evaluate(() => Boolean(history.state?.townNavigation?.key)), 'sign-in discarded blog history state');
    const signedInFrame = await (await page.locator('.giscus-frame').elementHandle()).contentFrame();
    await signedInFrame.evaluate(() => window.parent.postMessage({ giscus: { signOut: true } }, new URL(document.referrer).origin));
    await page.waitForFunction(() => localStorage.getItem('giscus-session') === null);
    await page.waitForFunction(() => { const frame = document.querySelector('.giscus-frame'); return frame && new URL(frame.src).searchParams.get('session') === ''; });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile comments overflow horizontally');
    assert.deepEqual(errors, []);
    console.log('PASS: lazy comments, error/retry, strict per-article mapping, theme updates, message validation, OAuth callback/history, mobile layout, and completed reading progress.');
  }
} finally { await browser.close(); }
