export type SpatialPoint = { x: number; z: number };

export const catmullRomPoint = (p0: SpatialPoint, p1: SpatialPoint, p2: SpatialPoint, p3: SpatialPoint, t: number): SpatialPoint => {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    z: 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
  };
};

export const samplePath = (points: SpatialPoint[], detail = 8) => {
  const samples: SpatialPoint[] = [];
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

export const corridorPolygon = (centerline: SpatialPoint[], halfWidth: number): SpatialPoint[] => {
  const samples = samplePath(centerline);
  const left: SpatialPoint[] = [];
  const right: SpatialPoint[] = [];
  samples.forEach((point, index) => {
    const previous = samples[Math.max(0, index - 1)];
    const next = samples[Math.min(samples.length - 1, index + 1)];
    const tangentX = next.x - previous.x;
    const tangentZ = next.z - previous.z;
    const length = Math.hypot(tangentX, tangentZ) || 1;
    const normalX = -tangentZ / length;
    const normalZ = tangentX / length;
    const taper = index === 0 || index === samples.length - 1 ? 0.82 : 1;
    left.push({ x: point.x + normalX * halfWidth * taper, z: point.z + normalZ * halfWidth * taper });
    right.push({ x: point.x - normalX * halfWidth * taper, z: point.z - normalZ * halfWidth * taper });
  });
  return [...left, ...right.reverse()];
};

export const corridorMeshData = (centerline: SpatialPoint[], width: number, y: number) => {
  const samples = samplePath(centerline);
  const positions: number[] = [];
  const indices: number[] = [];
  samples.forEach((point, index) => {
    const previous = samples[Math.max(0, index - 1)];
    const next = samples[Math.min(samples.length - 1, index + 1)];
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const length = Math.hypot(dx, dz) || 1;
    const nx = -dz / length;
    const nz = dx / length;
    const taper = index === 0 || index === samples.length - 1 ? 0.82 : 1;
    const halfWidth = width * 0.5 * taper;
    positions.push(
      point.x + nx * halfWidth, y, point.z + nz * halfWidth,
      point.x - nx * halfWidth, y, point.z - nz * halfWidth,
    );
    if (index < samples.length - 1) {
      const vertex = index * 2;
      // Counter-clockwise from above: normals point upward, not into the ground.
      indices.push(vertex, vertex + 2, vertex + 1, vertex + 1, vertex + 2, vertex + 3);
    }
  });
  return { positions, indices, samples };
};

// Build a corridor from already-sampled points. Callers that clip a path must
// use this variant; resampling a clipped curve would introduce a new Catmull-
// Rom overshoot and make the rendered edge diverge from the source path.
export const corridorMeshDataFromSamples = (samples: SpatialPoint[], width: number, y: number) => {
  const positions: number[] = [];
  const indices: number[] = [];
  samples.forEach((point, index) => {
    const previous = samples[Math.max(0, index - 1)];
    const next = samples[Math.min(samples.length - 1, index + 1)];
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const length = Math.hypot(dx, dz) || 1;
    const nx = -dz / length;
    const nz = dx / length;
    positions.push(point.x + nx * width * 0.5, y, point.z + nz * width * 0.5, point.x - nx * width * 0.5, y, point.z - nz * width * 0.5);
    if (index < samples.length - 1) {
      const vertex = index * 2;
      indices.push(vertex, vertex + 2, vertex + 1, vertex + 1, vertex + 2, vertex + 3);
    }
  });
  return { positions, indices, samples };
};

export const extendPathEndpoints = (samples: SpatialPoint[], startDistance: number, endDistance = startDistance) => {
  if (samples.length < 2 || (startDistance <= 0 && endDistance <= 0)) return samples;
  const first = samples[0];
  const next = samples[1];
  const last = samples[samples.length - 1];
  const previous = samples[samples.length - 2];
  const startLength = Math.hypot(next.x - first.x, next.z - first.z) || 1;
  const endLength = Math.hypot(last.x - previous.x, last.z - previous.z) || 1;
  const extendedStart = {
    x: first.x - ((next.x - first.x) / startLength) * Math.max(0, startDistance),
    z: first.z - ((next.z - first.z) / startLength) * Math.max(0, startDistance),
  };
  const extendedEnd = {
    x: last.x + ((last.x - previous.x) / endLength) * Math.max(0, endDistance),
    z: last.z + ((last.z - previous.z) / endLength) * Math.max(0, endDistance),
  };
  return [extendedStart, ...samples, extendedEnd];
};

export const pointInPolygon = (point: SpatialPoint, polygon: SpatialPoint[]) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersect = ((a.z > point.z) !== (b.z > point.z)) && point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
};

const lerpPoint = (first: SpatialPoint, second: SpatialPoint, amount: number): SpatialPoint => ({
  x: first.x + (second.x - first.x) * amount,
  z: first.z + (second.z - first.z) * amount,
});

// Return the portions of a path whose centerline is inside a region. This is
// used for bridge surfaces so their position and extent are derived from the
// exact road/river overlap instead of a second hand-authored anchor.
export const pathSegmentsInsidePolygon = (centerline: SpatialPoint[], polygon: SpatialPoint[], detail = 24) => {
  const samples = samplePath(centerline, detail);
  const segments: SpatialPoint[][] = [];
  let current: SpatialPoint[] = [];
  const flush = () => {
    if (current.length > 1) segments.push(current);
    current = [];
  };
  const crossing = (first: SpatialPoint, second: SpatialPoint, firstInside: boolean) => {
    let low = 0;
    let high = 1;
    for (let iteration = 0; iteration < 18; iteration += 1) {
      const middle = (low + high) / 2;
      const inside = pointInPolygon(lerpPoint(first, second, middle), polygon);
      if (inside === firstInside) low = middle;
      else high = middle;
    }
    return lerpPoint(first, second, (low + high) / 2);
  };

  for (let index = 0; index < samples.length - 1; index += 1) {
    const first = samples[index];
    const second = samples[index + 1];
    const firstInside = pointInPolygon(first, polygon);
    const secondInside = pointInPolygon(second, polygon);
    if (firstInside && secondInside) {
      if (!current.length) current.push(first);
      current.push(second);
    } else if (firstInside && !secondInside) {
      if (!current.length) current.push(first);
      current.push(crossing(first, second, true));
      flush();
    } else if (!firstInside && secondInside) {
      current = [crossing(first, second, false), second];
    } else {
      flush();
    }
  }
  flush();
  return segments;
};

export const pathSegmentsOutsidePolygon = (centerline: SpatialPoint[], polygon: SpatialPoint[], detail = 24) => {
  const samples = samplePath(centerline, detail);
  const segments: SpatialPoint[][] = [];
  let current: SpatialPoint[] = [];
  const flush = () => {
    if (current.length > 1) segments.push(current);
    current = [];
  };
  const crossing = (first: SpatialPoint, second: SpatialPoint, firstInside: boolean) => {
    let low = 0;
    let high = 1;
    for (let iteration = 0; iteration < 18; iteration += 1) {
      const middle = (low + high) / 2;
      const inside = pointInPolygon(lerpPoint(first, second, middle), polygon);
      if (inside === firstInside) low = middle;
      else high = middle;
    }
    return lerpPoint(first, second, (low + high) / 2);
  };

  for (let index = 0; index < samples.length - 1; index += 1) {
    const first = samples[index];
    const second = samples[index + 1];
    const firstInside = pointInPolygon(first, polygon);
    const secondInside = pointInPolygon(second, polygon);
    if (!firstInside && !secondInside) {
      if (!current.length) current.push(first);
      current.push(second);
    } else if (!firstInside && secondInside) {
      if (!current.length) current.push(first);
      current.push(crossing(first, second, false));
      flush();
    } else if (firstInside && !secondInside) {
      current = [crossing(first, second, true), second];
    } else {
      flush();
    }
  }
  flush();
  return segments;
};

const segmentIntersection = (a: SpatialPoint, b: SpatialPoint, c: SpatialPoint, d: SpatialPoint) => {
  const denominator = (a.x - b.x) * (c.z - d.z) - (a.z - b.z) * (c.x - d.x);
  if (Math.abs(denominator) < 1e-8) return undefined;
  const first = a.x * b.z - a.z * b.x;
  const second = c.x * d.z - c.z * d.x;
  const x = (first * (c.x - d.x) - (a.x - b.x) * second) / denominator;
  const z = (first * (c.z - d.z) - (a.z - b.z) * second) / denominator;
  const within = (value: number, start: number, end: number) => value >= Math.min(start, end) - 1e-6 && value <= Math.max(start, end) + 1e-6;
  if (!within(x, a.x, b.x) || !within(z, a.z, b.z) || !within(x, c.x, d.x) || !within(z, c.z, d.z)) return undefined;
  return { x, z };
};

export const findPathIntersection = (firstPath: SpatialPoint[], secondPath: SpatialPoint[]) => {
  const first = samplePath(firstPath, 12);
  const second = samplePath(secondPath, 12);
  for (let aIndex = 0; aIndex < first.length - 1; aIndex += 1) {
    for (let bIndex = 0; bIndex < second.length - 1; bIndex += 1) {
      const point = segmentIntersection(first[aIndex], first[aIndex + 1], second[bIndex], second[bIndex + 1]);
      if (!point) continue;
      // Use a centered tangent around the crossing instead of only one
      // polyline segment. This removes the small angular kink introduced by
      // sampling a curved road at the exact river intersection.
      const tangentStart = second[Math.max(0, bIndex - 1)];
      const tangentEnd = second[Math.min(second.length - 1, bIndex + 2)];
      const dx = tangentEnd.x - tangentStart.x;
      const dz = tangentEnd.z - tangentStart.z;
      // Three.js rotates the local +X axis toward world -Z around +Y.
      // Convert the road tangent explicitly so the bridge deck follows the
      // actual road direction instead of mirroring it across the X axis.
      return { ...point, rotationY: Math.atan2(-dz, dx) };
    }
  }
  return undefined;
};
