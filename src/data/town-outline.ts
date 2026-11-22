import type { Point } from './town-layout';

// Keep every existing article lot; grow the old board into a loose brick island.
export const townTerrainBounds = { minX: -50.4, maxX: 50.4, minZ: -42.48, maxZ: 42.48 };
export const EDGE_CELL = .72;
export const edgeCell = (value: number) => Math.floor(value / EDGE_CELL + .5) * EDGE_CELL;

export function townOutlineRadius(x: number, z: number) {
  const angle = Math.atan2(z / 41, x / 48.5);
  return Math.hypot(x / 48.5, z / 41)
    / (1 + .035 * Math.sin(angle * 3 + .6) + .022 * Math.sin(angle * 7 - .8));
}

export function inTownOutline(p: Point, clearance = 0) {
  const x = edgeCell(p.x), z = edgeCell(p.z);
  return townOutlineRadius(x, z) + clearance / 40 < 1;
}

export function clampToTownTerrain(p: Point): Point {
  const radius = townOutlineRadius(p.x,p.z);
  const scale = radius > .84 ? .84 / radius : 1;
  return { x:p.x*scale, z:p.z*scale };
}

export function extendTownPath(path: Point[], bothEnds = true): Point[] {
  const extend = (end: Point, adjacent: Point) => {
    const length = Math.hypot(end.x - adjacent.x, end.z - adjacent.z);
    return { x: end.x + (end.x - adjacent.x) / length * 24, z: end.z + (end.z - adjacent.z) / length * 24 };
  };
  return [...(bothEnds ? [extend(path[0], path[1])] : []), ...path, extend(path.at(-1)!, path.at(-2)!)];
}
