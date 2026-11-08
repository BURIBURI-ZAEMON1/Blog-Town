import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { NullEngine, Scene, Mesh, Matrix, Vector3 } from '@babylonjs/core';
const require = createRequire(import.meta.url), module = { exports: {} };
const output = ts.transpileModule(readFileSync('src/scene/brick-town/kit.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function('require', 'module', 'exports', output)(require, module, module.exports);
const { ThinBrickKit } = module.exports;
const engine = new NullEngine(), scene = new Scene(engine);
const originalRefresh = Mesh.prototype.thinInstanceRefreshBoundingInfo;
let refreshes = 0;
Mesh.prototype.thinInstanceRefreshBoundingInfo = function (...args) { refreshes++; return originalRefresh.apply(this, args); };
try {
  const kit = new ThinBrickKit(scene, 'instance-regression');
  const transforms = Array.from({ length: 200 }, (_, i) => ({ x: Math.sin(i) * 20, y: i * .01, z: Math.cos(i) * 12, yaw: i % 3 ? 0 : i * .14 }));
  for (const p of transforms) kit.box(p.x, p.y, p.z, .72, .2, 1.08, '#547a3c', p.yaw);
  const [mesh] = kit.flush('instances');
  const matrices = mesh.thinInstanceGetWorldMatrices();
  assert.equal(matrices.length, transforms.length);
  for (let i = 0; i < transforms.length; i++) {
    const p = transforms[i], expected = Matrix.RotationY(p.yaw); expected.setTranslationFromFloats(p.x, p.y, p.z);
    assert.deepEqual([...matrices[i].asArray()], [...expected.asArray()], 'instance transform changed');
    for (const point of mesh.rawBoundingInfo.boundingBox.vectors) {
      const world = Vector3.TransformCoordinates(point, matrices[i]);
      const bounds = mesh.getBoundingInfo().boundingBox;
      assert(world.x >= bounds.minimum.x - 1e-5 && world.x <= bounds.maximum.x + 1e-5 && world.y >= bounds.minimum.y - 1e-5 && world.y <= bounds.maximum.y + 1e-5 && world.z >= bounds.minimum.z - 1e-5 && world.z <= bounds.maximum.z + 1e-5, 'instance bounds clipped rendered geometry');
    }
  }
  assert.equal(refreshes, 1, 'static instance bounds were recalculated after buffer upload already calculated them');
  console.log('PASS: exact instance transforms/bounds, one bounds calculation, unchanged geometry.');
} finally { Mesh.prototype.thinInstanceRefreshBoundingInfo = originalRefresh; scene.dispose(); engine.dispose(); }
