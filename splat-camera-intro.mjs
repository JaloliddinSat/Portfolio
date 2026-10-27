// Start moving through the point cloud immediately after readiness. Give the
// camera a short lead before colored geometry grows in, preserving both poses.
export const HERO_CAMERA_INTRO = { delayMs: 0, durationMs: 3200, revealLeadMs: 250, height: 1.8, setback: 0.16 };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
// Zero velocity and acceleration at both ends soften the takeoff and landing.
const smooth = t => t * t * t * (t * (6 * t - 15) + 10);
export function createHeroCameraIntro({ bodyOrigin, position, scale, finalPose, enabled = true }) {
  const body = bodyOrigin.map((v, i) => v * scale + position[i]);
  const horizontal = [finalPose.position[0] - body[0], 0, finalPose.position[2] - body[2]];
  const length = Math.hypot(horizontal[0], horizontal[2]) || 1;
  const top = [body[0] + horizontal[0]/length * HERO_CAMERA_INTRO.setback * scale,
    body[1] - HERO_CAMERA_INTRO.height * scale,
    body[2] + horizontal[2]/length * HERO_CAMERA_INTRO.setback * scale];
  // Keep the arc above/in front of the subject instead of passing through them.
  const control = [finalPose.position[0], body[1] - 1.1*scale, finalPose.position[2] - .2*scale];
  const initialPose = enabled ? { position: top, lookAt: body } : finalPose;
  let startTime = null;
  let finished = !enabled;
  return {
    initialPose,
    start(now) { startTime = now; },
    get active() { return startTime !== null && !finished; },
    update(now, scrollPose = finalPose, scrollProgress = 0) {
      if (finished || startTime === null) return scrollPose;
      const t = Math.max(0, Math.min(1, (now - startTime - HERO_CAMERA_INTRO.delayMs) / HERO_CAMERA_INTRO.durationMs));
      if (t === 1 || scrollProgress >= .015) { finished = true; return scrollPose; }
      const eased = smooth(t);
      return {
        position: mix(mix(top, control, eased), mix(control, finalPose.position, eased), eased),
        lookAt: mix(body, finalPose.lookAt, eased),
      };
    },
  };
}
