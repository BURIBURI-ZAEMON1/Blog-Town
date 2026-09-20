export type RegionKind = 'road' | 'river' | 'forest' | 'landmark' | 'buildable';
export type Point = { x: number; z: number };

export interface WorldRegion {
  id: string;
  kind: RegionKind;
  polygon: Point[];
}

export type TownBuildingStyle =
  | 'cottage' | 'townhouse' | 'stonehouse' | 'villa' | 'rowhouse' | 'workshop'
  | 'shop' | 'forge' | 'inn' | 'watchtower' | 'chapel' | 'windmill' | 'clocktower';

export type TownSpecialStyle = Extract<TownBuildingStyle, 'shop' | 'forge' | 'inn' | 'watchtower' | 'chapel' | 'windmill' | 'clocktower'>;

/** Extra empty ground kept around each building for a readable town scale. */
export const BUILDING_GAP = 0.9;

/** Shared world coordinate frame used by Babylon and the article mini-map. */
export const townBoard = { minX: -34.56, maxX: 34.56, minZ: -28.80, maxZ: 28.80 } as const;

export interface TownPlot {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  roof: 'gable' | 'hip' | 'flat';
  walls: 'stone' | 'plaster' | 'timber';
  accent: number;
  postId?: string;
  floor?: number;
  style: TownBuildingStyle;
  special?: TownSpecialStyle;
  seedIndex: number;
  seriesPostIds?: string[];
}

export interface LayoutPost {
  id: string;
  series?: string;
  seriesIndex?: number;
  date?: string;
}

export type TownEntityKind = 'farm' | 'fence' | 'shrub';

export interface TownEntity {
  id: string;
  kind: TownEntityKind;
  x: number;
  z: number;
  width: number;
  depth: number;
  rotation?: number;
}

export interface TownLayout {
  seed: string;
  regions: WorldRegion[];
  entities: TownEntity[];
  plots: TownPlot[];
  /** All collision-reserved article lots, including currently empty lots. */
  reservedPlots: TownPlot[];
  center: Point;
}

// Article plots can now use the quiet outer field as well as the town core.
// This is still kept just inside the diorama edge so every building retains a
// small grass margin and never clips the raised board wall. Existing ground
// bricks and decorations are not removed: layout is calculated before the
// world renderer and the same occupancy contract makes the reservation win.
export const visibleBuildingBounds = {
  minX: -31.0,
  maxX: 31.0,
  minZ: -25.0,
  maxZ: 25.0,
};

const worldBounds: WorldRegion = {
  id: 'world-buildable',
  kind: 'buildable',
  polygon: [{ x: -32.4, z: -26.6 }, { x: 32.4, z: -26.6 }, { x: 32.4, z: 26.6 }, { x: -32.4, z: 26.6 }],
};

const catmullRomPoint = (p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point => {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    z: 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
  };
};

const samplePath = (points: Point[], detail = 6) => {
  const samples: Point[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    for (let step = 0; step < detail; step += 1) samples.push(catmullRomPoint(p0, p1, p2, p3, step / detail));
  }
  samples.push(points[points.length - 1]);
  return samples;
};

const corridorPolygon = (centerline: Point[], halfWidth: number): Point[] => {
  const samples = samplePath(centerline);
  const left: Point[] = [];
  const right: Point[] = [];
  samples.forEach((point, index) => {
    const previous = samples[Math.max(0, index - 1)];
    const next = samples[Math.min(samples.length - 1, index + 1)];
    const tangentX = next.x - previous.x;
    const tangentZ = next.z - previous.z;
    const length = Math.hypot(tangentX, tangentZ) || 1;
    const normalX = -tangentZ / length;
    const normalZ = tangentX / length;
    const taper = index === 0 || index === samples.length - 1 ? 0.84 : 1;
    left.push({ x: point.x + normalX * halfWidth * taper, z: point.z + normalZ * halfWidth * taper });
    right.push({ x: point.x - normalX * halfWidth * taper, z: point.z - normalZ * halfWidth * taper });
  });
  return [...left, ...right.reverse()];
};

export const riverCenterline: Point[] = [
  { x: -18.8, z: -30 }, { x: -15.1, z: -17.4 }, { x: -13.7, z: -12.2 }, { x: -12.0, z: -8.4 },
  { x: -11.5, z: -4.4 }, { x: -10.8, z: -0.7 }, { x: -9.2, z: 3.6 }, { x: -8.2, z: 8.0 },
  { x: -7.3, z: 13.8 }, { x: -8.8, z: 22.5 }, { x: -10.0, z: 32 },
].map(point => ({ x: point.x + 3.0, z: point.z }));

export const roadCenterlines: Record<string, Point[]> = {
  main: [{ x: -0.7, z: -36 }, { x: 0.15, z: -15 }, { x: 0.3, z: -10.5 }, { x: 0.8, z: -6 }, { x: 0.35, z: -1.8 }, { x: 0.2, z: 2.5 }, { x: -0.5, z: 7.2 }, { x: -1.65, z: 11.4 }, { x: -2.4, z: 36 }],
  // Branch roads overshoot the board so their paved surface is clipped by
  // the diorama edge instead of stopping in the field.
  east: [{ x: 0.1, z: 0.1 }, { x: 3.7, z: 0.4 }, { x: 7.6, z: 1.2 }, { x: 11.4, z: 2.2 }, { x: 15, z: 3.8 }, { x: 38, z: 11.8 }],
  west: [{ x: -0.2, z: 0 }, { x: -3.5, z: -1.1 }, { x: -6.9, z: -2.8 }, { x: -10.2, z: -4.5 }, { x: -13.4, z: -6.6 }, { x: -38, z: -14.2 }],
  north: [{ x: -0.8, z: 4.2 }, { x: 1.1, z: 6.3 }, { x: 3.5, z: 8.7 }, { x: 5.8, z: 11.2 }, { x: 7.2, z: 13.8 }, { x: 14.8, z: 34 }],
};

export const roadWidths = { main: 1.72, east: 1.6, west: 1.56, north: 1.64 } as const;
export const riverWidth = 1.96;

// A narrow loop keeps moving characters on the edge of the central plaza
// instead of sending them through the well and benches. The first point is
// the south gate, then the route travels clockwise around the east side to
// the north gate. The final repeated point closes the rendered corridor.
export const townCenterRing: Point[] = [
  { x: 0.31, z: -2.20 },
  { x: 1.30, z: -1.79 },
  { x: 2.06, z: -0.75 },
  { x: 2.20, z: 0.31 },
  { x: 1.79, z: 1.33 },
  { x: 0.81, z: 2.06 },
  { x: -0.31, z: 2.20 },
  { x: -1.46, z: 1.68 },
  { x: -2.13, z: 0.57 },
  { x: -2.13, z: -0.57 },
  { x: -1.46, z: -1.68 },
  { x: -0.68, z: -2.10 },
  { x: 0.31, z: -2.20 },
];
export const townCenterRingWidth = 0.66;
// Visual road disk under the plaza. The plaza is rendered above this disk,
// while the larger disk edge meets the four existing road branches.
export const townCenterRoundaboutRadius = 2.28;
export const townCenterRingConnectors: Point[][] = [[townCenterRing[6], roadCenterlines.north[0]]];

// These are the routes used by pedestrians. They reuse the authored road
// exits but replace the plaza-crossing center sections with the
// ring's outer arc. Keeping them data-driven also gives the spatial verifier a
// single source of truth for the movement network.
export const townTravelRoutes: Record<string, Point[]> = {
  // South main road -> the east side of the ring -> north main road.
  main: [
    ...roadCenterlines.main.slice(0, 4),
    townCenterRing[0], townCenterRing[1], townCenterRing[2], townCenterRing[3], townCenterRing[4], townCenterRing[5], townCenterRing[6],
    ...roadCenterlines.main.slice(5),
  ],
  // East road -> the north side of the ring -> north road.
  east: [
    ...roadCenterlines.east.slice(1).reverse(),
    townCenterRing[3], townCenterRing[4], townCenterRing[5], townCenterRing[6],
    roadCenterlines.north[0], ...roadCenterlines.north.slice(1),
  ],
  // West road -> the south side of the ring -> south main road.
  west: [
    ...roadCenterlines.west.slice(1).reverse(),
    townCenterRing[9], townCenterRing[10], townCenterRing[11], townCenterRing[0],
    ...roadCenterlines.main.slice(0, 4).reverse(),
  ],
  // North road -> the west side of the ring -> west road.
  north: [
    ...roadCenterlines.north.slice(1).reverse(),
    roadCenterlines.north[0], townCenterRing[6], townCenterRing[7], townCenterRing[8], townCenterRing[9],
    ...roadCenterlines.west.slice(1),
  ],
};

const river: WorldRegion = {
  id: 'river-west',
  kind: 'river',
  polygon: corridorPolygon(riverCenterline, riverWidth / 2),
};

const forest: WorldRegion = {
  id: 'pine-grove-east',
  kind: 'forest',
  polygon: [{ x: 9.1, z: 6.6 }, { x: 17.2, z: 6.3 }, { x: 17.8, z: 14.6 }, { x: 7.2, z: 14.4 }, { x: 7.1, z: 9.4 }],
};

const northGrove: WorldRegion = {
  id: 'north-grove',
  kind: 'forest',
  polygon: [{ x: -16.6, z: 9.5 }, { x: -11.6, z: 10.2 }, { x: -10.4, z: 14.8 }, { x: -17.5, z: 14.9 }],
};

const southOrchard: WorldRegion = {
  id: 'south-orchard',
  kind: 'forest',
  polygon: [{ x: 7.5, z: -14.6 }, { x: 12.1, z: -14.2 }, { x: 12.6, z: -11.1 }, { x: 9.9, z: -10.2 }, { x: 7.2, z: -11.8 }],
};


const roads: WorldRegion[] = [
  { id: 'road-main', kind: 'road', polygon: corridorPolygon(roadCenterlines.main, roadWidths.main / 2) },
  { id: 'road-branch-east', kind: 'road', polygon: corridorPolygon(roadCenterlines.east, roadWidths.east / 2) },
  { id: 'road-branch-west', kind: 'road', polygon: corridorPolygon(roadCenterlines.west, roadWidths.west / 2) },
  { id: 'road-north', kind: 'road', polygon: corridorPolygon(roadCenterlines.north, roadWidths.north / 2) },
  { id: 'road-town-center-ring', kind: 'road', polygon: corridorPolygon(townCenterRing, townCenterRingWidth / 2) },
  ...townCenterRingConnectors.map((path, index) => ({ id: `road-town-center-connector-${index}`, kind: 'road' as const, polygon: corridorPolygon(path, townCenterRingWidth / 2) })),
];

const landmark: WorldRegion = {
  id: 'town-center',
  kind: 'landmark',
  polygon: [{ x: -3.1, z: -3.1 }, { x: 3.1, z: -3.1 }, { x: 3.1, z: 3.1 }, { x: -3.1, z: 3.1 }],
};

// These are authored scene entities, not decorative afterthoughts. They are
// shared by the renderer and the article plot allocator so a new house cannot
// be placed through a farm bed, fence, or fixed shrub cluster.
export const townEntities: TownEntity[] = [
  { id: 'farm-west', kind: 'farm', x: 5.7, z: -7.7, width: 2.5, depth: 1.55, rotation: 0.12 },
  { id: 'farm-south', kind: 'farm', x: 8.8, z: -6.8, width: 2.7, depth: 1.6, rotation: 0.12 },
  { id: 'farm-north-east', kind: 'farm', x: 8.4, z: 5.4, width: 3.0, depth: 1.65, rotation: 0.12 },
  { id: 'fence-west-edge', kind: 'fence', x: -2.8, z: 5.0, width: 2.0, depth: 0.32, rotation: -0.2 },
  { id: 'fence-east-edge', kind: 'fence', x: 7.75, z: -5.25, width: 2.5, depth: 0.32, rotation: 0.28 },
  { id: 'shrub-west-1', kind: 'shrub', x: -6.2, z: -8.8, width: 1.15, depth: 1.0 },
  { id: 'shrub-west-2', kind: 'shrub', x: -6.3, z: -10.8, width: 1.15, depth: 1.0 },
  { id: 'shrub-east-1', kind: 'shrub', x: 8.5, z: -8.5, width: 1.15, depth: 1.0 },
  { id: 'shrub-east-2', kind: 'shrub', x: 9.75, z: 3.25, width: 1.15, depth: 1.0 },
  { id: 'shrub-north-1', kind: 'shrub', x: -7.25, z: 8.5, width: 1.15, depth: 1.0 },
  { id: 'shrub-north-2', kind: 'shrub', x: 6.5, z: 9.5, width: 1.15, depth: 1.0 },
];

export const worldRegions: WorldRegion[] = [worldBounds, river, forest, northGrove, southOrchard, ...roads, landmark];

const pointInPolygon = (point: Point, polygon: Point[]) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersect = ((a.z > point.z) !== (b.z > point.z)) && point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
};

const polygonBounds = (polygon: Point[]) => ({
  minX: Math.min(...polygon.map((point) => point.x)),
  maxX: Math.max(...polygon.map((point) => point.x)),
  minZ: Math.min(...polygon.map((point) => point.z)),
  maxZ: Math.max(...polygon.map((point) => point.z)),
});

const overlaps = (a: { x: number; z: number; width: number; depth: number }, b: { x: number; z: number; width: number; depth: number }) =>
  Math.abs(a.x - b.x) < (a.width + b.width) / 2 + BUILDING_GAP && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 + BUILDING_GAP;

const intersectsRegion = (plot: { x: number; z: number; width: number; depth: number }, region: WorldRegion) => {
  const bounds = polygonBounds(region.polygon);
  if (plot.x + plot.width / 2 < bounds.minX || plot.x - plot.width / 2 > bounds.maxX || plot.z + plot.depth / 2 < bounds.minZ || plot.z - plot.depth / 2 > bounds.maxZ) return false;
  const corners = [
    { x: plot.x - plot.width / 2, z: plot.z - plot.depth / 2 },
    { x: plot.x + plot.width / 2, z: plot.z - plot.depth / 2 },
    { x: plot.x + plot.width / 2, z: plot.z + plot.depth / 2 },
    { x: plot.x - plot.width / 2, z: plot.z + plot.depth / 2 },
  ];
  return corners.some((corner) => pointInPolygon(corner, region.polygon)) || pointInPolygon({ x: plot.x, z: plot.z }, region.polygon);
};

export const isBuildablePlot = (plot: { x: number; z: number; width: number; depth: number }, occupied: Array<{ x: number; z: number; width: number; depth: number }>) => {
  const insideVisibleBand = plot.x - plot.width / 2 >= visibleBuildingBounds.minX
    && plot.x + plot.width / 2 <= visibleBuildingBounds.maxX
    && plot.z - plot.depth / 2 >= visibleBuildingBounds.minZ
    && plot.z + plot.depth / 2 <= visibleBuildingBounds.maxZ;
  if (!insideVisibleBand || !pointInPolygon({ x: plot.x, z: plot.z }, worldBounds.polygon)) return false;
  if ([river, forest, northGrove, southOrchard, ...roads, landmark].some((region) => intersectsRegion(plot, region))) return false;
  if (townEntities.some((entity) => overlaps(plot, entity))) return false;
  return !occupied.some((other) => overlaps(plot, other));
};

const hashSeed = (seed: string) => [...seed].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 2166136261);
const rngFor = (seed: string) => {
  let state = hashSeed(seed);
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const normalBuildingStyles: Array<{ style: Exclude<TownBuildingStyle, TownSpecialStyle>; roof: TownPlot['roof']; walls: TownPlot['walls'] }> = [
  { style: 'cottage', roof: 'gable', walls: 'plaster' },
  { style: 'townhouse', roof: 'gable', walls: 'timber' },
  { style: 'stonehouse', roof: 'hip', walls: 'stone' },
  { style: 'villa', roof: 'hip', walls: 'plaster' },
  { style: 'rowhouse', roof: 'flat', walls: 'timber' },
  { style: 'workshop', roof: 'flat', walls: 'stone' },
];

const specialBuildingStyles: Array<{ style: TownSpecialStyle; roof: TownPlot['roof']; walls: TownPlot['walls'] }> = [
  { style: 'shop', roof: 'hip', walls: 'timber' },
  { style: 'forge', roof: 'flat', walls: 'stone' },
  { style: 'inn', roof: 'gable', walls: 'plaster' },
  { style: 'watchtower', roof: 'flat', walls: 'stone' },
  { style: 'chapel', roof: 'gable', walls: 'plaster' },
  { style: 'windmill', roof: 'gable', walls: 'timber' },
  { style: 'clocktower', roof: 'flat', walls: 'stone' },
];

const pickBuildingStyle = (random: () => number, index: number) => {
  // Special landmarks remain uncommon so the town keeps a believable skyline.
  const special = random() < 0.11;
  const catalog = special ? specialBuildingStyles : normalBuildingStyles;
  return catalog[(index + Math.floor(random() * catalog.length)) % catalog.length];
};

const groupPosts = (posts: LayoutPost[]) => {
  const groups: LayoutPost[][] = [];
  const seriesGroups = new Map<string, LayoutPost[]>();
  posts.forEach((post) => {
    if (!post.series) {
      groups.push([post]);
      return;
    }
    const key = post.series;
    const group = seriesGroups.get(key) ?? [];
    group.push(post);
    seriesGroups.set(key, group);
  });
  seriesGroups.forEach((group) => groups.push([...group].sort((a, b) => (a.seriesIndex ?? 0) - (b.seriesIndex ?? 0))));
  return groups;
};

const visibleSlots: Point[] = [
  { x: -7.6, z: -5.8 }, { x: -6.0, z: -5.8 }, { x: -4.4, z: -5.8 }, { x: -2.8, z: -5.8 },
  { x: 3.0, z: -5.8 }, { x: 4.6, z: -5.8 }, { x: 6.2, z: -5.8 }, { x: 7.8, z: -5.8 },
  { x: -7.6, z: -2.2 }, { x: -6.0, z: -2.2 }, { x: -4.4, z: -2.2 }, { x: 3.0, z: -2.2 },
  { x: 4.6, z: -2.2 }, { x: 6.2, z: -2.2 }, { x: 7.8, z: -2.2 },
  { x: -7.6, z: 1.4 }, { x: -6.0, z: 1.4 }, { x: -4.4, z: 1.4 }, { x: -2.8, z: 1.4 },
  { x: 3.0, z: 1.4 }, { x: 4.6, z: 1.4 }, { x: 6.2, z: 1.4 }, { x: 7.8, z: 1.4 },
  { x: -6.8, z: 5.0 }, { x: -5.2, z: 5.0 }, { x: -3.6, z: 5.0 }, { x: 2.2, z: 5.0 },
  { x: 3.8, z: 5.0 }, { x: 5.4, z: 5.0 }, { x: 7.0, z: 5.0 },
];

export const createTownLayout = (seed = 'river-bend-demo-v2', posts: LayoutPost[] = []): TownLayout => {
  const random = rngFor(seed);
  const groups = groupPosts(posts);
  const occupied: TownPlot[] = [];
  const plots: TownPlot[] = [];
  const roofs: TownPlot['roof'][] = ['gable', 'hip', 'flat'];
  const walls: TownPlot['walls'][] = ['stone', 'plaster', 'timber'];
  const plotWidth = 2.16;
  const plotDepth = 1.80;
  const gridStep = 0.36;
  const gridMinX = visibleBuildingBounds.minX + plotWidth / 2;
  const gridMaxX = visibleBuildingBounds.maxX - plotWidth / 2;
  const gridMinZ = visibleBuildingBounds.minZ + plotDepth / 2;
  const gridMaxZ = visibleBuildingBounds.maxZ - plotDepth / 2;
  const expandedSlots: Point[] = [];
  for (let x = gridMinX; x <= gridMaxX + 1e-6; x += gridStep) {
    for (let z = gridMinZ; z <= gridMaxZ + 1e-6; z += gridStep) expandedSlots.push({ x: Number(x.toFixed(4)), z: Number(z.toFixed(4)) });
  }
  const uniqueSlots = new Map<string, Point>();
  [...visibleSlots, ...expandedSlots].forEach((slot) => uniqueSlots.set(`${slot.x.toFixed(4)}:${slot.z.toFixed(4)}`, slot));
  const slotRandom = rngFor(`${seed}:plot-order`);
  const ringWidth = 7.5;
  const candidates = [...uniqueSlots.values()]
    .map((slot, slotIndex) => ({ slot, slotIndex, distance: Math.hypot(slot.x, slot.z), ring: Math.floor(Math.hypot(slot.x, slot.z) / ringWidth), jitter: slotRandom() }))
    .sort((a, b) => a.ring - b.ring || a.distance + a.jitter * 1.8 - (b.distance + b.jitter * 1.8) || a.slotIndex - b.slotIndex);

  // Estimate how many safely spaced plots each ring can hold. This is only a
  // layout metric; it does not create buildings or touch the rendered world.
  const ringCapacity = new Map<number, number>();
  const ringCandidates = new Map<number, typeof candidates>();
  candidates.forEach((candidate) => ringCandidates.set(candidate.ring, [...(ringCandidates.get(candidate.ring) ?? []), candidate]));
  ringCandidates.forEach((ringSlots, ring) => {
    const ringOccupied: Array<{ x: number; z: number; width: number; depth: number }> = [];
    for (const candidate of ringSlots) {
      const footprint = { x: candidate.slot.x, z: candidate.slot.z, width: plotWidth, depth: plotDepth };
      if (!isBuildablePlot(footprint, ringOccupied)) continue;
      ringOccupied.push(footprint);
    }
    ringCapacity.set(ring, ringOccupied.length);
  });

  let unlockedRing = 0;
  const ringOccupied = new Map<number, number>();
  const unlockThreshold = 0.58;
  groups.forEach((group, groupIndex) => {
    let candidate = candidates.find(({ slot, ring }) => ring <= unlockedRing && isBuildablePlot({ x: slot.x, z: slot.z, width: plotWidth, depth: plotDepth }, occupied));
    while (!candidate && unlockedRing < Math.max(...ringCapacity.keys())) {
      unlockedRing += 1;
      candidate = candidates.find(({ slot, ring }) => ring <= unlockedRing && isBuildablePlot({ x: slot.x, z: slot.z, width: plotWidth, depth: plotDepth }, occupied));
    }
    const slot = candidate?.slot;
    if (!slot) throw new Error(`No collision-free article building lot remains for article group ${groupIndex + 1}.`);
    const style = pickBuildingStyle(random, groupIndex);
    const plot: TownPlot = {
      id: `article-building-${groupIndex + 1}`,
      x: slot.x, z: slot.z, width: plotWidth, depth: plotDepth,
      roof: style.roof ?? roofs[(groupIndex + random() * roofs.length) % roofs.length | 0],
      walls: style.walls ?? walls[(groupIndex + random() * walls.length) % walls.length | 0],
      accent: groupIndex % 4, style: style.style, postId: group[0].id,
      special: specialBuildingStyles.some((candidate) => candidate.style === style.style) ? style.style as TownSpecialStyle : undefined,
      seedIndex: groupIndex, seriesPostIds: group.length > 1 ? group.map((post) => post.id) : undefined,
    };
    occupied.push(plot); plots.push(plot);
    const placedRing = candidate?.ring ?? 0;
    ringOccupied.set(placedRing, (ringOccupied.get(placedRing) ?? 0) + 1);
    const capacity = ringCapacity.get(placedRing) ?? 0;
    if (capacity > 0 && (ringOccupied.get(placedRing) ?? 0) / capacity >= unlockThreshold) unlockedRing = Math.max(unlockedRing, placedRing + 1);
  });

  // Reserve empty lots using the exact same collision contract as article lots.
  // Empty lots are visible as clear space only; they never become buildings.
  const reservedPlots = [...plots];
  for (const { slot } of candidates) {
    // Keep a generous logical buffer ahead of the current article count. The
    // full candidate field is still available to future layouts, while this
    // buffer protects the currently rendered world from decorative overlap.
    if (reservedPlots.length >= Math.max(96, groups.length + 48)) break;
    if (!isBuildablePlot({ x: slot.x, z: slot.z, width: plotWidth, depth: plotDepth }, reservedPlots)) continue;
    reservedPlots.push({
      id: `reserved-building-lot-${reservedPlots.length + 1}`,
      x: slot.x, z: slot.z, width: plotWidth, depth: plotDepth,
      roof: 'gable', walls: 'plaster', accent: reservedPlots.length % 4, style: 'cottage',
      seedIndex: reservedPlots.length,
    });
  }
  return { seed, regions: worldRegions, entities: townEntities, plots, reservedPlots, center: { x: 0, z: 0 } };
};
