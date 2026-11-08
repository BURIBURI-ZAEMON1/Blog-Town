// Exact layout compatibility plus a relative CPU budget: repeated content edits
// must not recompute the seed's static land/road/river eligibility field.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(process.env.TOWN_LAYOUT_SOURCE ?? 'src/data/town-layout.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const fresh = () => {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(require, module, module.exports);
  return module.exports.createTownLayout;
};
const createTownLayout = fresh();
const seed = 'layout-cache-regression';
const posts = Array.from({ length: 6 }, (_, i) => ({ id: `post-${i}`, date: `2026-01-0${i + 1}`, ...(i < 2 ? { series: 'shared', seriesIndex: i } : {}) }));
const first = createTownLayout(seed, posts), original = structuredClone(first);
assert.deepEqual(createTownLayout(seed, structuredClone(posts)), original, 'warm cache changed layout');
first.plots[0].x += 100;
first.reservedPlots.pop();
assert.deepEqual(createTownLayout(seed, posts), original, 'returned mutable layouts leaked into prepared lots');

// New articles, dates, series membership and series order remain live; only the
// seed-dependent candidate field may be reused, never a finished article layout.
const edits = [
  [...posts, { id: 'new-post', date: '2026-02-01' }],
  posts.map((post, i) => i === 0 ? { ...post, date: '2025-01-01', seriesIndex: 9 } : post),
  posts.filter(post => post.id !== 'post-3'),
  posts.map(post => post.id === 'post-4' ? { ...post, series: 'shared', seriesIndex: 3 } : post),
];
for (const changed of edits) assert.deepEqual(createTownLayout(seed, changed), fresh()(seed, changed), 'cached field retained stale article membership/order');
assert.deepEqual(createTownLayout('another-seed', posts), fresh()('another-seed', posts), 'seed change reused another town field');
assert.deepEqual(createTownLayout(seed, posts), original, 'switching seeds corrupted original field');

const benchmark = fresh(), start = performance.now();
const cold = benchmark('layout-cache-budget', posts), coldMs = performance.now() - start;
const warmStart = performance.now();
for (let i = 0; i < 16; i++) {
  const current = benchmark('layout-cache-budget', posts);
  assert.deepEqual(current, cold);
  assert.notEqual(current.plots, cold.plots, 'cache returned a finished mutable layout');
}
const warmMs = performance.now() - warmStart;
assert(warmMs < coldMs * 2, `16 warm layouts repeated static candidate work: ${Math.round(warmMs)}ms vs ${Math.round(coldMs)}ms cold`);
console.log(JSON.stringify({ message: 'PASS: identical cold/warm layouts, fresh mutable results, live article/series edits, seed invalidation and bounded warm CPU work', coldMs: Math.round(coldMs), sixteenWarmMs: Math.round(warmMs) }, null, 2));
