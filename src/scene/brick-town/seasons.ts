import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { townBoard } from '../../data/town-layout';
import { SEASON_PROFILES, type Season, type SeasonProfile } from '../../data/town-seasons';
import { BrickKit, ThinBrickKit, COLORS as C, STUD as S } from './kit';
import type { buildWorld } from './world';
import type { SnowSurface } from './surfaces';
import { randomFor } from './random';

type BaseWorld = ReturnType<typeof buildWorld>;
type OverlayContext = {
  scene: Scene;
  world: BaseWorld;
  surfaces: SnowSurface[];
  mobile: boolean;
  seed: string;
};
type Overlay = { meshes: Mesh[]; articleMeshes: Mesh[]; coverCount: number };
const linearColor = (hex: string) => Color3.FromHexString(hex).toLinearSpace();

/** Separate streams preserve the base town's tree/prop positions in every season. */
function scatter(context: OverlayContext, count: number, clustered: boolean) {
  const { world, seed } = context;
  const random = randomFor(`${seed}:season-cover:${clustered ? 'leaves' : 'flowers'}`);
  const points: { x: number; z: number; variant: number }[] = [];
  // Reuse the ground tile mask, which also excludes the actual river and bridge.
  for (let attempt = 0; attempt < count * 22 && points.length < count; attempt++) {
    let x: number, z: number;
    if (clustered && world.trees.length) {
      const tree = world.trees[Math.floor(random() * world.trees.length)];
      const angle = random() * Math.PI * 2, radius = 0.85 + random() * 1.9;
      x = tree.x + Math.cos(angle) * radius; z = tree.z + Math.sin(angle) * radius;
    } else {
      const tile = world.groundTiles[Math.floor(random() * world.groundTiles.length)];
      if (!tile) break;
      x = tile.x + (random() - 0.5) * 0.3; z = tile.z + (random() - 0.5) * 0.3;
    }
    if(x<townBoard.minX+0.4||x>townBoard.maxX-0.4||z<townBoard.minZ+0.4||z>townBoard.maxZ-0.4)continue;
    const p = { x,z }, radius = clustered ? 0.15 : 0.26;
    if (world.isRoad(p,radius+0.12) || world.isWater(p,radius+0.18) || world.inHouse(p,radius+0.1) || world.inEntity(p,radius+0.1)) continue;
    if (world.decor.some(item=>Math.hypot(item.x-x,item.z-z)<item.radius+radius*0.6)) continue;
    if (points.some(item=>Math.hypot(item.x-x,item.z-z)<radius*1.8)) continue;
    points.push({ x,z,variant:Math.floor(random()*4) });
  }
  return points;
}

function flowers(context: OverlayContext, profile: SeasonProfile): Overlay {
  const kit = new ThinBrickKit(context.scene, 'season-flowers');
  const points = scatter(context, context.mobile ? 360 : 960, false);
  for (const p of points) {
    const petal=profile.palette.flower[p.variant%profile.palette.flower.length];
    kit.cylinder(p.x,0.23,p.z,0.06,0.22,C.leaf);
    kit.box(p.x,0.34,p.z,0.31,0.07,0.13,petal);
    kit.box(p.x,0.34,p.z,0.13,0.07,0.31,petal);
    kit.cylinder(p.x,0.39,p.z,0.095,0.055,C.yellow);
    kit.box(p.x+0.07,0.19,p.z,0.18,0.045,0.08,C.leaf,0.4);
  }
  return { meshes:kit.flush('season:flowers'),articleMeshes:[],coverCount:points.length };
}

function leaves(context: OverlayContext, profile: SeasonProfile): Overlay {
  const kit = new ThinBrickKit(context.scene, 'season-leaves');
  const points = scatter(context,context.mobile ? 480 : 1400,true);
  for(const p of points) {
    kit.box(p.x,0.16,p.z,0.22,0.045,0.13,profile.palette.leaves[p.variant%profile.palette.leaves.length],p.variant*0.73);
    if(p.variant===0)kit.box(p.x+0.09,0.18,p.z+0.08,0.17,0.04,0.10,profile.palette.leaves[1],-0.45);
  }
  return { meshes:kit.flush('season:leaves'),articleMeshes:[],coverCount:points.length };
}

function snow(context: OverlayContext, profile: SeasonProfile): Overlay {
  const { world,scene }=context;
  const ground=new ThinBrickKit(scene,'season-snow'),ice=new ThinBrickKit(scene,'season-ice');
  for(const p of world.groundTiles) {
    if(world.inBuiltHouse(p,world.terrainStuds*S/2)||world.inEntity(p,0.12))continue;
    ground.box(p.x,0.125,p.z,world.terrainStuds*S-0.015,0.10,world.terrainStuds*S-0.015,profile.palette.snow);
  }
  const frost=randomFor(`${context.seed}:ice`);
  for(const p of world.waterTiles) {
    ice.box(p.x,-0.002,p.z,world.terrainStuds*S-0.02,0.045,world.terrainStuds*S-0.02,profile.palette.water[frost()<0.22?1:0]);
    if(!context.mobile&&frost()<0.1)ice.box(p.x,0.023,p.z,S*1.35,0.014,0.025,'#dff9fc',0.35);
  }
  for(const surface of world.waterSurfaces)ice.cylinder(surface.x,surface.y,surface.z,surface.diameter,0.045,profile.palette.water[0]);
  const worldSnow=new ThinBrickKit(scene,'season-snow');
  const kits = new Map<SnowSurface['parent'],BrickKit>();
  for(const surface of context.surfaces) {
    if(!surface.parent) {
      worldSnow.box(surface.x,surface.y+0.035,surface.z,surface.width,0.075,surface.depth,profile.palette.snow,surface.yaw??0);
      continue;
    }
    let kit=kits.get(surface.parent);
    if(!kit){kit=new BrickKit(scene,surface.parent,'season-snow');kits.set(surface.parent,kit);}
    kit.box(surface.x,surface.y+0.035,surface.z,surface.width,0.075,surface.depth,profile.palette.snow,surface.yaw??0,surface.postId);
  }
  const iceMeshes=ice.flush('season:ice');
  for(const mesh of iceMeshes) {
    const material=mesh.material as PBRMaterial;
    material.roughness=0.12;material.clearCoat.intensity=0.85;material.metallic=0.08;
    material.emissiveColor=material.albedoColor.scale(0.08);
  }
  const surfaceMeshes=[...kits.values()].flatMap((kit,index)=>kit.flush(`season:snow:${index}`));
  return {
    meshes:[...ground.flush('season:snow-ground'),...worldSnow.flush('season:snow-surfaces'),...iceMeshes,...surfaceMeshes],
    articleMeshes:surfaceMeshes.filter(mesh=>Boolean(mesh.metadata.postId)),coverCount:context.surfaces.length,
  };
}

const overlayBuilders: Record<Season,(context:OverlayContext,profile:SeasonProfile)=>Overlay> = {
  spring:flowers,
  summer:()=>({meshes:[],articleMeshes:[],coverCount:0}),
  autumn:leaves,
  winter:snow,
};

/** Builds only seasonal pieces. Base meshes, roots, layout and picking IDs stay alive. */
export const buildSeasonOverlays = (context: OverlayContext, season: Season) => overlayBuilders[season](context,SEASON_PROFILES[season]);

export function createSeasonController(context: OverlayContext) {
  type Tint = { material:PBRMaterial; from:Color3; to:Color3 };
  let active:Overlay={meshes:[],articleMeshes:[],coverCount:0};
  let season:Season|undefined;
  let progress=1;
  let tints:Tint[]=[];
  function collect(meshes:Mesh[],palette:Record<string,string>) {
    const seen=new Set<PBRMaterial>();
    for(const mesh of meshes) {
      const material=mesh.material as PBRMaterial,target=palette[mesh.metadata.baseColor];
      if(!target||seen.has(material))continue;
      seen.add(material);tints.push({ material,from:material.albedoColor.clone(),to:linearColor(target) });
    }
  }
  function set(next:Season,reducedMotion:boolean) {
    if(next===season)return false;
    for(const mesh of active.meshes)mesh.dispose(false,false);
    const profile=SEASON_PROFILES[next],{world}=context;
    active=buildSeasonOverlays(context,next);
    for(const mesh of active.meshes){mesh.computeWorldMatrix(true);mesh.freezeWorldMatrix();mesh.metadata.seasonal=true;}
    tints=[];
    collect(world.groundMeshes,{ [C.green]:profile.palette.ground[0],[C.moss]:profile.palette.ground[1],[C.leaf]:profile.palette.ground[2] });
    collect(world.shoreMeshes,{ [C.sand]:profile.palette.shore });
    collect(world.roadMeshes,{ [C.roadLight]:profile.palette.road[0],[C.road]:profile.palette.road[1],[C.sand]:profile.palette.road[2] });
    collect(world.foliageMeshes,{ [C.leaf]:profile.palette.tree[0],[C.pine]:profile.palette.treeShade[0],[C.yellow]:profile.palette.tree[1],[C.coral]:profile.palette.treeShade[1] });
    collect(world.waterMeshes,{ [C.waterLight]:profile.palette.water[0],[C.water]:profile.palette.water[1],[C.waterDeep]:profile.palette.water[2] });
    for(const mesh of world.glints)mesh.setEnabled(profile.waterVariant!=='frozen');
    progress=season===undefined||reducedMotion?1:0;
    season=next;
    tick(0,reducedMotion);
    return true;
  }
  function tick(dt:number,reducedMotion:boolean) {
    if(progress>=1&&dt>0)return;
    progress=reducedMotion?1:Math.min(1,progress+dt/0.85);
    const eased=1-Math.pow(1-progress,3);
    for(const tint of tints)Color3.LerpToRef(tint.from,tint.to,eased,tint.material.albedoColor);
    for(const mesh of active.meshes)mesh.visibility=eased;
  }
  return {
    set,tick,
    get meshes(){return active.meshes;},
    get articleMeshes(){return active.articleMeshes;},
    get coverCount(){return active.coverCount;},
    get transitioning(){return progress<1;},
    dispose(){for(const mesh of active.meshes)mesh.dispose(false,false);active={meshes:[],articleMeshes:[],coverCount:0};},
  };
}
