import assert from 'node:assert/strict';
import { HERO_REVEAL, installHeroReveal, patchRevealShader } from '../splat-reveal.mjs';
const source = 'uniform vec2 viewport; varying vec4 vColor; void main() { vec4 ndcCenter; vec4 quadPos; gl_Position = quadPos; }';
const patched = patchRevealShader(source);
assert(patched.includes('vColor.a *= heroRevealMask(ndcCenter.xy);'));
assert.equal((patched.match(/uniform vec2 viewport;/g)||[]).length,1);
assert(patched.indexOf('uniform vec2 viewport;') < patched.indexOf('float heroRevealMask('));
assert.throws(()=>patchRevealShader('incompatible'),/does not support/);
function fixture(options) {
  const material={vertexShader:source, uniforms:{}};
  let forced=0;
  const states=[];
  const viewer={getSplatMesh:()=>({material}),forceRenderNextFrame:()=>forced++};
  const reveal=installHeroReveal(viewer,{...options,onState:state=>states.push(state)});
  return {material,reveal,states,forced:()=>forced};
}
for (const mobile of [false,true]) {
  const {material,reveal,states,forced}=fixture({mobile});
  assert.equal(material.uniforms.heroRevealProgress.value,0,'first sorted frame starts hidden');
  assert.deepEqual(material.uniforms.heroRevealOrigin.value,mobile?HERO_REVEAL.mobileOrigin:HERO_REVEAL.desktopOrigin);
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
const scrolled=fixture();scrolled.reveal.start(1000);scrolled.reveal.update(1100,.08);
assert.equal(scrolled.material.uniforms.heroRevealProgress.value,1,'scroll transition takes over without a partially hidden scene');
const reduced=fixture({reducedMotion:true});reduced.reveal.start(1000);
assert.equal(reduced.material.vertexShader,source,'reduced motion adds no reveal shader');
assert.equal(reduced.reveal.active,false);
assert.equal(reduced.reveal.update(1100),false);
assert.deepEqual(reduced.states,['complete']);
const backgrounded=fixture();backgrounded.reveal.start(1000);backgrounded.reveal.update(100000);
assert.equal(backgrounded.reveal.active,false,'returning from a hidden tab finishes elapsed animation');
console.log('PASS: organic reveal shader, desktop/mobile origins, readiness, stationary rendering, completion, immediate scrolling, reduced motion and hidden-tab recovery');
