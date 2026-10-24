import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url), cache = new Map();
function load(path) {
  const absolute = resolve(path);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const module = { exports: {} }; cache.set(absolute, module);
  const output = ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const localRequire = (id) => id.startsWith('.') ? load(resolve(dirname(absolute), id.endsWith('.ts') ? id : `${id}.ts`)) : require(id);
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
}

const { createTownLayout } = load('src/data/town-layout.ts');
const basePosts = [
  { id: 'post-first-service-outsourcing-competition' },
  { id: 'post-obsidian-sync', series: 'Obsidian', seriesIndex: 1 },
  { id: 'post-obsidian-ai-agent-guide', series: 'Obsidian', seriesIndex: 0 },
  { id: 'post-hugo-blog-guide', series: 'Hello, Blog!', seriesIndex: 0 },
];
const signature = (plot) => ({
  ids: plot.seriesPostIds ?? [plot.postId],
  x: plot.x, z: plot.z, width: plot.width, depth: plot.depth,
  roof: plot.roof, walls: plot.walls, accent: plot.accent, style: plot.style,
});
const byPost = (layout) => new Map(layout.plots.flatMap((plot) => (plot.seriesPostIds ?? [plot.postId]).filter(Boolean).map((id) => [id, signature(plot)])));
const before = byPost(createTownLayout('heavens-door-town-v1', basePosts));
const afterNew = byPost(createTownLayout('heavens-door-town-v1', [{ id: 'post-new-article', date: '2026-10-24T00:00:00.000Z' }, ...basePosts]));
for (const [id, original] of before) assert.deepEqual(afterNew.get(id), original, `${id} moved or changed style when a new article was added`);
assert(afterNew.has('post-new-article'), 'new article did not receive a building');
const afterAnotherNew = byPost(createTownLayout('heavens-door-town-v1', [
  { id: 'post-newer-article', date: '2026-10-24T01:00:00.000Z' },
  { id: 'post-new-article', date: '2026-10-24T00:00:00.000Z' },
  ...basePosts,
]));
for (const [id, original] of afterNew) {
  const next = afterAnotherNew.get(id);
  assert.deepEqual({ ...next, ids: undefined }, { ...original, ids: undefined }, `${id} moved when a second newer article was added`);
}

const afterSeriesFloor = byPost(createTownLayout('heavens-door-town-v1', [...basePosts, { id: 'post-obsidian-new-floor', series: 'Obsidian', seriesIndex: 2 }]));
for (const [id, original] of before) {
  const next = afterSeriesFloor.get(id);
  assert.deepEqual({ ...next, ids: undefined }, { ...original, ids: undefined }, `${id} moved or changed style when a floor was added to an existing series`);
}
assert(afterSeriesFloor.get('post-obsidian-new-floor'), 'new series floor did not attach to its existing building');
assert.deepEqual(afterSeriesFloor.get('post-obsidian-new-floor').ids, ['post-obsidian-ai-agent-guide', 'post-obsidian-sync', 'post-obsidian-new-floor']);

console.log('PASS: existing formal-town locations and styles remain stable for new standalone articles and new series floors');
