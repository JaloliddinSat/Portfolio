const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const original = fs.readFileSync('ascii-physics.js', 'utf8').replace(/\ninitAsciiPhysics\(\);\s*$/, '').replace(/^import .*\n/, '');
function setup({mobile=false, reduced=false, top=-10,diagnostics,config={},noToggle=false,savedPreference}={}) {
  const listeners = new Map();
  const stored = new Map();
  if (savedPreference !== undefined) stored.set('ascii-physics-enabled',savedPreference);
  const frames = new Map();
  let id=0;
  const context = {setTransform(){},clearRect(){},fillText(){},save(){},restore(){},translate(){},rotate(){},scale(){},drawImage(){},beginPath(){},rect(){},clip(){}};
  const element = name => ({hidden:false,dataset:{theme:'dark'},scrollHeight:8000,
    classList:{values:new Set(),add(name){this.values.add(name)},remove(name){this.values.delete(name)},toggle(name,force){if(force)this.values.add(name);else this.values.delete(name)},contains(name){return this.values.has(name)}}, setAttribute(k,v){this[k]=v},
    addEventListener(k,fn){listeners.set(name+':'+k,fn)},
    hasPointerCapture(){return false}, setPointerCapture(){}, releasePointerCapture(){},getBoundingClientRect(){return {top}},querySelectorAll(){return []}});
  const canvas = element('canvas'); canvas.dataset.asciiConfig=JSON.stringify(config); canvas.getContext=()=>context;
  const toggle=element('toggle'), content=element('content'), root=element('root'), doc=element('document');
  Object.assign(doc,{elementFromPoint:()=>({closest:()=>null}),createElement:()=>({getContext:()=>context}),hidden:false,documentElement:root,body:element('body'),querySelector:s=>({'#ascii-curtain':canvas,'#ascii-toggle':noToggle?null:toggle,'#site-content-transition':content}[s])});
  const win=element('window');win.__portfolioDiagnostics=diagnostics;
  const scope = { document:doc, window:win, innerWidth:1200,innerHeight:800,devicePixelRatio:1,scrollY:1600,scrollX:0,performance:{now:()=>100},
    localStorage:{getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v)},
    matchMedia:q=>({matches:q.includes('reduced')?reduced:!mobile,addEventListener(){}}),
    requestAnimationFrame:fn=>{frames.set(++id,fn);return id},cancelAnimationFrame:i=>frames.delete(i),
    ResizeObserver:class{observe(){}},MutationObserver:class{observe(){}} };
  content.getBoundingClientRect=()=>({top:top+1600-scope.scrollY});
  vm.createContext(scope);
  const source=original.replaceAll('export function','function').replace(/  checkReveal\(\);\n}\s*$/,`  checkReveal();\n return {particles,simulate,measure,checkReveal,sync,draw,tick,spawn,hitboxHalf,state:()=>({activated,enabled,frame,spawnTop,worldBottom})};\n}`);
  vm.runInContext(fs.readFileSync('content-hitboxes.js','utf8').replaceAll('export function','function')+'\n'+source+'\nvar api = initAsciiPhysics();',scope);
  return {scope,api:scope.api,listeners,stored,frames,canvas,toggle,content};
}
const s=setup(); s.api.measure();
assert.equal(s.api.state().activated,true);
const p={scale:1,angle:0,angularVelocity:0,x:100,y:2000,vx:20,vy:80,glyph:'#'}; s.api.particles.push(p);
s.api.simulate(); const before={...p}; s.scope.scrollY=5000; s.api.checkReveal();
assert.equal(p.x,before.x); assert.equal(p.y,before.y); assert.equal(p.vy,before.vy);
s.api.simulate(); assert(p.y>before.y,'off-screen particles must continue moving');
p.x=5;p.vx=-100;s.api.simulate();assert(p.vx>0,'side walls bounce');
p.y=s.api.state().worldBottom;p.vy=100;s.api.simulate();assert(p.vy<0,'document bottom bounces');
s.api.particles.length=0;s.api.particles.push({scale:1,angle:0,angularVelocity:0,x:100,y:2000,vx:20,vy:0},{scale:1,angle:0,angularVelocity:0,x:110,y:2000,vx:-20,vy:0});s.api.simulate();assert(s.api.particles[0].vx<0,'glyph collisions exchange velocity');
s.listeners.get('toggle:click')();assert.equal(s.api.state().enabled,false);assert.equal(s.api.state().frame,null);assert.equal(s.canvas.hidden,true);assert.equal(s.stored.get('ascii-physics-enabled'),'false');
s.listeners.get('toggle:click')();assert.equal(s.api.state().enabled,true);assert.notEqual(s.api.state().frame,null);
assert.equal(setup({mobile:true}).toggle.hidden,true);
assert.equal(setup({reduced:true}).api.state().enabled,false);
const hero=setup({top:500});assert.equal(hero.api.state().activated,false);assert.equal(hero.api.state().frame,null);
console.log('PASS: scroll independence, off-screen motion, page bounds, glyph collisions, toggle/persistence, desktop gate, reduced motion, hero gate');

const dragTest=setup(); dragTest.api.measure();
const glyph={scale:1,angle:0,angularVelocity:0,x:100,y:2000,vx:10,vy:20};dragTest.api.particles.push(glyph);
const target={closest:()=>null};
dragTest.listeners.get('document:pointerdown')({button:0,target,clientX:100,clientY:400,pointerId:1,preventDefault(){},stopPropagation(){}});
dragTest.listeners.get('document:pointermove')({clientX:120,clientY:420,pointerId:1});
assert.equal(glyph.x,120);assert.equal(glyph.y,2020);assert(glyph.vx>0 && glyph.vy>0);
dragTest.listeners.get('document:pointerup')();
const thrownY=glyph.y;dragTest.api.simulate();assert(glyph.y>thrownY);
const boxTest=setup();
boxTest.content.querySelectorAll=()=>[{parentElement:{closest:()=>null},getClientRects:()=>[{}],matches:()=>false,getBoundingClientRect:()=>({left:80,right:180,top:450,bottom:500,width:100,height:50})}];
boxTest.api.measure();const colliding={scale:1,angle:0,angularVelocity:0,x:100,y:2044,vx:0,vy:100};boxTest.api.particles.push(colliding);boxTest.api.simulate();assert(colliding.vy<0,'content boxes bounce');
console.log('PASS: mouse dragging, release momentum, content box collision');

const persist=setup();persist.api.measure();persist.content.getBoundingClientRect=()=>({top:500});persist.api.checkReveal();assert.equal(persist.api.state().activated,true);assert.equal(persist.canvas.hidden,false,'returning to hero must not hide particles');
for(let i=0;i<200;i++)persist.api.spawn();
assert(persist.api.particles.every(p=>p.scale>=1&&p.scale<=1.8));
assert(persist.api.particles.every(p=>Math.abs(p.angularVelocity)<=Math.PI/4&&Math.abs(p.angularVelocity)>=5*Math.PI/180));
assert(persist.api.particles.some(p=>p.angularVelocity<0)&&persist.api.particles.some(p=>p.angularVelocity>0));
const spinning=persist.api.particles[0];const oldAngle=spinning.angle;persist.api.simulate();assert.notEqual(spinning.angle,oldAngle);
const large={scale:1.8,angle:Math.PI/4,angularVelocity:0,x:100,y:1000,vx:0,vy:-30};persist.api.particles.length=0;persist.api.particles.push(large);persist.api.simulate();assert(large.y>=persist.api.state().spawnTop+persist.api.hitboxHalf(large),'grid barrier keeps particles out of hero');
const generous=setup();generous.api.measure();const grab={scale:1,angle:0,angularVelocity:0,x:100,y:2000,vx:10,vy:20};generous.api.particles.push(grab);
generous.listeners.get('document:pointerdown')({button:0,target:{closest:()=>null},clientX:125,clientY:400,pointerId:1,preventDefault(){},stopPropagation(){}});assert.equal(grab.vx,0,'can grab 25px from glyph center');
console.log('PASS: persistent hero visibility, randomized size/spin bounds, both directions, rotation advances, grid boundary, enlarged grab target');

const grid=setup();grid.api.measure();const b={scale:1,angle:0,angularVelocity:0,x:100,y:1595,vx:20,vy:-100};grid.api.particles.push(b);grid.api.simulate();assert(b.y>=grid.api.state().spawnTop+6);assert(b.vy>0);
const prevVy=b.vy;grid.content.getBoundingClientRect=()=>({top:700});grid.api.checkReveal();grid.api.simulate();assert(b.y>=grid.api.state().spawnTop+6);assert.equal(b.vy,prevVy,'grid boundary must not impart scrolling velocity');
grid.api.spawn();assert(grid.api.particles.at(-1).y>grid.api.state().spawnTop,'spawn inside grid');
const timing=setup();timing.api.measure();const mover={scale:1,angle:0,angularVelocity:0,x:100,y:2200,vx:0,vy:100};timing.api.particles.push(mover);timing.api.tick(1000);timing.api.tick(1300);timing.api.tick(1317);timing.api.tick(1334);timing.api.tick(1351);assert(mover.y>2230,'dropped-frame time is carried forward');
console.log('PASS: grid confinement, moving transition barrier without scroll impulse, spawning inside grid, delayed-frame catch-up');
const atlas=setup();atlas.api.measure();atlas.api.particles.push({scale:1.5,angle:0.4,angularVelocity:0.2,x:100,y:2000,vx:10,vy:20,glyph:'#'});
let glyphRasterizations=0;const atlasContext=atlas.canvas.getContext('2d');atlasContext.fillText=()=>glyphRasterizations++;
atlas.api.draw();const built=glyphRasterizations;assert(built>0);atlas.api.draw();atlas.api.draw();assert.equal(glyphRasterizations,built,'glyphs rasterize once, then use bitmap draws');
console.log('PASS: glyph atlas is reused across animated frames');

const diagnosticFlags={particleLimit:80,glyphCollisions:true,cachedGlyphs:true,physicsPaused:false,drawingPaused:false};
const diagnosticPreview=setup({diagnostics:{flags:diagnosticFlags,sample(){},state(){},event(){}}});diagnosticPreview.api.measure();diagnosticFlags.particleLimit=80;
for(let i=0;i<1500;i++)diagnosticPreview.api.simulate();assert.equal(diagnosticPreview.api.particles.length,80,'debug cap must stop spawning at selected count');
diagnosticPreview.listeners.get('toggle:click')();assert.equal(diagnosticPreview.stored.has('ascii-physics-enabled'),false,'private preview must not change visitor preference');
console.log('PASS: private particle cap and visitor preference isolation');

const tuned=setup({config:{asciiRotationMultiplier:0,asciiScaleMultiplier:3,asciiSpawnWidth:20,asciiParticleLimit:180}});tuned.api.measure();
for(let i=0;i<2400;i++)tuned.api.simulate();assert.equal(tuned.api.particles.length,180);
assert(tuned.api.particles.every(p=>p.scale>=3&&p.scale<=5.4));assert(tuned.api.particles.every(p=>p.angularVelocity===0));
const band=setup({config:{asciiSpawnWidth:20,asciiScaleMultiplier:3}});band.api.measure();for(let i=0;i<200;i++)band.api.spawn();
assert(band.api.particles.every(p=>p.x+band.api.hitboxHalf(p)<=120||p.x-band.api.hitboxHalf(p)>=1080),'spawn boxes stay inside the two outer tenths');
const larger=setup({config:{asciiScaleMultiplier:3}});larger.api.measure();larger.api.particles.push({scale:5.4,angle:Math.PI/4,angularVelocity:0,x:100,y:2000,vx:20,vy:0},{scale:5.4,angle:Math.PI/4,angularVelocity:0,x:180,y:2000,vx:-20,vy:0});larger.api.simulate();assert(larger.api.particles[0].vx<0,'scaled characters collide across old cell boundaries');
const zero=setup({config:{asciiParticleLimit:0}});zero.api.measure();for(let i=0;i<120;i++)zero.api.simulate();assert.equal(zero.api.particles.length,0);
console.log('PASS: saved count, scale and rotation multipliers, edge spawn bands, large collision boxes, zero count');

const hover=setup();hover.api.measure();const hoveringGlyph={scale:1,angle:0,angularVelocity:0,x:100,y:2000,vx:0,vy:0,glyph:'#'};hover.api.particles.push(hoveringGlyph);
const surface={closest:()=>null};const root=hover.scope.document.documentElement;
hover.listeners.get('document:pointermove')({clientX:100,clientY:400,target:surface,pointerId:1});
assert(root.classList.contains('ascii-hovering'),'grab cursor appears inside catch radius');
hoveringGlyph.x=300;hover.api.tick(1000);assert(!root.classList.contains('ascii-hovering'),'stationary cursor clears when glyph floats away');
hoveringGlyph.x=100;hover.api.tick(1017);assert(root.classList.contains('ascii-hovering'),'stationary cursor updates when glyph returns');
hover.listeners.get('document:pointermove')({clientX:100,clientY:400,target:{closest:()=>({})},pointerId:1});assert(!root.classList.contains('ascii-hovering'),'links and controls retain their cursors');
hover.listeners.get('document:pointermove')({clientX:100,clientY:400,target:surface,pointerId:1});
hover.listeners.get('document:pointerdown')({clientX:100,clientY:400,target:surface,pointerId:1,button:0,preventDefault(){},stopPropagation(){}});
assert(root.classList.contains('ascii-dragging'));assert(!root.classList.contains('ascii-hovering'));
hover.listeners.get('document:pointerup')();assert(!root.classList.contains('ascii-dragging'));assert(root.classList.contains('ascii-hovering'));
hover.listeners.get('window:blur')();assert(!root.classList.contains('ascii-hovering'));
hover.listeners.get('document:pointermove')({clientX:100,clientY:400,target:surface,pointerId:1});hover.listeners.get('toggle:click')();assert(!root.classList.contains('ascii-hovering'),'disabled effect clears grab cursor');
assert(band.api.particles.some(p=>p.x<120)&&band.api.particles.some(p=>p.x>1080),'spawning uses both sides');
console.log('PASS: edge-only spawns, live hover cursor, stationary-pointer updates, control exclusion, dragging and cleanup');

// Isolate force integration from rendering, spawning, and collision responses.
function forceSetup(config = {}, theme = 'dark', x = 400, y = 2000) {
  const result = setup({config:{asciiParticleLimit:0,asciiCursorStrength:400,asciiCursorRadius:300,asciiCursorFalloff:2,asciiCursorReleaseDistance:0,...config}});
  result.api.measure();
  result.scope.document.documentElement.dataset.theme = theme;
  const particle = {scale:1,angle:0,angularVelocity:0,x,y,vx:0,vy:0,glyph:'#'};
  result.api.particles.push(particle);
  result.listeners.get('document:pointermove')({clientX:500,clientY:400,target:{closest:()=>null},pointerId:1});
  return {...result,particle};
}
const pull=forceSetup();pull.api.simulate();assert(pull.particle.vx>0);assert.equal(pull.particle.vy,0);
const repel=forceSetup({},'light');repel.api.simulate();assert(repel.particle.vx<0);assert.equal(repel.particle.vx,-pull.particle.vx,'themes reverse identical force');
pull.scope.document.documentElement.dataset.theme='light';pull.particle.vx=0;pull.api.simulate();assert(pull.particle.vx<0,'theme changes apply without reloading');
const outside=forceSetup({},'dark',100);outside.api.simulate();assert.equal(outside.particle.vx,0);
const edge=forceSetup({},'dark',200);edge.api.simulate();assert.equal(edge.particle.vx,0,'force is zero at radius');
const center=forceSetup({},'dark',500);center.api.simulate();assert.equal(center.particle.vx,0);assert(Number.isFinite(center.particle.vy));
const soft=forceSetup({},'dark',499);soft.api.simulate();assert(soft.particle.vx>0&&soft.particle.vx<400/120/24,'force softens near cursor');
const linear=forceSetup({asciiCursorFalloff:1});linear.api.simulate();
const concentrated=forceSetup({asciiCursorFalloff:4});concentrated.api.simulate();assert(linear.particle.vx>concentrated.particle.vx);
const noForce=forceSetup({asciiCursorStrength:0});noForce.api.simulate();assert.equal(noForce.particle.vx,0);
const noRadius=forceSetup({asciiCursorRadius:0});noRadius.api.simulate();assert.equal(noRadius.particle.vx,0);
const capped=forceSetup({asciiCursorStrength:3000,asciiMaxVelocity:50});capped.particle.vx=400;capped.particle.vy=400;capped.api.simulate();assert(Math.hypot(capped.particle.vx,capped.particle.vy)<=50+1e-10);
const still=forceSetup({asciiMaxVelocity:0});still.api.simulate();assert.equal(still.particle.x,400);assert.equal(still.particle.y,2000);
const scrollForce=forceSetup();scrollForce.scope.scrollY=1800;scrollForce.api.simulate();assert(scrollForce.particle.vx>0&&scrollForce.particle.vy>0,'cursor uses document coordinates after scrolling');
const leave=forceSetup();leave.listeners.get('root:pointerleave')();leave.api.simulate();assert.equal(leave.particle.vx,0);
const blur=forceSetup();blur.listeners.get('window:blur')();blur.api.simulate();assert.equal(blur.particle.vx,0);
const heroForce=forceSetup();heroForce.listeners.get('document:pointermove')({clientX:500,clientY:0,target:{closest:()=>null},pointerId:1});heroForce.scope.scrollY=0;heroForce.api.simulate();assert.equal(heroForce.particle.vx,0,'cursor above grid has no force');
const held=forceSetup();held.listeners.get('document:pointerdown')({clientX:400,clientY:400,target:{closest:()=>null},pointerId:1,button:0,preventDefault(){},stopPropagation(){}});held.api.simulate();assert.equal(held.particle.vx,0,'dragged particles ignore force');
const capThrow=forceSetup({asciiMaxVelocity:50});capThrow.listeners.get('document:pointerdown')({clientX:400,clientY:400,target:{closest:()=>null},pointerId:1,button:0,preventDefault(){},stopPropagation(){}});capThrow.listeners.get('document:pointermove')({clientX:500,clientY:500,pointerId:1});assert(Math.hypot(capThrow.particle.vx,capThrow.particle.vy)<=50+1e-10,'throw vector respects speed cap');
console.log('PASS: dark attraction, light repulsion, live theme changes, radius, soft core, falloff, zero force/radius/speed, speed/throw cap, scrolling, pointer leave/blur, hero exclusion, drag isolation');

const collisionCap=setup({config:{asciiParticleLimit:0,asciiMaxVelocity:100}});collisionCap.api.measure();
collisionCap.api.particles.push({scale:1,angle:0,angularVelocity:0,x:100,y:2000,vx:100,vy:0},{scale:1,angle:0,angularVelocity:0,x:110,y:2000,vx:0,vy:100});
collisionCap.api.simulate();assert(collisionCap.api.particles.every(p=>Math.hypot(p.vx,p.vy)<=100+1e-10),'collision exchange cannot exceed total speed cap');
const stress=forceSetup({asciiCursorStrength:3000,asciiCursorRadius:2000,asciiCursorFalloff:0.25,asciiMaxVelocity:600});
for(let i=0;i<2400;i++)stress.api.simulate();
assert([stress.particle.x,stress.particle.y,stress.particle.vx,stress.particle.vy].every(Number.isFinite));assert(Math.hypot(stress.particle.vx,stress.particle.vy)<=600+1e-10);
console.log('PASS: collision speed cap and sustained maximum-force stability');

const passThrough=forceSetup({asciiCursorReleaseDistance:40,asciiCursorCooldown:1,asciiCursorEscapeNudge:100},'dark',470);
passThrough.particle.vx=180;passThrough.api.simulate();
assert.equal(passThrough.particle.cursorReleased,true);assert.equal(passThrough.particle.vx,180,'fast approaching glyph keeps its incoming momentum');
assert.equal(passThrough.particle.cursorCooldownRemaining,1);
passThrough.particle.x=580;passThrough.api.simulate();assert.equal(passThrough.particle.vx,180,'outside resume radius still coasts until cooldown completes');
for(let i=0;i<125;i++)passThrough.api.simulate();assert.equal(passThrough.particle.cursorReleased,false);assert(passThrough.particle.vx<180,'attraction resumes after cooldown and escape');
const linger=forceSetup({asciiCursorReleaseDistance:40,asciiCursorCooldown:1,asciiCursorEscapeNudge:0},'dark',480);
for(let i=0;i<150;i++)linger.api.simulate();assert.equal(linger.particle.cursorReleased,true);assert.equal(linger.particle.vx,0,'time alone cannot recapture a glyph still near cursor');
linger.particle.x=550;linger.api.simulate();assert.equal(linger.particle.cursorReleased,true,'hysteresis excludes gap between release and resume radius');
linger.particle.x=565;linger.api.simulate();assert.equal(linger.particle.cursorReleased,false);assert(linger.particle.vx<0);
const escape=forceSetup({asciiCursorReleaseDistance:40,asciiCursorEscapeNudge:100},'dark',480);escape.api.simulate();assert.equal(escape.particle.vx,-100,'slow character gets outward nudge');
escape.particle.vx=0;escape.api.simulate();assert.equal(escape.particle.vx,-100,'slowdown after a collision can receive another escape nudge');
const exact=forceSetup({asciiCursorReleaseDistance:40},'dark',500);exact.api.simulate();assert(Number.isFinite(exact.particle.vx));assert(Math.hypot(exact.particle.vx,exact.particle.vy)>0,'exact center has finite escape direction');
const lightPass=forceSetup({asciiCursorReleaseDistance:40},'light',480);lightPass.api.simulate();assert(!lightPass.particle.cursorReleased);assert(lightPass.particle.vx<0&&Math.abs(lightPass.particle.vx)<100,'light theme repulsion is continuous without nudges');
const themePass=forceSetup({asciiCursorReleaseDistance:40},'dark',480);themePass.api.simulate();themePass.scope.document.documentElement.dataset.theme='light';themePass.api.simulate();assert.equal(themePass.particle.cursorReleased,false);
const boundedNudge=forceSetup({asciiCursorReleaseDistance:40,asciiCursorEscapeNudge:600,asciiMaxVelocity:50},'dark',480);boundedNudge.api.simulate();assert(Math.hypot(boundedNudge.particle.vx,boundedNudge.particle.vy)<=50+1e-10);
const noPass=forceSetup({asciiCursorReleaseDistance:0},'dark',480);noPass.api.simulate();assert(noPass.particle.vx>0);assert(!noPass.particle.cursorReleased);
const noGravityNudge=forceSetup({asciiCursorStrength:0,asciiCursorReleaseDistance:40},'dark',480);noGravityNudge.api.simulate();assert.equal(noGravityNudge.particle.vx,0);
const limitedRadius=forceSetup({asciiCursorRadius:20,asciiCursorReleaseDistance:500},'dark',470);limitedRadius.api.simulate();assert(!limitedRadius.particle.cursorReleased,'release distance cannot exceed influence radius');
console.log('PASS: per-glyph cooldown, escape-distance hysteresis, momentum preservation, repeated slow escape, exact-center nudge, light-theme isolation, speed limit, disable controls and bounded radius');

const idle=forceSetup();
let idleNow=2099;idle.scope.performance.now=()=>idleNow;
idle.api.simulate();assert(idle.particle.vx>0,'attraction works just before two seconds');
idleNow=2100;idle.particle.vx=0;idle.api.simulate();assert.equal(idle.particle.vx,0,'attraction stops exactly at the idle deadline');
idle.particle.vx=30;const idleX=idle.particle.x;idle.api.simulate();assert.equal(idle.particle.vx,30);assert(idle.particle.x>idleX,'idle cutoff preserves free motion');
idle.listeners.get('document:pointermove')({clientX:500,clientY:400,target:{closest:()=>null},pointerId:1});idle.particle.vx=0;idle.api.simulate();assert.equal(idle.particle.vx,0,'duplicate coordinates do not reset idle timer');
idle.listeners.get('document:pointerdown')({clientX:500,clientY:400,target:{closest:()=>({})},pointerId:1,button:0});idle.api.simulate();assert.equal(idle.particle.vx,0,'click at same position does not restore attraction');
idle.scope.scrollY=1610;idle.listeners.get('window:scroll')();idle.api.simulate();assert.equal(idle.particle.vx,0,'scroll does not restore attraction');
idle.listeners.get('document:pointermove')({clientX:501,clientY:400,target:{closest:()=>null},pointerId:1});idle.api.simulate();assert(idle.particle.vx>0,'real cursor movement restores attraction');
idleNow=4100;idle.particle.vx=0;idle.api.simulate();assert.equal(idle.particle.vx,0,'idle timer restarts from latest movement');
idle.scope.document.documentElement.dataset.theme='light';idle.api.simulate();assert(idle.particle.vx<0,'light theme still repels an idle cursor');
const idleNudge=forceSetup({asciiCursorReleaseDistance:40},'dark',480);idleNudge.scope.performance.now=()=>2100;idleNudge.api.simulate();assert.equal(idleNudge.particle.vx,0,'escape nudge also stops while dark cursor is idle');
const customIdle=forceSetup({asciiCursorIdleTimeout:3.5});customIdle.scope.performance.now=()=>3599;customIdle.api.simulate();assert(customIdle.particle.vx>0);customIdle.scope.performance.now=()=>3600;customIdle.particle.vx=0;customIdle.api.simulate();assert.equal(customIdle.particle.vx,0,'admin timeout controls cutoff');
const idleDisabled=forceSetup({asciiCursorIdleTimeout:0});idleDisabled.scope.performance.now=()=>1e8;idleDisabled.api.simulate();assert(idleDisabled.particle.vx>0,'timeout zero keeps attraction active');
console.log('PASS: precise idle cutoff, preserved motion, movement reactivation, duplicate/click/scroll exclusion, continuous light repulsion, nudge cutoff and configurable/disabled timeout');

function dimmedForce(theme='dark',config={}) {
  const s=forceSetup({asciiGravityDimmingMultiplier:0.25,...config},theme);
  s.content.querySelectorAll=()=>[{parentElement:{closest:()=>null},getClientRects:()=>[{}],matches:()=>false,getBoundingClientRect:()=>({left:490,right:510,top:390,bottom:410,width:20,height:20})}];
  s.api.measure();return s;
}
const normal=forceSetup();normal.api.simulate();
const dimDark=dimmedForce();dimDark.api.simulate();assert(Math.abs(dimDark.particle.vx-normal.particle.vx*0.25)<1e-10,'dark attraction uses content multiplier');
const dimLight=dimmedForce('light');dimLight.api.simulate();assert(Math.abs(dimLight.particle.vx+normal.particle.vx*0.25)<1e-10,'light repulsion uses same multiplier');
const dimOff=dimmedForce('dark',{asciiGravityDimmingEnabled:false});dimOff.api.simulate();assert.equal(dimOff.particle.vx,normal.particle.vx,'disabled dimming keeps full strength over content');
const dimZero=dimmedForce('dark',{asciiGravityDimmingMultiplier:0});dimZero.api.simulate();assert.equal(dimZero.particle.vx,0);
const dimOne=dimmedForce('dark',{asciiGravityDimmingMultiplier:1});dimOne.api.simulate();assert.equal(dimOne.particle.vx,normal.particle.vx);
const outsideMap=forceSetup({asciiGravityDimmingMultiplier:0});outsideMap.api.simulate();assert.equal(outsideMap.particle.vx,normal.particle.vx,'empty space keeps full strength');
const publicNoToggle=setup({noToggle:true,savedPreference:'false'});publicNoToggle.api.measure();publicNoToggle.api.tick(1000);publicNoToggle.api.tick(1100);assert(publicNoToggle.api.particles.length>0,'public effect runs without switch, ignoring obsolete visitor opt-out');
assert.equal(setup({noToggle:true,reduced:true}).api.state().enabled,false,'public effect still respects reduced motion');
console.log('PASS: content gravity multiplier in both themes, disabled/zero/full dimming, full-strength empty space, public startup without menu switch, legacy preference and reduced-motion handling');
