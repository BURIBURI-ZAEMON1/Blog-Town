import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { Camera } from '@babylonjs/core/Cameras/camera.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
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
import type { PickingInfo } from '@babylonjs/core/Collisions/pickingInfo.js';
import { BOARD, buildWorld, randomFor } from './world';
import { buildFeature, buildFriendHut } from './features';
import { buildHouse, FLOOR_HEIGHT, GROUND_Y } from './buildings';
import { buildMinifig } from './minifig';
import { createLife, tickLife, type Citizen } from './life';
import { weatherIsPrecipitating } from '../../data/town-weather';
import { blendTownDaylight, daylightStep, getTownDaylight } from '../../data/town-daylight';
import { SEASON_PROFILES } from '../../data/town-seasons';
import { createSeasonController } from './seasons';
import { createWeatherController } from './weather';
import { createPostNoticeProjector } from './post-notices';
import type { PostNoticeFrame } from '../../data/town-post-notices';
import type { TownLayout } from '../../data/town-layout';
import { clampToTownTerrain, townTerrainBounds } from '../../data/town-outline';
import type { TownSceneProps } from './types';
import { ARTICLE_FOCUS_MS, clampToPanBounds, getArticleFocusPose, getCameraPanBounds, getDragPanDelta } from './view';
import { configureTownEdgeShadows, edgeCloseAmount, TownEdgeField, townEdgeState, worldEdgeVisibility } from './edge-reveal';

export type SceneState = Pick<TownSceneProps,'activePostId'|'hoveredPostId'|'hoveredPlaceId'|'newPostIds'|'guidePostId'|'query'|'category'|'tag'|'colorMode'|'reducedMotion'|'season'>;
export type SceneCallbacks = Pick<TownSceneProps,'onHoverPlace'|'onResolvePlaceAnchor'|'onSelectPlace'|'onHoverPost'|'onResolvePostAnchor'|'onSelectPost'|'onTownExplored'> & {
  onResolveNewPostAnchors?: (frame: PostNoticeFrame) => void;
};
const color=(hex:string)=>Color3.FromHexString(hex);
// Discover desktop AO while React hydrates, not after scene construction. Its
// prepass can arrive before the first render rather than invalidating already
// compiled PBR materials later. Mobile never fetches this optional pipeline.
const contactShadowModule=typeof window!=='undefined'&&window.innerWidth>=720
  ? import('./desktop-pipeline').catch(()=>undefined)
  : undefined;

export function mountBrickTown(canvas:HTMLCanvasElement,layout:TownLayout,posts:TownSceneProps['posts'],initial:SceneState,callbacks:()=>SceneCallbacks,onFirstFrame?:()=>void) {
  const buildStarted=performance.now();
  const mobile=canvas.clientWidth<720;
  const engine=new Engine(canvas,true,{stencil:true,preserveDrawingBuffer:false,powerPreference:'default'});
  // A 1.25 DPR ceiling keeps bevel highlights crisp while avoiding the 2.25x
  // render-target cost that a 1.5 DPR cap caused on Retina displays.
  const maxDpr = mobile ? 1 : 1.25;
  engine.setHardwareScalingLevel(1/Math.min(window.devicePixelRatio,maxDpr));
  let disposed=false;
  let inView=true,visible=!document.hidden,lastFrame=0,renderBurst=8;
  let weatherWakeTimer:number|undefined;
  // Reduced-motion towns are visually static. Wake a short settling burst only
  // for changes, rather than continuously redrawing the identical GPU frame.
  function requestDraw() {
    if(disposed)return;
    window.clearTimeout(weatherWakeTimer);weatherWakeTimer=undefined;
    renderBurst=8;
    if(inView&&visible){canvas.dataset.renderLoop='active';engine.runRenderLoop(render);}
  }
  engine.onContextRestoredObservable.add(requestDraw);
  const scene=new Scene(engine);
  // Our throttled pointer handlers own the cursor; Babylon resets it on every move.
  scene.doNotHandleCursors=true;
  // Picking is handled explicitly below, with throttling and gesture detection.
  scene.skipPointerMovePicking=true;scene.skipPointerDownPicking=true;scene.skipPointerUpPicking=true;
  scene.blockMaterialDirtyMechanism=true;
  scene.clearColor=Color4.FromHexString('#ffffffff');
  scene.imageProcessingConfiguration.toneMappingEnabled=true;
  scene.imageProcessingConfiguration.toneMappingType=ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.contrast=1.06;
  const camera=new ArcRotateCamera('diorama-camera',Math.PI*0.68,0.96,36,new Vector3(0,0.2,0),scene);
  camera.mode=Camera.ORTHOGRAPHIC_CAMERA;
  camera.minZ=0.1;camera.maxZ=160;
  // Deliberate fixed composition keeps the article frontage readable. Zoom is
  // explicit; a click/touch never gets confused with an orbit gesture.
  const defaultZoom=mobile?1:1.9;
  let zoom=defaultZoom;
  const edgeState=townEdgeState(scene);
  edgeState.close=0;edgeState.lift=initial.reducedMotion?0:1;
  // Coarser mobile bricks need room for their full footprint before the screen edge.
  edgeState.inset=mobile?.065:0;
  const clampCameraTarget=()=>{
    const panBounds=getCameraPanBounds(
      townTerrainBounds,camera.alpha,camera.beta,
      camera.orthoRight!-camera.orthoLeft!,camera.orthoTop!-camera.orthoBottom!,
    );
    const clamped=clampToTownTerrain(clampToPanBounds(camera.target,panBounds));
    camera.target.x=clamped.x;camera.target.z=clamped.z;
  };
  let fittedWidth=0;
  const fit=(preserveView=false)=>{
    const width=canvas.clientWidth,height=canvas.clientHeight;
    if(!width||!height)return;
    if(mobile&&preserveView&&width===fittedWidth){
      // Browser chrome can resize the viewport when returning from system settings.
      // Extend/crop the bottom, keeping world scale and the top of the map fixed.
      const perPixel=(camera.orthoRight!-camera.orthoLeft!)/width;
      camera.orthoBottom=camera.orthoTop!-height*perPixel;
    }else{
      const aspect=width/height;
      const span=(mobile?34:Math.max(37,54/aspect))/zoom;
      camera.orthoTop=span/2;camera.orthoBottom=-span/2;
      camera.orthoLeft=-span*aspect/2;camera.orthoRight=span*aspect/2;
    }
    fittedWidth=width;
    clampCameraTarget();engine.resize();requestDraw();
  };
  fit();
  const hemi=new HemisphericLight('diffuse-sky',new Vector3(0,1,0),scene);
  hemi.specular=Color3.Black();
  const sun=new DirectionalLight('local-time-sun',new Vector3(0,-1,0),scene);
  sun.shadowMinZ=0.1;sun.shadowMaxZ=180;
  const shadows=new ShadowGenerator(mobile?512:2048,sun);
  shadows.usePercentageCloserFiltering=!mobile;shadows.filteringQuality=mobile?ShadowGenerator.QUALITY_LOW:ShadowGenerator.QUALITY_MEDIUM;
  shadows.bias=0.00012;shadows.normalBias=0.018;
  // Cache the static town shadow map; refresh for solar movement and transitions.
  shadows.getShadowMap()!.refreshRate=0;
  configureTownEdgeShadows(shadows,scene);
  const worldStarted=performance.now();
  const world=buildWorld(scene,layout,mobile);
  canvas.dataset.worldBuildMs=String(Math.round(performance.now()-worldStarted));
  const houses=layout.plots.map(p=>buildHouse(scene,p,mobile));
  const houseMeshes=houses.flatMap(h=>h.meshes);
  const features=(layout.features??[]).map(feature=>buildFeature(scene,feature,mobile));
  const huts=(layout.hamlet?.huts??[]).map(hut=>buildFriendHut(scene,hut,mobile));
  const places=[
    ...features.map(model=>({...model.feature,anchorY:model.anchorY,meshes:model.meshes})),
    ...huts.map(model=>({...model.hut,id:`friend:${model.hut.id}`,anchorY:model.anchorY,meshes:model.meshes})),
  ];
  const placeById=new Map(places.map(place=>[place.id,place]));
  const placeMeshes=places.flatMap(place=>place.meshes);
  edgeState.field=new TownEdgeField([
    ...world.decor.map(p=>({x:p.x,z:p.z,width:p.radius*2+.8,depth:p.radius*2+.8})),
    ...layout.entities.map(p=>({...p,width:p.width+.8,depth:p.depth+.8})),
    ...houses.map(h=>({...h.plot,width:h.plot.width+.8,depth:h.plot.depth+.8})),
    ...places.map(place=>({...place,width:place.width+.8,depth:place.depth+.8})),
  ]);
  const postNotices=createPostNoticeProjector(scene,camera,houses);
  const seasons=createSeasonController({scene,world,mobile,seed:layout.seed,surfaces:[...world.snowSurfaces,...houses.flatMap(h=>h.snowSurfaces)]});
  const weather=createWeatherController(scene,layout.seed,mobile);
  seasons.set(initial.season,initial.reducedMotion);
  let seasonChanges=0;
  // Terrain plates cannot cast a useful shadow onto themselves. Excluding that
  // multi-million-instance surface cuts most shadow-map geometry while houses,
  // trees, props and citizens retain their natural shadows.
  for(const m of [...world.shadowCasters,...houseMeshes,...placeMeshes,...seasons.meshes.filter(m=>!m.metadata.thinInstances)])shadows.addShadowCaster(m);
  for(const m of [...world.meshes,...houseMeshes,...placeMeshes]){m.computeWorldMatrix(true);m.freezeWorldMatrix();}
  let glow:import('@babylonjs/core/Layers/glowLayer.js').GlowLayer|undefined;
  let highlights:import('@babylonjs/core/Layers/highlightLayer.js').HighlightLayer|undefined;
  let fxaa:import('@babylonjs/core/PostProcesses/fxaaPostProcess.js').FxaaPostProcess|undefined;
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
    glow.customEmissiveColorSelector=(mesh,_subMesh,material,result)=>{
      const mat=material as PBRMaterial,point=mesh.getBoundingInfo().boundingBox.centerWorld;
      const house=houseByPostId.get(mesh.metadata?.postId);
      const reveal=worldEdgeVisibility(scene,house?.plot.x??point.x,0,house?.plot.z??point.z);
      const strength=(mat.emissiveIntensity??1)*reveal;
      result.set((mat.emissiveColor?.r??0)*strength,(mat.emissiveColor?.g??0)*strength,(mat.emissiveColor?.b??0)*strength,mat.alpha);
    };
    // Empty include lists glow every emissive object. Explicit exclusions prevent
    // filter outlines from turning whole houses into night lights.
    for(const m of [...world.meshes,...seasons.meshes])glow.addExcludedMesh(m);
    for(const m of houseMeshes)if(!m.metadata.glass)glow.addExcludedMesh(m);
    highlights=new highlightModule.HighlightLayer('article-floor-highlight',scene,{mainTextureRatio:mobile?0.32:0.5});
    highlights.blurHorizontalSize=mobile?0.35:0.55;highlights.blurVerticalSize=mobile?0.35:0.55;highlights.innerGlow=false;
    if(fxaaModule){fxaa=new fxaaModule.FxaaPostProcess('brick-fxaa',1,camera);fxaa.samples=1;}
    effectsReady=true;canvas.dataset.effectsReady='true';
    lighting();
    update(state);
  };
  let ao:import('./desktop-pipeline').SSAO2RenderingPipeline|undefined;
  if(!mobile&&engine.webGLVersion===2) void (contactShadowModule??import('./desktop-pipeline')).then(module=>{
    if(disposed||!module)return;
    ao=new module.SSAO2RenderingPipeline('brick-contact-shadows',scene,{ssaoRatio:0.5,blurRatio:0.5},[camera]);
    ao.radius=0.35;ao.totalStrength=1.0;ao.samples=8;ao.expensiveBlur=false;
    canvas.dataset.contactShadows='on';requestDraw();
  }).catch(()=>{ /* Keep the base scene usable if this optional chunk fails. */ });
  const postMap=new Map(posts.map(p=>[p.id,p]));
  const postSearchText=new Map(posts.map(p=>[p.id,[p.title,p.description,p.category,...p.tags,p.series??''].join(' ').toLowerCase()]));
  const houseByPostId=new Map<string,ReturnType<typeof buildHouse>>();
  for(const house of houses)for(const id of house.ids)houseByPostId.set(id,house);
  let articleMeshes=[...houseMeshes,...seasons.articleMeshes];
  let highlightSignature='';
  let state={...initial};let frames=0;let elapsed=0;
  let weatherSlot=Math.floor(Date.now()/900000),rainy=weatherIsPrecipitating(layout.seed,weatherSlot);
  let lightTarget=getTownDaylight(new Date(Date.now()),state.colorMode==='night',rainy);
  let light=lightTarget,lightClock=Date.now(),lightUntil=0,lastLightAt=0;
  const shadowDirection=Vector3.Zero();
  let townNight=light.night>=.5;
  const lampColor=color('#ffba5b'),windowColor=color('#ffb751');
  const dayGlass=color('#5e97a4'),nightGlass=color('#edbd6d'),overcast=color('#bac4ce');
  let citizens:Citizen[]=[],figures:ReturnType<typeof buildMinifig>[]=[];
  function populate() {
    citizens=createLife(layout,townNight,rainy,randomFor(`${layout.seed}:${townNight}:${weatherSlot}`));
    rebuildFigures();
    // Minifigures are tiny at the map scale; omitting their animated shadow-map
    // passes removes most per-frame shadow draw calls with no visible town loss.
  }
  function rebuildFigures() {
    for(const figure of figures)figure.root.dispose(false,false);
    figures=citizens.map((p,i)=>buildMinifig(scene,p.role,i,townNight,rainy&&state.season!=='winter'));
  }
  function lighting() {
    lightClock=Date.now();
    const next=getTownDaylight(new Date(lightClock),state.colorMode==='night',rainy);
    const now=performance.now();
    const changed=Math.abs(next.night-lightTarget.night)>.02||next.cloud!==lightTarget.cloud||Math.hypot(...next.direction.map((v,i)=>v-lightTarget.direction[i]))>.05;
    lightTarget=next;
    if(changed){lightUntil=frames?now+2200:0;lastLightAt=now;}
    // The page theme owns the background, independently of the town's solar day.
    scene.clearColor=Color4.FromHexString(state.colorMode==='night'?'#0b1220ff':'#ffffffff');
    applyLighting(now);
  }
  function applyLighting(now:number) {
    const amount=now>=lightUntil?1:1-Math.exp(-(now-lastLightAt)/320);
    light=blendTownDaylight(light,lightTarget,amount);lastLightAt=now;
    const {night,cloud}=light,day=1-night;
    sun.direction.copyFromFloats(...light.direction).normalize();
    sun.position.copyFrom(sun.direction).scaleInPlace(-70);
    // Direct sunlight vanishes before rain appears, including during transitions.
    sun.intensity=light.sun*(1-daylightStep(0,.55,cloud));
    sun.diffuse.copyFromFloats(...light.sunColor);sun.specular.copyFrom(sun.diffuse);
    hemi.diffuse.copyFromFloats(...light.skyColor);Color3.LerpToRef(hemi.diffuse,overcast,cloud*.8,hemi.diffuse);
    hemi.groundColor.copyFromFloats(...light.groundColor);
    hemi.intensity=light.sky+cloud*day*.13;
    scene.imageProcessingConfiguration.exposure=light.exposure-cloud*day*.08;
    shadows.setDarkness(1-daylightStep(0,.18,sun.intensity)*.95);
    edgeState.sunRay=[sun.direction.x,sun.direction.y,sun.direction.z];
    edgeState.cloudStrength=mobile?0:.4*daylightStep(0,.5,sun.intensity);
    if(sun.intensity>.001&&!sun.direction.equalsWithEpsilon(shadowDirection,.000001)){
      shadows.getShadowMap()?.resetRefreshCounter();shadowDirection.copyFrom(sun.direction);
    }
    for(const m of [...houseMeshes,...placeMeshes])if(m.metadata.glass){
      const mat=m.material as PBRMaterial;mat.emissiveColor.copyFrom(windowColor);mat.emissiveIntensity=night*1.5;
      Color3.LerpToRef(dayGlass,nightGlass,night,mat.albedoColor);
    }
    for(const m of world.lamps){const mat=m.material as PBRMaterial;mat.emissiveColor.copyFrom(lampColor);mat.emissiveIntensity=night*1.5;}
    weather.set(SEASON_PROFILES[state.season].precipitation,cloud>.6,state.reducedMotion,daylightStep(.6,1,cloud));
    if(glow)glow.isEnabled=night>.001;
    const nextNight=night>=.5;
    if(nextNight!==townNight){townNight=nextNight;populate();}
  }
  function update(next:SceneState) {
    const seasonChanged=next.season!==state.season;
    const environmentChanged=next.colorMode!==state.colorMode||seasonChanged||next.reducedMotion!==state.reducedMotion;
    if(seasonChanged) {
      for(const mesh of seasons.meshes){highlights?.removeMesh(mesh);glow?.removeExcludedMesh(mesh);shadows.removeShadowCaster(mesh);}
      seasons.set(next.season,next.reducedMotion);seasonChanges++;
      for(const mesh of seasons.meshes){glow?.addExcludedMesh(mesh);if(!mesh.metadata.thinInstances)shadows.addShadowCaster(mesh);}
      shadows.getShadowMap()?.resetRefreshCounter();
      articleMeshes=[...houseMeshes,...seasons.articleMeshes];
    }
    state={...next};if(seasonChanged)rebuildFigures();if(environmentChanged)lighting();
    if(state.reducedMotion)seasons.tick(0,true);
    const nextHighlightSignature=[state.query,state.category??'',state.tag??'',state.hoveredPostId??'',state.hoveredPlaceId??'',state.activePostId??'',state.season].join('\u0000');
    if(highlights && nextHighlightSignature!==highlightSignature) {
      const needle=state.query.trim().toLowerCase();let hasHighlight=false;
      for(const mesh of articleMeshes){
        const post=postMap.get(mesh.metadata.postId);if(!post)continue;
        const matches=!!(needle||state.category||state.tag)&&(!needle||postSearchText.get(post.id)?.includes(needle))&&(!state.category||post.category===state.category)&&(!state.tag||post.tags.includes(state.tag));
        const direct=post.id===state.hoveredPostId||post.id===state.activePostId;
        const house=houseByPostId.get(post.id);
        const revealed=house&&worldEdgeVisibility(scene,house.plot.x,0,house.plot.z)>.01;
        if((direct||matches)&&revealed){highlights.addMesh(mesh,color(direct?'#90e3d4':'#edbb53'));hasHighlight=true;}else highlights.removeMesh(mesh);
      }
      for(const place of places)for(const mesh of place.meshes){
        if(place.id===state.hoveredPlaceId&&worldEdgeVisibility(scene,place.x,0,place.z)>.01){highlights.addMesh(mesh,color('#90e3d4'));hasHighlight=true;}else highlights.removeMesh(mesh);
      }
      highlights.isEnabled=hasHighlight;
      highlightSignature=nextHighlightSignature;
    }
    if(state.hoveredPostId)anchor(state.hoveredPostId);
    if(state.hoveredPlaceId)anchorPlace(state.hoveredPlaceId);
    requestDraw();
  }
  function anchor(id:string){
    const house=houseByPostId.get(id);if(!house)return;
    const i=house.ids.indexOf(id),point=new Vector3(house.plot.x,GROUND_Y+(i+0.6)*FLOOR_HEIGHT,house.plot.z);
    const rect=canvas.getBoundingClientRect();
    const p=Vector3.Project(point,Matrix.Identity(),scene.getTransformMatrix(),camera.viewport.toGlobal(engine.getRenderWidth(),engine.getRenderHeight()));
    const a={x:rect.left+p.x*rect.width/engine.getRenderWidth(),y:rect.top+p.y*rect.height/engine.getRenderHeight()};
    callbacks().onResolvePostAnchor(id,a);return a;
  }
  function anchorPlace(id:string){
    const place=placeById.get(id);if(!place)return;
    const rect=canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const p=Vector3.Project(new Vector3(place.x,GROUND_Y+place.anchorY,place.z),Matrix.Identity(),scene.getTransformMatrix(),camera.viewport.toGlobal(engine.getRenderWidth(),engine.getRenderHeight()));
    callbacks().onResolvePlaceAnchor?.(id,{x:rect.left+p.x*rect.width/engine.getRenderWidth(),y:rect.top+p.y*rect.height/engine.getRenderHeight()});
  }
  const clearHover=()=>{lastHover=undefined;callbacks().onHoverPost(undefined);callbacks().onHoverPlace?.(undefined);};
  let lastHover:string|undefined,lastPickAt=0;
  const pointers=new Map<number,{x:number;y:number;type:string}>();
  let pinch:{startDistance:number;startZoom:number;moved:boolean}|undefined;
  const clampZoom=(value:number)=>Math.max(0.75,Math.min(2.6,value));
  const distanceBetween=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
  const applyZoom=(nextZoom:number)=>{
    const clamped=clampZoom(nextZoom);if(Math.abs(clamped-zoom)<0.0001)return;
    const scale=zoom/clamped;
    const centerX=(camera.orthoLeft!+camera.orthoRight!)/2,centerY=(camera.orthoTop!+camera.orthoBottom!)/2;
    // Zoom the current framing, including any bottom crop from browser chrome.
    camera.orthoLeft=centerX+(camera.orthoLeft!-centerX)*scale;
    camera.orthoRight=centerX+(camera.orthoRight!-centerX)*scale;
    camera.orthoTop=centerY+(camera.orthoTop!-centerY)*scale;
    camera.orthoBottom=centerY+(camera.orthoBottom!-centerY)*scale;
    zoom=clamped;clampCameraTarget();requestDraw();
  };
  let focusFlight: { from: { x:number; y:number; z:number; zoom:number }; to: Vector3; started:number; onComplete:()=>void; onCancel?:()=>void } | undefined;
  function cancelFocus(){if(!focusFlight)return;const cancel=focusFlight.onCancel;focusFlight=undefined;delete canvas.dataset.focusPost;delete canvas.dataset.focusProgress;cancel?.();}
  function focusTarget(id:string,to:Vector3,onComplete:()=>void,onCancel?:()=>void){
    if(disposed||!inView||!visible||!firstFramePublished)return false;
    cancelFocus();
    focusFlight={from:{x:camera.target.x,y:camera.target.y,z:camera.target.z,zoom},to,started:performance.now(),onComplete,onCancel};
    canvas.dataset.focusPost=id;canvas.dataset.focusProgress='0';
    canvas.dataset.focusDurationMs=String(ARTICLE_FOCUS_MS);
    clearHover();requestDraw();
    return true;
  }
  function focusPost(id:string,onComplete:()=>void){
    const house=houseByPostId.get(id);
    if(window.matchMedia('(max-width: 720px)').matches||state.reducedMotion||!house)return false;
    return focusTarget(id,new Vector3(house.plot.x,GROUND_Y+house.ids.length*FLOOR_HEIGHT*.5,house.plot.z),onComplete);
  }
  function focusPlace(id:string,onComplete:()=>void,onCancel?:()=>void){
    const place=placeById.get(id);if(!place)return false;
    const to=new Vector3(place.x,GROUND_Y+place.anchorY*.5,place.z);
    if(state.reducedMotion||mobile){applyZoom(Math.max(zoom,2.35));camera.target.copyFrom(to);requestDraw();onComplete();return true;}
    return focusTarget(id,to,onComplete,onCancel);
  }
  function pick(event:PointerEvent){
    const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
    // Pick ALL real solid surfaces. Roof/terrain/tree occlusion is respected;
    // a hidden wall can never be clicked through another object.
    const pickable=(m:import('@babylonjs/core/Meshes/abstractMesh.js').AbstractMesh)=>{
      if(!m.isPickable||!m.isVisible)return false;
      const house=houseByPostId.get(m.metadata?.postId);
      return !house||worldEdgeVisibility(scene,house.plot.x,0,house.plot.z)>.2;
    };
    const revealed=(hit:PickingInfo)=>{
      const mesh=hit.pickedMesh;
      if(!mesh)return true;
      const index=mesh.getIndices()?.[hit.faceId*3],anchors=mesh.getVerticesData('edgeAnchor');
      if(index===undefined||!anchors)return true;
      const point=Vector3.TransformCoordinates(new Vector3(anchors[index*2],0,anchors[index*2+1]),mesh.getWorldMatrix());
      return worldEdgeVisibility(scene,point.x,0,point.z)>.2;
    };
    let hit:PickingInfo|null=scene.pick(x,y,pickable);
    // An invisible tree must not occlude a visible article behind its footprint.
    if(hit?.hit&&!revealed(hit))hit=scene.multiPick(x,y,pickable)?.sort((a,b)=>a.distance-b.distance).find(revealed)??null;
    const data=hit?.hit?hit.pickedMesh?.metadata:undefined;
    return data?.friendId?`friend:${data.friendId}`:data?.featureId?`feature:${data.featureId}`:data?.postId as string|undefined;
  }
  const onWheel=(e:WheelEvent)=>{e.preventDefault();if(focusFlight){if(!focusFlight.onCancel)return;cancelFocus();}applyZoom(zoom-e.deltaY*0.0015);clearHover();};
  const onMove=(e:PointerEvent)=>{
    if(focusFlight)return;
    if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,type:e.pointerType});
    if(pinch&&pointers.size>=2){
      const [a,b]=Array.from(pointers.values());
      const ratio=distanceBetween(a,b)/Math.max(1,pinch.startDistance);
      if(Math.abs(ratio-1)>0.01)pinch.moved=true;
      applyZoom(pinch.startZoom*ratio);
      clearHover();
      canvas.style.cursor='grabbing';
      return;
    }
    if(down&&e.pointerId===down.pointerId&&e.buttons===1){
      const dx=e.clientX-down.lastX,dy=e.clientY-down.lastY;
      down.lastX=e.clientX;down.lastY=e.clientY;
      const totalX=e.clientX-down.x,totalY=e.clientY-down.y;
      if(down.moved||Math.hypot(totalX,totalY)>7){
        if(!down.moved){clearHover();}
        down.moved=true;
        const perPixel=(camera.orthoRight!-camera.orthoLeft!)/canvas.clientWidth;
        const pan=getDragPanDelta(camera.alpha,camera.beta,dx,dy,perPixel);
        camera.target.x+=pan.x;camera.target.z+=pan.z;
        clampCameraTarget();requestDraw();canvas.style.cursor='grabbing';
        return;
      }
    }
    // Touch has no hover: previews are selected explicitly on pointer-up.
    if(e.pointerType!=='mouse')return;
    const now=performance.now();if(now-lastPickAt<32)return;lastPickAt=now;
    const id=pick(e);canvas.style.cursor=id?'pointer':'grab';
    if(id!==lastHover){lastHover=id;const place=id?.startsWith('friend:')?id:id?.startsWith('feature:')?id.slice(8):undefined;callbacks().onHoverPost(place?undefined:id,id?{x:e.clientX,y:e.clientY}:undefined);callbacks().onHoverPlace?.(place,id?{x:e.clientX,y:e.clientY}:undefined);}
  };
  const onLeave=(e:PointerEvent)=>{if(e.pointerType!=='mouse')return;clearHover();if(!down)canvas.style.cursor='grab';};
  let down:{x:number;y:number;lastX:number;lastY:number;pointerId:number;moved:boolean}|undefined;
  const onDown=(e:PointerEvent)=>{
    if(focusFlight){if(!focusFlight.onCancel)return;cancelFocus();}
    if(e.button!==0||(e.pointerType==='mouse'&&!e.isPrimary))return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,type:e.pointerType});
    canvas.setPointerCapture?.(e.pointerId);
    if(e.pointerType==='touch'&&pointers.size===2){
      const [a,b]=Array.from(pointers.values());
      pinch={startDistance:distanceBetween(a,b),startZoom:zoom,moved:false};
      if(down){down.moved=true;down=undefined;}
      clearHover();canvas.style.cursor='grabbing';
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
      if(id?.startsWith('friend:'))callbacks().onSelectPlace?.(id);
      else if(id?.startsWith('feature:'))callbacks().onSelectPlace?.(id.slice(8));
      else if(id)callbacks().onSelectPost(id,e.pointerType);
      else {clearHover();}
    }
    releasePointer(down.pointerId);
    down=undefined;canvas.style.cursor='grab';
  };
  const onUp=(e:PointerEvent)=>finishPointer(e,true);
  const onCancel=(e:PointerEvent)=>finishPointer(e,false);
  canvas.addEventListener('wheel',onWheel,{passive:false});canvas.addEventListener('pointermove',onMove);canvas.addEventListener('pointerleave',onLeave);canvas.addEventListener('pointerdown',onDown);canvas.addEventListener('pointerup',onUp);canvas.addEventListener('pointercancel',onCancel);
  populate();lighting();update(initial);
  scene.blockMaterialDirtyMechanism=false;
  canvas.dataset.sceneBuildMs=String(Math.round(performance.now()-buildStarted));
  const resize=new ResizeObserver(()=>{fit(true);if(state.hoveredPostId)anchor(state.hoveredPostId);});resize.observe(canvas.parentElement!);
  let lastDiagnostics=0,slowRenderFrames=0,firstFramePublished=false;
  let edgeHighlightSignature='';
  const edgeTransform=Matrix.Zero();
  let edgeZoom=zoom,edgeInitialized=false,edgeWasReduced=state.reducedMotion;
  function publishDiagnostics(now:number){
    canvas.dataset.ready='true';canvas.dataset.frames=String(frames);canvas.dataset.weather=rainy?weather.kind:'clear';canvas.dataset.season=state.season;canvas.dataset.colorMode=state.colorMode;canvas.dataset.reducedMotion=String(state.reducedMotion);canvas.dataset.seasonChanges=String(seasonChanges);canvas.dataset.seasonCover=String(seasons.coverCount);canvas.dataset.seasonTransition=String(seasons.transitioning);canvas.dataset.precipitationAnimated=String(weather.animated);canvas.dataset.renderer=engine.webGLVersion===2?'webgl2':'webgl1';
    canvas.dataset.cameraX=camera.target.x.toFixed(2);canvas.dataset.cameraY=camera.target.y.toFixed(2);canvas.dataset.cameraZ=camera.target.z.toFixed(2);canvas.dataset.zoom=zoom.toFixed(3);canvas.dataset.rainDrops=String(weather.count);
    canvas.dataset.sceneMeshes=String(scene.meshes.length);canvas.dataset.sceneMaterials=String(scene.materials.length);canvas.dataset.sceneVertices=String(scene.getTotalVertices());canvas.dataset.thinInstances=String(scene.meshes.reduce((sum,mesh)=>sum+('thinInstanceCount' in mesh?Number(mesh.thinInstanceCount):0),0));lastDiagnostics=now;
    canvas.dataset.edgeReveal=edgeState.close.toFixed(3);
    canvas.dataset.edgeAnimating=String(edgeState.field.animating);
    canvas.dataset.solarHour=light.hour.toFixed(3);canvas.dataset.townNight=String(townNight);
    canvas.dataset.sunDirection=sun.direction.asArray().map(v=>v.toFixed(4)).join(',');canvas.dataset.sunIntensity=sun.intensity.toFixed(4);
    canvas.dataset.skyIntensity=hemi.intensity.toFixed(4);canvas.dataset.windowLight=light.night.toFixed(4);
    canvas.dataset.cloud=light.cloud.toFixed(4);canvas.dataset.lightTransition=String(now<lightUntil);
    canvas.dataset.lightCount=String(scene.lights.length);canvas.dataset.canvasBackground=scene.clearColor.toHexString();
    canvas.dataset.studioReflections=String(!!scene.environmentTexture);canvas.dataset.cloudShadows=mobile?'off':'on';
    canvas.dataset.cloudShadowStrength=edgeState.cloudStrength.toFixed(3);
  }
  function render(){
    if(disposed||!inView||!visible)return;
    const now=performance.now();if(now-lastFrame<(focusFlight?1000/60:mobile?1000/24:1000/30))return;
    const frameSeconds=lastFrame?(now-lastFrame)/1000:0.016;
    const dt=Math.min(0.05,frameSeconds);lastFrame=now;elapsed+=dt;
    let completedFocus:(()=>void)|undefined;
    if(focusFlight){
      const age=now-focusFlight.started;
      const pose=getArticleFocusPose(focusFlight.from,focusFlight.to,age);
      applyZoom(pose.zoom);
      camera.target.set(pose.x,pose.y,pose.z);
      canvas.dataset.focusProgress=String(Math.min(1,age/ARTICLE_FOCUS_MS));
      if(age>=ARTICLE_FOCUS_MS){completedFocus=focusFlight.onComplete;focusFlight=undefined;}
    }
    edgeState.close=edgeCloseAmount(zoom,defaultZoom);
    edgeState.lift=state.reducedMotion?0:1;
    scene.updateTransformMatrix();
    const transform=scene.getTransformMatrix();
    const edgeRevision=edgeState.field.revision;
    // Advance existing motion before assigning new targets, so the elapsed
    // time before a zoom cannot consume its entire retreat on the first frame.
    let edgeMoved=edgeState.field.tick(Math.min(.05,frameSeconds),state.reducedMotion);
    const edgeChanged=!edgeInitialized||edgeZoom!==zoom||!transform.equals(edgeTransform);
    if(edgeChanged){
      // Panning can discover new ground, but never withdraws an already revealed
      // piece. Both zoom directions settle into the same solid brick footprint.
      edgeState.field.retarget(transform.m,edgeState.inset,zoom!==edgeZoom,state.reducedMotion||!edgeInitialized,!edgeInitialized,edgeInitialized&&zoom>edgeZoom);
      edgeTransform.copyFrom(transform);edgeZoom=zoom;edgeInitialized=true;
      edgeMoved=edgeState.field.tick(0,state.reducedMotion)||edgeMoved;
    }
    if(edgeRevision!==edgeState.field.revision){edgeState.texture.update(edgeState.field.data);shadows.getShadowMap()?.resetRefreshCounter();}
    if(edgeWasReduced!==state.reducedMotion){edgeWasReduced=state.reducedMotion;shadows.getShadowMap()?.resetRefreshCounter();}
    const edgeHighlights=houses.map(house=>Number(worldEdgeVisibility(scene,house.plot.x,0,house.plot.z)>.01)).join('');
    if(edgeHighlights!==edgeHighlightSignature){edgeHighlightSignature=edgeHighlights;highlightSignature='';if(effectsReady)update(state);}
    const slot=Math.floor(Date.now()/900000);
    if(slot!==weatherSlot){weatherSlot=slot;rainy=weatherIsPrecipitating(layout.seed,slot);populate();lighting();}
    if(Math.abs(Date.now()-lightClock)>=1000)lighting();
    else if(light!==lightTarget&&(now-lastLightAt>=100||now>=lightUntil))applyLighting(now);
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
      const revealed=worldEdgeVisibility(scene,p.position.x,0,p.position.z);
      for(const m of f.meshes)m.visibility=p.opacity*Math.max(0,Math.min(1,edge/0.5))*revealed;
    });
    weather.tick(dt);seasons.tick(dt,state.reducedMotion);
    edgeState.cloudTime=state.reducedMotion?0:elapsed;
    if(state.season!=='winter')for(const m of world.glints)m.visibility=daylightStep(.05,.8,sun.intensity)*(state.reducedMotion?.65:.65+Math.sin(elapsed*1.5)*.15);
    if(state.hoveredPlaceId&&edgeChanged)anchorPlace(state.hoveredPlaceId);
    const renderStarted=performance.now();scene.render();const renderCost=performance.now()-renderStarted;frames++;
    const noticeFrame=postNotices.project(state.newPostIds, state.guidePostId, canvas.clientWidth, canvas.clientHeight);
    if(noticeFrame)callbacks().onResolveNewPostAnchors?.(noticeFrame);
    if(!firstFramePublished&&scene.isReady()){
      // A render call can finish while shader/texture imports are still pending.
      // Keep the loader until the base town can actually be drawn.
      firstFramePublished=true;
      onFirstFrame?.();
      // Present the complete base scene before attaching secondary pipelines.
      window.setTimeout(()=>{void initVisualEffects();},mobile?350:0);
    }
    if(ao&&renderCost>55){slowRenderFrames++;if(slowRenderFrames>=4){ao.dispose();ao=undefined;canvas.dataset.adaptiveAo='off';}}else slowRenderFrames=Math.max(0,slowRenderFrames-1);
    if(frames===1||focusFlight||completedFocus||edgeChanged||edgeMoved||now-lastDiagnostics>500)publishDiagnostics(now);
    completedFocus?.();
    if(state.reducedMotion&&--renderBurst<=0&&now>=lightUntil&&firstFramePublished&&effectsReady&&scene.isReady()&&engine.areAllEffectsReady()){
      engine.stopRenderLoop(render);canvas.dataset.renderLoop='idle';publishDiagnostics(now);
      // A static town sleeps between minute boundaries; weather slots align too.
      weatherWakeTimer=window.setTimeout(requestDraw,60000-Date.now()%60000+1);
    }
  }
  const syncVisibility=()=>{if(inView&&visible){lastFrame=0;requestDraw();}else{engine.stopRenderLoop(render);window.clearTimeout(weatherWakeTimer);weatherWakeTimer=undefined;canvas.dataset.renderLoop='paused';}};
  const observer=new IntersectionObserver(([entry])=>{inView=!!entry?.isIntersecting;syncVisibility();if(!inView&&focusFlight){const complete=focusFlight.onCancel?undefined:focusFlight.onComplete;cancelFocus();complete?.();}});observer.observe(canvas);
  const onVisibility=()=>{visible=!document.hidden;syncVisibility();if(!visible&&focusFlight){const complete=focusFlight.onCancel?undefined:focusFlight.onComplete;cancelFocus();complete?.();}};document.addEventListener('visibilitychange',onVisibility);
  engine.runRenderLoop(render);
  return {
    update,anchor,focusPost,focusPlace,cancelFocus,
    dispose(){cancelFocus();disposed=true;window.clearTimeout(weatherWakeTimer);engine.stopRenderLoop(render);resize.disconnect();observer.disconnect();document.removeEventListener('visibilitychange',onVisibility);canvas.removeEventListener('wheel',onWheel);canvas.removeEventListener('pointermove',onMove);canvas.removeEventListener('pointerleave',onLeave);canvas.removeEventListener('pointerdown',onDown);canvas.removeEventListener('pointerup',onUp);canvas.removeEventListener('pointercancel',onCancel);pointers.clear();pinch=undefined;down=undefined;ao?.dispose();seasons.dispose();weather.dispose();scene.dispose();engine.dispose();},
  };
}
