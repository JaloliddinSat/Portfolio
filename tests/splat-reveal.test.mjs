import assert from 'node:assert/strict';
import { HERO_REVEAL, HERO_REVEAL_RIM, HERO_REVEAL_GHOST, installHeroReveal, patchRevealShader, revealRadiusAt, frontRadiusAt, ghostOpacityAt, setRevealProgress, prepareHeroReveal, patchRevealFragment } from '../splat-reveal.mjs';
const source = 'uniform vec2 viewport; varying vec4 vColor; void main() { vec3 splatCenter; vec2 ndcOffset = vec2(0.0); vec4 quadPos; gl_Position = quadPos; }';
const patched = patchRevealShader(source);
assert(patched.includes('vec3 revealField = heroRevealMask(splatCenter);'));
assert(patched.includes('float ghostZone = revealField.z * (1.0 - keepPoint);'), 'point cloud survives the hex front passing over it');
assert(patched.includes('float shapeAmount = max(revealAmount, ghostZone);'), 'hex ghost zone restores full splat shape ahead of colour');
assert(patched.includes('basisVector1 = mix(vec2(pointRadius, 0.0), basisVector1, shapeAmount)'), 'unrevealed geometry becomes small dots');
assert(patched.includes('float pointRadius = 2.0 * heroRevealPixelRatio'), 'bigger point cloud dots');
assert(patched.includes('* mix(1.0, 0.45, revealField.z)'), 'points shrink inside the hex instead of disappearing');
assert(patched.includes('float ghostAlpha = (0.06 + 0.2 * revealField.y) * heroRevealGhostOpacity;'), 'ghost opacity follows the per-frame front gap');
assert(patched.includes('vColor.a *= mix(unrevealedAlpha, 1.0, revealAmount)'), 'sparse dots and ghosts transition to full original opacity');
assert(patched.includes('max(q.y, dot(q, vec2(0.8660254, 0.5)))'), 'secondary front is a hexagon measured by apothem');
assert(patched.includes('uniform float heroRevealRadius;') && patched.includes('uniform float heroRevealFrontRadius;'), 'radii are per-frame uniforms');
assert(!patched.includes('exp(log('), 'no per-splat exponential radius remains');
const fragment = 'void main() { float opacity = exp(-0.5 * A) * vColor.a; }';
const patchedFragment = patchRevealFragment(fragment);
assert(patchedFragment.includes('color = mix(mix(pointColor, ghostColor, vHeroRevealFx.y), color, vHeroRevealAmount)'), 'monochrome dots and ghosts transition to graded color');
assert(patchedFragment.includes('color = mix(color, heroRevealRimColor, min(1.0, vHeroRevealFx.x * 1.1))'), 'light growth edge tints the front');
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
  assert.equal(material.uniforms.heroRevealRadius.value,revealRadiusAt(.5),'radius uniform follows the growth curve');
  assert.equal(material.uniforms.heroRevealFrontRadius.value,frontRadiusAt(.5),'hex front uniform follows the compressed curve');
  assert.equal(reveal.update(1000+HERO_REVEAL.durationMs),true,'render the final fully visible frame');
  assert.equal(material.uniforms.heroRevealProgress.value,1);
  assert(Math.abs(material.uniforms.heroRevealRadius.value-HERO_REVEAL.maxRadius)<1e-9);
  assert.equal(reveal.active,false);
  assert.equal(reveal.update(100000),false,'no animation work remains after completion');
  assert.equal(forced(),2);
  assert.deepEqual(states,['revealing','complete']);
}
const themed=fixture();assert.deepEqual(themed.material.uniforms.heroRevealRimColor.value,HERO_REVEAL_RIM.dark);
themed.reveal.setLightTheme(true);assert.equal(themed.material.uniforms.heroRevealPointTone.value,.25);assert.deepEqual(themed.material.uniforms.heroRevealRimColor.value,HERO_REVEAL_RIM.light);
themed.reveal.setLightTheme(false);assert.equal(themed.material.uniforms.heroRevealPointTone.value,.78);assert.deepEqual(themed.material.uniforms.heroRevealRimColor.value,HERO_REVEAL_RIM.dark);
const scrolled=fixture();scrolled.reveal.start(1000);scrolled.reveal.update(1100,.08);
assert.equal(scrolled.material.uniforms.heroRevealProgress.value,1,'scroll transition takes over without a partially hidden scene');
const reduced=fixture({reducedMotion:true});reduced.reveal.start(1000);
assert.equal(reduced.material.vertexShader,source,'reduced motion adds no reveal shader');
assert.equal(reduced.reveal.active,false);
assert.equal(reduced.reveal.update(1100),false);
assert.deepEqual(reduced.states,['complete']);
const backgrounded=fixture();backgrounded.reveal.start(1000);backgrounded.reveal.update(100000);
assert.equal(backgrounded.reveal.active,false,'returning from a hidden tab finishes elapsed animation');
{
  const progressed=[];const material={vertexShader:source,fragmentShader:fragment,uniforms:{}};
  const reveal=installHeroReveal({getSplatMesh:()=>({material}),forceRenderNextFrame(){}},{onProgress:p=>progressed.push(p)});
  reveal.start(0);for(const t of [600,1500,1800,2400,3000]) reveal.update(t);
  assert.deepEqual(progressed,[.2,.5,.6,.8,1],'progress is reported every frame so the copy can enter at 60%');
  assert.equal(HERO_REVEAL.copyRevealAt,.6);
  const cut=[];const cutReveal=installHeroReveal({getSplatMesh:()=>({material:{vertexShader:source,fragmentShader:fragment,uniforms:{}}}),forceRenderNextFrame(){}},{onProgress:p=>cut.push(p)});
  cutReveal.start(0);cutReveal.update(300,.5);assert.deepEqual(cut,[1],'a scroll that cuts the reveal short reports completion');
}
console.log('PASS: organic reveal shader, shared 3D body origin and scene transforms, readiness, stationary rendering, completion, immediate scrolling, reduced motion and hidden-tab recovery');

assert(revealRadiusAt(.15) < revealRadiusAt(.5));
assert(Math.abs(revealRadiusAt(1)-HERO_REVEAL.maxRadius)<1e-9, 'reach the far background shell smoothly');
for(const t of [.05,.2,.35,.5,.69]) assert(frontRadiusAt(t) > revealRadiusAt(t), 'hex front always leads the coloured reveal');
assert(Math.abs(frontRadiusAt(HERO_REVEAL.frontFinishAt)-HERO_REVEAL.maxRadius)<1e-9,'hex front finishes early');
assert(Math.abs(frontRadiusAt(1)-HERO_REVEAL.maxRadius)<1e-9,'hex front clamps at the far shell');
const synced={heroRevealProgress:{value:0},heroRevealRadius:{value:0},heroRevealFrontRadius:{value:0},heroRevealGhostOpacity:{value:0}};
setRevealProgress(synced,.4);assert.equal(synced.heroRevealRadius.value,revealRadiusAt(.4));assert.equal(synced.heroRevealFrontRadius.value,frontRadiusAt(.4));assert.equal(synced.heroRevealGhostOpacity.value,ghostOpacityAt(.4));
assert(Math.abs(ghostOpacityAt(0)-HERO_REVEAL_GHOST.minOpacity)<1e-9,'overlapping fronts start at 5%');
assert(ghostOpacityAt(.05)<.06 && ghostOpacityAt(.05)>=HERO_REVEAL_GHOST.minOpacity,'ghost is nearly invisible while the fronts overlap');
assert(ghostOpacityAt(.1)<ghostOpacityAt(.2) && ghostOpacityAt(.2)<ghostOpacityAt(.3),'opacity rises with the gap');
assert.equal(ghostOpacityAt(.35),HERO_REVEAL_GHOST.maxOpacity,'reaches 80% once the hex is a model unit ahead');assert.equal(HERO_REVEAL_GHOST.maxOpacity,.8);
assert.equal(ghostOpacityAt(1),HERO_REVEAL_GHOST.minOpacity,'both fronts clamp together at the far shell');
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
assert(script.includes('if (progress >= HERO_REVEAL.copyRevealAt) playHeroIntro();'),'hero copy enters at 60% of the colour reveal');
assert(script.includes('if (state === "complete") playHeroIntro();'),'reduced motion and cut-short reveals still release the copy');
assert(!/state === "ready"[^\n]*hero-intro-play/.test(script),'readiness alone no longer releases the copy');
const indexHtml = await (await import('node:fs/promises')).readFile('index.html','utf8');
assert(!/hero-intro-play[\s\S]{0,40}\}, 2000\)/.test(indexHtml),'the 2s inline cap is gone; the loader holds the copy until the reveal');
assert(indexHtml.includes('root.classList.add("hero-intro-play");\n          }\n        }, 15000);'),'copy is released if the module never initialises');
assert(indexHtml.includes('window.addEventListener("wheel", preventScroll, { passive: false })'),'wheel is intercepted before the module loads');
assert(indexHtml.includes('window.addEventListener("touchmove", preventScroll, { passive: false })'),'touch scrolling is intercepted on iOS');
assert(indexHtml.includes('history.scrollRestoration = "manual"'),'reloads of the home URL do not restore a mid-page scroll behind the loader');
assert(script.includes('if (state !== "loading" && isHeroScrollLocked())'),'unlocking the loader restores the hero origin');
assert(script.includes('window.scrollTo(0, 0)'),'the intro starts at the top when there is no hash');
const styles = await (await import('node:fs/promises')).readFile('styles.css','utf8');
assert(styles.includes('html.splat-reveal-pending:not(.splat-load-slow)[data-splat-load-state="loading"]'),'document overflow is locked while the overlay is up');
assert(styles.includes('overflow: hidden;'),'the lock uses the standard document overflow rule');
console.log('PASS: hidden shader warm-up, GPU fence completion, fully loaded scene and delayed reveal clock');

for(const durationMs of [500,5700,10000]) {
 const custom=fixture({durationMs});custom.reveal.start(0);
 custom.reveal.update(durationMs/2);assert.equal(custom.material.uniforms.heroRevealProgress.value,.5);
 custom.reveal.update(durationMs);assert.equal(custom.material.uniforms.heroRevealProgress.value,1);
 assert.equal(custom.reveal.active,false);
}
console.log('PASS: independent configurable cylinder growth duration');
