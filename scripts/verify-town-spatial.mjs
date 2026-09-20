import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

const cache = new Map();
const loadTs = (path) => {
  const absolute = resolve(path);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const module = { exports: {} };
  cache.set(absolute, module);
  const source = readFileSync(absolute, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const localRequire = (specifier) => {
    if (!specifier.startsWith('.')) throw new Error(`Unsupported test import: ${specifier}`);
    const candidate = resolve(dirname(absolute), specifier);
    return loadTs(candidate.endsWith('.ts') ? candidate : `${candidate}.ts`);
  };
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
};

const spatial = loadTs('src/data/town-spatial.ts');
const layoutModule = loadTs('src/data/town-layout.ts');
const textures = loadTs('src/data/town-textures.ts');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const mesh = spatial.corridorMeshData([{ x: 0, z: -2 }, { x: 0, z: 2 }], 1, 0.1);
const [aIndex, bIndex, cIndex] = mesh.indices;
const vertex = (index) => ({ x: mesh.positions[index * 3], y: mesh.positions[index * 3 + 1], z: mesh.positions[index * 3 + 2] });
const a = vertex(aIndex); const b = vertex(bIndex); const c = vertex(cIndex);
const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
const normalY = ab.z * ac.x - ab.x * ac.z;
assert(normalY > 0, `corridor surface faces downward (normalY=${normalY})`);

const plazaOuterRadius = 1.72;
const minimumTrafficClearance = plazaOuterRadius + 0.08;
for (const [routeName, route] of Object.entries(layoutModule.townTravelRoutes)) {
  const routeSamples = spatial.samplePath(route, 24);
  const nearestCenterDistance = Math.min(...routeSamples.map((point) => Math.hypot(point.x, point.z)));
  assert(nearestCenterDistance > minimumTrafficClearance, `${routeName} traffic route crosses the town center (clearance=${nearestCenterDistance.toFixed(3)})`);
  assert(route.length >= 6, `${routeName} traffic route is not a connected road-to-road route`);
}
for (const [index, connector] of layoutModule.townCenterRingConnectors.entries()) {
  assert(connector.length > 1, `town center connector ${index} is empty`);
  const connectorSamples = spatial.samplePath(connector, 24);
  const nearestConnectorDistance = Math.min(...connectorSamples.map((point) => Math.hypot(point.x, point.z)));
  assert(nearestConnectorDistance > minimumTrafficClearance, `town center connector ${index} crosses the plaza`);
}
const ringSamples = spatial.samplePath(layoutModule.townCenterRing, 24);
const ringMinimumRadius = Math.min(...ringSamples.map((point) => Math.hypot(point.x, point.z)));
const ringInnerEdge = ringMinimumRadius - layoutModule.townCenterRingWidth / 2;
assert(ringInnerEdge >= plazaOuterRadius, `town center ring overlaps plaza (inner edge=${ringInnerEdge.toFixed(3)})`);
assert(ringInnerEdge - plazaOuterRadius < 0.16, `town center ring is not adjacent to plaza (gap=${(ringInnerEdge - plazaOuterRadius).toFixed(3)})`);
assert(layoutModule.townCenterRoundaboutRadius > plazaOuterRadius, 'roundabout does not surround the plaza');
assert(layoutModule.townCenterRoundaboutRadius - plazaOuterRadius < 0.7, `roundabout is too far from plaza (gap=${(layoutModule.townCenterRoundaboutRadius - plazaOuterRadius).toFixed(3)})`);

const board = { minX: -34.56, maxX: 34.56, minZ: -28.80, maxZ: 28.80 };
assert(layoutModule.roadCenterlines.east.at(-1).x > board.maxX, 'east road does not overshoot the board edge');
assert(layoutModule.roadCenterlines.west.at(-1).x < board.minX, 'west road does not overshoot the board edge');
assert(layoutModule.roadCenterlines.north.at(-1).z > board.maxZ, 'north road does not overshoot the board edge');

const distanceToPath = (point, samples) => {
  let best = Infinity;
  for (let index = 1; index < samples.length; index += 1) {
    const a = samples[index - 1];
    const b = samples[index];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(point.x - a.x - t * dx, point.z - a.z - t * dz));
  }
  return best;
};
const riverSamples = spatial.samplePath(layoutModule.riverCenterline, 32);
for (const roadName of ['main', 'east', 'north']) {
  const roadSamplesForCheck = spatial.samplePath(layoutModule.roadCenterlines[roadName], 32);
  const minimumCenterlineGap = Math.min(...roadSamplesForCheck.map((point) => distanceToPath(point, riverSamples)));
  const clearance = (layoutModule.roadWidths[roadName] + layoutModule.riverWidth) / 2;
  assert(minimumCenterlineGap > clearance, `${roadName} road overlaps the river corridor (gap=${minimumCenterlineGap.toFixed(3)}, required>${clearance.toFixed(3)})`);
}

const riverBankPolygon = spatial.corridorPolygon(layoutModule.riverCenterline, (layoutModule.riverWidth + 0.22) / 2);
const bridgeSegments = spatial.pathSegmentsInsidePolygon(layoutModule.roadCenterlines.west, riverBankPolygon, 24);
assert(bridgeSegments.length === 1, `expected one contiguous bridge overlap segment, got ${bridgeSegments.length}`);
const bridgeSegment = bridgeSegments[0];
assert(bridgeSegment.length > 2, `bridge overlap segment is too short (${bridgeSegment.length} samples)`);
const crossing = spatial.findPathIntersection(layoutModule.riverCenterline, layoutModule.roadCenterlines.west);
assert(crossing, 'west road and river have no calculated crossing');
const riverRegion = layoutModule.worldRegions.find((region) => region.kind === 'river');
const westRoad = layoutModule.worldRegions.find((region) => region.id === 'road-branch-west');
assert(spatial.pointInPolygon(crossing, riverRegion.polygon), 'bridge crossing is outside rendered/collision river polygon');
assert(spatial.pointInPolygon(crossing, westRoad.polygon), 'bridge crossing is outside west road polygon');
// The bridge's local +X axis must point along the road tangent after Babylon's
// applies rotationY (where +X rotates toward world -Z).
const roadSamples = spatial.samplePath(layoutModule.roadCenterlines.west, 12);
let tangentIndex = 0;
for (let index = 0; index < roadSamples.length - 1; index += 1) {
  const a = roadSamples[index];
  const b = roadSamples[index + 1];
  if (Math.abs((a.x + b.x) / 2 - crossing.x) + Math.abs((a.z + b.z) / 2 - crossing.z) < 1.4) { tangentIndex = index; break; }
}
const roadTangent = { x: roadSamples[tangentIndex + 1].x - roadSamples[tangentIndex].x, z: roadSamples[tangentIndex + 1].z - roadSamples[tangentIndex].z };
const roadLength = Math.hypot(roadTangent.x, roadTangent.z) || 1;
const bridgeAxis = { x: Math.cos(crossing.rotationY), z: -Math.sin(crossing.rotationY) };
const alignment = Math.abs((bridgeAxis.x * roadTangent.x + bridgeAxis.z * roadTangent.z) / roadLength);
assert(alignment > 0.96, `bridge axis is not aligned with west road (alignment=${alignment.toFixed(3)})`);
const bridgeHalfLength = (layoutModule.riverWidth + 1.08) / 2;
const bridgeEndpoints = [-bridgeHalfLength, bridgeHalfLength].map((distance) => ({
  x: crossing.x + bridgeAxis.x * distance,
  z: crossing.z + bridgeAxis.z * distance,
}));
bridgeEndpoints.forEach((endpoint, index) => {
  assert(!spatial.pointInPolygon(endpoint, riverRegion.polygon), `bridge endpoint ${index + 1} still sits in the river`);
  assert(spatial.pointInPolygon(endpoint, westRoad.polygon), `bridge endpoint ${index + 1} does not meet the west road`);
});
const extendedBridgeSegment = spatial.extendPathEndpoints(bridgeSegment, 0.38, 0.68);
const bridgeStart = extendedBridgeSegment[0];
const bridgeEnd = extendedBridgeSegment[extendedBridgeSegment.length - 1];
assert(spatial.pointInPolygon(bridgeSegment[Math.floor(bridgeSegment.length / 2)], riverRegion.polygon), 'bridge overlap does not cover the river center');
assert(!spatial.pointInPolygon(bridgeStart, riverRegion.polygon) && !spatial.pointInPolygon(bridgeEnd, riverRegion.polygon), 'bridge overlap endpoints still sit inside the water channel');
assert(spatial.pointInPolygon(bridgeStart, westRoad.polygon) && spatial.pointInPolygon(bridgeEnd, westRoad.polygon), 'extended bridge endpoints do not cover the land road');

const intersectsRegion = (entity, region) => {
  const corners = [
    { x: entity.x - entity.width / 2, z: entity.z - entity.depth / 2 },
    { x: entity.x + entity.width / 2, z: entity.z - entity.depth / 2 },
    { x: entity.x + entity.width / 2, z: entity.z + entity.depth / 2 },
    { x: entity.x - entity.width / 2, z: entity.z + entity.depth / 2 },
  ];
  return corners.some((corner) => spatial.pointInPolygon(corner, region.polygon)) || spatial.pointInPolygon({ x: entity.x, z: entity.z }, region.polygon);
};
const forbiddenRegions = layoutModule.worldRegions.filter((region) => ['river', 'road', 'forest'].includes(region.kind));
for (const entity of layoutModule.townEntities) {
  for (const region of forbiddenRegions) {
    assert(!intersectsRegion(entity, region), `${entity.id} overlaps forbidden ${region.id}`);
  }
}

const ground = textures.createGroundTextureData('river-bend-demo-v2', 64, 64);
let rgbTotal = 0;
let alphaMin = 255;
for (let index = 0; index < ground.data.length; index += 4) {
  rgbTotal += ground.data[index] + ground.data[index + 1] + ground.data[index + 2];
  alphaMin = Math.min(alphaMin, ground.data[index + 3]);
}
const rgbAverage = rgbTotal / (ground.width * ground.height * 3);
assert(alphaMin === 255, `ground texture contains transparent pixels (min alpha ${alphaMin})`);
assert(rgbAverage > 160, `ground texture is dark enough to blacken the terrain (average ${rgbAverage.toFixed(1)})`);

const samplePosts = Array.from({ length: 8 }, (_, index) => ({ id: `post-${index}` }));
const seriesLayout = layoutModule.createTownLayout('series-regression', [
  { id: 'series-1', series: 'same-series', seriesIndex: 0 },
  { id: 'series-2', series: 'same-series', seriesIndex: 1 },
]);
assert(seriesLayout.plots.length === 1, `one series must generate one building, got ${seriesLayout.plots.length}`);
assert(seriesLayout.plots[0].seriesPostIds?.join(',') === 'series-1,series-2', 'series floors are not ordered or grouped correctly');

const layout = layoutModule.createTownLayout('spatial-regression', samplePosts);
for (const plot of layout.plots) {
  assert(!spatial.pointInPolygon({ x: plot.x, z: plot.z }, riverRegion.polygon), `${plot.id} generated in river`);
  for (const entity of layout.entities) {
    const overlaps = Math.abs(plot.x - entity.x) < (plot.width + entity.width) / 2 + 0.35
      && Math.abs(plot.z - entity.z) < (plot.depth + entity.depth) / 2 + 0.35;
    assert(!overlaps, `${plot.id} overlaps fixed ${entity.kind} ${entity.id}`);
  }
}
for (let index = 0; index < layout.plots.length; index += 1) {
  for (let other = index + 1; other < layout.plots.length; other += 1) {
    const first = layout.plots[index];
    const second = layout.plots[other];
    const overlaps = Math.abs(first.x - second.x) < (first.width + second.width) / 2 + 0.35
      && Math.abs(first.z - second.z) < (first.depth + second.depth) / 2 + 0.35;
    assert(!overlaps, `${first.id} overlaps ${second.id}`);
  }
}

console.log(JSON.stringify({
  corridorNormalY: normalY,
  townCenterRingInnerEdge: Number(ringInnerEdge.toFixed(3)),
  townCenterRoundaboutRadius: layoutModule.townCenterRoundaboutRadius,
  bridgeCrossing: crossing,
  bridgeAlignment: Number(alignment.toFixed(3)),
  bridgeEndpoints,
  bridgeOverlapSamples: bridgeSegment.length,
  bridgeExtendedSamples: extendedBridgeSegment.length,
  groundAverage: Number(rgbAverage.toFixed(1)),
  groundAlphaMin: alphaMin,
  plotCount: layout.plots.length,
}, null, 2));
