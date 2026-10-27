import assert from 'node:assert/strict';
import { HERO_REVEAL, installHeroReveal, patchRevealShader, revealRadiusAt, prepareHeroReveal, patchRevealFragment } from '../splat-reveal.mjs';
const source = 'uniform vec2 viewport; varying vec4 vColor; void main() { vec3 splatCenter; vec2 ndcOffset = vec2(0.0); vec4 quadPos; gl_Position = quadPos; }';
const patched = patchRevealShader(source);
assert(patched.includes('float revealAmount = heroRevealMask(splatCenter);'));
assert(patched.includes('basisVector1 = mix(vec2(pointRadius, 0.0), basisVector1, revealAmount)'), 'unrevealed geometry becomes small dots');
assert(patched.includes('mix(keepPoint * 0.65, 1.0, revealAmount)'), 'sparse dots transition to full original opacity');
const fragment = 'void main() { float opacity = exp(-0.5 * A) * vColor.a; }';
assert(patchRevealFragment(fragment).includes('color = mix(pointColor, color, vHeroRevealAmount)'), 'monochrome dots transition to graded color');
assert.throws(()=>patchRevealFragment('incompatible'), /does not support/);
assert.equal((patched.match(/uniform vec2 viewport;/g)||[]).length,1);
assert(!patched.includes('heroRevealMask(ndcCenter'), 'reveal never uses camera projection');
assert(patched.includes('length(p.xz)'), 'cylinder radius measures horizontal scene distance');
assert(patched.includes('vec2 noisePosition = p.xz;'), 'noise boundary is identical at every height');
assert(!patched.includes('p.y'), 'vertical position cannot delay the head or other geometry');
assert.throws(()=>patchRevealShader('incompatible'),/does not support/);
function fixture(options) {
  const material={vertexShader:source, fragmentShader:fragment, uniforms:{}};
  let forced=0;
  const states=[];
  const viewer={getSplatMesh:()=>({material}),forceRenderNextFrame:()=>forced++};
  const reveal=installHeroReveal(viewer,{...options,onState:state=>states.push(state)});
  return {material,reveal,states,forced:()=>forced};
}
for (const mobile of [false,true]) {
  const {material,reveal,states,forced}=fixture({position:[-1.65,.87,-.71],scale:mobile?.75*.73:.75});
  assert.equal(material.uniforms.heroRevealProgress.value,0,'first sorted frame starts as point cloud');
  assert.deepEqual(material.uniforms.heroRevealOrigin.value,HERO_REVEAL.bodyOrigin.map((v,i)=>v*(mobile?.75*.73:.75)+[-1.65,.87,-.71][i]));
  assert.equal(reveal.update(500),false,'wait for render readiness');
  reveal.start(1000);
  assert.equal(reveal.active,true);
  assert.equal(reveal.update(1000+HERO_REVEAL.durationMs/2),true,'stationary cameras keep rendering the reveal');
  assert.equal(material.uniforms.heroRevealProgress.value,.5);
  assert.equal(reveal.update(1000+HERO_REVEAL.durationMs),true,'render the final fully visible frame');
  assert.equal(material.uniforms.heroRevealProgress.value,1);
  assert.equal(reveal.active,false);
  assert.equal(reveal.update(100000),false,'no animation work remains after completion');
  assert.equal(forced(),2);
  assert.deepEqual(states,['revealing','complete']);
}
const themed=fixture();themed.reveal.setLightTheme(true);assert.equal(themed.material.uniforms.heroRevealPointTone.value,.25);themed.reveal.setLightTheme(false);assert.equal(themed.material.uniforms.heroRevealPointTone.value,.78);
const scrolled=fixture();scrolled.reveal.start(1000);scrolled.reveal.update(1100,.08);
assert.equal(scrolled.material.uniforms.heroRevealProgress.value,1,'scroll transition takes over without a partially hidden scene');
const reduced=fixture({reducedMotion:true});reduced.reveal.start(1000);
assert.equal(reduced.material.vertexShader,source,'reduced motion adds no reveal shader');
assert.equal(reduced.reveal.active,false);
assert.equal(reduced.reveal.update(1100),false);
assert.deepEqual(reduced.states,['complete']);
const backgrounded=fixture();backgrounded.reveal.start(1000);backgrounded.reveal.update(100000);
assert.equal(backgrounded.reveal.active,false,'returning from a hidden tab finishes elapsed animation');
console.log('PASS: organic reveal shader, shared 3D body origin and scene transforms, readiness, stationary rendering, completion, immediate scrolling, reduced motion and hidden-tab recovery');

assert(revealRadiusAt(.15) < revealRadiusAt(.5));
assert(Math.abs(revealRadiusAt(1)-HERO_REVEAL.maxRadius)<1e-9, 'reach the far background shell smoothly');
const warm=[];
const warmMaterial={uniforms:{heroRevealProgress:{value:0}}};
let polls=0;
const gl={SYNC_GPU_COMMANDS_COMPLETE:1,ALREADY_SIGNALED:2,CONDITION_SATISFIED:3,WAIT_FAILED:4,
  fenceSync(){warm.push('fence');return {};}, flush(){},
  clientWaitSync(){return ++polls%2?0:3;},isContextLost:()=>false,deleteSync(){warm.push('delete');}};
const warmViewer={renderer:{compileAsync:async()=>warm.push('compiled'),getContext:()=>gl},camera:{},
  getSplatMesh:()=>({material:warmMaterial}),forceRenderNextFrame(){},
  render(){warm.push(warmMaterial.uniforms.heroRevealProgress.value);}};
await prepareHeroReveal(warmViewer,async()=>warm.push('yield'));
assert.deepEqual(warm.filter(x=>typeof x==='number'),[1,.35,0],'warm all paths and reset hidden frame before starting');
assert.equal(warm[0],'compiled');assert.equal(warm.filter(x=>x==='delete').length,3,'every GPU fence completes and is released');
assert.equal(warm.filter(x=>x==='yield').length,3,'GPU preparation yields without blocking');
const script = await (await import('node:fs/promises')).readFile('script.js','utf8');
assert(script.includes('progressiveLoad: false'),'both devices finish the download before revealing');
assert(script.indexOf('await prepareHeroReveal(viewer)')<script.indexOf('heroReveal.start(introStartedAt +'),'start animation after GPU preparation');
console.log('PASS: hidden shader warm-up, GPU fence completion, fully loaded scene and delayed reveal clock');
