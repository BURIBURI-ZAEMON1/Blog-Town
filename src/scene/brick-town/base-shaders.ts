// Register the unchanged WebGL sources together. Discovering these lazily from
// the first render/environment decode adds serial network waits after geometry.
import '@babylonjs/core/Shaders/pbr.vertex.js';
import '@babylonjs/core/Shaders/pbr.fragment.js';
import '@babylonjs/core/Shaders/shadowMap.vertex.js';
import '@babylonjs/core/Shaders/shadowMap.fragment.js';
import '@babylonjs/core/Shaders/depthBoxBlur.fragment.js';
import '@babylonjs/core/Shaders/color.vertex.js';
import '@babylonjs/core/Shaders/color.fragment.js';
import '@babylonjs/core/Shaders/postprocess.vertex.js';
import '@babylonjs/core/Shaders/rgbdDecode.fragment.js';
import '@babylonjs/core/Materials/Textures/Loaders/envTextureLoader.js';
