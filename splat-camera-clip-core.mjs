// A sphere parented to the camera that erases every splat inside it. Used to
// remove geometry that sits right next to the lens and flies past while the
// camera travels. Evaluated in view space, so it follows the camera with no
// per-frame uniform updates.
export const defaultCameraClip = () => ({
  version: 1, target: 'hero', asset: '/splats/Fairview.ksplat', space: 'camera',
  radius: 0.7, feather: 0.15, offset: [-0.42, 0, 0], enabled: true,
});
export function validCameraClip(value) {
  return value?.version === 1 && value.target === 'hero' && value.asset === '/splats/Fairview.ksplat' && value.space === 'camera' &&
    Number.isFinite(value.radius) && value.radius >= 0 && value.radius <= 50 &&
    Number.isFinite(value.feather) && value.feather >= 0 && value.feather <= 10 &&
    Array.isArray(value.offset) && value.offset.length === 3 && value.offset.every(v => Number.isFinite(v) && Math.abs(v) <= 50) &&
    typeof value.enabled === 'boolean';
}
export const CAMERA_CLIP_GLSL = `
uniform float cameraClipRadius;
uniform float cameraClipFeather;
uniform vec3 cameraClipOffset;
uniform float cameraClipMode; // 0 off, 1 erase, 2 highlight
// 1.0 keeps the splat, 0.0 erases it, in between is the feathered rim.
float splatCameraClip(vec3 viewCenter) {
  if (cameraClipMode < 0.5 || cameraClipRadius <= 0.0) return 1.0;
  // The offset is authored in camera space with +z pointing ahead of the lens;
  // view space looks down -z, so flip it here.
  float d = length(viewCenter - cameraClipOffset * vec3(1.0, 1.0, -1.0));
  float feather = min(cameraClipFeather, cameraClipRadius);
  if (feather <= 0.0) return step(cameraClipRadius, d);
  return smoothstep(cameraClipRadius - feather, cameraClipRadius, d);
}
`;
// Erased splats leave the vertex shader right after their view-space centre is
// known, before projection, covariance and colour work, and emit no fragments.
// Highlight mode paints them instead so the sphere can be seen while tuning.
export function patchCameraClipShader(shader) {
  const viewAnchor = 'vec4 viewCenter = transformModelViewMatrix * vec4(splatCenter, 1.0);';
  const anchor = 'gl_Position = quadPos;';
  if (!shader.includes(viewAnchor) || !shader.includes(anchor)) throw new Error('This splat shader does not support camera clipping.');
  return CAMERA_CLIP_GLSL + shader
    .replace(viewAnchor, `${viewAnchor}
            float cameraClipAlpha = splatCameraClip(viewCenter.xyz);
            if (cameraClipAlpha <= 0.0 && cameraClipMode < 1.5) {
                gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
                return;
            }`)
    .replace(anchor, `if (cameraClipMode > 1.5) vColor.rgb = mix(vec3(1.0, 0.15, 0.1), vColor.rgb, cameraClipAlpha);
            else vColor.a *= cameraClipAlpha;
            ${anchor}`);
}
export function installCameraClip(viewer, config) {
  if (!validCameraClip(config)) throw new Error('Invalid camera clip settings.');
  const material = viewer.getSplatMesh().material;
  material.vertexShader = patchCameraClipShader(material.vertexShader);
  Object.assign(material.uniforms, {
    cameraClipRadius: { value: config.radius },
    cameraClipFeather: { value: config.feather },
    cameraClipOffset: { value: [...config.offset] },
    cameraClipMode: { value: config.enabled ? 1 : 0 },
  });
  material.needsUpdate = true;
  viewer.forceRenderNextFrame();
  return (next, { highlight = false } = {}) => {
    if (!validCameraClip(next)) throw new Error('Invalid camera clip settings.');
    material.uniforms.cameraClipRadius.value = next.radius;
    material.uniforms.cameraClipFeather.value = next.feather;
    material.uniforms.cameraClipOffset.value = [...next.offset];
    material.uniforms.cameraClipMode.value = !next.enabled ? 0 : highlight ? 2 : 1;
    viewer.forceRenderNextFrame();
    viewer.render?.();
  };
}
