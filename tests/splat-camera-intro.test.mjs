import assert from 'node:assert/strict';
import { createHeroCameraIntro, HERO_CAMERA_INTRO } from '../splat-camera-intro.mjs';
const finalPose={position:[-1.66,.3,-1.91],lookAt:[-1.82,.58,-1.27]};
const options={bodyOrigin:[-.24,-.06,-.05],position:[-1.65,.87,-.71],scale:.75,finalPose};
for(const scale of [.75,.75*.73]) {
  const intro=createHeroCameraIntro({...options,scale});
  const body=options.bodyOrigin.map((v,i)=>v*scale+options.position[i]);
  assert.deepEqual(intro.initialPose.lookAt,body,'overhead camera aims at the same physical body point');
  assert.equal(intro.initialPose.position[1],body[1]-HERO_CAMERA_INTRO.height*scale);
  assert.deepEqual(intro.update(100),finalPose,'no animated camera before readiness');
  intro.start(1000);
  assert.deepEqual(intro.update(1000+HERO_CAMERA_INTRO.delayMs),intro.initialPose,'hold overhead while the outward reveal begins');
  const middle=intro.update(1000+HERO_CAMERA_INTRO.delayMs+HERO_CAMERA_INTRO.durationMs/2);
  assert(middle.position.every(Number.isFinite));
  assert(middle.position[1]<body[1], 'arc remains above the torso');
  assert.notDeepEqual(middle.position,finalPose.position);
  assert.deepEqual(intro.update(1000+HERO_CAMERA_INTRO.delayMs+HERO_CAMERA_INTRO.durationMs),finalPose,'land exactly on the original camera');
  assert.equal(intro.active,false);
  const scrolledPose={position:[1,2,3],lookAt:[4,5,6]};
  assert.deepEqual(intro.update(9000,scrolledPose),scrolledPose,'scroll/parallax remain in control afterwards');
}
const skip=createHeroCameraIntro({...options,enabled:false});skip.start(0);
assert.deepEqual(skip.initialPose,finalPose);assert.deepEqual(skip.update(100),finalPose);assert.equal(skip.active,false);
const scroll=createHeroCameraIntro(options);scroll.start(0);assert.deepEqual(scroll.update(100,finalPose,.02),finalPose);assert.equal(scroll.active,false);
console.log('PASS: overhead body framing on both scales, delayed descent, finite arc, exact original camera handoff, scrolling and reduced motion');
