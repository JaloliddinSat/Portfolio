// A stable, spatial noise field changes the reveal boundary without making it
// flicker. Evaluate once per splat vertex, rather than on every blended pixel.
export const HERO_REVEAL = {
  durationMs: 2400,
  desktopOrigin: [0.12, 0.18],
  mobileOrigin: [0.46, 0.18],
};
export const REVEAL_GLSL = `
uniform float heroRevealProgress;
uniform vec2 heroRevealOrigin;
float heroRevealHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float heroRevealNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(heroRevealHash(cell), heroRevealHash(cell + vec2(1.0, 0.0)), f.x),
             mix(heroRevealHash(cell + vec2(0.0, 1.0)), heroRevealHash(cell + vec2(1.0)), f.x), f.y);
}
float heroRevealMask(vec2 ndc) {
  if (heroRevealProgress >= 1.0) return 1.0;
  if (heroRevealProgress <= 0.0) return 0.0;
  float aspect = viewport.x / max(viewport.y, 1.0);
  vec2 p = (ndc - heroRevealOrigin) * vec2(aspect, 1.0);
  float corner = length((vec2(1.0) + abs(heroRevealOrigin)) * vec2(aspect, 1.0));
  // Mix broad lobes with smaller edge detail. Noise is fixed in scene projection.
  float noise = heroRevealNoise(p * 3.4) * 0.7 + heroRevealNoise(p * 8.1 + 17.3) * 0.3;
  float distanceField = (length(p) + (noise - 0.5) * 0.38) / corner;
  float t = heroRevealProgress;
  float radius = mix(-0.08, 1.10, t * t * (3.0 - 2.0 * t));
  return 1.0 - smoothstep(radius - 0.045, radius + 0.045, distanceField);
}
`;
export function patchRevealShader(shader) {
  const anchor = 'gl_Position = quadPos;';
  if (!shader.includes(anchor) || !shader.includes('ndcCenter') || !shader.includes('uniform vec2 viewport;')) {
    throw new Error('This splat shader does not support the hero reveal.');
  }
  // The renderer already declares viewport. Place helpers after that declaration
  // so the noise mask can read it in both WebGL shader compilation paths.
  return shader.replace('uniform vec2 viewport;', 'uniform vec2 viewport;\n' + REVEAL_GLSL)
    .replace(anchor, 'vColor.a *= heroRevealMask(ndcCenter.xy);\n' + anchor);
}
export function installHeroReveal(viewer, { mobile = false, reducedMotion = false, onState = () => {} } = {}) {
  const material = viewer.getSplatMesh().material;
  if (!reducedMotion) {
    material.vertexShader = patchRevealShader(material.vertexShader);
    material.uniforms.heroRevealProgress = { value: 0 };
    material.uniforms.heroRevealOrigin = { value: mobile ? HERO_REVEAL.mobileOrigin : HERO_REVEAL.desktopOrigin };
    material.needsUpdate = true;
  }
  let startTime = null;
  let complete = reducedMotion;
  return {
    start(now) {
      startTime = now;
      onState(complete ? 'complete' : 'revealing');
    },
    update(now, scrollProgress = 0) {
      if (complete || startTime === null) return false;
      const progress = Math.max(0, Math.min(1, (now - startTime) / HERO_REVEAL.durationMs));
      // Let an immediate scroll take over with the existing depth transition.
      const done = progress >= 1 || scrollProgress >= 0.08;
      material.uniforms.heroRevealProgress.value = done ? 1 : progress;
      viewer.forceRenderNextFrame();
      if (done) { complete = true; onState('complete'); }
      return true; // Include the final frame, even when the camera is stationary.
    },
    get active() { return startTime !== null && !complete; },
  };
}
