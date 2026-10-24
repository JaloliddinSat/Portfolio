const fs=require('node:fs');const vm=require('node:vm');const assert=require('node:assert/strict');
let now=100;const callbacks=[];const handlers={};
const scope={window:{addEventListener(type,callback){handlers[type]=callback}},document:{readyState:'loading',addEventListener(type,callback){handlers[type]=callback}},performance:{now:()=>now},requestAnimationFrame:fn=>callbacks.push(fn),navigator:{userAgent:'test'},innerWidth:1200,innerHeight:800,devicePixelRatio:1,scrollY:0,console};
vm.createContext(scope);vm.runInContext(fs.readFileSync('portfolio-debug.js','utf8'),scope);
const api=scope.window.__portfolioDiagnostics;assert.equal(api.flags.particleLimit,240);assert.equal(api.flags.cachedGlyphs,true);assert.equal(api.flags.physicsPaused,false);
let updates=0;const viewer={update(){assert.equal(this,viewer);updates++;now+=10;return 7},render(){now+=5},getSplatMesh(){return {getSplatCount:()=>100}}};
api.registerViewer('test',viewer);api.registerViewer('duplicate',viewer);assert.equal(viewer.update(),7);assert.equal(updates,1);api.flags.splatsPaused=true;viewer.update();viewer.render();assert.equal(updates,1,'splat comparison pause suppresses rendering work');
api.flags.splatsPaused=false;viewer.update();assert.equal(updates,2);assert(handlers.visibilitychange);assert(handlers.unhandledrejection);assert.equal(callbacks.length,1,'one diagnostic animation loop');
console.log('PASS: private diagnostic controls preserve viewer calls and isolate rendering work');
