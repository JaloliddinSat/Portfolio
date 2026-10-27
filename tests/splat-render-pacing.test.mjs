import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAdaptiveResolution, createFrameCap } from '../splat-render-pacing.mjs';

// Hero adaptive resolution: 1x in motion, ceiling ~300ms after input settles.
let applied = [];
const resolution = createAdaptiveResolution({ ceiling: 1.5, motionRatio: 1, settleMs: 300, apply: ratio => applied.push(ratio) });
assert.equal(resolution.ratio, 1.5, 'starts at the sharp ceiling');
assert.equal(resolution.enabled, true);
assert.equal(resolution.settle(0), false, 'nothing to restore before any motion');
assert.equal(resolution.noteMotion(1000), true, 'first motion drops to 1x immediately');
assert.deepEqual(applied, [1]);
for (let t = 1016; t < 1300; t += 16) assert.equal(resolution.noteMotion(t), false, 'a stream of pointer events never re-applies the ratio');
assert.deepEqual(applied, [1], 'hysteresis: one application per motion burst');
assert.equal(resolution.settle(1500), false, 'still within the settle window of the last event');
assert.equal(resolution.remainingMs(1500), 88, 'measured from the last event at 1288');
assert.equal(resolution.settle(1587), false, 'not a millisecond early');
assert.equal(resolution.settle(1588), true, 'ceiling restored once input has settled');
assert.deepEqual(applied, [1, 1.5]);
assert.equal(resolution.inMotion, false);
assert.equal(resolution.settle(2000), false, 'settling is idempotent, so the host draws exactly one sharp frame');
assert.equal(resolution.noteMotion(2100), true, 'a new gesture drops again');
assert.deepEqual(applied, [1, 1.5, 1]);
console.log('PASS: adaptive resolution drops once per gesture and restores once after the settle window');

// Pinned resolution (debug override or a 1x display) never toggles.
for (const [ceiling, motionRatio] of [[1.25, 1.25], [1, 1], [0.5, 1]]) {
  applied = [];
  const pinned = createAdaptiveResolution({ ceiling, motionRatio, settleMs: 300, apply: ratio => applied.push(ratio) });
  assert.equal(pinned.enabled, false);
  assert.equal(pinned.noteMotion(0), false);
  assert.equal(pinned.settle(1000), false);
  assert.deepEqual(applied, [], `ceiling ${ceiling} with motion ${motionRatio} is fixed`);
  assert.equal(pinned.ratio, Math.max(0.5, ceiling));
}
console.log('PASS: ?splatPixelRatio override and 1x displays keep a fixed resolution');

// StepNote orbit frame cap: ~30 steps per second at 60Hz and 120Hz without pausing.
for (const hz of [60, 120, 144]) {
  const cap = createFrameCap(30);
  let steps = 0;
  const frames = hz * 2;
  for (let i = 0; i < frames; i++) if (cap.shouldStep(i * 1000 / hz)) steps++;
  assert(Math.abs(steps - 60) <= 1, `${hz}Hz produced ${steps} steps over two seconds`);
}
const cap = createFrameCap(30);
assert.equal(cap.shouldStep(5000), true, 'first frame after a pause steps immediately');
assert.equal(cap.shouldStep(5016.7), false, 'alternate 60Hz frame is skipped');
assert.equal(cap.shouldStep(5033.3), true, 'the following frame steps even when 0.03ms early');
assert.equal(cap.shouldStep(5400), true, 'a long gap steps at once');
assert.equal(cap.shouldStep(5416.7), false, 'and resets the cadence from that frame');
console.log('PASS: frame cap halves the draw rate on 60Hz and 120Hz displays while the tween clock keeps real time');

// Pin the wiring in script.js.
const script = await readFile('script.js', 'utf8');
const stepNote = script.slice(script.indexOf('const initStepNoteSplat ='), script.indexOf('const initStepNoteProject ='));
assert(stepNote.includes('sphericalHarmonicsDegree: 1'), 'StepNote renders first-order spherical harmonics');
assert(stepNote.includes('createFrameCap(STEPNOTE_ORBIT_FPS)') && script.includes('const STEPNOTE_ORBIT_FPS = 30'), 'StepNote orbit draws at 30fps');
const skip = stepNote.indexOf('if (!orbitFrameCap.shouldStep(time))');
assert(skip > 0 && skip < stepNote.indexOf('applyLoopTransform(progress)', stepNote.indexOf('const animate =')), 'skipped frames exit before the transform and render request');
assert(stepNote.slice(skip, skip + 160).includes('requestAnimationFrame(animate)'), 'skipped frames keep the loop alive instead of pausing the viewer');
assert(stepNote.includes('if (animationFrameId === null) return libraryShouldRender();'), 'draw gate defers to the library when the orbit is paused or idle');
assert(stepNote.indexOf('orbitDrawPending = true;') > skip, 'one draw is admitted per applied orbit step');
const hero = script.slice(script.indexOf('const initSplat ='), script.indexOf('const showToast ='));
assert(!hero.includes('scheduleInitialLoadGrace') && !hero.includes('6500'), 'fixed post-load grace is gone');
assert(hero.includes('!heroReveal.active && !heroCameraIntro.active && !viewer.sortRunning'), 'idle-stop waits for reveal, intro and sorter');
assert(hero.includes('HERO_IDLE_STOP_SAFETY_MS'), 'with a bounded safety ceiling');
assert(hero.includes("motionRatio: DEBUG_SPLAT_PIXEL_RATIO > 0 ? splatPixelRatio : 1"), 'debug pixel ratio override pins the hero resolution');
assert(hero.includes('heroResolution.settle(performance.now())') && hero.slice(hero.indexOf('heroResolution.settle(')).slice(0, 200).includes('heroFrameDriver.request({ force: true })'), 'restoring the ceiling draws a sharp frame');
assert(hero.includes("import('./splat-render-pacing.mjs?v=1')"));
console.log('PASS: hero and StepNote wiring pinned');
