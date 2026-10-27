// Approved hero fog, shared with the private studio. Distances stay stable as the camera moves.
export const defaultFog = () => ({
  version: 1, target: 'hero', asset: '/splats/Fairview.ksplat',
  pipeline: 'warm-film -> distance-fog-v1', metric: '3d-distance', originSpace: 'model',
  origin: [-.24, -.06, -.05], cutoff: { radius: 10, feather: 0 },
  start: 1.1, falloff: 2.2, darkening: .47, blur: 4.2, fogginess: .52, color: '#000000',
});
export const FOG_CONTROLS = [
  ['start', 'Start distance', 0, 10, .1, ' units'],
  ['falloff', 'Falloff distance', .1, 10, .1, ' units'],
  ['darkening', 'Background darkening', 0, 1, .01, '%'],
  ['blur', 'Background blur', 0, 12, .1, ' px'],
  ['fogginess', 'Fogginess', 0, 1, .01, '%'],
];
export function validFog(value) {
  const defaults = defaultFog();
  return value?.version === 1 && value.target === defaults.target && value.asset === defaults.asset &&
    value.pipeline === defaults.pipeline && value.metric === defaults.metric && value.originSpace === 'model' &&
    Array.isArray(value.origin) && value.origin.length === 3 && value.origin.every((v,i) => v === defaults.origin[i]) &&
    value.cutoff?.radius === 10 && value.cutoff.feather === 0 && /^#[0-9a-f]{6}$/i.test(value.color) &&
    FOG_CONTROLS.every(([key,,min,max]) => Number.isFinite(value[key]) && value[key] >= min && value[key] <= max);
}
export function fogAmountAtDistance(distance, start, falloff) {
  const t = Math.max(0, Math.min(1, (distance-start)/falloff));
  return t*t*(3-2*t);
}
const VERTEX_UNIFORMS = `
uniform vec3 studioFogOrigin;
uniform float studioFogScale;
uniform float studioFogStart;
uniform float studioFogFalloff;
uniform float studioFogBlur;
uniform float studioFogPixelRatio;
uniform float studioFogEnabled;
varying float vStudioFog;
`;
const FRAGMENT_UNIFORMS = `
varying float vStudioFog;
uniform float studioFogDarkening;
uniform float studioFogDensity;
uniform vec3 studioFogColor;
`;
export function patchFogShaders(vertex, fragment) {
  const covariance = 'vec3 cov2Dv =';
  const output = 'gl_FragColor = vec4(color.rgb, opacity);';
  if (!vertex.includes(covariance) || !vertex.includes('vec3 splatCenter') || !fragment.includes(output)) {
    throw new Error('This splat shader does not support the fog preview.');
  }
  return {
    vertex: VERTEX_UNIFORMS + vertex.replace(covariance, `
      float fogDistance = length((splatCenter - studioFogOrigin) / studioFogScale);
      vStudioFog = studioFogEnabled * smoothstep(studioFogStart, studioFogStart + studioFogFalloff, fogDistance);
      // Convolve each projected Gaussian with a screen-space Gaussian. Keep its
      // integrated opacity stable so blur doesn't turn the room into solid blobs.
      float fogSigma = studioFogBlur * studioFogPixelRatio * vStudioFog;
      float fogVariance = fogSigma * fogSigma;
      float fogDetBefore = max(0.000001, cov2Dm[0][0]*cov2Dm[1][1] - cov2Dm[0][1]*cov2Dm[0][1]);
      cov2Dm[0][0] += fogVariance;
      cov2Dm[1][1] += fogVariance;
      float fogDetAfter = max(0.000001, cov2Dm[0][0]*cov2Dm[1][1] - cov2Dm[0][1]*cov2Dm[0][1]);
      vColor.a *= sqrt(fogDetBefore / fogDetAfter);
      ` + covariance),
    fragment: FRAGMENT_UNIFORMS + fragment.replace(output, `
      color *= 1.0 - studioFogDarkening * vStudioFog;
      color = mix(color, studioFogColor, studioFogDensity * vStudioFog);
      ` + output),
  };
}
export function installDistanceFog(viewer, initial, {position, scale}) {
  if (!validFog(initial)) throw new Error('Invalid fog settings.');
  const material = viewer.getSplatMesh().material;
  const shaders = patchFogShaders(material.vertexShader, material.fragmentShader);
  material.vertexShader = shaders.vertex;
  material.fragmentShader = shaders.fragment;
  const rgb = hex => [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  Object.assign(material.uniforms, {
    studioFogOrigin: {value: initial.origin.map((v,i)=>v*scale+position[i])},
    studioFogScale: {value:scale}, studioFogPixelRatio: {value:viewer.renderer.getPixelRatio()},
    studioFogStart: {value:initial.start}, studioFogFalloff: {value:initial.falloff},
    studioFogBlur: {value:initial.blur}, studioFogEnabled: {value:1},
    studioFogDarkening: {value:initial.darkening}, studioFogDensity: {value:initial.fogginess},
    studioFogColor: {value:rgb(initial.color)},
  });
  material.needsUpdate = true;
  viewer.forceRenderNextFrame();
  return (next, bypass=false) => {
    if (!validFog(next)) throw new Error('Invalid fog settings.');
    const uniforms = material.uniforms;
    for (const [uniform,key] of [['studioFogStart','start'],['studioFogFalloff','falloff'],['studioFogBlur','blur'],['studioFogDarkening','darkening'],['studioFogDensity','fogginess']]) uniforms[uniform].value = next[key];
    uniforms.studioFogEnabled.value = bypass ? 0 : 1;
    uniforms.studioFogPixelRatio.value = viewer.renderer.getPixelRatio();
    uniforms.studioFogColor.value = rgb(next.color);
    viewer.forceRenderNextFrame();
    viewer.render();
  };
}
