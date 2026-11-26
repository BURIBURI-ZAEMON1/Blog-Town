import {
  canSeePoint, makeBuildingVisitRoute, makeTownPatrolRoute, makeThiefArrivalRoute,
  planTownPopulation, routeMetrics, routeIntersectsPlots, type TownPersonRole, type TownPersonBehavior,
} from '../../data/town-life';
import { townTravelRoutes, type TownLayout, type Point } from '../../data/town-layout';
import { samplePath, pointInPolygon } from '../../data/town-spatial';

export const CITIZEN_CLEARANCE = 0.64;
const DOOR_TIME = 1.05;
const CHAT_TIME = 4.4;
const clamp = (value: number, end: number) => Math.max(0, Math.min(end, value));
const separation = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

export type LifeState = 'walking' | 'lurking' | 'entering' | 'inside' | 'resident' | 'exiting' | 'escaping' | 'gone';
export type Citizen = {
  role: TownPersonRole; behavior: TownPersonBehavior; state: LifeState;
  route: Point[]; metrics: ReturnType<typeof routeMetrics>; distance: number;
  speed: number; direction: 1 | -1; position: Point; facing: Point;
  opacity: number; timer: number; stay: boolean; pair?: number;
  conversation: number; conversationLeft: number; companion?: Citizen; cooldown: number;
  gesture?: 'map' | 'scan' | 'wave'; pause?: number; nextPause?: number;
  chattingSecond?: boolean; yielding?: boolean; stride?: number; pursuit?: number; passing?: Citizen; blockedFor?: number;
  chasing: boolean; moving: boolean; returning: boolean; returnPoints?: Point[];
};
type Conditions = { night: boolean; rainy: boolean };

export function atDistance(route: Point[], distances: number[], distance: number) {
  let index = 1;
  while (index < route.length - 1 && distances[index] < distance) index++;
  const a = route[index - 1], b = route[index] ?? a;
  const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const amount = clamp((distance - distances[index - 1]) / length, 1);
  return { position: { x: a.x + (b.x - a.x) * amount, z: a.z + (b.z - a.z) * amount }, facing: { x: (b.x - a.x) / length, z: (b.z - a.z) / length } };
}

function occupant(role: TownPersonRole, behavior: TownPersonBehavior, route: Point[], start: number, random: () => number): Citizen {
  const metrics = routeMetrics(route), distance = clamp(start, metrics.totalDistance);
  return {
    role, behavior, route, metrics, distance, ...atDistance(route, metrics.distances, distance),
    state: 'walking', speed: (role === 'guard' ? .55 : role === 'thief' ? .38 : .42) * (.88 + .24 * random()),
    direction: 1, opacity: 1, timer: 0, stay: random() < .45, conversation: 0, conversationLeft: 0,
    cooldown: 7 + random() * 8, nextPause: 5 + random() * 15, stride: random() * Math.PI * 2,
    moving: true, chasing: false, returning: false,
  };
}

export function createLife(layout: TownLayout, random: () => number): Citizen[] {
  const plans = planTownPopulation({ plotCount: layout.plots.length, random });
  const patrol = makeTownPatrolRoute(townTravelRoutes, samplePath);
  const roads = Object.values(townTravelRoutes).map(route => samplePath(route, 8));
  const main = roads[0];
  const center = main.reduce((best, point, index) => separation(point, layout.center) < separation(main[best], layout.center) ? index : best, 0);
  const meeting = routeMetrics(main).distances[center];
  const people: Citizen[] = [];
  for (const [index, plan] of plans.entries()) {
    const target = layout.plots[index % layout.plots.length];
    const road = roads[index % roads.length];
    let route = plan.role === 'guard' ? patrol : road;
    let behavior = plan.behavior;
    if (plan.interactionGroup !== undefined) {
      route = main;
      behavior = 'commute';
    } else if (behavior === 'visit') {
      const visit = makeBuildingVisitRoute(target, layout.plots[(index + 1) % layout.plots.length], townTravelRoutes, samplePath, layout.plots);
      if (routeIntersectsPlots(visit, layout.plots)) behavior = 'commute';
      else route = visit;
    }
    const total = routeMetrics(route).totalDistance;
    const friend = people.find(person => person.pair !== undefined && person.pair === plan.interactionGroup);
    const start = plan.interactionGroup !== undefined ? meeting + (friend ? .92 : 0)
      : behavior === 'visit' ? Math.min(total * .4, .75 + random()) : total * (plan.role === 'guard' ? .38 : .34 + random() * .19);
    const person = occupant(plan.role, behavior, route, start, random);
    person.pair = plan.interactionGroup;
    if (person.pair !== undefined) person.cooldown = .65;
    if (friend || (person.pair === undefined && index % 3 === 1 && behavior === 'commute')) {
      person.direction = -1;
      person.facing = { x: -person.facing.x, z: -person.facing.z };
    }
    for (let offset = 0; offset <= total; offset += .8) {
      const distance = (start + offset) % total, pose = atDistance(route, person.metrics.distances, distance);
      if (!roomAt(pose.position, people, person)) continue;
      person.distance = distance;
      person.position = pose.position;
      person.facing = { x: pose.facing.x * person.direction, z: pose.facing.z * person.direction };
      people.push(person);
      break;
    }
  }
  return people;
}

export function addNightVisitor(people: Citizen[], layout: TownLayout, rainy: boolean, random: () => number) {
  const old = people.findIndex(person => person.role === 'thief');
  if (layout.plots.length < 3 || (old >= 0 && people[old].state !== 'gone') || random() >= (rainy ? .18 : .36)) return;
  const target = layout.plots[Math.floor(random() * layout.plots.length)];
  const route = makeThiefArrivalRoute(target, townTravelRoutes, samplePath, layout.plots);
  if (routeIntersectsPlots(route, layout.plots) || !roomAt(route[0], people)) return;
  const person = occupant('thief', 'sneak', route, 0, random);
  person.opacity = 0;
  const index = old < 0 ? people.length : old;
  people[index] = person;
  return index;
}

const outside = (person: Citizen) => person.state !== 'inside' && person.state !== 'resident' && person.state !== 'gone';
const roomAt = (point: Point, people: Citizen[], except?: Citizen) => people.every(person => person === except || !outside(person) || separation(point, person.position) >= CITIZEN_CLEARANCE);

function walk(person: Citizen, target: Point, budget: number, people: Citizen[], layout: TownLayout, detour = true) {
  const origin = person.position, length = separation(origin, target);
  if (length < 1e-5 || budget <= 0) return 0;
  const aim = Math.atan2(target.x - origin.x, target.z - origin.z);
  const travel = Math.min(length, budget);
  for (const turn of detour ? [0, -.75, .75, -1.65, 1.65] : [0]) {
    const dx = Math.sin(aim + turn), dz = Math.cos(aim + turn);
    const next = { x: origin.x + dx * travel, z: origin.z + dz * travel };
    const clearance = people.every(other => {
      if (other === person || !outside(other)) return true;
      const along = clamp((other.position.x - origin.x) * dx + (other.position.z - origin.z) * dz, travel);
      return Math.hypot(other.position.x - origin.x - along * dx, other.position.z - origin.z - along * dz) >= CITIZEN_CLEARANCE - 1e-8;
    });
    if (!clearance || routeIntersectsPlots([origin, next], layout.plots, .18)
      || (layout.features ?? []).some(feature => Math.abs(next.x - feature.x) < feature.width / 2 + .16 && Math.abs(next.z - feature.z) < feature.depth / 2 + .16)
      || (layout.regions.some(region => region.kind === 'river' && pointInPolygon(next, region.polygon))
        && !layout.regions.some(region => region.kind === 'road' && pointInPolygon(next, region.polygon)))) continue;
    person.position = next;
    person.facing = { x: dx, z: dz };
    person.moving = true;
    person.yielding = turn !== 0;
    person.stride = ((person.stride ?? 0) + travel * 16) % (Math.PI * 2);
    return travel;
  }
  person.yielding = true;
  return 0;
}

const face = (person: Citizen, target: Point) => {
  const length = separation(person.position, target);
  if (length > .01) person.facing = { x: (target.x - person.position.x) / length, z: (target.z - person.position.z) / length };
};

export function greetCitizen(person: Citizen, camera: Point) {
  if (person.state !== 'walking' || person.chasing || person.returning || person.conversationLeft > 0 || person.gesture === 'wave') return;
  person.gesture = person.role === 'thief' ? 'scan' : 'wave';
  person.pause = 1.55;
  face(person, camera);
}

export function tickLife(people: Citizen[], dt: number, layout: TownLayout, conditions: Conditions = { night: true, rainy: false }) {
  const thief = people.find(person => person.role === 'thief' && outside(person));
  if (thief && !conditions.night && (thief.state === 'walking' || thief.state === 'lurking')) {
    thief.state = 'escaping'; thief.direction = -1;
  }
  for (const guard of people) if (guard.role === 'guard') {
    const seen = thief && thief.opacity > .5 && canSeePoint(guard.position, thief.position, guard.facing, 6.2, layout.plots, 100);
    guard.pursuit = seen ? 1.2 : Math.max(0, (guard.pursuit ?? 0) - dt);
    guard.chasing = !!thief && guard.pursuit > 0;
    if (seen && thief && (thief.state === 'walking' || thief.state === 'lurking')) {
      thief.state = 'escaping'; thief.direction = -1;
    }
  }

  for (const [index, person] of people.entries()) {
    if (!canTalk(person)) continue;
    const partner = people.find((other, otherIndex) => otherIndex > index && canTalk(other)
      && separation(person.position, other.position) <= 1.12
      && ((person.pair !== undefined && person.pair === other.pair) || person.facing.x * other.facing.x + person.facing.z * other.facing.z < -.25));
    if (!partner || routeIntersectsPlots([person.position, partner.position], layout.plots, 0)) continue;
    person.companion = partner; partner.companion = person;
    person.chattingSecond = false; partner.chattingSecond = true;
    person.conversationLeft = partner.conversationLeft = CHAT_TIME;
    person.cooldown = partner.cooldown = 30;
  }

  for (const person of people) {
    const p = person;
    p.cooldown -= dt; p.moving = false; p.yielding = false;
    p.conversationLeft = Math.max(0, p.conversationLeft - dt);
    p.conversation += (Number(p.conversationLeft > 0) - p.conversation) * Math.min(1, dt * 6);
    if (p.conversationLeft > 0 && p.companion) { face(p, p.companion.position); continue; }
    p.companion = undefined;
    if ((p.pause ?? 0) > 0 && !p.chasing && p.state !== 'escaping') {
      p.pause = Math.max(0, p.pause! - dt);
      if (p.pause > 0) continue;
    }
    p.gesture = undefined; p.pause = 0;
    if (p.role === 'guard' && (p.chasing || p.returning)) {
      const points = p.returnPoints ??= [];
      if (p.chasing && thief) {
        const origin = p.position;
        if (separation(origin, thief.position) <= CITIZEN_CLEARANCE + .12) face(p, thief.position);
        else if (walk(p, thief.position, dt * 1.12, people, layout)) {
          if (!points.length || separation(origin, points.at(-1)!) > .24) points.push(origin);
          p.returning = true;
        }
        continue;
      }
      const target = points.at(-1);
      if (target && separation(p.position, target) >= .015) {
        walk(p, target, dt * .61, people, layout);
        continue;
      }
      points.pop(); p.returning = points.length > 0;
      if (p.returning) continue;
    }
    if (p.state === 'gone') { p.opacity = 0; continue; }
    if (p.state === 'entering') {
      p.timer += dt; p.opacity = 1 - clamp((p.timer - .3) / (DOOR_TIME - .3), 1);
      if (p.timer >= DOOR_TIME) { p.state = p.role === 'townsperson' && p.stay ? 'resident' : 'inside'; p.timer = 0; }
      continue;
    }
    if (p.state === 'inside' || p.state === 'resident') {
      p.timer += dt; p.opacity = 0;
      const dwell = p.state === 'resident' ? (conditions.night ? 80 : conditions.rainy ? 42 : 16) : (conditions.rainy ? 8 : 4.2);
      if (p.timer >= dwell && roomAt(p.position, people, p)) {
        p.state = 'exiting'; p.timer = 0; p.facing = { x: -p.facing.x, z: -p.facing.z };
      }
      continue;
    }
    if (p.state === 'exiting') {
      p.timer += dt; p.opacity = clamp(p.timer / .75, 1);
      if (p.timer >= .75) { p.state = p.role === 'thief' ? 'escaping' : 'walking'; p.direction = p.direction === 1 ? -1 : 1; p.timer = 0; }
      continue;
    }
    if (p.state === 'lurking') {
      p.timer += dt;
      if (p.timer >= 2.8) { p.state = 'entering'; p.timer = 0; }
      continue;
    }

    const end = p.metrics.totalDistance;
    if (p.nextPause !== undefined && p.state === 'walking' && p.role !== 'thief' && p.distance > .8 && p.distance < end - .8) {
      p.nextPause -= dt;
      if (p.nextPause <= 0 && people.every(other => other === p || !outside(other) || separation(p.position, other.position) > 1.35)) {
        p.gesture = p.role === 'traveler' && !conditions.rainy ? 'map' : 'scan';
        p.pause = p.gesture === 'map' ? 2.8 : 1.65;
        p.nextPause = 17 + p.speed * 24;
        continue;
      }
    }
    const budget = dt * p.speed * (p.state === 'escaping' ? 2.8 : conditions.rainy ? 1.12 : 1);
    const lookDistance = clamp(p.distance + Math.max(.14, budget) * p.direction, end);
    const waypoint = atDistance(p.route, p.metrics.distances, lookDistance);
    const previous = p.position, forward = { x: waypoint.facing.x * p.direction, z: waypoint.facing.z * p.direction };
    const ahead = (other: Citizen) => (other.position.x - previous.x) * forward.x + (other.position.z - previous.z) * forward.z;
    if (p.passing && (!outside(p.passing) || ahead(p.passing) < -.24 || separation(previous, p.passing.position) > 1.25)) p.passing = undefined;
    p.passing ??= people.find(other => other !== p && outside(other) && ahead(other) > .12
      && separation(previous, other.position) < 1.02);
    const target = p.passing ? { x: waypoint.position.x + forward.z * .44, z: waypoint.position.z - forward.x * .44 } : waypoint.position;
    walk(p, target, budget, people, layout, separation(previous, waypoint.position) < .65);
    if (p.passing) p.yielding = true;
    const progress = Math.max(0, (p.position.x - previous.x) * forward.x + (p.position.z - previous.z) * forward.z);
    p.distance = separation(p.position, target) < .012 ? lookDistance : clamp(p.distance + progress * p.direction, end);
    if (p.role === 'thief') p.opacity = clamp(p.distance / .9, 1);
    const edge = p.direction === 1 ? end : 0;
    const exactEnd = p.behavior === 'visit' || p.role === 'thief';
    if (Math.abs(p.distance - edge) < .15 && separation(p.position, p.route[p.direction === 1 ? p.route.length - 1 : 0]) < (exactEnd ? .025 : .52)) {
      p.distance = edge; p.timer = 0;
      p.passing = undefined; p.blockedFor = 0;
      if (p.role === 'thief') p.state = p.direction === -1 ? 'gone' : 'lurking';
      else if (p.behavior === 'visit') { p.state = 'entering'; p.facing = { x: 0, z: -1 }; }
      else p.direction = p.direction === 1 ? -1 : 1;
    } else {
      p.blockedFor = progress > budget * .08 ? 0 : (p.blockedFor ?? 0) + dt;
      if (p.blockedFor > 2.2 + p.speed && p.state === 'walking') {
        p.blockedFor = 0; p.passing = undefined; p.direction = p.direction === 1 ? -1 : 1;
        if (p.role === 'thief') { p.state = 'escaping'; p.direction = -1; }
      }
    }
  }
}

function canTalk(person: Citizen) {
  return (person.role === 'townsperson' || person.role === 'traveler') && person.state === 'walking'
    && person.conversationLeft <= 0 && person.cooldown <= 0 && !person.pause;
}
