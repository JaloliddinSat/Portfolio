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
