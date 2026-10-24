const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
function setup(multiplier=0.25) {
  const events=new Map(),frames=[];
  let hovered=null,reads=0,resize;
  class Element { closest(){return null} }
  const style=()=>({setProperty(k,v){this[k]=v}});
  const context={setTransform(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillRect(){},createRadialGradient(){return {addColorStop(){}}}};
  const root={dataset:{gridContentGlowMultiplier:String(multiplier)},addEventListener:(k,fn)=>events.set('root:'+k,fn)};
  const panel=new Element();Object.assign(panel,{style:style(),prepend(canvas){this.canvas=canvas},querySelector(){return this.canvas},closest(){return this},parentElement:{closest(){return null}},matches(){return false},getClientRects(){return [{}]}});
  const content={querySelectorAll(){reads++;return [text,panel,nested,badge]},getBoundingClientRect(){return {top:100-scope.scrollY}}};
  const text={parentElement:{closest(){return null}},getClientRects(){return [{}]},matches(s){return s==='p, h2, h3, li'}};
  const badge={parentElement:{closest(){return null}},getClientRects(){return [{}]},
    matches(selector){return selector==='p, h2, h3, li'||selector.includes('.experience-skill-pill')},
    getBoundingClientRect(){return {left:750,right:900,top:250-scope.scrollY,bottom:290-scope.scrollY,width:150,height:40}}};
  const nested={parentElement:{closest(){return panel}},getClientRects(){throw Error('nested content should use parent box')}};
  panel.getBoundingClientRect=()=>({left:400,right:600,top:250-scope.scrollY,bottom:350-scope.scrollY,width:200,height:100});
  const document={documentElement:root,querySelector(s){return s==='#site-content-transition'?content:null},querySelectorAll(){return [panel]},createElement(){return {style:style(),setAttribute(){},getContext(){return context}}},body:{prepend(canvas){this.canvas=canvas}},elementFromPoint(){return hovered},addEventListener:(k,fn)=>events.set('doc:'+k,fn),createRange(){return {selectNodeContents(){},getClientRects(){return [{left:100,right:250,top:150-scope.scrollY,bottom:170-scope.scrollY,width:150,height:20},{left:100,right:180,top:180-scope.scrollY,bottom:200-scope.scrollY,width:80,height:20}]}}}};
  const window={matchMedia(){return {matches:true}},addEventListener:(k,fn)=>events.set(k,fn),get scrollY(){return scope.scrollY},scrollX:0,devicePixelRatio:1};
  const scope={document,window,Element,scrollX:0,scrollY:0,requestAnimationFrame(fn){frames.push(fn);return frames.length},ResizeObserver:class{constructor(fn){resize=fn}observe(){}}};
  vm.createContext(scope);
  const helper=fs.readFileSync('content-hitboxes.js','utf8').replace('export function','function');
  const script=fs.readFileSync('script.js','utf8').split('const DEBUG_SPLAT =')[0].replace(/^import .*\n/,'');
  vm.runInContext(helper+'\n'+script+'\ninitGridCursorGlow();',scope);
  const move=(x,y,target=null)=>{hovered=target;events.get('pointermove')({clientX:x,clientY:y});frames.shift()()};
  return {scope,events,frames,move,panel,root,canvas:document.body.canvas,reads:()=>reads,resize:()=>resize()};
}
const s=setup();s.move(120,160);assert.equal(s.canvas.style.opacity,'0.25','text line dims glow');
s.move(240,190);assert.equal(s.canvas.style.opacity,'1','space beyond shorter second line keeps full glow');
s.move(120,175);assert.equal(s.canvas.style.opacity,'1','gap between lines keeps full glow');
s.move(500,300,s.panel);assert.equal(s.canvas.style.opacity,'0.25');assert.equal(s.panel.style['--grid-panel-opacity'],'0.25','panel glow and background dim together');
s.move(752,252);assert.equal(s.canvas.style.opacity,'0.25','skill badge padding uses full badge box');
s.move(830,270);assert.equal(s.canvas.style.opacity,'0.25','skill badge label uses full badge box');
s.move(920,270);assert.equal(s.canvas.style.opacity,'1','gap beside skill badge stays bright');
s.move(500,300,s.panel);
assert.equal(s.reads(),1,'moving pointer reuses cached geometry');
s.scope.scrollY=100;s.events.get('scroll')();s.frames.shift()();assert.equal(s.canvas.style.opacity,'1','stationary cursor responds to scrolling content');
s.move(120,60);assert.equal(s.canvas.style.opacity,'0.25','text hitbox follows scrolling');
s.resize();s.frames.shift()();assert.equal(s.reads(),2,'layout changes invalidate cached hitboxes');
s.events.get('pointermove')({clientX:120,clientY:60});s.events.get('root:pointerleave')();s.frames.shift()();assert.equal(s.canvas.style.opacity,'0','pending update cannot reveal glow after pointer leaves');
const off=setup(0);off.move(120,160);assert.equal(off.canvas.style.opacity,'0');off.move(800,600);assert.equal(off.canvas.style.opacity,'1');
const full=setup(1);full.move(120,160);assert.equal(full.canvas.style.opacity,'1');
const bad=setup(9);bad.move(120,160);assert.equal(bad.canvas.style.opacity,'0.25');
console.log('PASS: shared text/card bounds, line gaps, global/panel multiplier, cached geometry, scroll/resize, pointer leave, zero/full/invalid settings');
