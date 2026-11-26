import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase.js';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import type { UniformBuffer } from '@babylonjs/core/Materials/uniformBuffer.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine.js';
import type { SubMesh } from '@babylonjs/core/Meshes/subMesh.js';

/** Per-mesh state keeps shared town materials and seasonal colours intact. */
export class TownFocusMaterial extends MaterialPluginBase {
  constructor(material: PBRMaterial) {
    super(material, 'TownFocus', 190, {}, true, false);
    this.registerForExtraEvents = true;
    this._enable(true);
  }
  getUniforms() {
    return { ubo: [{ name: 'townGlass', size: 2, type: 'vec2' }], fragment: 'uniform vec2 townGlass;' };
  }
  hardBindForSubMesh(buffer: UniformBuffer, _scene: Scene, engine: AbstractEngine, subMesh: SubMesh) {
    const data = subMesh.getRenderingMesh().metadata;
    const building = Boolean(data?.townTarget);
    buffer.updateFloat2('townGlass', data?.townGlass ?? 0, Number(building));
    // Keep front surfaces and contact-shadow depth stable throughout the blend.
    if (building) engine.setDepthWrite(true);
  }
  getCustomCode(type: string) {
    return type === 'fragment' ? {
      CUSTOM_FRAGMENT_UPDATE_ALPHA: 'alpha *= 1.0 - .7 * townGlass.x;',
      CUSTOM_FRAGMENT_BEFORE_LIGHTS: 'surfaceAlbedo = mix(surfaceAlbedo, vec3(.48, .53, .55), townGlass.x * .96);',
      '!float roughness=reflectivityOut\\.roughness;': 'float roughness=mix(reflectivityOut.roughness, .19, townGlass.x);',
      '!float writeGeometryInfo=finalColor\\.a>ALPHATESTVALUE \\? 1\\.0 : 0\\.0;': 'float writeGeometryInfo=townGlass.y > .5 ? 1.0 : (finalColor.a>ALPHATESTVALUE ? 1.0 : 0.0);',
      CUSTOM_FRAGMENT_BEFORE_FINALCOLORCOMPOSITION: `
        finalEmissive *= 1.0 - townGlass.x;
        #ifdef SPECULARTERM
        finalSpecularScaled *= 1.0 + townGlass.x * .45;
        #endif`,
    } : null;
  }
}
