// The origin is on the torso in Fairview model coordinates. Transform it with
// the scene so mobile scaling cannot change which physical geometry appears first.
export const HERO_REVEAL = {
  durationMs: 3000,
  bodyOrigin: [-0.24, -0.06, -0.05],
  maxRadius: 248,
};
export const revealRadiusAt = progress => 0.1 * (Math.expm1(Math.log1p(HERO_REVEAL.maxRadius / 0.1) * Math.max(0, Math.min(1, progress))));
export const REVEAL_GLSL = `
uniform float heroRevealProgress;
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
float heroRevealMask(vec3 scenePosition) {
  if (heroRevealProgress >= 1.0) return 1.0;
  if (heroRevealProgress <= 0.0) return 0.0;
  vec3 p = (scenePosition - heroRevealOrigin) / heroRevealScale;
  // Ignore height for both distance and noise: every vertical column reveals
  // together as the irregular cylinder expands through the scene's XZ plane.
  float distanceFromBody = length(p.xz);
  vec2 noisePosition = p.xz;
  float noise = heroRevealNoise(noisePosition * 3.4) * 0.7 + heroRevealNoise(noisePosition * 8.1 + 17.3) * 0.3;
  float distanceField = distanceFromBody + (noise - 0.5) * (0.12 + 0.04 * min(distanceFromBody, 4.0));
  // Exponential growth spends time on the nearby body and furniture, then reaches
  // the capture's distant background shell without a last-frame pop.
  float radius = 0.1 * (exp(log(1.0 + 248.0 / 0.1) * heroRevealProgress) - 1.0);
  float feather = 0.045 + radius * 0.02;
  return 1.0 - smoothstep(radius - feather, radius + feather, distanceField);
}
`;
export function patchRevealShader(shader) {
  const anchor = 'vec2 ndcOffset =';
  if (!shader.includes(anchor) || !shader.includes('vec3 splatCenter')) {
    throw new Error('This splat shader does not support the hero reveal.');
  }
  return REVEAL_GLSL + '\nvarying float vHeroRevealAmount;\nuniform float heroRevealPixelRatio;\n' + shader.replace(anchor, `
    float revealAmount = heroRevealMask(splatCenter);
    vHeroRevealAmount = revealAmount;
    if (revealAmount < 1.0) {
      // A stable subset of scene points becomes small, round screen-space dots.
      // Morph the same draw into full splats instead of rendering a second scene.
      float keepPoint = step(0.90, fract(float(splatIndex) * 0.61803398875));
      float pointRadius = 1.35 * heroRevealPixelRatio;
      basisVector1 = mix(vec2(pointRadius, 0.0), basisVector1, revealAmount);
      basisVector2 = mix(vec2(0.0, pointRadius), basisVector2, revealAmount);
      vColor.a *= mix(keepPoint * 0.65, 1.0, revealAmount);
    }
    ` + anchor);
}
export function patchRevealFragment(shader) {
  const anchor = 'float opacity = exp(-0.5 * A) * vColor.a;';
  if (!shader.includes(anchor)) throw new Error('This fragment shader does not support the hero point cloud.');
  return 'varying float vHeroRevealAmount;\nuniform float heroRevealPointTone;\n' + shader.replace(anchor, `
    if (vHeroRevealAmount < 1.0) {
      float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
      vec3 pointColor = vec3(heroRevealPointTone * (0.7 + 0.3 * luminance));
      color = mix(pointColor, color, vHeroRevealAmount);
    }
    ` + anchor);
}
export function installHeroReveal(viewer, { position = [0, 0, 0], scale = 1, lightTheme = false, reducedMotion = false, onState = () => {} } = {}) {
  const material = viewer.getSplatMesh().material;
  if (!reducedMotion) {
    material.vertexShader = patchRevealShader(material.vertexShader);
    material.fragmentShader = patchRevealFragment(material.fragmentShader);
    material.uniforms.heroRevealProgress = { value: 0 };
    material.uniforms.heroRevealOrigin = { value: HERO_REVEAL.bodyOrigin.map((v, i) => v * scale + position[i]) };
    material.uniforms.heroRevealScale = { value: scale };
    material.uniforms.heroRevealPixelRatio = { value: viewer.devicePixelRatio || 1 };
    material.uniforms.heroRevealPointTone = { value: lightTheme ? 0.25 : 0.78 };
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
    setLightTheme(light) {
      if (material.uniforms.heroRevealPointTone) material.uniforms.heroRevealPointTone.value = light ? 0.25 : 0.78;
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
  const progress = mesh.material.uniforms.heroRevealProgress;
  await renderer.compileAsync?.(mesh, viewer.camera);
  const original = progress?.value;
  try {
    // Warm both the full graded scene and the active noise/reveal path.
    for (const value of progress ? [1, 0.35] : [1]) {
      if (progress) progress.value = value;
      viewer.forceRenderNextFrame();
      viewer.render();
      await waitForGpu(renderer, nextFrame);
    }
  } finally {
    if (progress) progress.value = original;
  }
  // Reset the hidden canvas to the first point-cloud animation frame.
  viewer.forceRenderNextFrame();
  viewer.render();
  await waitForGpu(renderer, nextFrame);
}
