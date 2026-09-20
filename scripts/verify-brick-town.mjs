import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { NullEngine, Scene } from '@babylonjs/core';
const require=createRequire(import.meta.url),cache=new Map();
function load(path){
  const absolute=resolve(path);if(cache.has(absolute))return cache.get(absolute).exports;
  const module={exports:{}};cache.set(absolute,module);
  const output=ts.transpileModule(readFileSync(absolute,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const localRequire=id=>id.startsWith('.')?load(resolve(dirname(absolute),id.endsWith('.ts')?id:`${id}.ts`)):require(id);
  new Function('require','module','exports',output)(localRequire,module,module.exports);return module.exports;
}
const {createTownLayout,isBuildablePlot,townBoard}=load('src/data/town-layout.ts');
const {createTownMapModel,TOWN_MAP_MIRROR_X}=load('src/data/town-map.ts');
const {buildHouse,FLOOR_HEIGHT}=load('src/scene/brick-town/buildings.ts');
const {roundedBox}=load('src/scene/brick-town/kit.ts');
const {buildWorld,BOARD}=load('src/scene/brick-town/world.ts');
assert.deepEqual(BOARD,townBoard,'Babylon world and mini-map use different coordinate bounds');
assert.equal(TOWN_MAP_MIRROR_X,true,'mini-map should use the corrected left-right orientation');
const runtimeSource=readFileSync('src/scene/brick-town/runtime.ts','utf8');
assert(runtimeSource.includes("@babylonjs/core/Culling/ray.js"),'tree-shaken runtime did not register Babylon ray picking');
const {createRainField,getCameraPanBounds,clampToPanBounds,getDragPanDelta}=load('src/scene/brick-town/view.ts');
const {getTownLoadingProfile,TOWN_LOADING_THRESHOLDS}=load('src/scene/brick-town/loading.ts');
const engine=new NullEngine(),scene=new Scene(engine);
let rainState=123456789;
const rainRandom=()=>{rainState=(1664525*rainState+1013904223)>>>0;return rainState/4294967296;};
const rain=createRainField(rainRandom,700,BOARD);
const rainMargin=1.8;
assert.equal(rain.length,700,'desktop rain density regressed');
assert(rain.every(drop=>drop.x>=BOARD.minX-rainMargin&&drop.x<=BOARD.maxX+rainMargin&&drop.z>=BOARD.minZ-rainMargin&&drop.z<=BOARD.maxZ+rainMargin),'rain escaped full-board field');
const rainXs=rain.map(drop=>drop.x),rainZs=rain.map(drop=>drop.z);
assert(Math.min(...rainXs)<BOARD.minX+1&&Math.max(...rainXs)>BOARD.maxX-1,'rain does not reach both X edges');
assert(Math.min(...rainZs)<BOARD.minZ+1&&Math.max(...rainZs)>BOARD.maxZ-1,'rain does not reach both Z edges');
const desktopAspect=1100/760;
const desktopSpan=Math.max(37,54/desktopAspect)/1.9;
const panBounds=getCameraPanBounds(BOARD,Math.PI*0.68,0.96,desktopSpan*desktopAspect,desktopSpan);
assert(panBounds.minX<-8&&panBounds.maxX>8&&panBounds.minZ<-7&&panBounds.maxZ>7,'close-view pan remains limited to the old town-center clamp');
assert.deepEqual(clampToPanBounds({x:-999,z:999},panBounds),{x:panBounds.minX,z:panBounds.maxZ},'camera target is not clamped to computed board coverage');
const dragAlpha=Math.PI*0.68,dragBeta=0.96,dragScale=0.04;
const dragRight=getDragPanDelta(dragAlpha,dragBeta,120,0,dragScale);
const screenRight={x:Math.sin(dragAlpha),z:-Math.cos(dragAlpha)};
assert(dragRight.x*screenRight.x+dragRight.z*screenRight.z>0,'dragging right should pan the camera target right');
const dragDown=getDragPanDelta(dragAlpha,dragBeta,0,120,dragScale);
const screenForward={x:Math.cos(dragAlpha),z:Math.sin(dragAlpha)};
assert(dragDown.x*screenForward.x+dragDown.z*screenForward.z<0,'dragging down should pan the camera target backward');
const townSceneSource=readFileSync('src/components/TownScene.tsx','utf8');
assert(!townSceneSource.includes('1450'),'town loading overlay still imposes an artificial 1450ms wait');
assert(runtimeSource.includes('onFirstFrame'),'town loading overlay is not tied to the first rendered frame');
assert.equal(getTownLoadingProfile(0).phase,'quiet','short loads should keep the town loader visually quiet');
assert.equal(getTownLoadingProfile(TOWN_LOADING_THRESHOLDS.reveal).phase,'quick','town loader should reveal after the quiet threshold');
assert.equal(getTownLoadingProfile(TOWN_LOADING_THRESHOLDS.label).phase,'steady','town loader label should appear only for a sustained load');
assert.equal(getTownLoadingProfile(TOWN_LOADING_THRESHOLDS.patient).phase,'patient','long loads should use the calmer patient motion');
assert(getTownLoadingProfile(1500).cycleMs>getTownLoadingProfile(120).cycleMs,'loader motion should adapt to actual elapsed loading time');

const geometry=roundedBox(2,1,3,0.02);
assert(geometry.positions.length>24*3,'brick has no real bevel geometry');
for(let i=0;i<geometry.normals.length;i+=3)assert(Math.abs(Math.hypot(...geometry.normals.slice(i,i+3))-1)<1e-5,'non-unit bevel normal');
for(let i=0;i<geometry.positions.length;i+=3){assert(Math.abs(geometry.positions[i])<=1.00001);assert(Math.abs(geometry.positions[i+1])<=0.50001);assert(Math.abs(geometry.positions[i+2])<=1.50001);}
const posts=[{id:'single'},{id:'series-2',series:'notes',seriesIndex:2},{id:'series-1',series:'notes',seriesIndex:1}];
const layout=createTownLayout('brick-verification',posts);
assert.equal(layout.plots.length,2);
assert(layout.reservedPlots.length >= 96,'expanded town should expose a stable pool of empty article lots');
assert.deepEqual(layout.plots.find(p=>p.seriesPostIds).seriesPostIds,['series-1','series-2']);
for (const lot of layout.reservedPlots) {
  assert(isBuildablePlot(lot, layout.reservedPlots.filter(candidate => candidate !== lot)), `reserved lot ${lot.id} overlaps another reserved lot`);
}
const houses=layout.plots.map(p=>buildHouse(scene,p));
for(const house of houses){
  assert.deepEqual([...new Set(house.meshes.map(m=>m.metadata.postId))].sort(),[...house.ids].sort());
  for(const m of house.meshes){
    m.computeWorldMatrix(true);const box=m.getBoundingInfo().boundingBox;
    assert(Math.abs(box.minimumWorld.x-house.plot.x)<=house.plot.width/2+0.15,'visual house exceeds reserved X footprint');
    assert(Math.abs(box.maximumWorld.z-house.plot.z)<=house.plot.depth/2+0.15,'visual house exceeds reserved Z footprint');
    assert(box.maximumWorld.y<0.2+house.ids.length*FLOOR_HEIGHT+1.1,'roof contains duplicated world Y / floating geometry');
    assert(m.isPickable&&m.metadata.postId,'article mesh is not pickable with its own floor ID');
  }
  const all=house.meshes.reduce((sum,m)=>sum+m.getTotalVertices(),0);assert(all>10000,'building reverted to a few primitive walls');
}
const world=buildWorld(scene,layout);
for(const tree of world.decor){
  assert(!world.inHouse(tree,tree.radius),'tree crown overlaps an article building');
  assert(!world.isRoad(tree,tree.radius),'tree crown overlaps road/access path');
  assert(!world.isWater(tree,tree.radius),'tree crown overlaps water');
  assert(tree.x>BOARD.minX&&tree.x<BOARD.maxX&&tree.z>BOARD.minZ&&tree.z<BOARD.maxZ,'tree outside board');
}
const many=createTownLayout('growth',Array.from({length:8},(_,i)=>({id:`post-${i}`})));
const mapModel=createTownMapModel(many,'post-7');
assert.equal(mapModel.buildings.length,many.plots.length,'mini-map omitted a generated building');
assert(mapModel.selected?.postIds.includes('post-7'),'mini-map did not select the article building');
for(const building of mapModel.worldBuildings){
  const plot=many.plots.find(candidate=>candidate.id===building.id);
  assert(plot,'mini-map invented a building not present in the world layout');
  assert.deepEqual({x:building.x,z:building.z,width:building.width,depth:building.depth},{x:plot.x,z:plot.z,width:plot.width,depth:plot.depth},'mini-map transformed a world building coordinate');
}
let overflowError='';
try{createTownLayout('capacity',Array.from({length:700},(_,i)=>({id:`capacity-${i}`})));}
catch(error){overflowError=String(error?.message??error);}
const overflowMatch=overflowError.match(/article group (\d+)/);
const maxBuildings=overflowMatch?Number(overflowMatch[1])-1:300;
assert(maxBuildings>54,'expanded layout did not add outer building capacity');
assert(overflowError.includes('No collision-free article building lot remains'),'overflow should fail with a collision-free lot error');
assert.equal(many.plots.length,8);
for(const plot of many.plots){assert(isBuildablePlot(plot,many.plots.filter(p=>p!==plot)),'new article does not fit occupancy model');}
console.log(JSON.stringify({rainDrops:rain.length,panBounds,houses:houses.length,articleFloors:posts.length,bevelVertices:geometry.positions.length/3,decor:world.decor.length,mergedMeshes:world.meshes.length,worldVertices:world.meshes.reduce((sum,m)=>sum+m.getTotalVertices(),0),growthBuildings:many.plots.length,maxBuildings,overflowError},null,2));
scene.dispose();engine.dispose();
