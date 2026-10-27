export const defaultCutoff = () => ({ version: 1, target: 'hero', asset: '/splats/Fairview.ksplat', metric: '3d-distance', originSpace: 'model', origin: [-.24, -.06, -.05], radius: 20, feather: 1.5 });
export function validCutoff(value) {
  return value?.version === 1 && value.target === 'hero' && value.asset === '/splats/Fairview.ksplat' &&
    value.metric === '3d-distance' && value.originSpace === 'model' &&
    Array.isArray(value.origin) && value.origin.length === 3 && value.origin.every((v, i) => v === defaultCutoff().origin[i]) &&
    Number.isFinite(value.radius) && value.radius >= 1 && value.radius <= 300 &&
    Number.isFinite(value.feather) && value.feather >= 0 && value.feather <= 5;
}
export const radiusToSlider = radius => Math.log(radius) / Math.log(300) * 1000;
export const sliderToRadius = value => Math.round(Math.exp(value / 1000 * Math.log(300))*10)/10;
export const CUTOFF_GLSL = `
uniform vec3 cutoffOrigin;
uniform float cutoffScale;
uniform float cutoffRadius;
uniform float cutoffFeather;
uniform float cutoffEnabled;
float splatDistanceCutoff(vec3 center) {
  if (cutoffEnabled < 0.5) return 1.0;
  float d = length((center - cutoffOrigin) / cutoffScale);
  float feather = min(cutoffFeather, cutoffRadius);
  if (feather <= 0.0) return 1.0 - step(cutoffRadius, d);
  return 1.0 - smoothstep(cutoffRadius - feather, cutoffRadius, d);
}
`;
export function patchCutoffShader(shader) {
  const anchor = 'gl_Position = quadPos;';
  if (!shader.includes(anchor) || !shader.includes('vec3 splatCenter')) throw new Error('This splat shader does not support distance cutoff.');
  return CUTOFF_GLSL + shader.replace(anchor, 'vColor.a *= splatDistanceCutoff(splatCenter);\n' + anchor);
}
export function installDistanceCutoff(viewer, config, { position, scale }) {
  if (!validCutoff(config)) throw new Error('Invalid distance cutoff settings.');
  const material = viewer.getSplatMesh().material;
  material.vertexShader = patchCutoffShader(material.vertexShader);
  Object.assign(material.uniforms, {
    cutoffOrigin: { value: config.origin.map((v,i) => v*scale + position[i]) },
    cutoffScale: { value: scale }, cutoffRadius: { value: config.radius },
    cutoffFeather: { value: config.feather }, cutoffEnabled: { value: 1 },
  });
  material.needsUpdate = true;
  viewer.forceRenderNextFrame();
  return (next, fullScene = false) => {
    if (!validCutoff(next)) throw new Error('Invalid distance cutoff settings.');
    material.uniforms.cutoffRadius.value = next.radius;
    material.uniforms.cutoffFeather.value = next.feather;
    material.uniforms.cutoffEnabled.value = fullScene ? 0 : 1;
    viewer.forceRenderNextFrame();
    viewer.render();
  };
}
