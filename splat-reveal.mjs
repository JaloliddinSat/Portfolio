// The origin is on the torso in Fairview model coordinates. Transform it with
// the scene so mobile scaling cannot change which physical geometry appears first.
export const HERO_REVEAL = {
  durationMs: 3000,
  bodyOrigin: [-0.24, -0.06, -0.05],
  maxRadius: 248,
  // The hexagonal ghost front runs the same growth curve on a compressed clock,
  // so it is always ahead of the coloured reveal and lands at 70% of the duration.
  frontFinishAt: 0.7,
  pointRadius: 2,
  // Points the hex front passes over shrink to this fraction instead of vanishing.
  pointShrink: 0.45,
  // The hero copy starts its own entrance once the coloured reveal reaches this.
  copyRevealAt: 0.6,
};
// The ghost's opacity follows the gap between the two fronts: nearly invisible
// while they overlap near the body, reaching its ceiling once the hex is a full
// model unit ahead. Fractions of the ghost's base alpha, evaluated per frame.
export const HERO_REVEAL_GHOST = { minOpacity: 0.05, maxOpacity: 0.8, gapRange: 1 };
// Light growth edge and ghost tone. The same warm near-white rim in both themes.
export const HERO_REVEAL_RIM = { dark: [0.96, 0.93, 0.86], light: [0.96, 0.93, 0.86] };
// Unrevealed dot brightness, also identical across themes.
export const HERO_REVEAL_POINT_TONE = { dark: 0.78, light: 0.78 };
export const revealRadiusAt = progress => 0.1 * (Math.expm1(Math.log1p(HERO_REVEAL.maxRadius / 0.1) * Math.max(0, Math.min(1, progress))));
export const frontRadiusAt = progress => revealRadiusAt(progress / HERO_REVEAL.frontFinishAt);
export const ghostOpacityAt = progress => {
  const t = Math.max(0, Math.min(1, (frontRadiusAt(progress) - revealRadiusAt(progress)) / HERO_REVEAL_GHOST.gapRange));
  return HERO_REVEAL_GHOST.minOpacity + (HERO_REVEAL_GHOST.maxOpacity - HERO_REVEAL_GHOST.minOpacity) * t * t * (3 - 2 * t);
};
// Radii and ghost opacity are evaluated once per frame here instead of per splat.
export function setRevealProgress(uniforms, progress) {
  if (uniforms.heroRevealProgress) uniforms.heroRevealProgress.value = progress;
  if (uniforms.heroRevealRadius) uniforms.heroRevealRadius.value = revealRadiusAt(progress);
  if (uniforms.heroRevealFrontRadius) uniforms.heroRevealFrontRadius.value = frontRadiusAt(progress);
  if (uniforms.heroRevealGhostOpacity) uniforms.heroRevealGhostOpacity.value = ghostOpacityAt(progress);
}
export const REVEAL_GLSL = `
uniform float heroRevealProgress;
uniform float heroRevealRadius;
uniform float heroRevealFrontRadius;
uniform vec3 heroRevealOrigin;
uniform float heroRevealScale;
float heroRevealHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float heroRevealNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(heroRevealHash(cell), heroRevealHash(cell + vec2(1.0, 0.0)), f.x),
             mix(heroRevealHash(cell + vec2(0.0, 1.0)), heroRevealHash(cell + vec2(1.0)), f.x), f.y);
}
// x: coloured reveal amount. y: light growth-edge weight. z: hexagonal ghost zone.
vec3 heroRevealMask(vec3 scenePosition) {
  if (heroRevealProgress >= 1.0) return vec3(1.0, 0.0, 0.0);
  if (heroRevealProgress <= 0.0) return vec3(0.0);
  vec3 p = (scenePosition - heroRevealOrigin) / heroRevealScale;
  // Ignore height for both distance and noise: every vertical column reveals
  // together as the irregular cylinder expands through the scene's XZ plane.
  float distanceFromBody = length(p.xz);
  vec2 noisePosition = p.xz;
  float noise = heroRevealNoise(noisePosition * 3.4) * 0.7 + heroRevealNoise(noisePosition * 8.1 + 17.3) * 0.3;
  float distanceField = distanceFromBody + (noise - 0.5) * (0.12 + 0.04 * min(distanceFromBody, 4.0));
  float radius = heroRevealRadius;
  float feather = 0.045 + radius * 0.02;
  float reveal = 1.0 - smoothstep(radius - feather, radius + feather, distanceField);
  // Growth edge: brightest on splats that just crossed the front, cooling inward.
  // The band scales with the radius so it stays thick through exponential growth.
  float signedDistance = distanceField - radius;
  float band = 0.03 + 0.04 * radius;
  float rim = exp(-max(-signedDistance, 0.0) / band) * (1.0 - smoothstep(0.0, band * 0.35, signedDistance));
  // Secondary front: a flat-edged hexagon (apothem distance) with almost no noise,
  // so its straight edges read against the organic circle growing inside it.
  vec2 q = abs(p.xz);
  float hexField = max(q.y, dot(q, vec2(0.8660254, 0.5))) + (noise - 0.5) * 0.05;
  float hexRadius = heroRevealFrontRadius;
  float hexFeather = 0.03 + hexRadius * 0.015;
  float zone = 1.0 - smoothstep(hexRadius - hexFeather, hexRadius + hexFeather, hexField);
  float hexRim = 1.0 - smoothstep(0.0, hexFeather * 2.0 + 0.02, abs(hexField - hexRadius));
  return vec3(reveal, max(rim, hexRim), zone);
}
`;
export function patchRevealShader(shader) {
  const anchor = 'vec2 ndcOffset =';
  if (!shader.includes(anchor) || !shader.includes('vec3 splatCenter')) {
    throw new Error('This splat shader does not support the hero reveal.');
  }
  return REVEAL_GLSL + '\nvarying float vHeroRevealAmount;\nvarying vec2 vHeroRevealFx;\nuniform float heroRevealPixelRatio;\nuniform float heroRevealGhostOpacity;\n' + shader.replace(anchor, `
    vec3 revealField = heroRevealMask(splatCenter);
    float revealAmount = revealField.x;
    // A stable subset of scene points becomes small, round screen-space dots.
    // Morph the same draw into full splats instead of rendering a second scene.
    float keepPoint = step(0.90, fract(float(splatIndex) * 0.61803398875));
    // The hex ghost is made of the splats that are not points, so the point
    // cloud survives the hex passing over it and only shrinks there.
    float ghostZone = revealField.z * (1.0 - keepPoint);
    vHeroRevealAmount = revealAmount;
    vHeroRevealFx = vec2(revealField.y, ghostZone);
    if (revealAmount < 1.0) {
      float pointRadius = ${HERO_REVEAL.pointRadius.toFixed(1)} * heroRevealPixelRatio
        * mix(1.0, ${HERO_REVEAL.pointShrink.toFixed(2)}, revealField.z);
      // Inside the hexagonal front the ghost splats already have their full
      // shape, drawn translucently until the coloured reveal fills them in.
      float shapeAmount = max(revealAmount, ghostZone);
      basisVector1 = mix(vec2(pointRadius, 0.0), basisVector1, shapeAmount);
      basisVector2 = mix(vec2(0.0, pointRadius), basisVector2, shapeAmount);
      // Dozens of splats overlap per pixel on the body, so the ghost stays faint;
      // heroRevealGhostOpacity scales it by how far ahead of the colour it is.
      float ghostAlpha = (0.06 + 0.2 * revealField.y) * heroRevealGhostOpacity;
      float unrevealedAlpha = mix(keepPoint * 0.65, ghostAlpha, ghostZone);
      vColor.a *= mix(unrevealedAlpha, 1.0, revealAmount);
    }
    vColor.a = min(1.0, vColor.a * (1.0 + revealField.y * 0.3));
    ` + anchor);
}
export function patchRevealFragment(shader) {
  const anchor = 'float opacity = exp(-0.5 * A) * vColor.a;';
  if (!shader.includes(anchor)) throw new Error('This fragment shader does not support the hero point cloud.');
  return 'varying float vHeroRevealAmount;\nvarying vec2 vHeroRevealFx;\nuniform float heroRevealPointTone;\nuniform vec3 heroRevealRimColor;\n' + shader.replace(anchor, `
    if (vHeroRevealAmount < 1.0 || vHeroRevealFx.x > 0.0) {
      float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
      vec3 pointColor = vec3(heroRevealPointTone * (0.7 + 0.3 * luminance));
      vec3 ghostColor = heroRevealRimColor * (0.35 + 0.4 * luminance);
      color = mix(mix(pointColor, ghostColor, vHeroRevealFx.y), color, vHeroRevealAmount);
      color = mix(color, heroRevealRimColor, min(1.0, vHeroRevealFx.x * 1.1));
    }
    ` + anchor);
}
export function installHeroReveal(viewer, { position = [0, 0, 0], scale = 1, durationMs = HERO_REVEAL.durationMs, lightTheme = false, reducedMotion = false, onState = () => {}, onProgress = () => {} } = {}) {
  durationMs = Number.isFinite(durationMs) ? Math.max(500, Math.min(10000, durationMs)) : HERO_REVEAL.durationMs;
  const material = viewer.getSplatMesh().material;
  if (!reducedMotion) {
    material.vertexShader = patchRevealShader(material.vertexShader);
    material.fragmentShader = patchRevealFragment(material.fragmentShader);
    material.uniforms.heroRevealProgress = { value: 0 };
    material.uniforms.heroRevealRadius = { value: 0 };
    material.uniforms.heroRevealFrontRadius = { value: 0 };
    material.uniforms.heroRevealGhostOpacity = { value: HERO_REVEAL_GHOST.minOpacity };
    material.uniforms.heroRevealOrigin = { value: HERO_REVEAL.bodyOrigin.map((v, i) => v * scale + position[i]) };
    material.uniforms.heroRevealScale = { value: scale };
    material.uniforms.heroRevealPixelRatio = { value: viewer.devicePixelRatio || 1 };
    material.uniforms.heroRevealPointTone = { value: lightTheme ? HERO_REVEAL_POINT_TONE.light : HERO_REVEAL_POINT_TONE.dark };
    material.uniforms.heroRevealRimColor = { value: [...(lightTheme ? HERO_REVEAL_RIM.light : HERO_REVEAL_RIM.dark)] };
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
      const progress = Math.max(0, Math.min(1, (now - startTime) / durationMs));
      // Let an immediate scroll take over with the existing depth transition.
      const done = progress >= 1 || scrollProgress >= 0.08;
      setRevealProgress(material.uniforms, done ? 1 : progress);
      viewer.forceRenderNextFrame();
      onProgress(done ? 1 : progress);
      if (done) { complete = true; onState('complete'); }
      return true; // Include the final frame, even when the camera is stationary.
    },
    get active() { return startTime !== null && !complete; },
    setLightTheme(light) {
      if (material.uniforms.heroRevealPointTone) material.uniforms.heroRevealPointTone.value = light ? HERO_REVEAL_POINT_TONE.light : HERO_REVEAL_POINT_TONE.dark;
      if (material.uniforms.heroRevealRimColor) material.uniforms.heroRevealRimColor.value = [...(light ? HERO_REVEAL_RIM.light : HERO_REVEAL_RIM.dark)];
    },
  };
}

// Fence the hidden warm-up draws instead of gl.finish(), which would block the
// main thread. The reveal clock only starts after these GPU commands complete.
async function waitForGpu(renderer, nextFrame) {
  const gl = renderer.getContext?.();
  if (!gl?.fenceSync) { await nextFrame(); await nextFrame(); return; }
  const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  if (!fence) throw new Error('Could not prepare the splat GPU reveal.');
  gl.flush();
  try {
    for (let i = 0; i < 180; i++) {
      const status = gl.clientWaitSync(fence, 0, 0);
      if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) return;
      if (status === gl.WAIT_FAILED || gl.isContextLost()) throw new Error('Splat GPU preparation failed.');
      await nextFrame();
    }
    throw new Error('Splat GPU preparation timed out.');
  } finally { gl.deleteSync(fence); }
}
export async function prepareHeroReveal(viewer, nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve))) {
  const renderer = viewer.renderer;
  const mesh = viewer.getSplatMesh();
  const uniforms = mesh.material.uniforms;
  const progress = uniforms.heroRevealProgress;
  await renderer.compileAsync?.(mesh, viewer.camera);
  const original = progress?.value;
  try {
    // Warm both the full graded scene and the active noise/reveal path. At 0.35
    // the points, hexagonal ghost zone and growth edge are all on screen at once.
    for (const value of progress ? [1, 0.35] : [1]) {
      if (progress) setRevealProgress(uniforms, value);
      viewer.forceRenderNextFrame();
      viewer.render();
      await waitForGpu(renderer, nextFrame);
    }
  } finally {
    if (progress) setRevealProgress(uniforms, original);
  }
  // Reset the hidden canvas to the first point-cloud animation frame.
  viewer.forceRenderNextFrame();
  viewer.render();
  await waitForGpu(renderer, nextFrame);
}
