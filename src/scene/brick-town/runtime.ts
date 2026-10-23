import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { Camera } from '@babylonjs/core/Cameras/camera.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CubeTexture } from '@babylonjs/core/Materials/Textures/cubeTexture.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
// Scene.pick is an optional Babylon extension; this side-effect registration is
// required after switching from the barrel import to tree-shaken modules.
import '@babylonjs/core/Culling/ray.js';
import { BOARD, buildWorld, randomFor } from './world';
import { buildHouse, FLOOR_HEIGHT, GROUND_Y } from './buildings';
import { buildMinifig } from './minifig';
import { createLife, tickLife, type Citizen } from './life';
import { weatherIsPrecipitating } from '../../data/town-weather';
import { SEASON_PROFILES } from '../../data/town-seasons';
import { createSeasonController } from './seasons';
import { createWeatherController } from './weather';
import type { TownLayout } from '../../data/town-layout';
import type { TownSceneProps } from './types';
import { clampToPanBounds, getCameraPanBounds, getDragPanDelta } from './view';

export type SceneState = Pick<TownSceneProps,'activePostId'|'hoveredPostId'|'query'|'category'|'tag'|'colorMode'|'reducedMotion'|'season'>;
export type SceneCallbacks = Pick<TownSceneProps,'onHoverPost'|'onResolvePostAnchor'|'onSelectPost'>;
const color=(hex:string)=>Color3.FromHexString(hex);

export function mountBrickTown(canvas:HTMLCanvasElement,layout:TownLayout,posts:TownSceneProps['posts'],initial:SceneState,callbacks:()=>SceneCallbacks,onFirstFrame?:()=>void,onZoomChange?:(zoom:number,defaultZoom:number)=>void) {
  const mobile=canvas.clientWidth<720;
  const engine=new Engine(canvas,true,{stencil:true,preserveDrawingBuffer:false,powerPreference:'default'});
  // A 1.25 DPR ceiling keeps bevel highlights crisp while avoiding the 2.25x
  // render-target cost that a 1.5 DPR cap caused on Retina displays.
  const maxDpr = mobile ? 1 : 1.25;
  engine.setHardwareScalingLevel(1/Math.min(window.devicePixelRatio,maxDpr));
  const scene=new Scene(engine);
  scene.clearColor=Color4.FromHexString('#ffffffff');
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
  const shadows=new ShadowGenerator(mobile?512:2048,sun);
  shadows.usePercentageCloserFiltering=!mobile;shadows.filteringQuality=mobile?ShadowGenerator.QUALITY_LOW:ShadowGenerator.QUALITY_MEDIUM;
  shadows.bias=0.00012;shadows.normalBias=0.018;
  // Only static architecture and scenery cast shadows. Rendering this depth map
  // once preserves the same town lighting without paying for it every frame.
  shadows.getShadowMap()!.refreshRate=0;
  const world=buildWorld(scene,layout,mobile);
  const houses=layout.plots.map(p=>buildHouse(scene,p,mobile));
  const houseMeshes=houses.flatMap(h=>h.meshes);
  const seasons=createSeasonController({scene,world,mobile,seed:layout.seed,surfaces:[...world.snowSurfaces,...houses.flatMap(h=>h.snowSurfaces)]});
  const weather=createWeatherController(scene,layout.seed,mobile);
  seasons.set(initial.season,initial.reducedMotion);
  let seasonChanges=0;
  // Terrain plates cannot cast a useful shadow onto themselves. Excluding that
  // multi-million-instance surface cuts most shadow-map geometry while houses,
  // trees, props and citizens retain their natural shadows.
  for(const m of [...world.shadowCasters,...houseMeshes,...seasons.meshes.filter(m=>!m.metadata.thinInstances)])shadows.addShadowCaster(m);
  for(const m of [...world.meshes,...houseMeshes]){m.computeWorldMatrix(true);m.freezeWorldMatrix();}
  let glow:import('@babylonjs/core/Layers/glowLayer.js').GlowLayer|undefined;
  let highlights:import('@babylonjs/core/Layers/highlightLayer.js').HighlightLayer|undefined;
  let fxaa:import('@babylonjs/core/PostProcesses/fxaaPostProcess.js').FxaaPostProcess|undefined;
  let disposed=false;
  let effectsReady=false;
  const initVisualEffects=async()=>{
    if(disposed||effectsReady)return;
    const [layers,highlightModule,fxaaModule]=await Promise.all([
      import('@babylonjs/core/Layers/glowLayer.js'),
      import('@babylonjs/core/Layers/highlightLayer.js'),
      mobile?Promise.resolve(undefined):import('@babylonjs/core/PostProcesses/fxaaPostProcess.js'),
    ]);
    if(disposed)return;
    glow=new layers.GlowLayer('warm-window-scatter',scene,{mainTextureRatio:mobile?0.24:0.35});glow.intensity=0.22;
    // Empty include lists glow every emissive object. Explicit exclusions prevent
    // filter outlines from turning whole houses into night lights.
    for(const m of [...world.meshes,...seasons.meshes])glow.addExcludedMesh(m);
    for(const m of houseMeshes)if(!m.metadata.glass)glow.addExcludedMesh(m);
    highlights=new highlightModule.HighlightLayer('article-floor-highlight',scene,{mainTextureRatio:mobile?0.32:0.5});
    highlights.blurHorizontalSize=mobile?0.35:0.55;highlights.blurVerticalSize=mobile?0.35:0.55;highlights.innerGlow=false;
    if(fxaaModule){fxaa=new fxaaModule.FxaaPostProcess('brick-fxaa',1,camera);fxaa.samples=1;}
    effectsReady=true;
    lighting();
    update(state);
  };
  let ao:import('@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline.js').SSAO2RenderingPipeline|undefined;
  // Contact AO is a secondary refinement, so load it in a separate chunk while
  // the brick assembly overlay is playing instead of blocking the first frame.
  if(!mobile&&engine.webGLVersion===2) void import('@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline.js').then(({SSAO2RenderingPipeline})=>{
    if(disposed)return;
    ao=new SSAO2RenderingPipeline('brick-contact-shadows',scene,{ssaoRatio:0.5,blurRatio:0.5},[camera]);
    ao.radius=0.35;ao.totalStrength=1.0;ao.samples=8;ao.expensiveBlur=false;
  });
  const postMap=new Map(posts.map(p=>[p.id,p]));
  let state={...initial};let frames=0;let elapsed=0;
  let inView=true,visible=!document.hidden,lastFrame=0;
  let weatherSlot=Math.floor(Date.now()/900000),rainy=weatherIsPrecipitating(layout.seed,weatherSlot);
  let citizens:Citizen[]=[],figures:ReturnType<typeof buildMinifig>[]=[];
  function populate() {
    citizens=createLife(layout,state.colorMode==='night',rainy,randomFor(`${layout.seed}:${state.colorMode}:${weatherSlot}`));
    rebuildFigures();
    // Minifigures are tiny at the map scale; omitting their animated shadow-map
    // passes removes most per-frame shadow draw calls with no visible town loss.
  }
  function rebuildFigures() {
    for(const figure of figures)figure.root.dispose(false,false);
    figures=citizens.map((p,i)=>buildMinifig(scene,p.role,i,state.colorMode==='night',rainy&&state.season!=='winter'));
  }
  function lighting() {
    const night=state.colorMode==='night',profile=SEASON_PROFILES[state.season];
    scene.clearColor=Color4.FromHexString(night?'#0b1220ff':'#ffffffff');
    sun.intensity=night?0.45:rainy?0.75:1.5;sun.diffuse=color(night?'#9cbce8':rainy?'#dbe5e8':profile.lighting.sun);
    hemi.diffuse=color(profile.lighting.sky);
    hemi.intensity=night?0.18:rainy?0.40:0.25;scene.environmentIntensity=night?0.20:0.5;
    scene.imageProcessingConfiguration.exposure=night?0.8:0.82;
    for(const m of houseMeshes)if(m.metadata.glass){
      const mat=m.material as PBRMaterial;mat.emissiveColor=night?color('#ffb751'):Color3.Black();mat.emissiveIntensity=night?1.5:0;
      mat.albedoColor=color(night?'#edbd6d':'#5e97a4');
    }
    for(const m of world.lamps){const mat=m.material as PBRMaterial;mat.emissiveColor=night?color('#ffba5b'):Color3.Black();mat.emissiveIntensity=night?1.5:0;}
    weather.set(profile.precipitation,rainy,state.reducedMotion);if(glow)glow.isEnabled=night;
  }
  function update(next:SceneState) {
    const seasonChanged=next.season!==state.season;
    const rebuildPeople=next.colorMode!==state.colorMode;
    const environmentChanged=rebuildPeople||seasonChanged||next.reducedMotion!==state.reducedMotion;
    if(seasonChanged) {
      for(const mesh of seasons.meshes){highlights?.removeMesh(mesh);glow?.removeExcludedMesh(mesh);shadows.removeShadowCaster(mesh);}
      seasons.set(next.season,next.reducedMotion);seasonChanges++;
      for(const mesh of seasons.meshes){glow?.addExcludedMesh(mesh);if(!mesh.metadata.thinInstances)shadows.addShadowCaster(mesh);}
      shadows.getShadowMap()?.resetRefreshCounter();
    }
    state={...next};if(rebuildPeople)populate();else if(seasonChanged)rebuildFigures();if(environmentChanged)lighting();
    if(state.reducedMotion)seasons.tick(0,true);
    const needle=state.query.trim().toLowerCase();let hasHighlight=false;
    for(const mesh of [...houseMeshes,...seasons.articleMeshes]){
      const post=postMap.get(mesh.metadata.postId);if(!post)continue;
      const matches=!!(needle||state.category||state.tag)&&(!needle||[post.title,post.description,post.category,...post.tags,post.series??''].join(' ').toLowerCase().includes(needle))&&(!state.category||post.category===state.category)&&(!state.tag||post.tags.includes(state.tag));
      const direct=post.id===state.hoveredPostId||post.id===state.activePostId;
      if(!highlights)continue;
      if(direct||matches){highlights.addMesh(mesh,color(direct?'#90e3d4':'#edbb53'));hasHighlight=true;}else highlights.removeMesh(mesh);
    }
    if(highlights)highlights.isEnabled=hasHighlight;
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
  const pointers=new Map<number,{x:number;y:number;type:string}>();
  let pinch:{startDistance:number;startZoom:number;moved:boolean}|undefined;
  const clampZoom=(value:number)=>Math.max(0.75,Math.min(2.6,value));
  const distanceBetween=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
  const applyZoom=(nextZoom:number)=>{const clamped=clampZoom(nextZoom);if(Math.abs(clamped-zoom)<0.0001)return;zoom=clamped;fit();onZoomChange?.(zoom,defaultZoom);};
  function pick(event:PointerEvent){
    const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
    // Pick ALL real solid surfaces. Roof/terrain/tree occlusion is respected;
    // a hidden wall can never be clicked through another object.
    const hit=scene.pick(x,y,m=>m.isPickable&&m.isVisible);
    return hit?.hit?hit.pickedMesh?.metadata?.postId as string|undefined:undefined;
  }
  const onMove=(e:PointerEvent)=>{
    if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,type:e.pointerType});
    if(pinch&&pointers.size>=2){
      const [a,b]=Array.from(pointers.values());
      const ratio=distanceBetween(a,b)/Math.max(1,pinch.startDistance);
      if(Math.abs(ratio-1)>0.01)pinch.moved=true;
      applyZoom(pinch.startZoom*ratio);
      lastHover=undefined;callbacks().onHoverPost(undefined);
      canvas.style.cursor='grabbing';
      return;
    }
    if(down&&e.pointerId===down.pointerId&&e.buttons===1){
      const dx=e.clientX-down.lastX,dy=e.clientY-down.lastY;
      down.lastX=e.clientX;down.lastY=e.clientY;
      const totalX=e.clientX-down.x,totalY=e.clientY-down.y;
      // Let the browser own vertical touch scrolling (touch-action: pan-y).
      // Once a horizontal map drag starts, all movement belongs to that drag.
      if(e.pointerType==='touch'&&!down.moved&&Math.abs(totalY)>Math.abs(totalX))return;
      if(down.moved||Math.hypot(totalX,totalY)>7){
        if(!down.moved){lastHover=undefined;callbacks().onHoverPost(undefined);}
        down.moved=true;
        const perPixel=(camera.orthoRight!-camera.orthoLeft!)/canvas.clientWidth;
        const pan=getDragPanDelta(camera.alpha,camera.beta,dx,dy,perPixel);
        camera.target.x+=pan.x;camera.target.z+=pan.z;
        clampCameraTarget();canvas.style.cursor='grabbing';
        return;
      }
    }
    // Touch has no hover: previews are selected explicitly on pointer-up.
    if(e.pointerType!=='mouse')return;
    const now=performance.now();if(now-lastPickAt<32)return;lastPickAt=now;
    const id=pick(e);canvas.style.cursor=id?'pointer':'grab';
    if(id!==lastHover){lastHover=id;callbacks().onHoverPost(id,id?{x:e.clientX,y:e.clientY}:undefined);}
  };
  const onLeave=(e:PointerEvent)=>{if(e.pointerType!=='mouse')return;lastHover=undefined;callbacks().onHoverPost(undefined);if(!down)canvas.style.cursor='grab';};
  let down:{x:number;y:number;lastX:number;lastY:number;pointerId:number;moved:boolean}|undefined;
  const onDown=(e:PointerEvent)=>{
    if(e.button!==0||(e.pointerType==='mouse'&&!e.isPrimary))return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,type:e.pointerType});
    canvas.setPointerCapture?.(e.pointerId);
    if(e.pointerType==='touch'&&pointers.size===2){
      const [a,b]=Array.from(pointers.values());
      pinch={startDistance:distanceBetween(a,b),startZoom:zoom,moved:false};
      if(down){down.moved=true;down=undefined;}
      lastHover=undefined;callbacks().onHoverPost(undefined);canvas.style.cursor='grabbing';
      return;
    }
    if(down||pointers.size!==1)return;
    down={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,pointerId:e.pointerId,moved:false};
  };
  const releasePointer=(pointerId:number)=>{if(canvas.hasPointerCapture?.(pointerId))canvas.releasePointerCapture(pointerId);pointers.delete(pointerId);};
  const finishPointer=(e:PointerEvent,select:boolean)=>{
    if(pinch){
      releasePointer(e.pointerId);
      if(pointers.size<2)pinch=undefined;
      canvas.style.cursor='grab';
      return;
    }
    if(!down||e.pointerId!==down.pointerId){releasePointer(e.pointerId);return;}
    if(select&&!down.moved&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<7){
      const id=pick(e);
      if(id)callbacks().onSelectPost(id,e.pointerType);
      else {lastHover=undefined;callbacks().onHoverPost(undefined);}
    }
    releasePointer(down.pointerId);
    down=undefined;canvas.style.cursor='grab';
  };
  const onUp=(e:PointerEvent)=>finishPointer(e,true);
  const onCancel=(e:PointerEvent)=>finishPointer(e,false);
  canvas.addEventListener('pointermove',onMove);canvas.addEventListener('pointerleave',onLeave);canvas.addEventListener('pointerdown',onDown);canvas.addEventListener('pointerup',onUp);canvas.addEventListener('pointercancel',onCancel);
  populate();lighting();update(initial);
  const resize=new ResizeObserver(()=>{fit();if(state.hoveredPostId)anchor(state.hoveredPostId);});resize.observe(canvas.parentElement!);
  let lastDiagnostics=0,slowRenderFrames=0;
  function publishDiagnostics(now:number){
    canvas.dataset.ready='true';canvas.dataset.frames=String(frames);canvas.dataset.weather=rainy?weather.kind:'clear';canvas.dataset.season=state.season;canvas.dataset.colorMode=state.colorMode;canvas.dataset.reducedMotion=String(state.reducedMotion);canvas.dataset.seasonChanges=String(seasonChanges);canvas.dataset.seasonCover=String(seasons.coverCount);canvas.dataset.seasonTransition=String(seasons.transitioning);canvas.dataset.precipitationAnimated=String(weather.animated);canvas.dataset.renderer=engine.webGLVersion===2?'webgl2':'webgl1';
    canvas.dataset.cameraX=camera.target.x.toFixed(2);canvas.dataset.cameraZ=camera.target.z.toFixed(2);canvas.dataset.zoom=zoom.toFixed(3);canvas.dataset.rainDrops=String(weather.count);
    canvas.dataset.sceneMeshes=String(scene.meshes.length);canvas.dataset.sceneMaterials=String(scene.materials.length);canvas.dataset.sceneVertices=String(scene.getTotalVertices());canvas.dataset.thinInstances=String(scene.meshes.reduce((sum,mesh)=>sum+('thinInstanceCount' in mesh?Number(mesh.thinInstanceCount):0),0));lastDiagnostics=now;
  }
  function render(){
    if(disposed||!inView||!visible)return;
    const now=performance.now();if(now-lastFrame<(mobile?1000/24:1000/30))return;
    const dt=Math.min(0.05,lastFrame?(now-lastFrame)/1000:0.016);lastFrame=now;elapsed+=dt;
    const slot=Math.floor(Date.now()/900000);
    if(slot!==weatherSlot){weatherSlot=slot;rainy=weatherIsPrecipitating(layout.seed,slot);populate();lighting();}
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
    weather.tick(dt);seasons.tick(dt,state.reducedMotion);
    if(!state.reducedMotion&&state.season!=='winter')for(const m of world.glints)m.visibility=0.65+Math.sin(elapsed*1.5)*0.15;
    const renderStarted=performance.now();scene.render();const renderCost=performance.now()-renderStarted;frames++;
    if(frames===1){onFirstFrame?.();window.setTimeout(()=>{void initVisualEffects();},mobile?350:0);}
    if(ao&&renderCost>55){slowRenderFrames++;if(slowRenderFrames>=4){ao.dispose();ao=undefined;canvas.dataset.adaptiveAo='off';}}else slowRenderFrames=Math.max(0,slowRenderFrames-1);
    if(frames===1||now-lastDiagnostics>500)publishDiagnostics(now);
  }
  const syncVisibility=()=>{if(inView&&visible){lastFrame=0;engine.runRenderLoop(render);}else engine.stopRenderLoop(render);};
  const observer=new IntersectionObserver(([entry])=>{inView=!!entry?.isIntersecting;syncVisibility();});observer.observe(canvas);
  const onVisibility=()=>{visible=!document.hidden;syncVisibility();};document.addEventListener('visibilitychange',onVisibility);
  onZoomChange?.(zoom,defaultZoom);
  engine.runRenderLoop(render);
  return {
    update,anchor,
    zoom(amount:number){applyZoom(zoom+amount);},
    home(){zoom=defaultZoom;camera.target.set(0,0.2,0);fit();onZoomChange?.(zoom,defaultZoom);},
    dispose(){disposed=true;engine.stopRenderLoop(render);resize.disconnect();observer.disconnect();document.removeEventListener('visibilitychange',onVisibility);canvas.removeEventListener('pointermove',onMove);canvas.removeEventListener('pointerleave',onLeave);canvas.removeEventListener('pointerdown',onDown);canvas.removeEventListener('pointerup',onUp);canvas.removeEventListener('pointercancel',onCancel);pointers.clear();pinch=undefined;down=undefined;ao?.dispose();seasons.dispose();weather.dispose();scene.dispose();engine.dispose();},
  };
}
