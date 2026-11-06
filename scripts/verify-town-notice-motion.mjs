// Requires a Playwright browser. To use an installed Chrome instead:
// PLAYWRIGHT_CHANNEL=chrome npm run verify:notice-motion
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from 'playwright';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();
function load(path) {
  const absolute = resolve(path);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const module = { exports: {} };
  cache.set(absolute, module);
  const output = ts.transpileModule(readFileSync(absolute, 'utf8'), {
    fileName: absolute,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const localRequire = (id) => id.startsWith('.')
    ? load(resolve(dirname(absolute), extname(id) ? id : `${id}.ts`)) : require(id);
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
}
const TownPostNotices = load('src/components/TownPostNotices.tsx').default;
const css = readFileSync('src/styles/global.css', 'utf8');
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const render = async (width, anchors, reducedMotion = false) => {
    const html = renderToStaticMarkup(createElement(TownPostNotices, {
      posts: [{ id: 'guide', title: '首次进入的文章' }, { id: 'new', title: '新文章' }],
      newPostIds: ['new'], frame: { width, height: 760, anchors }, reducedMotion, onOpen: () => {},
    }));
    await page.setContent(`<style>${css}</style><div style="position:relative;width:${width}px;height:760px">${html}</div>`);
  };
  const anchors = [{ postId: 'guide', kind: 'guide', x: 350, y: 260 }, { postId: 'new', kind: 'new', x: 750, y: 460 }];
  // Exercise the real component and CSS at multiple animation phases and at
  // updated anchor coordinates. Both notice types must remain on their building.
  for (const offset of [0, 120]) {
    await render(1100, anchors.map((anchor) => ({ ...anchor, x: anchor.x + offset, y: anchor.y - offset })));
    assert.equal(await page.locator('.town-new-post-label-guide').count(), 1);
    const samples = await page.evaluate(() => Array.from(document.querySelectorAll('.town-new-post-pulse')).map((pulse) => {
      const anchor = pulse.parentElement.querySelector('.town-new-post-anchor');
      const animation = pulse.getAnimations()[0];
      animation.pause();
      return [0, 700, 1400, 2200].map((time) => {
        animation.currentTime = time;
        const ring = pulse.getBoundingClientRect(), point = anchor.getBoundingClientRect();
        return { dx: ring.left + ring.width / 2 - point.left - point.width / 2, dy: ring.top + ring.height / 2 - point.top - point.height / 2, width: ring.width };
      });
    }));
    assert.equal(samples.length, 2);
    for (const phases of samples) {
      assert(phases.every(({ dx, dy }) => Math.abs(dx) < .5 && Math.abs(dy) < .5), 'notice pulse drifted away from its building');
      assert(phases.at(-1).width > phases[0].width + 10, 'desktop pulse stopped expanding');
    }
  }
  for (const width of [390, 720]) {
    await page.setViewportSize({ width, height: 844 });
    const mobileAnchors = [{ postId: 'guide', kind: 'guide', x: 160, y: 240 }];
    // A stale/wide canvas during responsive layout must not leak a desktop ring.
    for (const frameWidth of [width, 1100]) {
      await render(frameWidth, mobileAnchors);
      assert.equal(await page.locator('.town-new-post-label-guide').count(), 1, 'mobile guide disappeared');
      assert.equal(await page.locator('.town-new-post-pulse:visible').count(), 0, 'mobile guide retained a pulse ring');
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const media of [false, true]) {
    await page.emulateMedia({ reducedMotion: media ? 'reduce' : 'no-preference' });
    await render(1100, anchors, !media);
    assert(await page.locator('.town-new-post-pulse').evaluateAll((pulses) => pulses.every((pulse) => pulse.getAnimations().length === 0)), 'reduced-motion notices kept animating');
  }
  console.log('PASS: guide/new pulses stay centered through animation and frame updates; mobile hides rings, and reduced motion stops them.');
} finally { await browser.close(); }
