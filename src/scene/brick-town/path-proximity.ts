import type { Point } from '../../data/town-layout';

/** Precomputed segments for the thousands of terrain and seasonal mask queries. */
export function createPathProximity(points: readonly Point[]) {
  const segments = points.slice(1).map((b, index) => {
    const a = points[index], dx = b.x - a.x, dz = b.z - a.z;
    return { x: a.x, z: a.z, dx, dz, lengthSquared: dx * dx + dz * dz || 1,
      minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z) };
  });
  return (point: Point, radius: number) => {
    if (radius <= 0) return false;
    const radiusSquared = radius * radius;
    for (const segment of segments) {
      if (point.x < segment.minX - radius || point.x > segment.maxX + radius || point.z < segment.minZ - radius || point.z > segment.maxZ + radius) continue;
      const t = Math.max(0, Math.min(1, ((point.x - segment.x) * segment.dx + (point.z - segment.z) * segment.dz) / segment.lengthSquared));
      const dx = point.x - segment.x - t * segment.dx, dz = point.z - segment.z - t * segment.dz;
      if (dx * dx + dz * dz < radiusSquared) return true;
    }
    return false;
  };
}
