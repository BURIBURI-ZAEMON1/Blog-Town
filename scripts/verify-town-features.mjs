import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { NullEngine, Scene, Vector3 } from '@babylonjs/core';
const require = createRequire(import.meta.url), cache = new Map();
function load(path) {
  const absolute = resolve(path);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const module = { exports: {} }; cache.set(absolute, module);
  const output = ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const localRequire = id => id.startsWith('.') ? load(resolve(dirname(absolute), `${id.replace(/\.ts$/, '')}.ts`)) : require(id);
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
}
const { createTownLayout } = load('src/data/town-layout.ts');
const { inTownOutline } = load('src/data/town-outline.ts');
const { samplePath } = load('src/data/town-spatial.ts');
const rectDistance = (rect, point) => Math.hypot(Math.max(0, Math.abs(rect.x-point.x)-rect.width/2), Math.max(0, Math.abs(rect.z-point.z)-rect.depth/2));
const assertHamletClear = layout => {
  const hamlet = layout.hamlet;
  for (const plot of layout.reservedPlots) {
    assert(rectDistance(plot, hamlet.center) >= hamlet.radius + 1.6, 'article footprint enters the hamlet reservation');
    for (const point of samplePath(hamlet.path, 24)) assert(rectDistance(plot, point) >= .95, 'article footprint enters the rendered hamlet access road');
  }
};
const { friendLinks, siteConfig } = load('src/config/site.ts');
const layoutFriends = friendLinks.length ? friendLinks.slice(0, 9) : Array.from({ length: 9 }, (_, i) => ({ id: `test-friend-${i}` }));
const { buildFeature, buildFriendHut } = load('src/scene/brick-town/features.ts');
const { createSiteStats } = load('src/lib/site-stats.ts');
const posts = Array.from({ length: 120 }, (_, index) => ({ id: `p${index}`, date: '2026-01-01' }));
for (const seed of [siteConfig.townSeed, 'town-blog-framework-v1']) {
  const original = createTownLayout(seed, posts);
  const layout = createTownLayout(seed, posts, layoutFriends);
  assert.equal(layout.plots.length, original.plots.length, 'hamlet lost articles');
  assert(Math.hypot(layout.hamlet.center.x, layout.hamlet.center.z) > 22 && Math.hypot(layout.hamlet.center.x, layout.hamlet.center.z) < 30, 'hamlet must sit beyond the article core');
  assertHamletClear(layout);
  assert.equal(layout.hamlet.huts.length, layoutFriends.length);
  assert.equal(createTownLayout(seed, posts, []).hamlet, undefined);
  for (const hut of layout.hamlet.huts) {
    assert(Math.abs(Math.hypot(hut.x - layout.hamlet.center.x, hut.z - layout.hamlet.center.z) - layout.hamlet.radius) < .001, 'huts do not form a ring');
    for (const corner of [-1, 1].flatMap(x => [-1, 1].map(z => ({ x: hut.x + x * 1.3, z: hut.z + z * 1.3 })))) assert(inTownOutline(corner), 'hut leaves the terrain');
    for (const plot of layout.plots) assert(Math.abs(hut.x - plot.x) >= (plot.width + 2.6) / 2 || Math.abs(hut.z - plot.z) >= (plot.depth + 2.6) / 2, 'hut overlaps an article');
    for (const other of layout.hamlet.huts) if (hut !== other) assert(Math.hypot(hut.x - other.x, hut.z - other.z) >= 2.6, 'huts overlap');
  }
  const moreFriends = [...layoutFriends, ...Array.from({ length: 18 }, (_, i) => ({ id: `extra-friend-${i}` }))];
  const expanded = createTownLayout(seed, posts, moreFriends);
  assertHamletClear(expanded);
  assert.equal(expanded.hamlet.huts.length, moreFriends.length, 'one hut must be generated for each real friend');
  assert.deepEqual(expanded.hamlet.huts.slice(0, layoutFriends.length), layout.hamlet.huts, 'adding friends moved their existing homes');
  for (const hut of expanded.hamlet.huts) {
    for (const other of expanded.hamlet.huts) if (hut !== other) assert(Math.hypot(hut.x-other.x, hut.z-other.z) >= 2.6, 'expanded huts overlap');
    for (const plot of expanded.reservedPlots) assert(Math.abs(hut.x-plot.x) >= (plot.width+2.6)/2 || Math.abs(hut.z-plot.z) >= (plot.depth+2.6)/2, 'expanded hut overlaps an article lot');
  }
  let capacity;
  try { createTownLayout(seed, [], Array.from({ length: 200 }, (_, i) => ({ id: `capacity-${i}` }))); } catch (error) { capacity = Number(error.message.match(/(\d+) terrain-safe lots/)?.[1]); }
  assert(Number.isFinite(capacity) && capacity > moreFriends.length);
  for (const count of [1, 17, 18, capacity]) {
    const stress = createTownLayout(seed, posts, Array.from({ length: count }, (_, i) => ({ id: `stress-${i}` })));
    assertHamletClear(stress);
    assert.equal(stress.plots.length, posts.length);
  }
  console.log(`Hamlet capacity: ${capacity}; full footprints and rendered access road clear at 1, 9, 17, 18, 27 and ${capacity} friends`);
  const grown = createTownLayout(seed, [...posts, { id: 'newest', date: '2026-11-22' }], layoutFriends);
  for (const plot of layout.plots) assert.deepEqual(grown.plots.find(next => next.postId === plot.postId), plot, 'growth moved an article');
}
const engine = new NullEngine(), scene = new Scene(engine);
const layout = createTownLayout(siteConfig.townSeed, [], layoutFriends);
for (const model of [buildFeature(scene, layout.features[0]), buildFriendHut(scene, layout.hamlet.huts[0])]) {
  assert(model.meshes.length > 0);
  assert(model.meshes.every(mesh => mesh.isPickable && !mesh.metadata.postId), 'landmarks masquerade as articles');
  assert(model.meshes.every(mesh => mesh.getVerticesData('edgeAnchor').every(value => value === 0)), 'parented landmark edge anchor is not local');
  model.root.dispose();
}
const windmill = buildFeature(scene, layout.features[0]);
const sail = windmill.rotor.getChildMeshes().find(mesh => mesh.getBoundingInfo().boundingBox.extendSize.length() > 1);
const tower = windmill.meshes.find(mesh => mesh.parent === windmill.root);
const vertex = Vector3.FromArray(sail.getVerticesData('position'));
const before = Vector3.TransformCoordinates(vertex, sail.computeWorldMatrix(true));
const pivot = windmill.rotor.getAbsolutePosition().clone();
const towerBefore = tower.computeWorldMatrix(true).clone();
windmill.rotor.rotation.z = Math.PI / 6;
const after = Vector3.TransformCoordinates(vertex, sail.computeWorldMatrix(true));
assert(Vector3.Distance(before, after) > .01, 'sail vertices did not rotate');
assert(Math.abs(Vector3.Distance(before, pivot) - Vector3.Distance(after, pivot)) < 1e-5, 'sails drifted away from their axle');
assert(Math.abs(before.z - after.z) < 1e-5, 'sails left the facade plane');
assert(tower.computeWorldMatrix(true).equals(towerBefore), 'turning sails moved the tower');
assert(windmill.rotor.getChildMeshes().every(mesh => mesh.isPickable && mesh.metadata.featureId === 'about'), 'rotating sails lost About picking');
windmill.root.dispose();
scene.dispose(); engine.dispose();
assert.equal(createSiteStats([], new Date('2026-11-22')).days, undefined);
assert.equal(createSiteStats([{ date: '2026-11-20', category: 'a', tags: ['x'], wordCount: 120 }], new Date('2026-11-22')).days, 3);

const savedWindow = globalThis.window, savedFetch = globalThis.fetch;
const storage = new Map(), session = new Map(), requests = [], visitors = new Set(), readers = new Map();
let sitePv = 0, clientIdentity = 'visitor-1', failure;
globalThis.window = {
  location: { origin: 'http://localhost:4325', pathname: '/posts/a/' },
  localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  sessionStorage: { getItem: key => session.get(key) ?? null, setItem: (key, value) => session.set(key, value) },
};
globalThis.fetch = async (url, options) => {
  const headers = new Headers(options.headers);
  requests.push({ url, options, headers });
  if (failure instanceof Error) throw failure;
  if (failure) return { ok: true, headers: new Headers(), json: async () => failure };
  const identity = headers.get('Authorization')?.replace('Bearer ', '') ?? clientIdentity;
  const path = new URL(headers.get('x-bsz-referer')).pathname;
  if (!readers.has(path)) readers.set(path, new Set());
  if (options.method === 'POST') { visitors.add(identity); readers.get(path).add(identity); sitePv++; }
  const data = { page_pv: 99, page_uv: readers.get(path).size, site_pv: sitePv, site_uv: visitors.size };
  return { ok: true, headers: new Headers({ 'Set-Bsz-Identity': identity }), json: async () => ({ success: true, data }) };
};
const freshCounter = () => { cache.delete(resolve('src/lib/views.ts')); return load('src/lib/views.ts').recordView; };
try {
  let recordView = freshCounter();
  assert.equal(await recordView('/posts/a/'), undefined);
  assert.equal(requests.length, 0, 'local preview contacted the external counter');
  window.location.origin = new URL(siteConfig.siteUrl).origin;
  assert.equal(await recordView('/posts/stale/'), undefined, 'stale route was counted');
  const first = recordView('/posts/a/'), duplicate = recordView('/posts/a/');
  assert.deepEqual(await first, { readers: 1, totals: { pageviews: 1, visitors: 1 } });
  assert.deepEqual(await duplicate, await first);
  assert.equal(requests.length, 1, 'duplicate effects counted the same page twice');
  assert.equal(new URL(requests[0].url).origin, 'https://bsz.dusays.com');
  assert.equal(requests[0].options.credentials, 'omit', 'counter still relies on third-party cookies');
  assert.equal(requests[0].headers.get('x-bsz-referer'), `${window.location.origin}/posts/a/`);
  assert.deepEqual(await recordView('/posts/a/'), await first);
  assert.equal(requests.length, 1, 'settled duplicate counted again');

  window.location.pathname = '/'; const home = recordView('/');
  window.location.pathname = '/posts/a/'; const back = recordView('/posts/a/');
  window.location.pathname = '/posts/b/'; const other = recordView('/posts/b/');
  assert.deepEqual(await home, { readers: 1, totals: { pageviews: 2, visitors: 1 } });
  assert.deepEqual(await back, { readers: 1, totals: { pageviews: 3, visitors: 1 } });
  assert.deepEqual(await other, { readers: 1, totals: { pageviews: 4, visitors: 1 } });
  assert(requests.slice(1).every(request => request.headers.get('Authorization') === 'Bearer visitor-1'), 'rapid route changes raced visitor identity');
  assert.deepEqual(load('src/lib/views.ts').getCachedView('/posts/a/'), await back, 'completed article counts were not cached');
  const originalIdentity = new Map(storage);
  storage.clear(); clientIdentity = 'visitor-2'; recordView = freshCounter(); window.location.pathname = '/posts/a/';
  assert.deepEqual(await recordView('/posts/a/'), { readers: 2, totals: { pageviews: 5, visitors: 2 } });
  assert.equal(readers.get('/posts/b/').size, 1, 'another article inherited the site visitor total');
  storage.clear(); for (const [key, value] of originalIdentity) storage.set(key, value);
  recordView = freshCounter();
  assert.equal(load('src/lib/views.ts').getCachedView('/posts/a/').readers, 2, 'reload lost the session cache');
  assert.deepEqual(await recordView('/posts/a/'), { readers: 2, totals: { pageviews: 6, visitors: 2 } }, 'reload lost the stored visitor identity');

  for (const payload of [{ success: false }, { success: true, data: {} }, { success: true, data: { page_uv: -1, site_pv: 2, site_uv: 1 } }, { success: true, data: { page_uv: '1', site_pv: 2, site_uv: 1 } }, { success: true, data: { page_pv: 41, site_pv: 2, site_uv: 1 } }, new Error('offline'), new DOMException('timeout', 'TimeoutError')]) {
    failure = payload; recordView = freshCounter();
    assert.equal(await recordView('/posts/a/'), undefined, 'invalid or unavailable counts were displayed');
  }
  failure = undefined;
  assert(await recordView('/posts/a/'), 'a failed request prevented recovery on the same route');
  window.localStorage = { getItem() { throw new Error('storage blocked'); }, setItem() { throw new Error('storage blocked'); } };
  recordView = freshCounter();
  const noStorageFirst = await recordView('/posts/a/');
  window.location.pathname = '/posts/b/';
  assert.equal((await recordView('/posts/b/')).totals.visitors, noStorageFirst.totals.visitors, 'blocked storage lost the in-memory identity');
  const normalFetch = globalThis.fetch;
  const beforeLostResponse = sitePv;
  globalThis.fetch = async (url, options) => {
    const response = await normalFetch(url, options);
    if (options.method === 'POST') throw new DOMException('response lost after counting', 'TimeoutError');
    return response;
  };
  recordView = freshCounter();
  const recovered = await recordView('/posts/b/');
  assert.equal(recovered.totals.pageviews, beforeLostResponse + 1, 'read recovery counted a lost POST twice');
  assert.deepEqual(requests.slice(-2).map(request => request.options.method), ['POST', 'GET']);
  globalThis.fetch = normalFetch;

  let releaseSlow;
  const startedPaths = [];
  globalThis.fetch = async (url, options) => {
    const path = new URL(options.headers['x-bsz-referer']).pathname;
    startedPaths.push(path);
    if (path === '/posts/slow/') await new Promise(resolve => { releaseSlow = resolve; });
    return normalFetch(url, options);
  };
  recordView = freshCounter();
  window.location.pathname = '/posts/slow/'; const slow = recordView('/posts/slow/');
  window.location.pathname = '/posts/current/'; const current = recordView('/posts/current/');
  assert.deepEqual(startedPaths, ['/posts/slow/', '/posts/current/'], 'a slow previous page blocked the current article');
  assert(await current, 'current article waited for the slow request');
  releaseSlow(); await slow;
  globalThis.fetch = normalFetch;

  const cacheKey = [...session.keys()].find(key => key.endsWith('/posts/a/'));
  session.set(cacheKey, '{broken'); freshCounter();
  assert.equal(load('src/lib/views.ts').getCachedView('/posts/a/'), undefined, 'corrupt cache was displayed');
  session.set(cacheKey, JSON.stringify({ readers: -1, totals: { pageviews: 1, visitors: 1 } })); freshCounter();
  assert.equal(load('src/lib/views.ts').getCachedView('/posts/a/'), undefined, 'invalid cache counts were displayed');
} finally {
  if (savedWindow === undefined) delete globalThis.window; else globalThis.window = savedWindow;
  globalThis.fetch = savedFetch;
}
console.log('PASS: collision-reserved hamlet, rotating windmill, real models, stats, per-article unique readers, stable visitor identity, route deduplication, preview isolation and graceful outages');
