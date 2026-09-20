export type TownPersonRole = 'townsperson' | 'guard' | 'thief' | 'traveler';
export type TownPersonBehavior = 'commute' | 'visit' | 'patrol' | 'sneak';

export type TownPersonPlan = {
  role: TownPersonRole;
  behavior: TownPersonBehavior;
  interactionGroup?: number;
};

type PopulationOptions = {
  plotCount: number;
  night: boolean;
  rainy: boolean;
  random: () => number;
};

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));


export type TownLifePoint = { x: number; z: number };
export type TownLifePlot = { x: number; z: number; width: number; depth: number };

type RouteNetwork = Record<string, TownLifePoint[]>;
type SampleRoute = (route: TownLifePoint[], detail: number) => TownLifePoint[];

export const routeMetrics = (route: TownLifePoint[]) => {
  const distances = [0];
  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1];
    const current = route[index];
    distances.push(distances[index - 1] + Math.hypot(current.x - previous.x, current.z - previous.z));
  }
  return { distances, totalDistance: distances[distances.length - 1] ?? 0 };
};

export const doorPointForPlot = (plot: TownLifePlot): TownLifePoint => ({
  x: plot.x,
  z: plot.z + plot.depth / 2 + 0.26,
});

const closestRoutePoint = (route: TownLifePoint[], target: TownLifePoint) => {
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  route.forEach((point, index) => {
    const distance = Math.hypot(point.x - target.x, point.z - target.z);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  return { index: nearestIndex, point: route[nearestIndex] ?? target };
};

const pointInsidePlot = (point: TownLifePoint, plot: TownLifePlot, padding = 0.12) =>
  Math.abs(point.x - plot.x) < plot.width / 2 + padding
  && Math.abs(point.z - plot.z) < plot.depth / 2 + padding;

export const routeIntersectsPlots = (
  route: TownLifePoint[],
  plots: TownLifePlot[],
  padding = 0.12,
) => {
  for (let routeIndex = 0; routeIndex < route.length - 1; routeIndex += 1) {
    const first = route[routeIndex];
    const second = route[routeIndex + 1];
    const length = Math.hypot(second.x - first.x, second.z - first.z);
    const steps = Math.max(1, Math.ceil(length / 0.06));
    for (let step = 0; step <= steps; step += 1) {
      const amount = step / steps;
      const point = {
        x: first.x + (second.x - first.x) * amount,
        z: first.z + (second.z - first.z) * amount,
      };
      if (plots.some((plot) => pointInsidePlot(point, plot, padding))) return true;
    }
  }
  return false;
};


export const canSeePoint = (
  observer: TownLifePoint,
  target: TownLifePoint,
  facing: TownLifePoint,
  maxDistance: number,
  obstacles: TownLifePlot[] = [],
  fieldOfViewDegrees = 100,
) => {
  const toTarget = { x: target.x - observer.x, z: target.z - observer.z };
  const distance = Math.hypot(toTarget.x, toTarget.z);
  if (distance <= 0.0001 || distance > maxDistance) return false;
  const facingLength = Math.hypot(facing.x, facing.z) || 1;
  const targetLength = distance || 1;
  const dot = (facing.x / facingLength) * (toTarget.x / targetLength)
    + (facing.z / facingLength) * (toTarget.z / targetLength);
  if (dot < Math.cos((fieldOfViewDegrees * Math.PI) / 360)) return false;
  const steps = Math.max(1, Math.ceil(distance / 0.1));
  for (let step = 1; step < steps - 1; step += 1) {
    const amount = step / steps;
    const point = {
      x: observer.x + toTarget.x * amount,
      z: observer.z + toTarget.z * amount,
    };
    if (obstacles.some((plot) => pointInsidePlot(point, plot, 0.08))) return false;
  }
  return true;
};

const makeAccessPath = (
  plot: TownLifePlot,
  roadPoint: TownLifePoint,
  occupiedPlots: TownLifePlot[],
) => {
  const door = doorPointForPlot(plot);
  const apron = { x: door.x, z: door.z + 0.42 };
  const sideClearance = plot.width / 2 + 0.34;
  const left = { x: plot.x - sideClearance, z: apron.z };
  const right = { x: plot.x + sideClearance, z: apron.z };
  const candidates: TownLifePoint[][] = [
    [door, roadPoint],
    [door, apron, roadPoint],
    [door, apron, left, roadPoint],
    [door, apron, right, roadPoint],
    [door, apron, left, { x: left.x, z: roadPoint.z }, roadPoint],
    [door, apron, right, { x: right.x, z: roadPoint.z }, roadPoint],
  ];
  const safe = candidates
    .filter((candidate) => !routeIntersectsPlots(candidate, occupiedPlots))
    .sort((first, second) => routeMetrics(first).totalDistance - routeMetrics(second).totalDistance);
  return safe[0] ?? [door, apron, roadPoint];
};

export const makeBuildingVisitRoute = (
  from: TownLifePlot,
  to: TownLifePlot,
  routeNetwork: RouteNetwork,
  sampleRoute: SampleRoute,
  occupiedPlots: TownLifePlot[] = [from, to],
) => {
  const fromDoor = doorPointForPlot(from);
  const toDoor = doorPointForPlot(to);
  let bestRoute: TownLifePoint[] | undefined;
  let bestScore = Number.POSITIVE_INFINITY;

  Object.values(routeNetwork).forEach((roadRoute) => {
    const sampledRoad = sampleRoute(roadRoute, 8);
    const fromRoad = closestRoutePoint(sampledRoad, fromDoor);
    const toRoad = closestRoutePoint(sampledRoad, toDoor);
    const firstIndex = Math.min(fromRoad.index, toRoad.index);
    const lastIndex = Math.max(fromRoad.index, toRoad.index);
    const roadSegment = fromRoad.index <= toRoad.index
      ? sampledRoad.slice(firstIndex, lastIndex + 1)
      : sampledRoad.slice(firstIndex, lastIndex + 1).reverse();
    if (roadSegment.length < 2) return;

    const fromAccess = makeAccessPath(from, fromRoad.point, occupiedPlots);
    const toAccess = makeAccessPath(to, toRoad.point, occupiedPlots).reverse();
    const candidate = [
      ...fromAccess,
      ...roadSegment.slice(1),
      ...toAccess.slice(1),
    ];
    if (routeIntersectsPlots(candidate, occupiedPlots)) return;

    const accessDistance = routeMetrics(fromAccess).totalDistance + routeMetrics(toAccess).totalDistance;
    const roadDistance = routeMetrics(roadSegment).totalDistance;
    const score = accessDistance * 2.4 + roadDistance * 0.035;
    if (score < bestScore) {
      bestScore = score;
      bestRoute = candidate;
    }
  });

  // The normal layout always has a collision-free road connection. Keeping a
  // front-apron fallback avoids returning an invalid empty route if a custom
  // layout temporarily has no road network.
  if (bestRoute) return bestRoute;
  const fromApron = { x: fromDoor.x, z: fromDoor.z + 0.42 };
  const toApron = { x: toDoor.x, z: toDoor.z + 0.42 };
  return [fromDoor, fromApron, toApron, toDoor];
};

export const makeTownPatrolRoute = (
  routeNetwork: RouteNetwork,
  sampleRoute: SampleRoute,
): TownLifePoint[] => {
  // The authored travel routes meet at the town's central ring. Stitching
  // their compatible ends into one long patrol circuit lets a guard cover the
  // whole road network instead of oscillating at one building entrance.
  const northToWest = sampleRoute(routeNetwork.north ?? [], 8);
  const westToSouth = sampleRoute(routeNetwork.west ?? [], 8);
  const southToNorth = sampleRoute(routeNetwork.main ?? [], 8);
  const northToEast = sampleRoute(routeNetwork.east ?? [], 8).reverse();
  const circuit = [northToWest, westToSouth, southToNorth];
  const result: TownLifePoint[] = [];
  circuit.forEach((segment) => {
    segment.forEach((point, index) => {
      const previous = result.at(-1);
      if (index === 0 && previous && Math.hypot(previous.x - point.x, previous.z - point.z) < 0.01) return;
      result.push({ x: point.x, z: point.z });
    });
  });
  // The north ends of the authored routes do not share an on-map junction.
  // Join them above the visible town boundary so the guard never cuts across
  // the plaza or buildings while changing from the main road to the east road.
  const last = result.at(-1);
  const firstEast = northToEast[0];
  if (last && firstEast) {
    result.push(
      { x: last.x, z: 33 },
      { x: firstEast.x, z: 33 },
    );
  }
  northToEast.forEach((point, index) => {
    const previous = result.at(-1);
    if (index === 0 && previous && Math.hypot(previous.x - point.x, previous.z - point.z) < 0.01) return;
    result.push({ x: point.x, z: point.z });
  });
  return result;
};

export const makeThiefArrivalRoute = (
  plot: TownLifePlot,
  routeNetwork: RouteNetwork,
  sampleRoute: SampleRoute,
  occupiedPlots: TownLifePlot[] = [plot],
): TownLifePoint[] => {
  const door = doorPointForPlot(plot);
  let bestRoute: TownLifePoint[] | undefined;
  let bestScore = Number.POSITIVE_INFINITY;

  Object.values(routeNetwork).forEach((roadRoute) => {
    const sampledRoad = sampleRoute(roadRoute, 8);
    const nearest = closestRoutePoint(sampledRoad, door);
    if (nearest.index < 1) return;
    const roadArrival = sampledRoad.slice(0, nearest.index + 1);
    const accessToDoor = makeAccessPath(plot, nearest.point, occupiedPlots).reverse();
    const candidate = [...roadArrival, ...accessToDoor.slice(1)];
    if (routeIntersectsPlots(candidate, occupiedPlots)) return;
    const score = routeMetrics(candidate).totalDistance + nearest.index * 0.02;
    if (score < bestScore) {
      bestScore = score;
      bestRoute = candidate;
    }
  });

  if (bestRoute) return bestRoute;
  return [
    { x: door.x, z: door.z + 4.5 },
    door,
  ];
};

export const makeDoorPatrolRoute = (plot: TownLifePlot, radius: number): TownLifePoint[] => {
  const door = doorPointForPlot(plot);
  return [
    door,
    { x: door.x - radius * 0.55, z: door.z + radius * 0.12 },
    { x: door.x + radius, z: door.z + radius * 0.08 },
    { x: door.x - radius * 0.55, z: door.z + radius * 0.12 },
    door,
  ];
};

export const getTownPopulationCount = ({ plotCount, night, rainy, random }: PopulationOptions) => {
  if (plotCount <= 0) return 0;
  const base = clamp(Math.round(plotCount * (1.15 + random() * 0.55)), 3, 10);
  const timeAdjusted = night ? Math.round(base * 0.68) : base;
  const weatherAdjusted = rainy ? Math.round(timeAdjusted * 0.72) : timeAdjusted;
  // A three-building town keeps the three core roles even at night or in rain;
  // larger towns still visibly thin out while remaining capped for performance.
  const minimum = plotCount >= 3 ? 3 : 2;
  return clamp(weatherAdjusted, minimum, 10);
};

export const planTownPopulation = (options: PopulationOptions): TownPersonPlan[] => {
  const count = getTownPopulationCount(options);
  if (count === 0) return [];
  const { night, rainy, plotCount, random } = options;
  const plans: TownPersonPlan[] = [];

  for (let index = 0; index < count; index += 1) {
    let role: TownPersonRole;
    if (index === 0) role = 'townsperson';
    else if (index === 1) role = 'traveler';
    else if (index === 2) role = 'guard';
    else {
      const roll = random();
      role = roll < 0.58 ? 'townsperson' : roll < 0.82 ? 'traveler' : 'guard';
    }
    const behavior: TownPersonBehavior = role === 'guard'
      ? 'patrol'
      : role === 'townsperson' && plotCount > 1 && random() < 0.58
        ? 'visit'
        : 'commute';
    plans.push({ role, behavior });
  }

  // A thief is an event, not a permanent population class. At most one can
  // replace an ordinary passer-by, only at night, and rain lowers the chance.
  if (night && count >= 3 && random() < (rainy ? 0.18 : 0.36)) {
    // Preserve at least one townsperson and the guaranteed guard. Prefer to
    // replace a later traveler/townsperson, but a three-person town may replace
    // its traveler so the event remains possible at the current demo scale.
    let replaceIndex = -1;
    for (let index = plans.length - 1; index >= 1; index -= 1) {
      if (plans[index].role !== 'guard') {
        replaceIndex = index;
        break;
      }
    }
    if (replaceIndex >= 0) plans[replaceIndex] = { role: 'thief', behavior: 'sneak' };
  }

  // Bind one compatible pair up front. Runtime animation can then use a direct
  // partner index instead of scanning every pedestrian on every frame.
  const socialIndices = plans
    .map((plan, index) => ({ plan, index }))
    .filter(({ plan }) => plan.role === 'townsperson' || plan.role === 'traveler')
    .map(({ index }) => index);
  if (socialIndices.length >= 2 && random() < 0.64) {
    plans[socialIndices[0]].interactionGroup = 0;
    plans[socialIndices[1]].interactionGroup = 0;
  }

  return plans;
};
