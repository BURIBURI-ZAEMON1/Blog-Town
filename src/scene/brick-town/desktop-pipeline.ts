// Desktop only: register AO sources while its pipeline module downloads, not
// during the first render. This does not construct a pipeline or alter quality.
import '@babylonjs/core/Shaders/ssao2.fragment.js';
import '@babylonjs/core/Shaders/ssaoCombine.fragment.js';
import '@babylonjs/core/Shaders/pass.fragment.js';
export { SSAO2RenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline.js';
