
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

export interface LayoutFriend {
  id: string;
}

export interface LayoutDiaryEntry {
  id: string;
  /** ISO date; used to place month markers and to order the lane. */
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

export type TownFeatureKind = 'about';

export interface TownFeature {
  id: string;
  kind: TownFeatureKind;
  x: number;
  z: number;
  width: number;
  depth: number;
  /** Yaw in radians so a landmark can face the diorama camera. */
  rotation?: number;
  title: string;
  summary: string;
  href: string;
}

/**
 * A friend's house in the outlying hamlet. Huts are laid out on an arc east of
 * the town core so the settlement reads as a separate neighbourhood instead of
 * another row of article buildings.
 */
export interface TownFriendHut {
  /** Matches FriendLink.id in the site config. */
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  rotation: number;
  accent: number;
}

export interface TownHamlet {
  id: string;
  kind: 'friends';
  x: number;
  z: number;
  radius: number;
  huts: TownFriendHut[];
  /** Dirt track from the town's east side into the hamlet green. */
  path: Point[];
  /** Rectangular reservation that keeps article lots and props out of the hamlet. */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

/**
 * One notice board in the diary district. Each short note gets its own board,
 * mirroring how every article gets its own building: the town stays readable
 * as "one place, one entry" instead of hiding all notes behind a single prop.
 */
export interface TownDiaryBoard {
  /** Matches DiaryEntry.id. */
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  rotation: number;
  /** Lean in radians; older boards lean, archived ones lean furthest. */
  tilt: number;
  /** Stable accent index so a board keeps its colour across builds. */
  accent: number;
  /**
   * Which piece of street furniture this board uses. Varying the silhouette
   * keeps a district of nine boards from looking like a row of identical
   * official notices.
   */
  form: 'board' | 'cork' | 'chalk' | 'awning';
  /** How weathered the board is; drives geometry, not just colour. */
  state: 'new' | 'mid' | 'old' | 'archived';
}

/** A brick digit marker that divides the diary lane by month. */
export interface TownDiaryMonthMarker {
  /** YYYY-MM key. */
  key: string;
  /** Month number, 1-12. */
  month: number;
  x: number;
  z: number;
  rotation: number;
}

export interface TownDiaryDistrict {
  id: string;
  kind: 'diary';
  x: number;
  z: number;
  boards: TownDiaryBoard[];
  /** Notes that no longer fit on the lane, filed at its far end. */
  archived: TownDiaryBoard[];
  /** Month markers standing between the two board rows. */
  months: TownDiaryMonthMarker[];
  /** The single civic board used by the compact layout. */
  singleBoard: TownDiaryBoard;
  /** Dirt lane that connects the quarter to the town. */
  path: Point[];
  /** Bounds that keep article lots and props out of the district. */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

/**
 * How the diary appears in the town. `district` gives every note its own board;
 * `single` keeps one civic notice board beside the windmill that opens the
 * diary page. Both are supported so the layout can be switched without
 * rewriting the scene.
 */
export type DiaryLayoutMode = 'district' | 'single';

export interface TownLayout {
  seed: string;
  regions: WorldRegion[];
  entities: TownEntity[];
  plots: TownPlot[];
  /** All collision-reserved article lots, including currently empty lots. */
  reservedPlots: TownPlot[];
  /** Non-article landmarks such as About or future civic buildings. */
  features: TownFeature[];
  /** Outlying friend hamlet, when the site has friend links. */
  hamlet?: TownHamlet;
  /** Diary notice-board district, when the site has short notes. */
  diary?: TownDiaryDistrict;
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

export const townFeatures: TownFeature[] = [
  {
    id: 'about',
    kind: 'about',
    x: 0,
    z: 0,
    width: 2.24,
    depth: 2.00,
    title: '关于',
    summary: '关于这个博客，以及这座积木小镇。',
    href: '/about/',
  },
];

// The hamlet sits outside the default diorama framing on purpose: the town is
// already full, and the agreed interaction is "choose a neighbour, then the
// camera travels out to their house". It still stays inside the camera pan
// bounds so every hut can be centred.
const HAMLET_CENTER = { x: 21.5, z: -16.5 };
const HAMLET_RADIUS = 6.2;
// A shallow south-facing cul-de-sac: the middle huts sit furthest south while
// the two ends curl back toward the town, so the settlement opens toward the
// plaza instead of closing into a second ring.
const HAMLET_START_ANGLE = Math.PI * 200 / 180;
const HAMLET_END_ANGLE = Math.PI * 340 / 180;
const HAMLET_HUT_WIDTH = 1.44;
const HAMLET_HUT_DEPTH = 1.08;

// Leaves the town near the south-east corner of the built-up area, clears the
// orchard, then curves into the hamlet green.
const HAMLET_PATH: Point[] = [
  { x: 6.4, z: -12.6 },
  { x: 9.6, z: -13.6 },
  { x: 12.4, z: -14.6 },
  { x: 15.0, z: -15.6 },
  { x: 17.4, z: -16.4 },
  { x: 19.6, z: -16.6 },
];

const hamletBoundsFor = (center: Point, radius: number) => ({
  minX: center.x - radius - HAMLET_HUT_WIDTH,
  maxX: center.x + radius + HAMLET_HUT_WIDTH,
  minZ: center.z - radius - HAMLET_HUT_WIDTH,
  maxZ: center.z + radius + HAMLET_HUT_WIDTH,
});

/**
 * Lays the friend hamlet on a shallow arc east of the town core. Huts face the
 * town centre so the settlement reads as a row of neighbours looking back at
 * the plaza rather than a second ring of article buildings.
 */
export const createTownHamlet = (friendIds: string[]): TownHamlet | undefined => {
  if (!friendIds.length) return undefined;
  const span = HAMLET_START_ANGLE - HAMLET_END_ANGLE;
  const huts: TownFriendHut[] = friendIds.map((id, index) => {
    const t = friendIds.length === 1 ? 0.5 : index / (friendIds.length - 1);
    const angle = HAMLET_START_ANGLE - span * t;
    const x = HAMLET_CENTER.x + Math.cos(angle) * HAMLET_RADIUS;
    const z = HAMLET_CENTER.z + Math.sin(angle) * HAMLET_RADIUS;
    return {
      id,
      x: Number(x.toFixed(3)),
      z: Number(z.toFixed(3)),
      width: HAMLET_HUT_WIDTH,
      depth: HAMLET_HUT_DEPTH,
      // Face the hamlet's own green so the row reads as a shared courtyard.
      rotation: Math.atan2(HAMLET_CENTER.x - x, HAMLET_CENTER.z - z),
      accent: index % 5,
    };
  });
  return {
    id: 'friend-hamlet',
    kind: 'friends',
    x: HAMLET_CENTER.x,
    z: HAMLET_CENTER.z,
    radius: HAMLET_RADIUS,
    huts,
    path: HAMLET_PATH,
    bounds: hamletBoundsFor(HAMLET_CENTER, HAMLET_RADIUS),
  };
};

// Diary boards line the outer stretch of the east road, below the friend
// hamlet on screen. The newest note sits closest to town and time recedes down
// the lane. A single straight row on the far verge reads as one quiet line of
// notices well clear of the plaza.
const DIARY_BOARD_WIDTH = 1.3;
const DIARY_BOARD_DEPTH = 0.66;
const DIARY_FORMS: TownDiaryBoard['form'][] = ['board', 'cork', 'chalk', 'awning'];
// Distance from the road centreline to the single board line. The row stands on
// the far verge, well clear of both the carriageway and the houses, so the
// notices read as a quiet row on the edge of town.
const DIARY_ROW_OFFSET = 2.6;
// The board line runs parallel to the road axis rather than following its
// curve, so all nine notices sit on one genuinely straight line.
const DIARY_LINE_ORIGIN = { x: 0.1, z: 0.1 } as const;
const DIARY_LINE_END = { x: 38, z: 11.8 } as const;
// The lane begins out past the last plaza frontage so the row sits on the
// quiet outer road instead of hugging the town buildings. The wider pitch
// leaves visible grass between boards.
const DIARY_LANE_START = 13.0;
const DIARY_LANE_END_PAD = 2.0;
const DIARY_LANE_STEP = 1.9;
// The row is a readable strip, not an endless fence: anything past this many
// notices is filed into the archive cluster at the end of the lane.
const DIARY_MAX_BOARDS = 9;
const DIARY_ARCHIVE_OFFSET = 1.9;
const DIARY_ARCHIVE_STEP = 0.9;
const DIARY_ARCHIVE_TILT = 0.21;

/** One civic notice board beside the windmill, used in \`single\` mode. */
export const DIARY_SINGLE_BOARD = { x: -1.2, z: 4.3, width: 1.62, depth: 0.70 } as const;


const DIARY_SINGLE: TownDiaryBoard = {
  id: 'diary-all',
  x: DIARY_SINGLE_BOARD.x,
  z: DIARY_SINGLE_BOARD.z,
  width: DIARY_SINGLE_BOARD.width,
  depth: DIARY_SINGLE_BOARD.depth,
  // Face the plaza's south approach, matching the surrounding houses.
  rotation: 0,
  tilt: 0,
  accent: 0,
  form: 'board',
  state: 'new',
};


/**
 * Both diary layouts are always present in the data. The scene renders one of
 * them based on the visitor's choice, so switching never has to rebuild the
 * town or move an article building.
 */
export const createTownDiaryDistrict = (entries: LayoutDiaryEntry[], existingPlots: TownPlot[] = []): TownDiaryDistrict | undefined => {
  if (!entries.length) return undefined;

  // Walk the east road and keep only slots that clear every article building
  // and prop. The row itself stays on a fixed line so the pitch is even.
  const slots: { along: number; x: number; z: number }[] = [];
  // Being on the far side of the road is not enough: this is an isometric
  // diorama, so a tall house hides everything standing behind it on screen.
  // Ground-level distance checks miss that entirely, so the test is done in
  // screen space: project the board and every building, and reject the spot
  // when a nearer building's silhouette covers it.
  const DIORAMA_ALPHA = Math.PI * 0.68;
  const DIORAMA_BETA = 0.96;
  const cosA = Math.cos(DIORAMA_ALPHA), sinA = Math.sin(DIORAMA_ALPHA);
  const cosB = Math.cos(DIORAMA_BETA), sinB = Math.sin(DIORAMA_BETA);
  // Orthographic screen axes derived from the ArcRotate camera basis.
  const screenOf = (x: number, y: number, z: number) => ({
    x: -x * sinA + z * cosA,
    y: -x * cosA * cosB + y * sinB - z * sinA * cosB,
    depth: -x * cosA * sinB + y * cosB + z * sinA * sinB,
  });
  const BOARD_HEIGHT = 3.0;
  const FLOOR_HEIGHT_ESTIMATE = 1.512;
  const buildingHeight = (plot: TownPlot) => {
    const floors = Math.max(1, plot.seriesPostIds?.length ?? 1);
    return 1.2 + floors * FLOOR_HEIGHT_ESTIMATE + 1.0;
  };
  const rectOf = (x: number, z: number, width: number, depth: number, height: number) => {
    const halfW = width / 2, halfD = depth / 2;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minDepth = Infinity, maxDepth = -Infinity;
    for (const dx of [-halfW, halfW]) {
      for (const dz of [-halfD, halfD]) {
        for (const dy of [0, height]) {
          const p = screenOf(x + dx, dy, z + dz);
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
          minDepth = Math.min(minDepth, p.depth); maxDepth = Math.max(maxDepth, p.depth);
        }
      }
    }
    return { minX, maxX, minY, maxY, minDepth, maxDepth };
  };
  const boardRect = (x: number, z: number) =>
    rectOf(x, z, DIARY_BOARD_WIDTH, DIARY_BOARD_DEPTH, BOARD_HEIGHT);
  const occludedByBuilding = (x: number, z: number) => {
    const board = boardRect(x, z);
    for (const plot of existingPlots) {
      const building = rectOf(plot.x, plot.z, plot.width, plot.depth, buildingHeight(plot));
      // A building only hides the board if it is in front of it and their
      // silhouettes actually overlap. The margin keeps a hair of the board's
      // own frame from being clipped.
      if (building.minDepth <= board.maxDepth) continue;
      const overlapX = Math.min(board.maxX, building.maxX) - Math.max(board.minX, building.minX);
      const overlapY = Math.min(board.maxY, building.maxY) - Math.max(board.minY, building.minY);
      if (overlapX > 0.15 && overlapY > 0.15) return true;
    }
    return false;
  };
  const blocked = (x: number, z: number) => {
    if (Math.hypot(x, z) < 4.4) return true;
    for (const plot of existingPlots) {
      if (Math.abs(x - plot.x) < (DIARY_BOARD_WIDTH + plot.width) / 2 + 0.28
        && Math.abs(z - plot.z) < (DIARY_BOARD_DEPTH + plot.depth) / 2 + 0.28) return true;
    }
    for (const entity of townEntities) {
      if (Math.abs(x - entity.x) < (DIARY_BOARD_WIDTH + entity.width) / 2 + 0.2
        && Math.abs(z - entity.z) < (DIARY_BOARD_DEPTH + entity.depth) / 2 + 0.2) return true;
    }
    // Keep clear of the road surface, the river and every branch/ring corridor.
    for (const region of worldRegions) {
      if (region.kind !== 'road' && region.kind !== 'river') continue;
      if (pointInPolygon({ x, z }, region.polygon)) return true;
    }
    return false;
  };
  // Every board sits on one genuinely straight line out in the orchard field,
  // parallel to the road rather than following its curve. A constant pitch
  // keeps the row evenly spaced, and the line stays far enough from the houses
  // that no facade can hide a notice.
  const lineDx = DIARY_LINE_END.x - DIARY_LINE_ORIGIN.x;
  const lineDz = DIARY_LINE_END.z - DIARY_LINE_ORIGIN.z;
  const lineLength = Math.hypot(lineDx, lineDz);
  const lineUx = lineDx / lineLength;
  const lineUz = lineDz / lineLength;
  // Normal that points away from the camera, so the row lands behind the lane
  // instead of between the houses that front it.
  const normalX = lineUz;
  const normalZ = -lineUx;
  const spaced: typeof slots = [];
  for (let index = 0; ; index += 1) {
    const along = DIARY_LANE_START + index * DIARY_LANE_STEP;
    if (along > lineLength - DIARY_LANE_END_PAD) break;
    const x = DIARY_LINE_ORIGIN.x + lineUx * along + normalX * DIARY_ROW_OFFSET;
    const z = DIARY_LINE_ORIGIN.z + lineUz * along + normalZ * DIARY_ROW_OFFSET;
    if (blocked(x, z)) continue;
    if (occludedByBuilding(x, z)) continue;
    spaced.push({ along, x, z });
  }
  const capacity = Math.min(spaced.length, DIARY_MAX_BOARDS);
  spaced.length = capacity;

  const toBoard = (entry: LayoutDiaryEntry, slot: { x: number; z: number }, index: number): TownDiaryBoard => {
    const x = slot.x;
    const z = slot.z;
    const jitter = (index % 3) - 1;
    return {
      id: entry.id,
      x: Number(x.toFixed(3)),
      z: Number(z.toFixed(3)),
      width: DIARY_BOARD_WIDTH,
      depth: DIARY_BOARD_DEPTH,
      rotation: jitter * 0.05,
      tilt: 0,
      accent: index % 4,
      form: DIARY_FORMS[index % DIARY_FORMS.length],
      state: 'new',
    };
  };

  const activeEntries = entries.slice(0, capacity);
  const overflowEntries = entries.slice(capacity);

  // Split the notes that are actually present into thirds, so a short lane
  // still shows all three weathering tiers instead of only the fresh ones.
  const boardCount = activeEntries.length;
  const thirdSize = Math.max(1, Math.ceil(boardCount / 3));
  const boards = activeEntries.map((entry, index) => {
    const board = toBoard(entry, spaced[index], index);
    const third = Math.floor(index / thirdSize);
    board.state = third <= 0 ? 'new' : third === 1 ? 'mid' : 'old';
    board.tilt = board.state === 'new' ? 0 : board.state === 'mid' ? 0.026 : 0.052;
    return board;
  });

  // Archive cluster: the overflow is filed at the far end of the same line,
  // stacked outward from the road so it never runs past the diorama edge.
  // Boards lean and turn away from the street, so the cluster reads as "filed".
  const lastActive = spaced[spaced.length - 1];
  // Leave a visible gap after the last live board, then file the overflow in a
  // compact heap that steps away from the road.
  const archiveStart = (lastActive?.along ?? DIARY_LANE_START) + 2.6;
  const archived: TownDiaryBoard[] = overflowEntries.map((entry, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    // Heap outward across the road; each row sits further from the street.
    const along = Math.min(lineLength - 1.0, archiveStart - column * DIARY_ARCHIVE_STEP);
    const across = DIARY_ROW_OFFSET + DIARY_ARCHIVE_OFFSET + row * 0.78;
    const x = DIARY_LINE_ORIGIN.x + lineUx * along + normalX * across;
    const z = DIARY_LINE_ORIGIN.z + lineUz * along + normalZ * across;
    return {
      id: entry.id,
      x: Number(x.toFixed(3)),
      z: Number(z.toFixed(3)),
      width: DIARY_BOARD_WIDTH,
      depth: DIARY_BOARD_DEPTH,
      rotation: (index % 2 ? 1 : -1) * 0.31,
      tilt: DIARY_ARCHIVE_TILT,
      accent: index % 4,
      form: 'board',
      state: 'archived',
    };
  });

  const months: TownDiaryMonthMarker[] = [];
  for (let index = 1; index < activeEntries.length; index += 1) {
    const previousKey = (activeEntries[index - 1].date ?? '').slice(0, 7);
    const currentKey = (activeEntries[index].date ?? '').slice(0, 7);
    if (!currentKey || currentKey === previousKey) continue;
    const along = (spaced[index - 1].along + spaced[index].along) / 2;
    // Sit on the same straight line as the boards, a little further out, so the
    // divider reads as part of the row instead of drifting to the near verge.
    const offset = DIARY_ROW_OFFSET + 2.0;
    const x = DIARY_LINE_ORIGIN.x + lineUx * along + normalX * offset;
    const z = DIARY_LINE_ORIGIN.z + lineUz * along + normalZ * offset;
    months.push({
      key: currentKey,
      month: Number(currentKey.slice(5, 7)),
      x: Number(x.toFixed(3)),
      z: Number(z.toFixed(3)),
      rotation: 0,
    });
  }

  const all = [...boards, ...archived, ...months];
  const bounds = {
    minX: Math.min(...all.map((item) => item.x)) - 1.4,
    maxX: Math.max(...all.map((item) => item.x)) + 1.4,
    minZ: Math.min(...all.map((item) => item.z)) - 1.4,
    maxZ: Math.max(...all.map((item) => item.z)) + 1.4,
  };

  return {
    id: 'diary-district',
    kind: 'diary',
    // Anchor the district at the centre of its row so "outlying place" refers
    // to the whole strip, not just the note closest to town.
    x: Number(((bounds.minX + bounds.maxX) / 2).toFixed(3)),
    z: Number(((bounds.minZ + bounds.maxZ) / 2).toFixed(3)),
    boards,
    archived,
    months,
    singleBoard: DIARY_SINGLE,
    path: roadCenterlines.east,
    bounds,
  };
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
  // Nudged south so the diary lane keeps an unbroken row of notices along the
  // east road; it still fronts the same field corner.
  { id: 'shrub-east-2', kind: 'shrub', x: 9.75, z: 4.9, width: 1.15, depth: 1.0 },
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


const groupKey = (group: LayoutPost[]) => group[0].series ? `series:${group[0].series}` : `post:${group[0].id}`;

type StableArticlePlot = {
  id: string;
  order: number;
  x: number;
  z: number;
  roof: TownPlot['roof'];
  walls: TownPlot['walls'];
  accent: number;
  style: TownBuildingStyle;
};

// The formal blog already has a public town map. Keep these existing article
// groups pinned while new groups use the next available reserved lot.
const stableArticlePlots: Record<string, Record<string, StableArticlePlot>> = {
  'heavens-door-town-v1': {
    'post:post-first-service-outsourcing-competition': { id: 'article-building-1', order: 0, x: -4.36, z: 1.82, roof: 'hip', walls: 'plaster', accent: 0, style: 'villa' },
    'series:Obsidian': { id: 'article-building-2', order: 1, x: 4.28, z: -1.42, roof: 'flat', walls: 'timber', accent: 1, style: 'rowhouse' },
    'series:Hello, Blog!': { id: 'article-building-3', order: 2, x: -2.20, z: -4.66, roof: 'flat', walls: 'stone', accent: 2, style: 'workshop' },
  },
};

const stableGroupOrder = (group: LayoutPost[]) => {
  const dates = group.map((post) => post.date ? Date.parse(post.date) : Number.POSITIVE_INFINITY).filter(Number.isFinite);
  return dates.length ? Math.min(...dates) : Number.POSITIVE_INFINITY;
};
const stableBuildingStyle = (seed: string, key: string) => pickBuildingStyle(rngFor(`${seed}:article-style:${key}`), 0);

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

// Candidate geometry and per-ring capacity depend only on the town seed, not
// article content. Keep one prepared seed (bounded cache); never cache returned
// layouts, so content edits still rebuild article groups and reservations.
let preparedLots: ReturnType<typeof prepareLots> | undefined;
let preparedSeed: string | undefined;
function prepareLots(seed: string) {
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
    .map((slot, slotIndex) => ({ slot, slotIndex, distance: Math.hypot(slot.x, slot.z), ring: Math.floor(Math.hypot(slot.x, slot.z) / ringWidth), jitter: slotRandom(), buildable: isBuildablePlot({ x: slot.x, z: slot.z, width: plotWidth, depth: plotDepth }, []) }))
    .sort((a, b) => a.ring - b.ring || a.distance + a.jitter * 1.8 - (b.distance + b.jitter * 1.8) || a.slotIndex - b.slotIndex);

  // Estimate how many safely spaced plots each ring can hold. This is only a
  // layout metric; it does not create buildings or touch the rendered world.
  const ringCapacity = new Map<number, number>();
  const ringCandidates = new Map<number, typeof candidates>();
  for (const candidate of candidates) {
    let ringSlots = ringCandidates.get(candidate.ring);
    if (!ringSlots) { ringSlots = []; ringCandidates.set(candidate.ring, ringSlots); }
    ringSlots.push(candidate);
  }
  ringCandidates.forEach((ringSlots, ring) => {
    const ringOccupied: Array<{ x: number; z: number; width: number; depth: number }> = [];
    for (const candidate of ringSlots) {
      const footprint = { x: candidate.slot.x, z: candidate.slot.z, width: plotWidth, depth: plotDepth };
      if (!candidate.buildable || ringOccupied.some(other => overlaps(footprint, other))) continue;
      ringOccupied.push(footprint);
    }
    ringCapacity.set(ring, ringOccupied.length);
  });

  return { candidates, ringCapacity, plotWidth, plotDepth };
}

/**
 * Landmarks are authored, not allocated, so they must never be pushed onto an
 * existing article building. This uses a tighter clearance than BUILDING_GAP:
 * article lots keep a generous margin for readability, while a civic prop such
 * as a notice board only needs to clear the wall itself.
 */
const LANDMARK_CLEARANCE = 0.24;
const collidesWithLandmark = (
  plot: { x: number; z: number; width: number; depth: number },
  landmark: { x: number; z: number; width: number; depth: number },
) => Math.abs(plot.x - landmark.x) < (plot.width + landmark.width) / 2 + LANDMARK_CLEARANCE
  && Math.abs(plot.z - landmark.z) < (plot.depth + landmark.depth) / 2 + LANDMARK_CLEARANCE;

export const createTownLayout = (
  seed = 'river-bend-demo-v2',
  posts: LayoutPost[] = [],
  friends: LayoutFriend[] = [],
  diary: LayoutDiaryEntry[] = [],
): TownLayout => {
  const groups = groupPosts(posts);
  const hamlet = createTownHamlet(friends.map((friend) => friend.id));
  const presets = stableArticlePlots[seed] ?? {};
  const orderedGroups = [...groups].sort((a, b) => {
    const aPreset = presets[groupKey(a)];
    const bPreset = presets[groupKey(b)];
    if (aPreset && bPreset) return aPreset.order - bPreset.order;
    if (aPreset) return -1;
    if (bPreset) return 1;
    return stableGroupOrder(a) - stableGroupOrder(b) || hashSeed(`${seed}:article-group:${groupKey(a)}`) - hashSeed(`${seed}:article-group:${groupKey(b)}`);
  });
  const occupied: TownPlot[] = [];
  const plots: TownPlot[] = [];
  const roofs: TownPlot['roof'][] = ['gable', 'hip', 'flat'];
  const walls: TownPlot['walls'][] = ['stone', 'plaster', 'timber'];
  if (!preparedLots || preparedSeed !== seed) {
    preparedLots = prepareLots(seed); preparedSeed = seed;
  }
  const { candidates, ringCapacity, plotWidth, plotDepth } = preparedLots;

  let unlockedRing = 0;
  const ringOccupied = new Map<number, number>();
  const unlockThreshold = 0.58;
  orderedGroups.forEach((group, groupIndex) => {
    const key = groupKey(group);
    const preset = presets[key];
    const presetCandidate = preset ? candidates.find(({ slot }) => Math.abs(slot.x - preset.x) < 0.001 && Math.abs(slot.z - preset.z) < 0.001) : undefined;
    let candidate = presetCandidate;
    if (!candidate) {
      candidate = candidates.find(({ slot, ring, buildable }) => ring <= unlockedRing && buildable && !occupied.some(other => overlaps({ x: slot.x, z: slot.z, width: plotWidth, depth: plotDepth }, other)));
      while (!candidate && unlockedRing < Math.max(...ringCapacity.keys())) {
        unlockedRing += 1;
        candidate = candidates.find(({ slot, ring, buildable }) => ring <= unlockedRing && buildable && !occupied.some(other => overlaps({ x: slot.x, z: slot.z, width: plotWidth, depth: plotDepth }, other)));
      }
    }
    const slot = candidate?.slot;
    if (!slot) throw new Error(`No collision-free article building lot remains for article group ${groupIndex + 1}.`);
    const style = preset ? { style: preset.style, roof: preset.roof, walls: preset.walls } : stableBuildingStyle(seed, key);
    const groupRandom = rngFor(`${seed}:article-plot:${key}`);
    const plot: TownPlot = {
      id: preset?.id ?? `article-building-${plots.length + 1}`,
      x: slot.x, z: slot.z, width: plotWidth, depth: plotDepth,
      roof: style.roof ?? roofs[Math.floor(groupRandom() * roofs.length)],
      walls: style.walls ?? walls[Math.floor(groupRandom() * walls.length)],
      accent: preset?.accent ?? hashSeed(`${seed}:accent:${key}`) % 4,
      style: style.style, postId: group[0].id,
      special: specialBuildingStyles.some((candidate) => candidate.style === style.style) ? style.style as TownSpecialStyle : undefined,
      seedIndex: preset?.order ?? plots.length, seriesPostIds: group.length > 1 ? group.map((post) => post.id) : undefined,
    };
    occupied.push(plot); plots.push(plot);
    const placedRing = candidate?.ring ?? 0;
    ringOccupied.set(placedRing, (ringOccupied.get(placedRing) ?? 0) + 1);
    const capacity = ringCapacity.get(placedRing) ?? 0;
    if (capacity > 0 && (ringOccupied.get(placedRing) ?? 0) / capacity >= unlockThreshold) unlockedRing = Math.max(unlockedRing, placedRing + 1);
  });

  const diaryDistrict = createTownDiaryDistrict(diary, plots);

  // Reserve empty lots using the exact same collision contract as article lots.
  // Empty lots are visible as clear space only; they never become buildings.
  const reservedPlots = [...plots];
  for (const { slot, buildable } of candidates) {
    // Keep a generous logical buffer ahead of the current article count. The
    // full candidate field is still available to future layouts, while this
    // buffer protects the currently rendered world from decorative overlap.
    if (reservedPlots.length >= Math.max(96, groups.length + 48)) break;
    if (!buildable || reservedPlots.some(other => overlaps({ x: slot.x, z: slot.z, width: plotWidth, depth: plotDepth }, other))) continue;
    // An authored landmark always wins over a future empty lot.
    if (townFeatures.some((feature) => collidesWithLandmark({ x: slot.x, z: slot.z, width: plotWidth, depth: plotDepth }, feature))) continue;
    if (hamlet?.huts.some((hut) => collidesWithLandmark({ x: slot.x, z: slot.z, width: plotWidth, depth: plotDepth }, hut))) continue;
    if (diaryDistrict?.boards.some((board) => collidesWithLandmark({ x: slot.x, z: slot.z, width: plotWidth, depth: plotDepth }, board))) continue;
    reservedPlots.push({
      id: `reserved-building-lot-${reservedPlots.length + 1}`,
      x: slot.x, z: slot.z, width: plotWidth, depth: plotDepth,
      roof: 'gable', walls: 'plaster', accent: reservedPlots.length % 4, style: 'cottage',
      seedIndex: reservedPlots.length,
    });
  }

  // A landmark that lands on an article building would silently delete a
  // readable building from the town, so fail the build instead of shipping it.
  for (const plot of plots) {
    for (const feature of townFeatures) {
      if (collidesWithLandmark(plot, feature)) {
        throw new Error(`Landmark "${feature.id}" collides with article building "${plot.postId}" at (${plot.x}, ${plot.z}).`);
      }
    }
    for (const hut of hamlet?.huts ?? []) {
      if (collidesWithLandmark(plot, hut)) {
        throw new Error(`Friend hut "${hut.id}" collides with article building "${plot.postId}" at (${plot.x}, ${plot.z}).`);
      }
    }
    for (const board of diaryDistrict?.boards ?? []) {
      if (collidesWithLandmark(plot, board)) {
        throw new Error(`Diary board "${board.id}" collides with article building "${plot.postId}" at (${plot.x}, ${plot.z}).`);
      }
    }
  }

  return { seed, regions: worldRegions, entities: townEntities, plots, reservedPlots, features: townFeatures, hamlet, diary: diaryDistrict, center: { x: 0, z: 0 } };
};
