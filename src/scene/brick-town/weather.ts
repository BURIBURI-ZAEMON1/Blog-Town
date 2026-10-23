import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import type { Scene } from '@babylonjs/core/scene.js';
import { createPrecipitationField, type Precipitation } from '../../data/town-weather';
import { townBoard } from '../../data/town-layout';
import { randomFor } from './random';

/** One precipitation lifecycle, with separate rain/snow shape and movement strategies. */
export function createWeatherController(scene:Scene,seed:string,mobile:boolean) {
  let kind:Precipitation='rain',wet=false,reduced=false;
  let drops=createPrecipitationField(randomFor(`${seed}:rain`),mobile?280:700,townBoard,'rain');
  let mesh:ReturnType<typeof CreateLineSystem>|undefined;
  let positions=new Float32Array();
  let elapsed=0;
  function writePositions() {
    for(let i=0;i<drops.length;i++) {
      const d=drops[i];
      if(kind==='rain') {
        const o=i*6;
        positions[o]=d.x;positions[o+1]=d.y;positions[o+2]=d.z;
        positions[o+3]=d.x-0.12;positions[o+4]=d.y-0.65;positions[o+5]=d.z-0.04;
      } else {
        const o=i*12,x=d.x+Math.sin(elapsed*0.65+i)*0.38,z=d.z+Math.cos(elapsed*0.45+i)*0.2;
        const size=0.045+(i%3)*0.018;
        positions[o]=x-size;positions[o+1]=d.y-size;positions[o+2]=z;
        positions[o+3]=x+size;positions[o+4]=d.y+size;positions[o+5]=z;
        positions[o+6]=x-size;positions[o+7]=d.y+size;positions[o+8]=z;
        positions[o+9]=x+size;positions[o+10]=d.y-size;positions[o+11]=z;
      }
    }
  }
  function set(nextKind:Precipitation,nextWet:boolean,reducedMotion:boolean) {
    wet=nextWet;reduced=reducedMotion;
    if(!mesh||nextKind!==kind) {
      mesh?.dispose();kind=nextKind;elapsed=0;
      drops=createPrecipitationField(randomFor(`${seed}:${kind}`),mobile?(kind==='snow'?200:280):(kind==='snow'?480:700),townBoard,kind);
      positions=new Float32Array(drops.length*(kind==='snow'?12:6));
      writePositions();
      const lines:Vector3[][]=[];
      for(let i=0;i<positions.length;i+=6)lines.push([Vector3.FromArray(positions,i),Vector3.FromArray(positions,i+3)]);
      mesh=CreateLineSystem('town-precipitation',{lines,updatable:true},scene);
      mesh.color=Color3.FromHexString(kind==='snow'?'#f3ffff':'#bad4dc');mesh.alpha=kind==='snow'?0.85:0.42;
      mesh.isPickable=false;mesh.alwaysSelectAsActiveMesh=true;
    }
    mesh.setEnabled(wet&&!reduced);
  }
  function tick(dt:number) {
    if(!wet||reduced||!mesh)return;
    elapsed+=dt;
    for(const drop of drops){drop.y-=dt*drop.speed;if(drop.y<0.10)drop.y+=14;}
    writePositions();mesh.updateVerticesData(VertexBuffer.PositionKind,positions,false,false);
  }
  return {set,tick,get count(){return drops.length;},get kind(){return kind;},get animated(){return wet&&!reduced;},dispose(){mesh?.dispose();}};
}
