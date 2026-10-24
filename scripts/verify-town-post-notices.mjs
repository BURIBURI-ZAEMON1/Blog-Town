import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { ArcRotateCamera, Camera, NullEngine, Scene, Vector3 } from '@babylonjs/core';

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
const { NEW_POST_WINDOW_MS, getNewPostIds, parseReadPostIds, layoutPostNotices } = load('src/data/town-post-notices.ts');
const now = Date.parse('2026-10-24T12:00:00+08:00');
const post = (id, timestamp) => ({ id, date: new Date(timestamp).toISOString() });
const posts = [post('just-published', now), post('within', now - 1), post('boundary', now - NEW_POST_WINDOW_MS), post('expired', now - NEW_POST_WINDOW_MS - 1), post('future', now + 1), { id: 'invalid', date: 'invalid' }];
assert.deepEqual(getNewPostIds(posts, new Set(), now), ['just-published', 'within', 'boundary']);
assert.deepEqual(getNewPostIds(posts, new Set(['within']), now), ['just-published', 'boundary']);
assert.deepEqual(getNewPostIds(posts, new Set(), now + 1), ['just-published', 'within', 'future']);
assert.deepEqual(getNewPostIds([{ id: 'offset', date: '2026-10-10T12:00:00+08:00' }], new Set(), now), ['offset']);
assert.deepEqual([...parseReadPostIds('["read",null,1,"","read","second"]')], ['read', 'second']);
for (const raw of [null, '{broken', '{}', 'true', 'null']) assert.equal(parseReadPostIds(raw).size, 0);

for (const [width, height] of [[320, 500], [390, 600], [1100, 760]]) {
  const anchors = Array.from({ length: 5 }, (_, i) => ({ postId: `floor-${i}`, kind: 'new', x: width / 2, y: height / 2 + i * 8 }));
  const placed = layoutPostNotices({ width, height, anchors });
  assert.equal(placed.length, anchors.length, 'series floors lost notices');
  for (let i = 0; i < placed.length; i++) {
    const a = placed[i];
    assert(a.left >= 10 && a.left + a.width <= width - 10 && a.top >= 10 && a.top + a.height <= height - 10, 'label escaped the canvas');
    assert(a.path.startsWith(`M ${a.x} ${a.y} `), 'leader points to a different article floor');
    for (const b of placed.slice(i + 1)) assert(a.left + a.width <= b.left || b.left + b.width <= a.left || a.top + a.height <= b.top || b.top + b.height <= a.top, 'series labels overlap');
  }
  const edge = layoutPostNotices({ width, height, anchors: [{ postId: 'edge', kind: 'new', x: 1, y: 1 }, { postId: 'outside', kind: 'new', x: -1, y: 50 }] });
  assert.equal(edge.length, 1); assert.equal(edge[0].postId, 'edge');
  const fixedSide = layoutPostNotices({ width: 1000, height: 760, anchors: [{ postId: 'left-anchor', kind: 'new', x: 100, y: 300 }, { postId: 'right-anchor', kind: 'new', x: 800, y: 300 }] });
  assert.equal(fixedSide.find((item) => item.postId === 'left-anchor').left, 128, 'left-side notice did not stay on the fixed right side');
  assert.equal(fixedSide.find((item) => item.postId === 'right-anchor').left, 828, 'right-side notice flipped across its building');
  const overflow = layoutPostNotices({ width: 1000, height: 760, anchors: [{ postId: 'overflow', kind: 'new', x: 980, y: 300 }] });
  assert.equal(overflow[0].left, 1008, 'edge notice was unexpectedly pulled back into the canvas');
}
const { createTownLayout } = load('src/data/town-layout.ts');
const { buildHouse } = load('src/scene/brick-town/buildings.ts');
const { createPostNoticeProjector } = load('src/scene/brick-town/post-notices.ts');
const engine = new NullEngine(), scene = new Scene(engine);
const camera = new ArcRotateCamera('notice-test', Math.PI * .68, .96, 36, new Vector3(0, .2, 0), scene);
camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
camera.orthoLeft = -20; camera.orthoRight = 20; camera.orthoTop = 15; camera.orthoBottom = -15;
const layout = createTownLayout('notices-regression', [{ id: 'one' }, { id: 'floor-a', series: 'series', seriesIndex: 0 }, { id: 'floor-b', series: 'series', seriesIndex: 1 }]);
const houses = layout.plots.map((plot) => buildHouse(scene, plot, true));
const projector = createPostNoticeProjector(scene, camera, houses), ids = ['one', 'floor-a', 'floor-b'];
scene.render();
const first = projector.project(ids, undefined, 1000, 750);
assert.equal(first.anchors.length, 3);
const guide = projector.project(ids, 'floor-a', 1000, 750);
assert.equal(guide.anchors.find((anchor) => anchor.postId === 'floor-a').kind, 'guide');
assert.equal(guide.anchors.filter((anchor) => anchor.postId === 'floor-a').length, 1, 'guide duplicated the new article notice');
assert.equal(projector.project(ids, 'floor-a', 1000, 750), undefined, 'stationary camera keeps publishing frames');
assert.equal(projector.project(ids, undefined, 1000, 750).anchors.length, 3, 'guide state did not clear');
const floors = first.anchors.filter((a) => a.postId.startsWith('floor'));
assert.notEqual(floors[0].y, floors[1].y, 'series articles point to the same floor');
camera.target.x += 3; scene.render();
const panned = projector.project(ids, undefined, 1000, 750);
assert.notDeepEqual(panned.anchors, first.anchors, 'pan left notices at the previous camera position');
assert.equal(projector.project(ids, undefined, 1000, 750), undefined, 'camera never settles after pan');
const resized = projector.project(ids, undefined, 500, 375);
for (let i = 0; i < resized.anchors.length; i++) assert(Math.abs(resized.anchors[i].x * 2 - panned.anchors[i].x) < .02, 'render DPI leaked into CSS coordinates');
assert.equal(projector.project([], undefined, 500, 375).anchors.length, 0, 'read posts retain anchors');
camera.target.set(1000, 0, 1000); scene.render();
assert.equal(projector.project(ids, undefined, 500, 375).anchors.length, 0, 'offscreen buildings retain floating labels');
scene.dispose(); engine.dispose();
console.log('PASS: rolling 14-day dates, unread IDs, corrupt storage, series label placement, camera projection/cache, resizing and offscreen culling');
