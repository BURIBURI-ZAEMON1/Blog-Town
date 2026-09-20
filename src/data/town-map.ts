import { riverCenterline, roadCenterlines, roadWidths, riverWidth, townBoard, townCenterRing, townCenterRingConnectors, townCenterRingWidth, type Point, type TownLayout } from './town-layout';
import { samplePath } from './town-spatial';

/** One LEGO stud becomes one pixel cell in the article map. */
export const TOWN_MAP_PIXEL = 0.36;
// Match the fixed Babylon camera composition used by the diorama. The mini-map
// is therefore a true top-down projection of what the user sees, not an
// unrelated north-up sketch.
export const TOWN_CAMERA_ALPHA = Math.PI * 0.68;
// The Babylon camera's screen-right axis is mirrored relative to the article
// panel's SVG reading direction. Apply one global X reflection so roads, river,
// buildings and the selected marker all flip together around the map center.
export const TOWN_MAP_MIRROR_X = true;

export type TownMapBuilding = {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  postIds: string[];
  points?: Point[];
};

const quantize = (value: number) => Math.round(value / TOWN_MAP_PIXEL);
const project = (point: Point): Point => {
  const rightX = Math.sin(TOWN_CAMERA_ALPHA);
  const rightZ = -Math.cos(TOWN_CAMERA_ALPHA);
  const depthX = Math.cos(TOWN_CAMERA_ALPHA);
  const depthZ = Math.sin(TOWN_CAMERA_ALPHA);
  const screenX = point.x * rightX + point.z * rightZ;
  return { x: (TOWN_MAP_MIRROR_X ? -1 : 1) * screenX, z: point.x * depthX + point.z * depthZ };
};
const pixelize = (points: Point[]) => {
  const result: Point[] = [];
  for (const point of samplePath(points, 12).map(project)) {
    const next = { x: quantize(point.x), z: quantize(point.z) };
    const previous = result.at(-1);
    if (!previous || previous.x !== next.x || previous.z !== next.z) result.push(next);
  }
  return result;
};

export const createTownMapModel = (layout: TownLayout, postId: string) => {
  const worldBuildings: TownMapBuilding[] = layout.plots.map((plot) => ({
    id: plot.id, x: plot.x, z: plot.z, width: plot.width, depth: plot.depth,
    postIds: plot.seriesPostIds ?? (plot.postId ? [plot.postId] : []),
  }));
  const buildings: TownMapBuilding[] = worldBuildings.map((building) => {
    const center = project({ x: building.x, z: building.z });
    const halfWidth = building.width / 2, halfDepth = building.depth / 2;
    const points = [
      { x: building.x - halfWidth, z: building.z - halfDepth }, { x: building.x + halfWidth, z: building.z - halfDepth },
      { x: building.x + halfWidth, z: building.z + halfDepth }, { x: building.x - halfWidth, z: building.z + halfDepth },
    ].map(project).map((point) => ({ x: quantize(point.x), z: quantize(point.z) }));
    return { ...building, x: quantize(center.x), z: quantize(center.z), width: Math.max(1, quantize(building.width)), depth: Math.max(1, quantize(building.depth)), points };
  });
  return {
    pixelSize: TOWN_MAP_PIXEL,
    bounds: (() => {
      const corners = [
        project({ x: townBoard.minX, z: townBoard.minZ }), project({ x: townBoard.minX, z: townBoard.maxZ }),
        project({ x: townBoard.maxX, z: townBoard.minZ }), project({ x: townBoard.maxX, z: townBoard.maxZ }),
      ];
      return { minX: Math.min(...corners.map((point) => quantize(point.x))), maxX: Math.max(...corners.map((point) => quantize(point.x))), minZ: Math.min(...corners.map((point) => quantize(point.z))), maxZ: Math.max(...corners.map((point) => quantize(point.z))) };
    })(),
    river: { points: pixelize(riverCenterline), width: Math.max(1, quantize(riverWidth)) },
    roads: Object.entries(roadCenterlines).map(([key, points]) => ({ points: pixelize(points), width: Math.max(1, quantize(roadWidths[key as keyof typeof roadWidths])) })),
    centerRing: { points: pixelize(townCenterRing), width: Math.max(1, quantize(townCenterRingWidth)) },
    centerConnectors: townCenterRingConnectors.map((points) => ({ points: pixelize(points), width: Math.max(1, quantize(townCenterRingWidth)) })),
    worldBuildings,
    buildings,
    selected: buildings.find((building) => building.postIds.includes(postId)),
  };
};
