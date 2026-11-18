// Requires at least one published article with a matching search term.
// SEARCH_TEST_QUERY=Obsidian PLAYWRIGHT_CHANNEL=chrome npm run verify:search-ime
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.TOWN_BLOG_TEST_URL ?? 'http://127.0.0.1:4321';
const query = process.env.SEARCH_TEST_QUERY ?? 'Obsidian';
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${base}/posts/`);
    await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
    if (width < 720) await page.getByRole('button', { name: '打开搜索' }).click();
    const input = page.getByRole('textbox', { name: '搜索文章' });
    await input.fill(query);
    const firstResult = page.locator('.search-result').first();
    await firstResult.waitFor({ state: 'visible' });
    const target = new URL(await firstResult.getAttribute('href'), base).pathname;
    const startingPath = new URL(page.url()).pathname;
    await input.evaluate(element => {
      element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: 'o' }));
      element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown', isComposing: true }));
      element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', isComposing: true }));
    });
    assert.equal(new URL(page.url()).pathname, startingPath, 'IME candidate Enter opened the highlighted article');
    assert.equal(await firstResult.getAttribute('class'), 'search-result is-highlighted', 'candidate arrows changed the selected result');
    await input.evaluate(element => {
      element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'Obsidian' }));
      // Safari can deliver an unmarked Enter after compositionend.
      element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
    });
    assert.equal(new URL(page.url()).pathname, startingPath, 'post-composition Enter opened the highlighted article');
    await page.waitForTimeout(300);
    await input.evaluate(element => {
      const event = new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' });
      Object.defineProperty(event, 'keyCode', { value: 229 });
      element.dispatchEvent(event);
    });
    assert.equal(new URL(page.url()).pathname, startingPath, 'IME keyCode 229 opened the highlighted article');
    await input.press('Enter');
    await page.waitForURL(url => url.pathname === target);
    await context.close();
  }
  console.log('PASS: desktop and mobile IME candidate / Safari trailing Enter stay in search; deliberate Enter opens the article.');
} finally { await browser.close(); }
