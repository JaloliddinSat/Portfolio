// Runtime pacing for the splat viewers. Pure state machines; the hosts in
// script.js supply the clock, the timers and the pixel-ratio application.

// Hero adaptive resolution. Motion (camera intro, reveal, scroll, parallax) is
// drawn at `motionRatio`; the viewer returns to `ceiling` once no motion has been
// reported for `settleMs`. Entering motion is immediate so the first heavy frame
// is already cheap; leaving it is debounced so a stream of pointer events never
// toggles the drawing buffer more than once per gesture.
export function createAdaptiveResolution({ ceiling, motionRatio = 1, settleMs = 300, apply }) {
  const sharp = Math.max(0.5, Number(ceiling) || 1);
  const soft = Math.min(sharp, Math.max(0.5, Number(motionRatio) || 1));
  const enabled = soft < sharp - 1e-6;
  let current = sharp;
  let lastMotionAt = -Infinity;
  return {
    get ratio() { return current; },
    get inMotion() { return current !== sharp; },
    get enabled() { return enabled; },
    settleMs,
    // Returns true when the drawing buffer just dropped to the motion ratio.
    noteMotion(now) {
      lastMotionAt = now;
      if (!enabled || current === soft) return false;
      current = soft;
      apply(soft);
      return true;
    },
    // Milliseconds until the ceiling may be restored, or 0 when already due.
    remainingMs(now) { return Math.max(0, lastMotionAt + settleMs - now); },
    // Returns true when the ceiling was just restored; the host must then draw
    // one frame so the sharp image is what stays on screen.
    settle(now) {
      if (!enabled || current === sharp || now - lastMotionAt < settleMs) return false;
      current = sharp;
      apply(sharp);
      return true;
    },
  };
}

// Frame cap for a tween that keeps its own clock. `shouldStep(time)` answers
// whether this animation frame should apply the transform; skipped frames leave
// the previous image on screen while the tween itself keeps real-time pacing.
// The accumulator carries the remainder so 60 Hz and 120 Hz both land on ~fps.
export function createFrameCap(fps = 30) {
  const interval = 1000 / Math.max(1, fps);
  let last = -Infinity;
  return {
    interval,
    shouldStep(time) {
      const elapsed = time - last;
      // Allow a little slack so a 16.7 ms cadence steps exactly every other frame.
      if (elapsed < interval - 1) return false;
      // A frame admitted through the slack counts as a full interval; otherwise
      // carry the remainder so the long-run rate stays at `fps`.
      last = Number.isFinite(elapsed) && elapsed >= interval ? time - (elapsed % interval) : time;
      return true;
    },
    reset() { last = -Infinity; },
  };
}
