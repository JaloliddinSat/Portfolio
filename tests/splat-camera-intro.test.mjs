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

// Exercise the actual frame callback on either side of intro completion. Both
// must apply cursor parallax to the current pose, with no change in offset.
const vm=await import('node:vm');
const source=await (await import('node:fs/promises')).readFile('script.js','utf8');
const start=source.indexOf('const renderSplatFrame =');
const end=source.indexOf('syncHeroDepthTheme =',start);
let calls=0,rendered=[],motion=0;
const pose={position:[1,2,3],lookAt:[4,5,6]};
const context={performance:{now:()=>0},document:{hidden:false,documentElement:{classList:{remove(){}}}},splatInView:true,
 noteHeroMotion:()=>motion++,
 updatePointerParallax:()=>false,heroReveal:{update:()=>false,active:false},
 heroCameraIntro:{active:true,update:()=>pose},lastRenderedProgress:null,
 easeScrollProgress:x=>x,computeScrollPosition:()=>pose,SPLAT_CONFIG:{cameraStart:pose,cameraEnd:pose},
 applyPointerParallax:(position,lookAt)=>{calls++;return {position:position.map(v=>v+.05),lookAt};},
 viewer:{camera:{position:{set(...values){rendered.push(values);}},lookAt(){}},forceRenderNextFrame(){}},
 updateHeroDepthShader(){},ensureViewerRunning(){},renderManualViewerFrame(){}};
vm.createContext(context);vm.runInContext(source.slice(start,end).replace('const renderSplatFrame =','globalThis.frame ='),context);
context.frame({smoothed:0,delta:16,force:true,requestNextFrame(){}});
context.heroCameraIntro.active=false;
context.frame({smoothed:0,delta:16,force:true,requestNextFrame(){}});
assert.equal(calls,2,'cursor parallax stays enabled during and after the intro');
assert.deepEqual(rendered[0],rendered[1],'ending the intro cannot snap to a new parallax offset');
assert.equal(motion,1,'the moving intro reports motion; a forced redraw of an unchanged picture does not');
context.frame({smoothed:.2,delta:16,force:false,requestNextFrame(){}});
assert.equal(motion,2,'a changing scroll position reports motion');
console.log('PASS: continuous parallax before and after intro completion');
