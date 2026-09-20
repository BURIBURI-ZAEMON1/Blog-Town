import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import '@babylonjs/core/Meshes/thinInstanceMesh.js';
import { CreateCylinderVertexData } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.pure.js';
import { CreateBoxVertexData } from '@babylonjs/core/Meshes/Builders/boxBuilder.pure.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';

export const STUD = 0.36;
export const COURSE = 0.216;
export const COLORS = {
  cream: '#eadbb7', ivory: '#f4eed8', sand: '#c9ad78', tan: '#af8659',
  red: '#aa3e30', coral: '#cc5940', darkRed: '#74332b', blue: '#3f7887',
  navy: '#264753', teal: '#368d81', green: '#547a3c', leaf: '#739546',
  pine: '#31583d', moss: '#8da352', dark: '#303d35', brown: '#654a35',
  water: '#399baf', waterDeep: '#287b90', waterLight: '#75c5cd',
  road: '#bcb4a0', roadLight: '#d5cbb5', yellow: '#efba36', black: '#242b2b',
};
type Geometry = { positions: number[]; normals: number[]; indices: number[] };
type Bucket = Geometry & { color: string; id?: string; glass: boolean };
type ThinBucket = { geometry: Geometry; color: string; glass: boolean; matrices: number[] };
const geometryCache = new Map<string, Geometry>();
const sceneMaterials = new WeakMap<Scene, Map<string, PBRMaterial>>();

const materialFor = (scene: Scene, color: string, glass: boolean, group: string) => {
  let cache = sceneMaterials.get(scene);
  if (!cache) { cache = new Map(); sceneMaterials.set(scene, cache); }
  const key = `${group}:${color}:${glass}`;
  let material = cache.get(key);
  if (!material) {
    material = new PBRMaterial(`${group}:plastic:${color}:${glass}`, scene);
    material.albedoColor = Color3.FromHexString(color).toLinearSpace(); material.metallic = 0;
    material.roughness = glass ? 0.15 : 0.29;
    material.clearCoat.isEnabled = true; material.clearCoat.intensity = 0.25; material.clearCoat.roughness = 0.21;
    material.environmentIntensity = 0.7;
    if (glass) material.alpha = 0.86;
    cache.set(key, material);
  }
  return material;
};

// A rounded box is a subdivided cube projected onto its inset Minkowski sum.
// The continuous normals give the real bevel a narrow plastic edge highlight.
export function roundedBox(w: number, h: number, d: number, radius = 0.014): Geometry {
  const key = `b:${w}:${h}:${d}:${radius}`;
  const cached = geometryCache.get(key); if (cached) return cached;
  const half = [w / 2, h / 2, d / 2];
  const r = Math.min(radius, ...half.map(v => v * 0.4));
  const inner = half.map(v => v - r);
  const result: Geometry = { positions: [], normals: [], indices: [] };
  for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
    const u = (axis + 1) % 3, v = (axis + 2) % 3;
    const us = [-half[u], -inner[u], inner[u], half[u]];
    const vs = [-half[v], -inner[v], inner[v], half[v]];
    const base = result.positions.length / 3;
    for (const y of vs) for (const x of us) {
      const p = [0, 0, 0]; p[axis] = half[axis] * sign; p[u] = x; p[v] = y;
      const q = p.map((value, i) => Math.max(-inner[i], Math.min(inner[i], value)));
      const n = p.map((value, i) => value - q[i]); const length = Math.hypot(...n);
      result.positions.push(...q.map((value, i) => value + n[i] / length * r));
      result.normals.push(...n.map(value => value / length));
    }
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      const a = base + y * 4 + x, b = a + 1, c = a + 4, d = c + 1;
      result.indices.push(...(sign > 0 ? [a, c, b, b, c, d] : [a, b, c, b, d, c]));
    }
  }
  geometryCache.set(key, result); return result;
}

const cylinderGeometry = (_scene: Scene, diameter: number, height: number, top = diameter, tessellation = 12): Geometry => {
  const key = `c:${diameter}:${height}:${top}:${tessellation}`; let geometry = geometryCache.get(key);
  if (!geometry) {
    const data = CreateCylinderVertexData({ diameterTop: top, diameterBottom: diameter, height, tessellation });
    geometry = { positions: Array.from(data.positions!), normals: Array.from(data.normals!), indices: Array.from(data.indices!) };
    geometryCache.set(key, geometry);
  }
  return geometry;
};

const simpleBox = (w: number, h: number, d: number): Geometry => {
  const key = `simple:${w}:${h}:${d}`; let geometry = geometryCache.get(key);
  if (!geometry) {
    const data = CreateBoxVertexData({ width: w, height: h, depth: d });
    geometry = { positions: Array.from(data.positions!), normals: Array.from(data.normals!), indices: Array.from(data.indices!) };
    geometryCache.set(key, geometry);
  }
  return geometry;
};

export class BrickKit {
  private buckets = new Map<string, Bucket>();
  readonly materials = new Map<string, PBRMaterial>();
  readonly meshes: Mesh[] = [];
  constructor(readonly scene: Scene, readonly parent?: TransformNode, readonly materialGroup = 'plastic') {}
  private add(geometry: Geometry, x: number, y: number, z: number, color: string, yaw = 0, id?: string, glass = false) {
    const key = `${color}:${id ?? ''}:${glass}`;
    let bucket = this.buckets.get(key);
    if (!bucket) { bucket = { positions: [], normals: [], indices: [], color, id, glass }; this.buckets.set(key, bucket); }
    const base = bucket.positions.length / 3, c = Math.cos(yaw), s = Math.sin(yaw);
    for (let i = 0; i < geometry.positions.length; i += 3) {
      const p = geometry.positions, n = geometry.normals;
      bucket.positions.push(x + c * p[i] + s * p[i + 2], y + p[i + 1], z - s * p[i] + c * p[i + 2]);
      bucket.normals.push(c * n[i] + s * n[i + 2], n[i + 1], -s * n[i] + c * n[i + 2]);
    }
    for (const index of geometry.indices) bucket.indices.push(base + index);
  }
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: string, yaw = 0, id?: string, glass = false) {
    this.add(roundedBox(w, h, d, Math.min(0.025, h * 0.16)), x, y, z, color, yaw, id, glass);
  }
  cylinder(x: number, y: number, z: number, diameter: number, height: number, color: string, id?: string, top = diameter) {
    this.add(cylinderGeometry(this.scene, diameter, height, top), x, y, z, color, 0, id);
  }
  brick(x: number, bottom: number, z: number, nx: number, nz: number, color: string, height = COURSE, studs = true, id?: string) {
    this.box(x, bottom + height / 2, z, nx * STUD - 0.015, height - 0.009, nz * STUD - 0.015, color, 0, id);
    if (studs) for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      this.cylinder(x + (i - (nx - 1) / 2) * STUD, bottom + height + 0.035, z + (j - (nz - 1) / 2) * STUD, 0.215, 0.07, color, id);
    }
  }
  flush(name: string) {
    for (const [key, bucket] of this.buckets) {
      const mesh = new Mesh(`${name}:${key}`, this.scene);
      const data = new VertexData(); data.positions = bucket.positions; data.normals = bucket.normals; data.indices = bucket.indices; data.applyToMesh(mesh);
      const mat = materialFor(this.scene, bucket.color, bucket.glass, this.materialGroup);
      mesh.material = mat; mesh.parent = this.parent ?? null; mesh.receiveShadows = true;
      mesh.isPickable = true; mesh.metadata = { postId: bucket.id, plastic: true, glass: bucket.glass, baseColor: bucket.color };
      this.materials.set(key, mat); this.meshes.push(mesh);
    }
    this.buckets.clear(); return this.meshes;
  }
}

// The board contains thousands of repeated LEGO plates and studs. Keeping a
// translated copy of every vertex made the CPU heap and upload cost scale with
// the map area. Thin instances preserve the exact moulded geometry while each
// repeated piece is represented by one compact transform matrix.
export class ThinBrickKit {
  private buckets = new Map<string, ThinBucket>();
  readonly meshes: Mesh[] = [];
  constructor(readonly scene: Scene, readonly materialGroup = 'plastic') {}
  private add(key: string, geometry: Geometry, x: number, y: number, z: number, color: string, yaw = 0, glass = false) {
    const bucketKey = `${key}:${color}:${glass}`;
    let bucket = this.buckets.get(bucketKey);
    if (!bucket) { bucket = { geometry, color, glass, matrices: [] }; this.buckets.set(bucketKey, bucket); }
    const matrix = Matrix.RotationY(yaw); matrix.setTranslationFromFloats(x, y, z);
    bucket.matrices.push(...matrix.asArray());
  }
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: string, yaw = 0, glass = false) {
    this.add(`simple:${w}:${h}:${d}`, simpleBox(w, h, d), x, y, z, color, yaw, glass);
  }
  cylinder(x: number, y: number, z: number, diameter: number, height: number, color: string, top = diameter) {
    this.add(`c:${diameter}:${height}:${top}:8`, cylinderGeometry(this.scene, diameter, height, top, 8), x, y, z, color);
  }
  brick(x: number, bottom: number, z: number, nx: number, nz: number, color: string, height = COURSE, studs = true) {
    this.box(x, bottom + height / 2, z, nx * STUD - 0.015, height - 0.009, nz * STUD - 0.015, color);
    if (studs) for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      this.cylinder(x + (i - (nx - 1) / 2) * STUD, bottom + height + 0.035, z + (j - (nz - 1) / 2) * STUD, 0.215, 0.07, color);
    }
  }
  flush(name: string) {
    for (const [key, bucket] of this.buckets) {
      const mesh = new Mesh(`${name}:${key}`, this.scene);
      const data = new VertexData(); data.positions = bucket.geometry.positions; data.normals = bucket.geometry.normals; data.indices = bucket.geometry.indices; data.applyToMesh(mesh);
      mesh.material = materialFor(this.scene, bucket.color, bucket.glass, this.materialGroup);
      mesh.thinInstanceSetBuffer('matrix', new Float32Array(bucket.matrices), 16, true);
      mesh.thinInstanceRefreshBoundingInfo(true);
      mesh.receiveShadows = true; mesh.isPickable = false; mesh.alwaysSelectAsActiveMesh = true;
      mesh.metadata = { plastic: true, glass: bucket.glass, baseColor: bucket.color, thinInstances: bucket.matrices.length / 16 };
      this.meshes.push(mesh);
    }
    this.buckets.clear(); return this.meshes;
  }
}
