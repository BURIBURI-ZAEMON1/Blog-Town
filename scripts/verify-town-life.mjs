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

const life = loadTs('src/data/town-life.ts');
const layoutModule = loadTs('src/data/town-layout.ts');
const spatial = loadTs('src/data/town-spatial.ts');
const rain = loadTs('src/data/town-rain.ts');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sequence = (...values) => {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0.5;
};

assert(rain.rainYAtTime(12, 0.2, 20, 0) !== rain.rainYAtTime(12, 0.2, 20, 0.25), 'rain streak Y position is static over time');
assert(rain.rainYAtTime(12, 0.2, 20, 0) > rain.RAIN_BOTTOM, 'rain streak starts outside the valid rain area');
assert(rain.rainXAtTime(0, 68 / rain.RAIN_WIND_X) === rain.rainXAtTime(0, 0), 'rain horizontal motion does not wrap');

const day = life.planTownPopulation({ plotCount: 3, night: false, rainy: false, random: sequence(0.5, 0.2, 0.3, 0.4, 0.1, 0.2) });
assert(day.length >= 3, `three buildings should sustain at least three daytime people, got ${day.length}`);
assert(day.some((person) => person.role === 'townsperson'), 'day plan has no townsperson');
assert(day.some((person) => person.role === 'traveler'), 'day plan has no traveler');
assert(day.some((person) => person.role === 'guard'), 'day plan has no guard');
assert(!day.some((person) => person.role === 'thief'), 'day plan generated a thief');

const nightWithThief = life.planTownPopulation({ plotCount: 5, night: true, rainy: false, random: sequence(0.9, 0.2, 0.3, 0.2, 0.1, 0.1, 0.1) });
assert(nightWithThief.some((person) => person.role === 'thief'), 'night event roll did not generate a thief');
assert(nightWithThief.filter((person) => person.role === 'thief').length === 1, 'more than one thief generated');

const sparseNightCount = life.getTownPopulationCount({ plotCount: 3, night: true, rainy: true, random: sequence(0) });
assert(sparseNightCount === 3, `three-building town lost a core role in sparse weather (${sparseNightCount})`);

const smallNight = life.planTownPopulation({ plotCount: 3, night: true, rainy: false, random: sequence(0.5, 0.2, 0.3, 0.1) });
assert(smallNight.some((person) => person.role === 'guard'), 'small night event removed the guard');
assert(smallNight.some((person) => person.role === 'thief'), 'small night town can never generate a thief');
assert(smallNight.some((person) => person.role === 'townsperson'), 'small night event removed every townsperson');

const rainyNight = life.getTownPopulationCount({ plotCount: 8, night: true, rainy: true, random: sequence(0.8) });
const clearDay = life.getTownPopulationCount({ plotCount: 8, night: false, rainy: false, random: sequence(0.8) });
assert(rainyNight < clearDay, `rainy night population (${rainyNight}) should be lower than clear day (${clearDay})`);
assert(clearDay <= 10, `population exceeded performance cap (${clearDay})`);


// Test the actual engine-independent simulation, not names or text in a renderer.
const simulation = loadTs('src/scene/brick-town/life.ts');
const simulationLayout = layoutModule.createTownLayout('life-regression', [
  { id: 'one' }, { id: 'two' }, { id: 'three' },
]);
const actor = (overrides = {}) => {
  const route = [{x:0,z:0},{x:0,z:3}];
  return { role:'townsperson', behavior:'visit', state:'walking', route, metrics:life.routeMetrics(route),
    distance:2.95, speed:0.6, direction:1, position:{x:0,z:2.95}, facing:{x:0,z:1}, opacity:1,
    timer:0, stay:false, conversation:0, conversationLeft:0, cooldown:10, chasing:false, returning:false, moving:true,
    ...overrides };
};
const emptyLayout = {...simulationLayout, plots:[], regions:[]};
const visit = actor();
const visited = new Set();
for(let i=0;i<700;i++){simulation.tickLife([visit],0.02,emptyLayout);visited.add(visit.state);}
for(const state of ['entering','inside','exiting','walking']) assert(visited.has(state),`visit never reached ${state}`);
assert(visit.direction===-1 || visit.state==='entering', 'visitor did not return along its route');
const resident=actor({stay:true});
for(let i=0;i<100;i++)simulation.tickLife([resident],0.02,emptyLayout);
assert(resident.state==='resident'&&resident.opacity===0,'resident did not stay inside');
const thief=actor({role:'thief',behavior:'sneak',stay:false});
const thiefStates=new Set();
for(let i=0;i<1200;i++){simulation.tickLife([thief],0.02,emptyLayout);thiefStates.add(thief.state);}
for(const state of ['lurking','entering','inside','exiting','escaping','gone']) assert(thiefStates.has(state),`thief never reached ${state}`);
const guard=actor({role:'guard',behavior:'patrol',distance:0,position:{x:0,z:0},facing:{x:0,z:1}});
const seen=actor({role:'thief',behavior:'sneak',distance:2,position:{x:0,z:2}});
simulation.tickLife([guard,seen],0.02,emptyLayout);
assert(guard.chasing&&seen.state==='escaping','visible thief did not trigger chase');
assert(guard.position.z>0,'guard did not actually move toward the visible thief');
const blockedGuard=actor({role:'guard',behavior:'patrol',distance:0,position:{x:0,z:0},facing:{x:0,z:1}});
const blockedThief=actor({role:'thief',behavior:'sneak',distance:2,position:{x:0,z:2}});
simulation.tickLife([blockedGuard,blockedThief],0.02,{...emptyLayout,plots:[{x:0,z:1,width:1,depth:0.6}]});
assert(!blockedGuard.chasing&&blockedThief.state==='walking','guard saw through a building');
const first=actor({pair:0,behavior:'commute',cooldown:0,distance:1,position:{x:0,z:1}});
const second=actor({pair:0,behavior:'commute',cooldown:0,distance:1.5,position:{x:0,z:1.5}});
let previous={...first.position},maxStep=0,conversationPeak=0;
for(let i=0;i<220;i++){
  simulation.tickLife([first,second],0.02,emptyLayout);
  maxStep=Math.max(maxStep,Math.hypot(first.position.x-previous.x,first.position.z-previous.z));
  conversationPeak=Math.max(conversationPeak,first.conversation);previous={...first.position};
}
assert(conversationPeak>0.8,'conversation never became visible');
assert(maxStep<=0.6*0.02+1e-6,`conversation teleported (${maxStep})`);
assert(rain.RAIN_PROBABILITY===0.3,'rain probability changed');
const sampledWeather=Array.from({length:96},(_,i)=>rain.weatherIsRainy('river-bend-demo-v2',i));
assert(sampledWeather.filter(Boolean).length>3&&sampledWeather.filter(Boolean).length<38,'weather distribution is implausible');
console.log('Simulation: visit, resident, thief lifecycle, occluded chase, smooth conversation PASS');


const pair = day.filter((person) => person.interactionGroup === 0);
assert(pair.length === 2, `social interaction should bind exactly two people, got ${pair.length}`);

// Exercise the real article-building layout rather than only synthetic points.
// Every segment is sampled densely, so a long access leg crossing a house is
// caught even when neither of its endpoints lies inside that footprint.
const layout = layoutModule.createTownLayout('town-blog-framework-v1', [
  { id: 'article-one' },
  { id: 'article-two' },
  { id: 'article-three' },
]);
const thiefPlot = layout.plots[0];
const thiefArrival = life.makeThiefArrivalRoute(thiefPlot, layoutModule.townTravelRoutes, spatial.samplePath, layout.plots);
assert(thiefArrival.length > 2, 'thief arrival route does not include a road approach');
assert(Math.hypot(thiefArrival.at(-1).x - life.doorPointForPlot(thiefPlot).x, thiefArrival.at(-1).z - life.doorPointForPlot(thiefPlot).z) < 1e-6, 'thief arrival route does not end at the target door');
assert(!life.routeIntersectsPlots(thiefArrival, layout.plots), 'thief arrival route crosses a building');

const patrolRoute = life.makeTownPatrolRoute(layoutModule.townTravelRoutes, spatial.samplePath);
const mainRoute = spatial.samplePath(layoutModule.townTravelRoutes.main, 8);
assert(patrolRoute.length > mainRoute.length, 'guard patrol route does not cover more than the main road');
assert(life.routeMetrics(patrolRoute).totalDistance > life.routeMetrics(mainRoute).totalDistance, 'guard patrol route is not a town-wide circuit');
assert(!life.routeIntersectsPlots(patrolRoute, layout.plots), 'guard patrol route crosses an article building');

assert(life.canSeePoint({ x: 0, z: -2 }, { x: 0, z: 0 }, { x: 0, z: 1 }, 3, [], 96), 'guard sightline rejected a visible thief');
assert(!life.canSeePoint({ x: 0, z: -2 }, { x: 0, z: 0 }, { x: 0, z: -1 }, 3, [], 96), 'guard sightline accepted a thief behind the guard');
assert(!life.canSeePoint({ x: 0, z: -2 }, { x: 0, z: 2 }, { x: 0, z: 1 }, 5, [{ x: 0, z: 0, width: 1, depth: 1 }], 96), 'guard sightline ignored a building obstruction');

let visitRouteChecks = 0;
for (let fromIndex = 0; fromIndex < layout.plots.length; fromIndex += 1) {
  const patrol = life.makeDoorPatrolRoute(layout.plots[fromIndex], 0.62);
  assert(!life.routeIntersectsPlots(patrol, layout.plots), `door patrol ${fromIndex} crosses a building`);
  for (let toIndex = 0; toIndex < layout.plots.length; toIndex += 1) {
    if (fromIndex === toIndex) continue;
    const route = life.makeBuildingVisitRoute(
      layout.plots[fromIndex],
      layout.plots[toIndex],
      layoutModule.townTravelRoutes,
      spatial.samplePath,
      layout.plots,
    );
    assert(route.length > 3, `visit route ${fromIndex}->${toIndex} does not reach the road network`);
    assert(!life.routeIntersectsPlots(route, layout.plots), `visit route ${fromIndex}->${toIndex} crosses a building`);
    const start = life.doorPointForPlot(layout.plots[fromIndex]);
    const end = life.doorPointForPlot(layout.plots[toIndex]);
    assert(Math.hypot(route[0].x - start.x, route[0].z - start.z) < 1e-6, `visit route ${fromIndex}->${toIndex} starts away from its door`);
    assert(Math.hypot(route.at(-1).x - end.x, route.at(-1).z - end.z) < 1e-6, `visit route ${fromIndex}->${toIndex} ends away from its door`);
    visitRouteChecks += 1;
  }
}

console.log(JSON.stringify({
  dayRoles: day.map((person) => person.role),
  nightRoles: nightWithThief.map((person) => person.role),
  smallNightRoles: smallNight.map((person) => person.role),
  clearDayCount: clearDay,
  rainyNightCount: rainyNight,
  sparseNightCount,
  pairedPeople: pair.length,
  visitRouteChecks,
}, null, 2));
