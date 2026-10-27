import assert from 'node:assert/strict';
import {defaultOverlays,validOverlays,overlayOpacity,overlayBackground} from '../splat-overlay-core.mjs';
const config=defaultOverlays();assert(validOverlays(JSON.parse(JSON.stringify(config))));
for(const bad of [-1,101,NaN,'2'])assert(!validOverlays({...config,themes:{...config.themes,dark:{strength:bad,start:.5}}}));
assert(!validOverlays({...config,themes:{dark:{strength:1,start:.98}}}));
for(const progress of [0,.2,.5])assert.equal(overlayOpacity(progress,.5),0);
assert.equal(overlayOpacity(.74,.5),.5);assert.equal(overlayOpacity(.98,.5),1);
assert(overlayOpacity(.3,.1)>overlayOpacity(.3,.5),'earlier start changes fade timing');
assert.equal(overlayOpacity(.97,.97),0);assert.equal(overlayOpacity(.98,.97),1);
const original=structuredClone(config);config.themes.dark.strength=100;config.themes.dark.start=.1;
assert.deepEqual(config.themes.light,original.themes.light,'theme drafts are independent');
for(const theme of ['dark','light']){
 assert(overlayBackground(theme,0).includes('rgba(0,0,0,0)')||theme==='light');
 assert(!overlayBackground(theme,100).includes('NaN'));
 assert(overlayBackground(theme,100).includes('rgba('));
 assert.notEqual(overlayBackground(theme,100),overlayBackground(theme,1));
}
console.log('PASS: overlay export validation, 100x strength range, independent themes, scroll timing and finite high-strength gradient');
const {hydrateOverlays,backdropColor}=await import('../splat-overlay-core.mjs');
const b=defaultOverlays().themes.light.backdrop;
assert.equal(backdropColor(0,b),'rgb(17, 17, 17)');
assert.equal(backdropColor(b.end,b),'rgb(255, 255, 255)');
assert.equal(backdropColor(1,{...b,color:'#ff0000'}),'rgb(255, 0, 0)');
assert.equal(backdropColor((b.start+b.end)/2,b),'rgb(136, 136, 136)');
assert(!validOverlays({...defaultOverlays(),themes:{...defaultOverlays().themes,light:{strength:1,start:.5,backdrop:{start:.8,end:.2,color:'#ffffff'}}}}));
const migrated=hydrateOverlays({version:1,target:'hero-edge-scroll-overlay',themes:{dark:{strength:8,start:.1},light:{strength:4,start:.2}}});
assert.equal(migrated.themes.dark.strength,8);assert.equal(migrated.themes.light.strength,4);assert.deepEqual(migrated.themes.light.backdrop,b);assert(validOverlays(migrated));
console.log('PASS: backdrop starts dark, interpolates to selected color, validates timing, and preserves existing drafts');
const {HERO_OVERLAYS}=await import('../splat-overlay-core.mjs');
assert.deepEqual(HERO_OVERLAYS,{version:2,target:'hero-edge-scroll-overlay',themes:{dark:{strength:2.4,start:0},light:{strength:21,start:0,backdrop:{start:0,end:1,color:'#ffffff'}}}},'public settings exactly match supplied values');
const {readFile}=await import('node:fs/promises');
const script=await readFile('script.js','utf8'),css=await readFile('styles.css','utf8');
assert(script.includes('overlayOpacity(smoothed, HERO_OVERLAYS.themes[activeTheme].start)'));
assert(css.includes('background: var(--hero-dark-scroll-gradient)'));
assert(css.includes('background: var(--hero-light-scroll-gradient)'));
assert(css.includes('background-color: var(--overlay-backdrop, #111111)'));
console.log('PASS: exact selected public values and shared theme gradient/backdrop integration');

for (const theme of ['dark','light']) for (const strength of [0,1,2.4,21,100]) {
 const gradient=overlayBackground(theme,strength);
 assert(gradient.includes('transparent 6%'),'vignette center stays clear at every strength');
 assert(!gradient.includes('), rgba('),'strength cannot add a full-frame color wash');
 assert.equal((gradient.match(/radial-gradient/g)||[]).length,1);
}
console.log('PASS: both themes retain a clear vignette center without a uniform wash, including 21x and 100x strength');
