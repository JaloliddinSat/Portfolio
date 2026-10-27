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
  assert.deepEqual(intro.update(1000+HERO_CAMERA_INTRO.delayMs),intro.initialPose,'keep the exact initial overhead placement');
  const lead=intro.update(1000+HERO_CAMERA_INTRO.revealLeadMs);
  assert.notDeepEqual(lead.position,intro.initialPose.position,'camera is already moving before colored geometry appears');
  const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  const early=intro.update(1000+100);
  assert(distance(early.position,intro.initialPose.position)>.01,'first 100ms produces visible movement instead of a flat starting beat');
  const earlyNext=intro.update(1000+200);
  const midBefore=intro.update(1000+HERO_CAMERA_INTRO.durationMs/2-50);
  const midAfter=intro.update(1000+HERO_CAMERA_INTRO.durationMs/2+50);
  const late=intro.update(1000+HERO_CAMERA_INTRO.durationMs-100);
  const midSpeed=distance(midBefore.position,midAfter.position);
  assert(distance(early.position,earlyNext.position)<midSpeed,'accelerate gently out of the initial pose');
  assert(distance(late.position,finalPose.position)<midSpeed,'slow down into the exact landing');
  const middle=intro.update(1000+HERO_CAMERA_INTRO.delayMs+HERO_CAMERA_INTRO.durationMs/2);
  assert(middle.position.every(Number.isFinite));
  assert(middle.position[1]<body[1], 'arc remains above the torso');
  assert.notDeepEqual(middle.position,finalPose.position);
  assert.deepEqual(intro.update(1000+HERO_CAMERA_INTRO.delayMs+HERO_CAMERA_INTRO.durationMs),finalPose,'land exactly on the original camera');
  assert.equal(intro.active,false);
  const scrolledPose={position:[1,2,3],lookAt:[4,5,6]};
  assert.deepEqual(intro.update(9000,scrolledPose),scrolledPose,'scroll/parallax remain in control afterwards');
  const path=createHeroCameraIntro({...options,scale});path.start(0);
  let previous=path.initialPose.position;
  let remaining=distance(previous,finalPose.position);
  for(let step=1;step<=400;step++) {
    const next=path.update(HERO_CAMERA_INTRO.durationMs*step/400).position;
    for(let axis=0;axis<3;axis++) {
      const direction=Math.sign(finalPose.position[axis]-path.initialPose.position[axis]);
      assert((next[axis]-previous[axis])*direction>=-1e-12,'camera never reverses position on any axis');
    }
    const nextRemaining=distance(next,finalPose.position);
    assert(nextRemaining<=remaining+1e-12,'distance to the endpoint always decreases');
    previous=next;remaining=nextRemaining;
  }
}
const skip=createHeroCameraIntro({...options,enabled:false});skip.start(0);
assert.deepEqual(skip.initialPose,finalPose);assert.deepEqual(skip.update(100),finalPose);assert.equal(skip.active,false);
const scroll=createHeroCameraIntro(options);scroll.start(0);assert.deepEqual(scroll.update(100,finalPose,.02),finalPose);assert.equal(scroll.active,false);
console.log('PASS: overhead body framing on both scales, immediate eased descent and reveal lead, finite arc, exact original camera handoff, scrolling and reduced motion');

for(const durationMs of [1000,6400,10000]) {
 const custom=createHeroCameraIntro({...options,durationMs});custom.start(0);
 assert.notDeepEqual(custom.update(durationMs/2).position,finalPose.position);
 assert.equal(custom.active,true);
 assert.deepEqual(custom.update(durationMs),finalPose);
 assert.equal(custom.active,false);
}
console.log('PASS: visible initial motion and configurable A-to-B duration');
