const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const original = fs.readFileSync('ascii-physics.js', 'utf8').replace(/\ninitAsciiPhysics\(\);\s*$/, '');
function setup({mobile=false, reduced=false, top=-10,diagnostics,config={}}={}) {
  const listeners = new Map();
  const stored = new Map();
  const frames = new Map();
  let id=0;
  const context = {setTransform(){},clearRect(){},fillText(){},save(){},restore(){},translate(){},rotate(){},scale(){},drawImage(){},beginPath(){},rect(){},clip(){}};
  const element = name => ({hidden:false,dataset:{theme:'dark'},scrollHeight:8000,
    classList:{values:new Set(),add(name){this.values.add(name)},remove(name){this.values.delete(name)},toggle(name,force){if(force)this.values.add(name);else this.values.delete(name)},contains(name){return this.values.has(name)}}, setAttribute(k,v){this[k]=v},
    addEventListener(k,fn){listeners.set(name+':'+k,fn)},
    hasPointerCapture(){return false}, setPointerCapture(){}, releasePointerCapture(){},getBoundingClientRect(){return {top}},querySelectorAll(){return []}});
  const canvas = element('canvas'); canvas.dataset.asciiConfig=JSON.stringify(config); canvas.getContext=()=>context;
  const toggle=element('toggle'), content=element('content'), root=element('root'), doc=element('document');
  Object.assign(doc,{elementFromPoint:()=>({closest:()=>null}),createElement:()=>({getContext:()=>context}),hidden:false,documentElement:root,body:element('body'),querySelector:s=>({'#ascii-curtain':canvas,'#ascii-toggle':toggle,'#site-content-transition':content}[s])});
  const win=element('window');win.__portfolioDiagnostics=diagnostics;
  const scope = { document:doc, window:win, innerWidth:1200,innerHeight:800,devicePixelRatio:1,scrollY:1600,scrollX:0,performance:{now:()=>100},
    localStorage:{getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v)},
    matchMedia:q=>({matches:q.includes('reduced')?reduced:!mobile,addEventListener(){}}),
    requestAnimationFrame:fn=>{frames.set(++id,fn);return id},cancelAnimationFrame:i=>frames.delete(i),
    ResizeObserver:class{observe(){}},MutationObserver:class{observe(){}} };
  content.getBoundingClientRect=()=>({top:top+1600-scope.scrollY});
  vm.createContext(scope);
  const source=original.replace('export function','function').replace(/  checkReveal\(\);\n}\s*$/,`  checkReveal();\n return {particles,simulate,measure,checkReveal,sync,draw,tick,spawn,hitboxHalf,state:()=>({activated,enabled,frame,spawnTop,worldBottom})};\n}`);
  vm.runInContext(source+'\nvar api = initAsciiPhysics();',scope);
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
