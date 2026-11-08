import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const module = { exports: {} };
const output = ts.transpileModule(readFileSync('src/scene/brick-town/path-proximity.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
new Function('exports', output)(module.exports);
const { createPathProximity } = module.exports;
const oldDistance = (p, points) => {
  let distance = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    distance = Math.min(distance, Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz));
  }
  return distance;
};
let count = 0;
for (const points of [[], [{ x: 0, z: 0 }], [{ x: 1, z: 1 }, { x: 1, z: 1 }], Array.from({ length: 90 }, (_, i) => ({ x: -25 + i * .6, z: Math.sin(i * .14) * 8 }))]) {
  const near = createPathProximity(points);
  for (let x = -30; x <= 30; x += .37) for (let z = -14; z <= 14; z += .61) for (const radius of [-1, 0, .3, .8, 1.5, 3]) {
    const point = { x, z };
    assert.equal(near(point, radius), oldDistance(point, points) < radius, 'terrain/season mask changed');
    count++;
  }
}
console.log(`PASS: ${count} proximity queries match the original distance predicate, including degenerate paths and boundary radii.`);
