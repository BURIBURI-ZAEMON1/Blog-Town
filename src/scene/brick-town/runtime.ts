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
import { buildDiaryBoard, buildDiaryMonthMarker, buildFeature, buildFriendHut } from './features';
import { buildMinifig } from './minifig';
import { createLife, tickLife, type Citizen } from './life';
import { weatherIsPrecipitating } from '../../data/town-weather';
import { SEASON_PROFILES } from '../../data/town-seasons';
import { createSeasonController } from './seasons';
import { createWeatherController } from './weather';
import { createPostNoticeProjector } from './post-notices';
import type { PostNoticeFrame } from '../../data/town-post-notices';
import type { TownLayout } from '../../data/town-layout';
import type { TownSceneProps } from './types';
import { clampToPanBounds, getCameraPanBounds, getDragPanDelta } from './view';

export type SceneState = Pick<TownSceneProps,'activePostId'|'hoveredPostId'|'hoveredFeatureId'|'hoveredFriendId'|'selectedFriendId'|'focusedFriendId'|'hoveredDiaryId'|'focusedDiaryId'|'diaryFocusRevision'|'diaryMode'|'newPostIds'|'guidePostId'|'query'|'category'|'tag'|'colorMode'|'reducedMotion'|'season'>;
export type SceneCallbacks = Pick<TownSceneProps,'onHoverPost'|'onHoverFeature'|'onHoverFriend'|'onHoverDiary'|'onResolvePostAnchor'|'onResolveFeatureAnchor'|'onResolveFriendAnchor'|'onResolveDiaryAnchor'|'onSelectPost'|'onOpenFeature'|'onSelectFriend'|'onSelectDiary'|'onTownExplored'> & {
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
  scene.environmentTexture=CubeTexture.CreateFromPrefilteredData('/assets/brick-town/studio.env',scene);
  scene.environmentIntensity=0.75;
  scene.imageProcessingConfiguration.toneMappingEnabled=true;
  scene.imageProcessingConfiguration.toneMappingType=ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure=1.15;
  scene.imageProcessingConfiguration.contrast=1.06;
  const camera=new ArcRotateCamera('diorama-camera',Math.PI*0.68,0.96,36,new Vector3(0,2.5,0),scene);
  camera.mode=Camera.ORTHOGRAPHIC_CAMERA;
  camera.minZ=0.1;camera.maxZ=160;
  // Deliberate fixed composition keeps the article frontage readable. Zoom is
  // explicit; a click/touch never gets confused with an orbit gesture.
  const defaultZoom=mobile?1:1.7;
  let zoom=defaultZoom;
  const clampCameraTarget=()=>{
    const panBounds=getCameraPanBounds(
      BOARD,camera.alpha,camera.beta,
      camera.orthoRight!-camera.orthoLeft!,camera.orthoTop!-camera.orthoBottom!,
    );
    const clamped=clampToPanBounds(camera.target,panBounds);
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
  const worldStarted=performance.now();
  const world=buildWorld(scene,layout,mobile);
  canvas.dataset.worldBuildMs=String(Math.round(performance.now()-worldStarted));
  const houses=layout.plots.map(p=>buildHouse(scene,p,mobile));
  const houseMeshes=houses.flatMap(h=>h.meshes);
  const features=(layout.features??[]).map(feature=>buildFeature(scene,feature,mobile));
  const featureMeshes=features.flatMap(feature=>feature.meshes);
  const featureById=new Map(features.map(feature=>[feature.feature.id,feature]));
  // Diagnostics for the landmark verifier: proves every authored landmark got
  // real geometry instead of silently failing to build.
  canvas.dataset.features=features.map(feature=>`${feature.feature.id}:${feature.meshes.length}`).join(',');
  const friendHuts=(layout.hamlet?.huts??[]).map(hut=>buildFriendHut(scene,hut,mobile));
  const friendMeshes=friendHuts.flatMap(hut=>hut.meshes);
  const friendById=new Map(friendHuts.map(hut=>[hut.hut.id,hut]));
  // Diary furniture is rebuilt when the visitor switches between the district
  // and the single-board layout, so both live behind one mutable holder.
  let diaryBoards: ReturnType<typeof buildDiaryBoard>[] = [];
  let diaryMeshes: ReturnType<typeof buildDiaryBoard>['meshes'] = [];
  let diaryById = new Map<string, ReturnType<typeof buildDiaryBoard>>();
  let diaryMonths: ReturnType<typeof buildDiaryMonthMarker>[] = [];
  let diaryMode: 'district' | 'single' = initial.diaryMode ?? 'district';
  const buildDiaryFurniture = () => {
    for (const board of diaryBoards) for (const mesh of board.meshes) {
      highlights?.removeMesh(mesh);
      glow?.removeExcludedMesh(mesh);
      shadows.removeShadowCaster(mesh);
    }
    for (const board of diaryBoards) board.root.dispose(false, false);
    for (const marker of diaryMonths) marker.root.dispose(false, false);
    // The district renders live boards plus the archived cluster; the single
    // layout keeps only the one civic board beside the windmill.
    const source = layout.diary
      ? (diaryMode === 'single'
        ? [layout.diary.singleBoard]
        : [...layout.diary.boards, ...layout.diary.archived])
      : [];
    const monthSource = layout.diary && diaryMode === 'district' ? layout.diary.months : [];
    diaryBoards = source.map((board) => buildDiaryBoard(scene, board, mobile));
    diaryMonths = monthSource.map((marker) => buildDiaryMonthMarker(scene, marker, mobile));
    diaryMeshes = diaryBoards.flatMap((board) => board.meshes);
    for (const marker of diaryMonths) diaryMeshes.push(...marker.meshes);
    diaryById = new Map(diaryBoards.map((board) => [board.board.id, board]));
    for (const mesh of diaryMeshes) {
      if (!mesh.metadata.glass) glow?.addExcludedMesh(mesh);
      shadows.addShadowCaster(mesh);
      mesh.computeWorldMatrix(true);
      mesh.freezeWorldMatrix();
    }
    shadows.getShadowMap()?.resetRefreshCounter();
  };
  const postNotices=createPostNoticeProjector(scene,camera,houses);
  const seasons=createSeasonController({scene,world,mobile,seed:layout.seed,surfaces:[...world.snowSurfaces,...houses.flatMap(h=>h.snowSurfaces)]});
  const weather=createWeatherController(scene,layout.seed,mobile);
  seasons.set(initial.season,initial.reducedMotion);
  let seasonChanges=0;
  // Terrain plates cannot cast a useful shadow onto themselves. Excluding that
  // multi-million-instance surface cuts most shadow-map geometry while houses,
  // trees, props and citizens retain their natural shadows.
  for(const m of [...world.shadowCasters,...houseMeshes,...featureMeshes,...friendMeshes,...seasons.meshes.filter(m=>!m.metadata.thinInstances)])shadows.addShadowCaster(m);
  for(const m of [...world.meshes,...houseMeshes,...featureMeshes,...friendMeshes]){m.computeWorldMatrix(true);m.freezeWorldMatrix();}
  let glow:import('@babylonjs/core/Layers/glowLayer.js').GlowLayer|undefined;
  let highlights:import('@babylonjs/core/Layers/highlightLayer.js').HighlightLayer|undefined;
  let fxaa:import('@babylonjs/core/PostProcesses/fxaaPostProcess.js').FxaaPostProcess|undefined;
  let effectsReady=false;
  // The diary builder touches the highlight/glow layers, so it must run after
  // those handles are declared.
  buildDiaryFurniture();
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
    for(const m of featureMeshes)if(!m.metadata.glass)glow.addExcludedMesh(m);
    for(const m of friendMeshes)if(!m.metadata.glass)glow.addExcludedMesh(m);
    for(const m of diaryMeshes)if(!m.metadata.glass)glow.addExcludedMesh(m);
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
  let featureFocus='';
  let friendFocus='';
  let lastFocusedFriend='';
  let lastFocusedDiary='';
  let lastDiaryFocusRevision=0;
  let articleMeshes=[...houseMeshes,...seasons.articleMeshes];
  let highlightSignature='';
  let state={...initial};let frames=0;let elapsed=0;
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
    for(const m of [...houseMeshes,...featureMeshes,...friendMeshes,...diaryMeshes])if(m.metadata.glass){
      const mat=m.material as PBRMaterial;mat.emissiveColor=night?color('#ffb751'):Color3.Black();mat.emissiveIntensity=night?1.5:0;
      mat.albedoColor=color(night?'#edbd6d':'#5e97a4');
    }
    for(const m of world.lamps){const mat=m.material as PBRMaterial;mat.emissiveColor=night?color('#ffba5b'):Color3.Black();mat.emissiveIntensity=night?1.5:0;}
    weather.set(profile.precipitation,rainy,state.reducedMotion);if(glow)glow.isEnabled=night;
  }
  function applyFeatureFocus(id?: string) {
    const next=id&&featureById.has(id)?id:'';
    if(next===featureFocus)return;
    featureFocus=next;
    for(const house of houses)for(const mesh of house.meshes)mesh.visibility=next?0.55:1;
    requestDraw();
  }
  // Selecting a neighbour dims the rest of the town so the chosen hut and its
  // label read clearly, mirroring the existing About-landmark focus treatment.
  function applyFriendFocus(id?: string) {
    const next=id&&friendById.has(id)?id:'';
    if(next===friendFocus)return;
    friendFocus=next;
    const dim=!!next;
    for(const house of houses)for(const mesh of house.meshes)mesh.visibility=dim?0.45:1;
    for(const feature of features)for(const mesh of feature.meshes)mesh.visibility=dim?0.45:1;
    for(const hut of friendHuts)if(hut.hut.id!==next)for(const mesh of hut.meshes)mesh.visibility=dim?0.45:1;
    if(!next)for(const hut of friendHuts)for(const mesh of hut.meshes)mesh.visibility=1;
    requestDraw();
  }
  function update(next:SceneState) {
    const seasonChanged=next.season!==state.season;
    const rebuildPeople=next.colorMode!==state.colorMode;
    if(next.diaryMode && next.diaryMode!==diaryMode){diaryMode=next.diaryMode;buildDiaryFurniture();highlightSignature='';}
    const environmentChanged=rebuildPeople||seasonChanged||next.reducedMotion!==state.reducedMotion;
    if(seasonChanged) {
      for(const mesh of seasons.meshes){highlights?.removeMesh(mesh);glow?.removeExcludedMesh(mesh);shadows.removeShadowCaster(mesh);}
      seasons.set(next.season,next.reducedMotion);seasonChanges++;
      for(const mesh of seasons.meshes){glow?.addExcludedMesh(mesh);if(!mesh.metadata.thinInstances)shadows.addShadowCaster(mesh);}
      shadows.getShadowMap()?.resetRefreshCounter();
      articleMeshes=[...houseMeshes,...seasons.articleMeshes];
    }
    state={...next};
    // Hover previews a hut; the selection stays highlighted underneath so the
    // camera target and the list state do not flicker while sweeping the row.
    const activeFriend=state.hoveredFriendId??state.selectedFriendId;
    const activeDiary=state.hoveredDiaryId??'';
    applyFeatureFocus(state.hoveredFeatureId);applyFriendFocus(activeFriend);if(rebuildPeople)populate();else if(seasonChanged)rebuildFigures();if(environmentChanged)lighting();
    const focusedFriendId=state.focusedFriendId??'';
    if(focusedFriendId!==lastFocusedFriend){lastFocusedFriend=focusedFriendId;if(focusedFriendId)focusFriend(focusedFriendId);}
    const focusedDiaryId=state.focusedDiaryId??'';
    if(focusedDiaryId!==lastFocusedDiary){lastFocusedDiary=focusedDiaryId;if(focusedDiaryId)focusDiary(focusedDiaryId);}
    // The reading card can return to a note it already visited, so re-request
    // the same id through a revision counter instead of relying on id changes.
    const focusRevision=state.diaryFocusRevision??0;
    if(focusRevision!==lastDiaryFocusRevision){
      lastDiaryFocusRevision=focusRevision;
      if(focusedDiaryId)focusDiary(focusedDiaryId);
    }
    if(state.reducedMotion)seasons.tick(0,true);
    const nextHighlightSignature=[state.query,state.category??'',state.tag??'',state.hoveredPostId??'',state.hoveredFeatureId??'',activeFriend??'',activeDiary,state.activePostId??'',state.season].join('\u0000');
    if(highlights && nextHighlightSignature!==highlightSignature) {
      const needle=state.query.trim().toLowerCase();let hasHighlight=false;
      for(const mesh of articleMeshes){
        const post=postMap.get(mesh.metadata.postId);if(!post)continue;
        const matches=!!(needle||state.category||state.tag)&&(!needle||postSearchText.get(post.id)?.includes(needle))&&(!state.category||post.category===state.category)&&(!state.tag||post.tags.includes(state.tag));
        const direct=post.id===state.hoveredPostId||post.id===state.activePostId;
        if(direct||matches){highlights.addMesh(mesh,color(direct?'#90e3d4':'#edbb53'));hasHighlight=true;}else highlights.removeMesh(mesh);
      }
      for(const feature of features){
        const direct=feature.feature.id===state.hoveredFeatureId;
        for(const mesh of feature.meshes){if(direct){highlights.addMesh(mesh,color('#f6c85c'));hasHighlight=true;}else highlights.removeMesh(mesh);}
      }
      for(const hut of friendHuts){
        const direct=hut.hut.id===activeFriend;
        for(const mesh of hut.meshes){if(direct){highlights.addMesh(mesh,color('#f6c85c'));hasHighlight=true;}else highlights.removeMesh(mesh);}
      }
      for(const board of diaryBoards){
        const direct=board.board.id===activeDiary;
        for(const mesh of board.meshes){if(direct){highlights.addMesh(mesh,color('#f6c85c'));hasHighlight=true;}else highlights.removeMesh(mesh);}
      }
      highlights.isEnabled=hasHighlight;
      highlightSignature=nextHighlightSignature;
    }
    if(state.hoveredPostId)anchor(state.hoveredPostId);
    if(state.hoveredFeatureId)anchorFeature(state.hoveredFeatureId);
    if(activeFriend)anchorFriend(activeFriend);
    if(activeDiary)anchorDiary(activeDiary);
    requestDraw();
  }
  // Project a world point to viewport coordinates. Returns undefined when the
  // canvas has no measurable size yet: dividing by a zero render width yields
  // NaN, and a NaN style offset makes the tooltip fall back to its static
  // position (the bottom-left corner of the stage).
  function projectToViewport(point:Vector3){
    const rect=canvas.getBoundingClientRect();
    const width=engine.getRenderWidth(),height=engine.getRenderHeight();
    if(!rect.width||!rect.height||!width||!height)return undefined;
    const p=Vector3.Project(point,Matrix.Identity(),scene.getTransformMatrix(),camera.viewport.toGlobal(width,height));
    const a={x:rect.left+p.x*rect.width/width,y:rect.top+p.y*rect.height/height};
    return Number.isFinite(a.x)&&Number.isFinite(a.y)?a:undefined;
  }
  function anchor(id:string){
    const house=houseByPostId.get(id);if(!house)return;
    const i=house.ids.indexOf(id),point=new Vector3(house.plot.x,GROUND_Y+(i+0.6)*FLOOR_HEIGHT,house.plot.z);
    const a=projectToViewport(point);
    if(!a)return undefined;
    callbacks().onResolvePostAnchor(id,a);return a;
  }
  function anchorFeature(id:string){
    const feature=featureById.get(id);if(!feature)return;
    const point=new Vector3(feature.feature.x,GROUND_Y+feature.anchorY,feature.feature.z);
    const a=projectToViewport(point);
    if(!a)return undefined;
    callbacks().onResolveFeatureAnchor(id,a);return a;
  }
  function anchorFriend(id:string){
    const hut=friendById.get(id);if(!hut)return;
    const point=new Vector3(hut.hut.x,GROUND_Y+hut.anchorY,hut.hut.z);
    const a=projectToViewport(point);
    if(!a)return undefined;
    callbacks().onResolveFriendAnchor(id,a);return a;
  }
  function anchorDiary(id:string){
    const board=diaryById.get(id);if(!board)return;
    const point=new Vector3(board.board.x,GROUND_Y+board.anchorY,board.board.z);
    const a=projectToViewport(point);
    if(!a)return undefined;
    callbacks().onResolveDiaryAnchor(id,a);return a;
  }

  // Camera travel for the hamlet. Pan is clamped to the same bounds as drag,
  // and the zoom floor keeps the hut readable without losing its neighbours.
  let focusAnimation:{fromX:number;fromZ:number;toX:number;toZ:number;fromZoom:number;toZoom:number;start:number;duration:number}|undefined;
  function focusFriend(id:string|undefined){
    const hut=id?friendById.get(id):undefined;
    if(!hut)return;
    const bounds=getCameraPanBounds(BOARD,camera.alpha,camera.beta,camera.orthoRight!-camera.orthoLeft!,camera.orthoTop!-camera.orthoBottom!);
    const target=clampToPanBounds({x:hut.hut.x,z:hut.hut.z},bounds);
    focusAnimation={
      fromX:camera.target.x,fromZ:camera.target.z,toX:target.x,toZ:target.z,
      fromZoom:zoom,toZoom:Math.max(zoom,1.45),
      start:performance.now(),duration:state.reducedMotion?0:680,
    };
    requestDraw();
  }
  function focusDiary(id:string){
    const board=diaryById.get(id);
    if(!board)return;
    const bounds=getCameraPanBounds(BOARD,camera.alpha,camera.beta,camera.orthoRight!-camera.orthoLeft!,camera.orthoTop!-camera.orthoBottom!);
    const target=clampToPanBounds({x:board.board.x,z:board.board.z},bounds);
    focusAnimation={
      fromX:camera.target.x,fromZ:camera.target.z,toX:target.x,toZ:target.z,
      fromZoom:zoom,toZoom:Math.max(zoom,1.55),
      start:performance.now(),duration:state.reducedMotion?0:680,
    };
    requestDraw();
  }
  function tickFocus(now:number){
    if(!focusAnimation)return;
    const progress=Math.min(1,Math.max(0,(now-focusAnimation.start)/(focusAnimation.duration||1)));
    // Ease-in-out cubic keeps the travel calm at both ends.
    const eased=progress<0.5?4*progress*progress*progress:1-Math.pow(-2*progress+2,3)/2;
    camera.target.x=focusAnimation.fromX+(focusAnimation.toX-focusAnimation.fromX)*eased;
    camera.target.z=focusAnimation.fromZ+(focusAnimation.toZ-focusAnimation.fromZ)*eased;
    applyZoom(focusAnimation.fromZoom+(focusAnimation.toZoom-focusAnimation.fromZoom)*eased);
    if(progress>=1)focusAnimation=undefined;
    // The label is a DOM projection, so it has to follow the camera every
    // frame of the travel instead of staying at its pre-focus screen point.
    const active=state.hoveredFriendId??state.selectedFriendId;
    if(active)anchorFriend(active);
    const diaryTarget=state.focusedDiaryId??state.hoveredDiaryId;
    if(diaryTarget)anchorDiary(diaryTarget);
    requestDraw();
  }
  let lastHover:string|undefined,lastPickAt=0;
  const pointers=new Map<number,{x:number;y:number;type:string}>();
  let pinch:{startDistance:number;startZoom:number;moved:boolean}|undefined;
  const clampZoom=(value:number)=>Math.max(0.75,Math.min(2.6,value));
  const distanceBetween=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
  // Declared as a function so the hamlet focus tween can call it before this
  // point in the module body.
  function applyZoom(nextZoom:number){
    const clamped=clampZoom(nextZoom);if(Math.abs(clamped-zoom)<0.0001)return;
    const scale=zoom/clamped;
    const centerX=(camera.orthoLeft!+camera.orthoRight!)/2,centerY=(camera.orthoTop!+camera.orthoBottom!)/2;
    // Zoom the current framing, including any bottom crop from browser chrome.
    camera.orthoLeft=centerX+(camera.orthoLeft!-centerX)*scale;
    camera.orthoRight=centerX+(camera.orthoRight!-centerX)*scale;
    camera.orthoTop=centerY+(camera.orthoTop!-centerY)*scale;
    camera.orthoBottom=centerY+(camera.orthoBottom!-centerY)*scale;
    zoom=clamped;clampCameraTarget();requestDraw();
  }
  type PickTarget={kind:'post'|'feature'|'friend'|'diary';id:string};
  function pick(event:PointerEvent):PickTarget|undefined{
    const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
    // Pick ALL real solid surfaces. Roof/terrain/tree occlusion is respected;
    // a hidden wall can never be clicked through another object.
    const hit=scene.pick(x,y,m=>m.isPickable&&m.isVisible);
    const metadata=hit?.hit?hit.pickedMesh?.metadata as {postId?:string;featureId?:string;friendId?:string;diaryId?:string}|undefined:undefined;
    if(metadata?.friendId)return {kind:'friend',id:metadata.friendId};
    if(metadata?.diaryId)return {kind:'diary',id:metadata.diaryId};
    if(metadata?.featureId)return {kind:'feature',id:metadata.featureId};
    if(metadata?.postId)return {kind:'post',id:metadata.postId};
    return undefined;
  }
  const clearHover=()=>{lastHover=undefined;callbacks().onHoverPost(undefined);callbacks().onHoverFeature(undefined);callbacks().onHoverFriend(undefined);callbacks().onHoverDiary(undefined);};
  const onWheel=(e:WheelEvent)=>{e.preventDefault();applyZoom(zoom-e.deltaY*0.0015);clearHover();};
  const onMove=(e:PointerEvent)=>{
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
    const target=pick(e);canvas.style.cursor=target?'pointer':'grab';
    const key=target?`${target.kind}:${target.id}`:undefined;
    if(key!==lastHover){
      lastHover=key;
      callbacks().onHoverPost(target?.kind==='post'?target.id:undefined,target?.kind==='post'?{x:e.clientX,y:e.clientY}:undefined);
      callbacks().onHoverFeature(target?.kind==='feature'?target.id:undefined,target?.kind==='feature'?{x:e.clientX,y:e.clientY}:undefined);
      callbacks().onHoverFriend(target?.kind==='friend'?target.id:undefined,target?.kind==='friend'?{x:e.clientX,y:e.clientY}:undefined);
      callbacks().onHoverDiary(target?.kind==='diary'?target.id:undefined,target?.kind==='diary'?{x:e.clientX,y:e.clientY}:undefined);
    }
  };
  const onLeave=(e:PointerEvent)=>{if(e.pointerType!=='mouse')return;clearHover();if(!down)canvas.style.cursor='grab';};
  let down:{x:number;y:number;lastX:number;lastY:number;pointerId:number;moved:boolean}|undefined;
  const onDown=(e:PointerEvent)=>{
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
      const target=pick(e);
      if(target?.kind==='feature')callbacks().onOpenFeature(target.id);
      else if(target?.kind==='diary')callbacks().onSelectDiary(target.id);
      else if(target?.kind==='friend')callbacks().onSelectFriend(target.id);
      else if(target?.kind==='post')callbacks().onSelectPost(target.id,e.pointerType);
      else clearHover();
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
  const resize=new ResizeObserver(()=>{fit(true);if(state.hoveredPostId)anchor(state.hoveredPostId);if(state.hoveredFeatureId)anchorFeature(state.hoveredFeatureId);});resize.observe(canvas.parentElement!);
  let lastDiagnostics=0,slowRenderFrames=0,firstFramePublished=false;
  function publishDiagnostics(now:number){
    canvas.dataset.ready='true';canvas.dataset.frames=String(frames);canvas.dataset.weather=rainy?weather.kind:'clear';canvas.dataset.season=state.season;canvas.dataset.colorMode=state.colorMode;canvas.dataset.reducedMotion=String(state.reducedMotion);canvas.dataset.seasonChanges=String(seasonChanges);canvas.dataset.seasonCover=String(seasons.coverCount);canvas.dataset.seasonTransition=String(seasons.transitioning);canvas.dataset.precipitationAnimated=String(weather.animated);canvas.dataset.renderer=engine.webGLVersion===2?'webgl2':'webgl1';
    canvas.dataset.cameraX=camera.target.x.toFixed(2);canvas.dataset.cameraZ=camera.target.z.toFixed(2);canvas.dataset.zoom=zoom.toFixed(3);canvas.dataset.rainDrops=String(weather.count);
    canvas.dataset.sceneMeshes=String(scene.meshes.length);canvas.dataset.sceneMaterials=String(scene.materials.length);canvas.dataset.sceneVertices=String(scene.getTotalVertices());canvas.dataset.thinInstances=String(scene.meshes.reduce((sum,mesh)=>sum+('thinInstanceCount' in mesh?Number(mesh.thinInstanceCount):0),0));lastDiagnostics=now;
  }
  function render(){
    if(disposed||!inView||!visible)return;
    const now=performance.now();if(now-lastFrame<(mobile?1000/24:1000/30))return;
    const dt=Math.min(0.05,lastFrame?(now-lastFrame)/1000:0.016);lastFrame=now;elapsed+=dt;
    tickFocus(now);
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
    if(frames===1||now-lastDiagnostics>500)publishDiagnostics(now);
    if(state.reducedMotion&&--renderBurst<=0&&firstFramePublished&&effectsReady&&scene.isReady()&&engine.areAllEffectsReady()){
      engine.stopRenderLoop(render);canvas.dataset.renderLoop='idle';publishDiagnostics(now);
      // Static weather still follows the real 15-minute boundary without a
      // permanent animation loop or polling timer. Interaction cancels this wake.
      weatherWakeTimer=window.setTimeout(requestDraw,900000-Date.now()%900000+1);
    }
  }
  const syncVisibility=()=>{if(inView&&visible){lastFrame=0;requestDraw();}else{engine.stopRenderLoop(render);window.clearTimeout(weatherWakeTimer);weatherWakeTimer=undefined;canvas.dataset.renderLoop='paused';}};
  const observer=new IntersectionObserver(([entry])=>{inView=!!entry?.isIntersecting;syncVisibility();});observer.observe(canvas);
  const onVisibility=()=>{visible=!document.hidden;syncVisibility();};document.addEventListener('visibilitychange',onVisibility);
  engine.runRenderLoop(render);
  return {
    update,anchor,
    dispose(){disposed=true;window.clearTimeout(weatherWakeTimer);engine.stopRenderLoop(render);resize.disconnect();observer.disconnect();document.removeEventListener('visibilitychange',onVisibility);canvas.removeEventListener('wheel',onWheel);canvas.removeEventListener('pointermove',onMove);canvas.removeEventListener('pointerleave',onLeave);canvas.removeEventListener('pointerdown',onDown);canvas.removeEventListener('pointerup',onUp);canvas.removeEventListener('pointercancel',onCancel);pointers.clear();pinch=undefined;down=undefined;ao?.dispose();seasons.dispose();weather.dispose();scene.dispose();engine.dispose();},
  };
}
