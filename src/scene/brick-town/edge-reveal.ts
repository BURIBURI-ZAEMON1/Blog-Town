import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase.js';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import type { UniformBuffer } from '@babylonjs/core/Materials/uniformBuffer.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import { ShaderStore } from '@babylonjs/core/Engines/shaderStore.js';
import { shadowMapVertexShader } from '@babylonjs/core/Shaders/shadowMap.vertex.js';
import { shadowMapPixelShader } from '@babylonjs/core/Shaders/shadowMap.fragment.js';

// A shared world grid keeps whole objects and their supporting plates together,
// without splitting the existing merged meshes or thin-instance batches.
const CELL = .72, WIDTH = 160, HEIGHT = 128, COUNT = WIDTH * HEIGHT;
const MOTION_SECONDS = .26;
const gridIndex = (x: number, z: number) => Math.max(0, Math.min(HEIGHT - 1, Math.floor(z / CELL + HEIGHT / 2 + .5))) * WIDTH
  + Math.max(0, Math.min(WIDTH - 1, Math.floor(x / CELL + WIDTH / 2 + .5)));
const ease = (t: number) => 1 - (1 - t) ** 3;
export const edgeCloseAmount = (zoom: number, defaultZoom: number) => {
  const t = Math.max(0, Math.min(1, (zoom / defaultZoom - 1) / .22));
  return t * t * (3 - 2 * t);
};
export function edgeDistance(x: number, y: number, inset = 0) {
  const angle = Math.atan2(y, x);
  const radius = Math.hypot(x, y);
  return .91 - inset + .025 * Math.sin(angle * 5 + .6) + .018 * Math.sin(angle * 9) - radius;
}

type Support = { x: number; z: number; width: number; depth: number };
export class TownEdgeField {
  readonly data = new Uint8Array(COUNT * 4).fill(255);
  readonly owners = Int32Array.from({ length: COUNT }, (_, i) => i);
  readonly progress = new Float32Array(COUNT).fill(1);
  private targets = new Uint8Array(COUNT).fill(1);
  private ages = new Float32Array(COUNT);
  private heights = new Float32Array(COUNT);
  private fromHeights = new Float32Array(COUNT);
  private fromProgress = new Float32Array(COUNT);
  private pulses = new Uint8Array(COUNT);
  private active = new Set<number>();
  revision = 0;
  get animating() { return this.active.size > 0; }
  constructor(supports: Support[] = []) {
    for (let i = 0; i < COUNT; i++) this.data[i * 4 + 2] = 128;
    for (const p of supports) {
      const owner = gridIndex(p.x, p.z);
      const minX = Math.max(0, Math.floor((p.x - p.width / 2) / CELL + WIDTH / 2));
      const maxX = Math.min(WIDTH - 1, Math.ceil((p.x + p.width / 2) / CELL + WIDTH / 2));
      const minZ = Math.max(0, Math.floor((p.z - p.depth / 2) / CELL + HEIGHT / 2));
      const maxZ = Math.min(HEIGHT - 1, Math.ceil((p.z + p.depth / 2) / CELL + HEIGHT / 2));
      for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) this.owners[z * WIDTH + x] = owner;
      this.owners[owner] = owner;
    }
    // Resolve overlapping footprints once, so every part samples the same state.
    for (let i = 0; i < COUNT; i++) {
      let owner = this.owners[i];
      while (owner !== this.owners[owner]) owner = this.owners[owner];
      this.owners[i] = owner;
    }
  }
  retarget(matrix: ArrayLike<number>, inset: number, retract: boolean, immediate: boolean, initial = false, landing = false) {
    const entering: number[] = [];
    for (let i = 0; i < COUNT; i++) {
      if (this.owners[i] !== i) continue;
      const x = (i % WIDTH - WIDTH / 2) * CELL, z = (Math.floor(i / WIDTH) - HEIGHT / 2) * CELL;
      const w = x * matrix[3] + z * matrix[11] + matrix[15];
      const screenX = (x * matrix[0] + z * matrix[8] + matrix[12]) / w;
      const screenY = (x * matrix[1] + z * matrix[9] + matrix[13]) / w;
      const screenD = edgeDistance(screenX, screenY, inset);
      const target = Number(initial ? screenD >= 0 : this.targets[i] ? !retract || screenD >= -.035 : screenD > .025);
      if (immediate) {
        this.progress[i] = this.targets[i] = target; this.heights[i] = 0; this.active.delete(i);
      } else if (target !== this.targets[i]) {
        // Every withdrawal uses the visible lift-and-land, including pieces
        // retained by panning; sinking below adjacent ground hides the motion.
        this.pulses[i] = Number(!target);
        this.fromHeights[i] = target && !this.progress[i] ? -.28 : this.heights[i];
        this.fromProgress[i] = this.progress[i];
        this.ages[i] = this.active.has(i) ? 0 : -(i % 3) * .022;
        this.targets[i] = target; this.active.add(i);
        if (retract && !landing && target && !this.progress[i]) entering.push(i);
      }
    }
    if (entering.length) {
      // Retained pan edges land first; new outer pieces then rise, without
      // restarting pieces already moving during a continuous wheel gesture.
      let delay = 0;
      for (const i of this.active) if (!this.targets[i] && this.progress[i] > 0) delay = Math.max(delay, MOTION_SECONDS - this.ages[i]);
      for (const i of entering) this.ages[i] -= delay;
    }
    if (immediate) this.write();
  }
  tick(seconds: number, reducedMotion = false) {
    if (!this.active.size) return false;
    for (const i of this.active) {
      this.ages[i] += seconds;
      const target = this.targets[i], pulse = this.pulses[i];
      const t = reducedMotion ? 1 : Math.max(0, Math.min(1, this.ages[i] / MOTION_SECONDS));
      this.progress[i] = this.fromProgress[i] + (target - this.fromProgress[i]) * ease(t);
      if (pulse) {
        const phase = t < .25 ? t / .25 : (1 - t) / .75;
        this.heights[i] = this.fromHeights[i] * (1 - ease(t)) + .28 * phase * phase * (3 - 2 * phase);
      } else {
        this.heights[i] = this.fromHeights[i] * (1 - ease(t));
      }
      if (t === 1) { this.progress[i] = target; this.heights[i] = 0; this.active.delete(i); }
    }
    this.write(); return true;
  }
  private write() {
    let changed = false;
    for (let i = 0; i < COUNT; i++) {
      const owner = this.owners[i], progress = this.progress[owner];
      const visible = progress > 0 ? 255 : 0, amount = Math.round(progress * 255);
      const height = Math.round(this.heights[owner] / .4 * 127) + 128;
      if (this.data[i * 4] !== visible || this.data[i * 4 + 1] !== amount || this.data[i * 4 + 2] !== height) changed = true;
      this.data[i * 4] = visible; this.data[i * 4 + 1] = amount; this.data[i * 4 + 2] = height;
    }
    if (changed) this.revision++;
  }
  visibility(x: number, z: number) { return this.data[gridIndex(x, z) * 4 + 1] / 255; }
}

type EdgeState = { close: number; lift: number; inset: number; field: TownEdgeField; texture: RawTexture; sunRay: [number,number,number]; cloudStrength: number; cloudTime: number };
const states = new WeakMap<Scene, EdgeState>();
export function townEdgeState(scene: Scene) {
  let state = states.get(scene);
  if (!state) {
    const field = new TownEdgeField();
    const texture = RawTexture.CreateRGBATexture(field.data, WIDTH, HEIGHT, scene, false, false, Texture.NEAREST_SAMPLINGMODE);
    texture.wrapU = texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    state = { close: 1, lift: 0, inset: 0, field, texture, sunRay: [0,-1,0], cloudStrength: 0, cloudTime: 0 }; states.set(scene, state);
  }
  return state;
}
export function worldEdgeVisibility(scene: Scene, x: number, _y: number, z: number) {
  return townEdgeState(scene).field.visibility(x, z);
}

const EDGE_VERTEX_DECLARATIONS = 'attribute vec2 edgeAnchor; uniform sampler2D townEdgeMap; varying float vTownEdge;';
const EDGE_VERTEX = `
  vec4 edgeWorld = world * vec4(edgeAnchor.x, 0.0, edgeAnchor.y, 1.0);
  vec2 edgeCell = floor(edgeWorld.xz / .72 + vec2(80.0, 64.0) + .5);
  vec2 edgeUV = (clamp(edgeCell, vec2(0.0), vec2(159.0, 127.0)) + .5) / vec2(160.0, 128.0);
  vec3 edgeState = texture2D(townEdgeMap, edgeUV).rgb;
  vTownEdge = edgeState.r;
  worldPos.y += edgeLift * (edgeState.b * 255.0 - 128.0) / 127.0 * .4;
`;
const EDGE_DISCARD = 'if (vTownEdge < .5) discard;';

// Extend Babylon's small depth shader, rather than duplicating PBR shading in
// every shadow pass. Settled views still reuse the static shadow map.
export function configureTownEdgeShadows(shadows: ShadowGenerator, scene: Scene) {
  ShaderStore.ShadersStore.townEdgeShadowVertexShader = shadowMapVertexShader.shader
    .replace('#define CUSTOM_VERTEX_DEFINITIONS', EDGE_VERTEX_DECLARATIONS + 'uniform float edgeLift;')
    .replace('#include<shadowMapVertexNormalBias>', EDGE_VERTEX + '\n#include<shadowMapVertexNormalBias>');
  ShaderStore.ShadersStore.townEdgeShadowPixelShader = shadowMapPixelShader.shader
    .replace('#define CUSTOM_FRAGMENT_DEFINITIONS', 'varying float vTownEdge;')
    .replace('#include<clipPlaneFragment>', EDGE_DISCARD + '\n#include<clipPlaneFragment>');
  shadows.customShaderOptions = { shaderName: 'townEdgeShadow', attributes: ['edgeAnchor'], uniforms: ['edgeLift'], samplers: ['townEdgeMap'] };
  shadows.onBeforeShadowMapRenderObservable.add(effect => {
    const state = townEdgeState(scene);
    effect.setTexture('townEdgeMap', state.texture); effect.setFloat('edgeLift', state.lift);
  });
}

/** One shared state texture; revealed pieces retain their normal opaque material. */
export class TownEdgeMaterial extends MaterialPluginBase {
  private state: EdgeState;
  constructor(material: PBRMaterial, scene: Scene) {
    super(material, 'TownEdge', 180, { TOWN_CLOUD_SHADOWS: (scene.getEngine().getRenderingCanvas()?.clientWidth??0)>=720 }, true, true);
    this.state = townEdgeState(scene);
  }
  getAttributes(attributes: string[]) { attributes.push('edgeAnchor'); }
  getSamplers(samplers: string[]) { samplers.push('townEdgeMap'); }
  getUniforms() {
    return {
      ubo: [{ name: 'edgeLift', size: 1, type: 'float' }, { name: 'townSunCloud', size: 4, type: 'vec4' }, { name: 'townCloudTime', size: 1, type: 'float' }, { name: 'townViewDirection', size: 3, type: 'vec3' }],
      vertex: 'uniform float edgeLift;', fragment: 'uniform vec4 townSunCloud; uniform float townCloudTime; uniform vec3 townViewDirection;',
    };
  }
  bindForSubMesh(buffer: UniformBuffer, scene: Scene) {
    buffer.updateFloat('edgeLift', this.state.lift);
    buffer.setTexture('townEdgeMap', this.state.texture);
    buffer.updateFloat4('townSunCloud', ...this.state.sunRay, this.state.cloudStrength);
    buffer.updateFloat('townCloudTime', this.state.cloudTime);
    const view=scene.activeCamera!.getViewMatrix().m;
    buffer.updateFloat3('townViewDirection', -view[2], -view[6], -view[10]);
  }
  getCustomCode(type: string): Record<string, string> {
    if (type === 'vertex') return {
      CUSTOM_VERTEX_DEFINITIONS: EDGE_VERTEX_DECLARATIONS,
      CUSTOM_VERTEX_UPDATE_WORLDPOS: EDGE_VERTEX + 'vPositionW = worldPos.xyz;',
    };
    return {
      // Orthographic rays are parallel; perspective eye vectors create a moving
      // specular hotspot across flat ground as the camera pans.
      '!vec3 viewDirectionW=normalize\\(vEyePosition.xyz-vPositionW\\);': 'vec3 viewDirectionW=normalize(townViewDirection);',
      CUSTOM_FRAGMENT_DEFINITIONS: `varying float vTownEdge;
        #ifdef TOWN_CLOUD_SHADOWS
        float townCloudShadow(vec3 point) {
          if (townSunCloud.w <= 0.0) return 1.0;
          // Project onto an unseen cloud layer along the sun's world-space rays.
          vec2 p = point.xz + (14.0-point.y)*townSunCloud.xz/min(-.12,townSunCloud.y);
          p += vec2(.12,.045)*townCloudTime;
          float shape = sin(p.x*.19 + sin(p.y*.23)*.8)*.5+.5;
          shape *= .7+.3*sin(p.y*.17-p.x*.09);
          return 1.0-townSunCloud.w*smoothstep(.38,.85,shape);
        }
        #endif`,
      CUSTOM_FRAGMENT_MAIN_BEGIN: `${EDGE_DISCARD}
        #ifdef TOWN_CLOUD_SHADOWS
        float townCloud = townCloudShadow(vPositionW);
        float townLightTransmission = 1.0;
        #endif`,
      ...Object.fromEntries([0,1,2,3].map(i=>[`CUSTOM_LIGHT${i}_COLOR`, `
        #ifdef TOWN_CLOUD_SHADOWS
          #ifdef DIRLIGHT${i}
          townLightTransmission = townCloud;
          #else
          townLightTransmission = 1.0;
          #endif
        #endif`])),
      '!aggShadow\\+=shadow;': `
        #ifdef TOWN_CLOUD_SHADOWS
        shadow *= townLightTransmission;
        #endif
        aggShadow+=shadow;`,
    };
  }
}
