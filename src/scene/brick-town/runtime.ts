import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { Camera } from '@babylonjs/core/Cameras/camera.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CubeTexture } from '@babylonjs/core/Materials/Textures/cubeTexture.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { FxaaPostProcess } from '@babylonjs/core/PostProcesses/fxaaPostProcess.js';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { HighlightLayer } from '@babylonjs/core/Layers/highlightLayer.js';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration.js';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
// Scene.pick is an optional Babylon extension; this side-effect registration is
// required after switching from the barrel import to tree-shaken modules.
import '@babylonjs/core/Culling/ray.js';
import { BOARD, buildWorld, randomFor } from './world';
import { buildHouse, FLOOR_HEIGHT, GROUND_Y } from './buildings';
import { buildMinifig } from './minifig';
import { createLife, tickLife, type Citizen } from './life';
import { weatherIsRainy } from '../../data/town-rain';
import type { TownLayout } from '../../data/town-layout';
import type { TownSceneProps } from './types';
import { clampToPanBounds, createRainField, getCameraPanBounds, getDragPanDelta } from './view';

export type SceneState = Pick<TownSceneProps,'activePostId'|'hoveredPostId'|'query'|'category'|'tag'|'colorMode'|'reducedMotion'>;
export type SceneCallbacks = Pick<TownSceneProps,'onHoverPost'|'onResolvePostAnchor'|'onSelectPost'>;
const color=(hex:string)=>Color3.FromHexString(hex);

export function mountBrickTown(canvas:HTMLCanvasElement,layout:TownLayout,posts:TownSceneProps['posts'],initial:SceneState,callbacks:()=>SceneCallbacks,onFirstFrame?:()=>void) {
  const mobile=canvas.clientWidth<720;
  const engine=new Engine(canvas,true,{stencil:true,preserveDrawingBuffer:false,powerPreference:'default'});
  // A 1.25 DPR ceiling keeps bevel highlights crisp while avoiding the 2.25x
  // render-target cost that a 1.5 DPR cap caused on Retina displays.
  engine.setHardwareScalingLevel(1/Math.min(window.devicePixelRatio,1.25));
  const scene=new Scene(engine);
  scene.clearColor=Color4.FromHexString('#e3ddcdff');
  scene.environmentTexture=CubeTexture.CreateFromPrefilteredData('/assets/brick-town/studio.env',scene);
  scene.environmentIntensity=0.75;
  scene.imageProcessingConfiguration.toneMappingEnabled=true;
  scene.imageProcessingConfiguration.toneMappingType=ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure=1.15;
  scene.imageProcessingConfiguration.contrast=1.06;
  const camera=new ArcRotateCamera('diorama-camera',Math.PI*0.68,0.96,36,new Vector3(0,0.2,0),scene);
  camera.mode=Camera.ORTHOGRAPHIC_CAMERA;
  camera.minZ=0.1;camera.maxZ=160;
  // Deliberate fixed composition keeps the article frontage readable. Zoom is
  // explicit; a click/touch never gets confused with an orbit gesture.
  const defaultZoom=mobile?1:1.9;
  let zoom=defaultZoom;
  const clampCameraTarget=()=>{
    const panBounds=getCameraPanBounds(
      BOARD,camera.alpha,camera.beta,
      camera.orthoRight!-camera.orthoLeft!,camera.orthoTop!-camera.orthoBottom!,
    );
    const clamped=clampToPanBounds(camera.target,panBounds);
    camera.target.x=clamped.x;camera.target.z=clamped.z;
  };
  const fit=()=>{
    const aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight);
    const span=(mobile?34:Math.max(37,54/aspect))/zoom;
    camera.orthoTop=span/2;camera.orthoBottom=-span/2;
    camera.orthoLeft=-span*aspect/2;camera.orthoRight=span*aspect/2;
    clampCameraTarget();engine.resize();
  };
  fit();
  const hemi=new HemisphericLight('cool-sky',new Vector3(0,1,0),scene);
  hemi.diffuse=color('#dce7ed');hemi.groundColor=color('#706748');hemi.intensity=0.42;
  const sun=new DirectionalLight('large-window-sun',new Vector3(-0.5,-1,-0.65),scene);
  sun.position.set(12,25,16);sun.diffuse=color('#fff0d2');sun.intensity=1.5;
  sun.shadowMinZ=0.1;sun.shadowMaxZ=100;
  const shadows=new ShadowGenerator(mobile?1024:2048,sun);
  shadows.usePercentageCloserFiltering=true;shadows.filteringQuality=ShadowGenerator.QUALITY_MEDIUM;
  shadows.bias=0.00012;shadows.normalBias=0.018;
  // Only static architecture and scenery cast shadows. Rendering this depth map
  // once preserves the same town lighting without paying for it every frame.
  shadows.getShadowMap()!.refreshRate=0;
  const world=buildWorld(scene,layout);
  const houses=layout.plots.map(p=>buildHouse(scene,p));
  const houseMeshes=houses.flatMap(h=>h.meshes);
  // Terrain plates cannot cast a useful shadow onto themselves. Excluding that
  // multi-million-instance surface cuts most shadow-map geometry while houses,
  // trees, props and citizens retain their natural shadows.
  for(const m of [...world.shadowCasters,...houseMeshes])shadows.addShadowCaster(m);
  for(const m of [...world.meshes,...houseMeshes]){m.computeWorldMatrix(true);m.freezeWorldMatrix();}
  const glow=new GlowLayer('warm-window-scatter',scene,{mainTextureRatio:0.35});glow.intensity=0.22;
  // Empty include lists glow every emissive object. Explicit exclusions prevent
  // filter outlines from turning whole houses into night lights.
  for(const m of world.meshes)glow.addExcludedMesh(m);
  for(const m of houseMeshes)if(!m.metadata.glass)glow.addExcludedMesh(m);
  const highlights=new HighlightLayer('article-floor-highlight',scene,{mainTextureRatio:0.5});
  highlights.blurHorizontalSize=0.55;highlights.blurVerticalSize=0.55;highlights.innerGlow=false;
  let disposed=false;
  let ao:import('@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline.js').SSAO2RenderingPipeline|undefined;
  // Contact AO is a secondary refinement, so load it in a separate chunk while
  // the brick assembly overlay is playing instead of blocking the first frame.
  if(!mobile&&engine.webGLVersion===2) void import('@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline.js').then(({SSAO2RenderingPipeline})=>{
    if(disposed)return;
    ao=new SSAO2RenderingPipeline('brick-contact-shadows',scene,{ssaoRatio:0.5,blurRatio:0.5},[camera]);
    ao.radius=0.35;ao.totalStrength=1.0;ao.samples=8;ao.expensiveBlur=false;
  });
  // DefaultRenderingPipeline imports and allocates bloom/DoF/chromatic passes
  // even though this scene only used FXAA. A focused post-process is equivalent
  // visually and removes megabytes of unused browser code.
  const fxaa=new FxaaPostProcess('brick-fxaa',1,camera);
  fxaa.samples=1;
  const postMap=new Map(posts.map(p=>[p.id,p]));
  let state={...initial};let frames=0;let elapsed=0;
  let inView=true,visible=!document.hidden,lastFrame=0;
  let weatherSlot=Math.floor(Date.now()/900000),rainy=weatherIsRainy(layout.seed,weatherSlot);
  let citizens:Citizen[]=[],figures:ReturnType<typeof buildMinifig>[]=[];
  const rainRandom=randomFor(layout.seed+':rain');
  // Match rain density to the expanded board rather than the old town-center
  // rectangle. The small margin keeps drops visible right up to every edge.
  const drops=createRainField(rainRandom,mobile?280:700,BOARD);
  const linePairs=drops.map(d=>[new Vector3(d.x,d.y,d.z),new Vector3(d.x-0.12,d.y-0.65,d.z-0.04)]);
  const rainMesh=CreateLineSystem('rain',{lines:linePairs,updatable:true},scene);
  const rainPositions=new Float32Array(drops.length*6);
  rainMesh.color=color('#bad4dc');rainMesh.alpha=0.42;rainMesh.isPickable=false;
  function populate() {
    for(const f of figures)f.root.dispose(false,false);
    citizens=createLife(layout,state.colorMode==='night',rainy,randomFor(`${layout.seed}:${state.colorMode}:${weatherSlot}`));
    figures=citizens.map((p,i)=>buildMinifig(scene,p.role,i,state.colorMode==='night',rainy));
    // Minifigures are tiny at the map scale; omitting their animated shadow-map
    // passes removes most per-frame shadow draw calls with no visible town loss.
  }
  function lighting() {
    const night=state.colorMode==='night';
    scene.clearColor=Color4.FromHexString(night?'#24343cff':'#e3ddcdff');
    sun.intensity=night?0.45:rainy?0.75:1.5;sun.diffuse=color(night?'#9cbce8':rainy?'#dbe5e8':'#fff0d2');
    hemi.intensity=night?0.18:rainy?0.40:0.25;scene.environmentIntensity=night?0.20:0.5;
    scene.imageProcessingConfiguration.exposure=night?0.8:0.82;
    const table=world.table.material as PBRMaterial;table.albedoColor=color(night?'#24343c':'#d6cfbc').toLinearSpace();
    for(const m of houseMeshes)if(m.metadata.glass){
      const mat=m.material as PBRMaterial;mat.emissiveColor=night?color('#ffb751'):Color3.Black();mat.emissiveIntensity=night?1.5:0;
      mat.albedoColor=color(night?'#edbd6d':'#5e97a4');
    }
    for(const m of world.lamps){const mat=m.material as PBRMaterial;mat.emissiveColor=night?color('#ffba5b'):Color3.Black();mat.emissiveIntensity=night?1.5:0;}
    rainMesh.setEnabled(rainy);glow.isEnabled=night;
  }
  function update(next:SceneState) {
    const rebuildPeople=next.colorMode!==state.colorMode;
    state={...next};if(rebuildPeople){populate();lighting();}
    const needle=state.query.trim().toLowerCase();let hasHighlight=false;
    for(const mesh of houseMeshes){
      const post=postMap.get(mesh.metadata.postId);if(!post)continue;
      const matches=!!(needle||state.category||state.tag)&&(!needle||[post.title,post.description,post.category,...post.tags,post.series??''].join(' ').toLowerCase().includes(needle))&&(!state.category||post.category===state.category)&&(!state.tag||post.tags.includes(state.tag));
      const direct=post.id===state.hoveredPostId||post.id===state.activePostId;
      if(direct||matches){highlights.addMesh(mesh,color(direct?'#90e3d4':'#edbb53'));hasHighlight=true;}else highlights.removeMesh(mesh);
    }
    highlights.isEnabled=hasHighlight;
    if(state.hoveredPostId)anchor(state.hoveredPostId);
  }
  function anchor(id:string){
    const house=houses.find(h=>h.ids.includes(id));if(!house)return;
    const i=house.ids.indexOf(id),point=new Vector3(house.plot.x,GROUND_Y+(i+0.6)*FLOOR_HEIGHT,house.plot.z);
    const rect=canvas.getBoundingClientRect();
    const p=Vector3.Project(point,Matrix.Identity(),scene.getTransformMatrix(),camera.viewport.toGlobal(engine.getRenderWidth(),engine.getRenderHeight()));
    const a={x:rect.left+p.x*rect.width/engine.getRenderWidth(),y:rect.top+p.y*rect.height/engine.getRenderHeight()};
    callbacks().onResolvePostAnchor(id,a);return a;
  }
  let lastHover:string|undefined,lastPickAt=0;
  function pick(event:PointerEvent){
    const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
    // Pick ALL real solid surfaces. Roof/terrain/tree occlusion is respected;
    // a hidden wall can never be clicked through another object.
    const hit=scene.pick(x,y,m=>m.isPickable&&m.isVisible);
    return hit?.hit?hit.pickedMesh?.metadata?.postId as string|undefined:undefined;
  }
  const onMove=(e:PointerEvent)=>{
    if(down&&e.buttons===1){
      const dx=e.clientX-down.lastX,dy=e.clientY-down.lastY;
      down.lastX=e.clientX;down.lastY=e.clientY;
      if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>7){
        const perPixel=(camera.orthoRight!-camera.orthoLeft!)/canvas.clientWidth;
        const pan=getDragPanDelta(camera.alpha,camera.beta,dx,dy,perPixel);
        camera.target.x+=pan.x;camera.target.z+=pan.z;
        clampCameraTarget();canvas.style.cursor='grabbing';
        return;
      }
    }
    const now=performance.now();if(now-lastPickAt<32)return;lastPickAt=now;
    const id=pick(e);canvas.style.cursor=id?'pointer':'grab';
    if(id!==lastHover){lastHover=id;callbacks().onHoverPost(id,id?{x:e.clientX,y:e.clientY}:undefined);}
  };
  const onLeave=()=>{lastHover=undefined;callbacks().onHoverPost(undefined);if(!down)canvas.style.cursor='grab';};
  let down:{x:number;y:number;lastX:number;lastY:number;pointerId:number}|undefined;
  const onDown=(e:PointerEvent)=>{down={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,pointerId:e.pointerId};canvas.setPointerCapture?.(e.pointerId);};
  const finishPointer=(e:PointerEvent,select:boolean)=>{
    if(select&&down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<7){const id=pick(e);if(id)callbacks().onSelectPost(id);}
    if(down&&canvas.hasPointerCapture?.(down.pointerId))canvas.releasePointerCapture(down.pointerId);
    down=undefined;canvas.style.cursor='grab';
  };
  const onUp=(e:PointerEvent)=>finishPointer(e,true);
  const onCancel=(e:PointerEvent)=>finishPointer(e,false);
  canvas.addEventListener('pointermove',onMove);canvas.addEventListener('pointerleave',onLeave);canvas.addEventListener('pointerdown',onDown);canvas.addEventListener('pointerup',onUp);canvas.addEventListener('pointercancel',onCancel);
  populate();lighting();update(initial);
  const resize=new ResizeObserver(()=>{fit();if(state.hoveredPostId)anchor(state.hoveredPostId);});resize.observe(canvas.parentElement!);
  let lastDiagnostics=0,slowRenderFrames=0;
  function publishDiagnostics(now:number){
    canvas.dataset.ready='true';canvas.dataset.frames=String(frames);canvas.dataset.weather=rainy?'rain':'clear';canvas.dataset.renderer=engine.webGLVersion===2?'webgl2':'webgl1';
    canvas.dataset.cameraX=camera.target.x.toFixed(2);canvas.dataset.cameraZ=camera.target.z.toFixed(2);canvas.dataset.rainDrops=String(drops.length);
    canvas.dataset.sceneMeshes=String(scene.meshes.length);canvas.dataset.sceneMaterials=String(scene.materials.length);canvas.dataset.sceneVertices=String(scene.getTotalVertices());canvas.dataset.thinInstances=String(scene.meshes.reduce((sum,mesh)=>sum+('thinInstanceCount' in mesh?Number(mesh.thinInstanceCount):0),0));lastDiagnostics=now;
  }
  function render(){
    if(disposed||!inView||!visible)return;
    const now=performance.now();if(now-lastFrame<33)return;
    const dt=Math.min(0.05,lastFrame?(now-lastFrame)/1000:0.016);lastFrame=now;elapsed+=dt;
    const slot=Math.floor(Date.now()/900000);
    if(slot!==weatherSlot){weatherSlot=slot;rainy=weatherIsRainy(layout.seed,slot);populate();lighting();}
    if(!state.reducedMotion)tickLife(citizens,dt,layout);
    citizens.forEach((p,i)=>{
      const f=figures[i];f.root.position.set(p.position.x,0.10,p.position.z);
      // Raised bridge follows its real deck, with short ramps at both ends.
      if(world.bridge){const b=world.bridge,dx=p.position.x-b.x,dz=p.position.z-b.z,c=Math.cos(b.rotationY),s=Math.sin(b.rotationY),along=dx*c-dz*s,across=dx*s+dz*c;if(Math.abs(across)<0.85&&Math.abs(along)<2.2)f.root.position.y=0.10+0.12*Math.min(1,(2.2-Math.abs(along))/0.3);}
      if(p.state==='entering')f.root.position.z-=0.32*Math.min(1,p.timer/0.8);
      if(p.state==='exiting')f.root.position.z-=0.32*(1-Math.min(1,p.timer/0.8));
      // Conversation pose is derived from the base route position each frame,
      // never accumulated into the agent's navigation coordinates.
      if(p.conversation>0){const side=i%2?1:-1;f.root.position.x+=side*0.09*p.conversation;}
      f.root.rotation.y=Math.atan2(p.facing.x,p.facing.z);
      const step=p.moving&&!state.reducedMotion?Math.sin(elapsed*9+i)*0.36:0;
      f.limbs[0].rotation.x=step;f.limbs[1].rotation.x=-step;f.limbs[2].rotation.x=-step*0.6;f.limbs[3].rotation.x=step*0.6;
      const edge=Math.min(p.position.x-BOARD.minX,BOARD.maxX-p.position.x,p.position.z-BOARD.minZ,BOARD.maxZ-p.position.z);
      for(const m of f.meshes)m.visibility=p.opacity*Math.max(0,Math.min(1,edge/0.5));
    });
    if(rainy&&!state.reducedMotion){for(let i=0;i<drops.length;i++){const d=drops[i];d.y-=dt*d.speed;if(d.y<0.1)d.y+=13;const offset=i*6;rainPositions[offset]=d.x;rainPositions[offset+1]=d.y;rainPositions[offset+2]=d.z;rainPositions[offset+3]=d.x-0.12;rainPositions[offset+4]=d.y-0.65;rainPositions[offset+5]=d.z-0.04;}rainMesh.updateVerticesData(VertexBuffer.PositionKind,rainPositions,false,false);}
    for(const m of world.glints)m.visibility=0.65+Math.sin(elapsed*1.5)*0.15;
    const renderStarted=performance.now();scene.render();const renderCost=performance.now()-renderStarted;frames++;
    if(frames===1)onFirstFrame?.();
    if(ao&&renderCost>55){slowRenderFrames++;if(slowRenderFrames>=4){ao.dispose();ao=undefined;canvas.dataset.adaptiveAo='off';}}else slowRenderFrames=Math.max(0,slowRenderFrames-1);
    if(frames===1||now-lastDiagnostics>500)publishDiagnostics(now);
  }
  const syncVisibility=()=>{if(inView&&visible){lastFrame=0;engine.runRenderLoop(render);}else engine.stopRenderLoop(render);};
  const observer=new IntersectionObserver(([entry])=>{inView=!!entry?.isIntersecting;syncVisibility();});observer.observe(canvas);
  const onVisibility=()=>{visible=!document.hidden;syncVisibility();};document.addEventListener('visibilitychange',onVisibility);
  engine.runRenderLoop(render);
  return {
    update,anchor,
    zoom(amount:number){zoom=Math.max(0.75,Math.min(2.6,zoom+amount));fit();},
    home(){zoom=defaultZoom;camera.target.set(0,0.2,0);fit();},
    dispose(){disposed=true;engine.stopRenderLoop(render);resize.disconnect();observer.disconnect();document.removeEventListener('visibilitychange',onVisibility);canvas.removeEventListener('pointermove',onMove);canvas.removeEventListener('pointerleave',onLeave);canvas.removeEventListener('pointerdown',onDown);canvas.removeEventListener('pointerup',onUp);canvas.removeEventListener('pointercancel',onCancel);ao?.dispose();scene.dispose();engine.dispose();},
  };
}
