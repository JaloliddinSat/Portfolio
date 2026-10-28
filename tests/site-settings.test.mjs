import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
const { DEFAULT_SITE_SETTINGS } = await import(pathToFileURL(root + '/functions/_lib/site-settings.js'));
const { onRequest: admin } = await import(pathToFileURL(root + '/functions/api/admin/[[path]].js'));
const { onRequest: middleware } = await import(pathToFileURL(root + '/functions/_middleware.js'));
let value = null;
const bucket = {
  async head() { return null; },
  async get() { return value === null ? null : {json:async()=>JSON.parse(value)}; },
  async put(key,body) { assert.equal(key,'settings/site.json'); value=body; }
};
const env={RESUMES:bucket,ADMIN_PASSWORD:'test-password',ADMIN_SESSION_SECRET:'test-only-session-secret'};
const call = (route,method='GET',body,cookie,origin='https://portfolio.test')=>admin({env,request:new Request('https://portfolio.test/api/admin/'+route,{method,headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})})});
assert.equal((await call('settings')).status,401);
assert.equal((await call('settings','POST',{asciiEnabled:true})).status,401);
const login=await call('login','POST',{email:'jsatimov@uwaterloo.ca',password:'test-password'});assert.equal(login.status,200);
const cookie=login.headers.get('set-cookie').split(';')[0];
assert.deepEqual(await (await call('settings','GET',undefined,cookie)).json(),{...DEFAULT_SITE_SETTINGS,asciiEnabled:false});
assert.equal((await call('settings','POST',{asciiEnabled:'true'},cookie)).status,400);
assert.equal((await call('settings','POST',{asciiEnabled:true},cookie,'https://other.test')).status,403);
// Existing enable-only records must hydrate all new controls without migration.
value=JSON.stringify({asciiEnabled:false});
assert.deepEqual(await (await call('settings','GET',undefined,cookie)).json(),{...DEFAULT_SITE_SETTINGS});
const tuning={asciiGravityDimmingEnabled:false,asciiGravityDimmingMultiplier:0.4,gridContentGlowMultiplier:0.4,asciiRotationMultiplier:0.5,asciiScaleMultiplier:1.5,asciiSpawnWidth:20,asciiParticleLimit:180,asciiCursorStrength:400,asciiCursorRadius:350,asciiCursorFalloff:1.5,asciiMaxVelocity:250,asciiCursorReleaseDistance:55,asciiCursorCooldown:1.5,asciiCursorIdleTimeout:3.5,asciiCursorEscapeNudge:120};
assert.equal((await call('settings','POST',tuning,cookie)).status,200);
assert.deepEqual(await (await call('settings','GET',undefined,cookie)).json(),{...DEFAULT_SITE_SETTINGS,asciiEnabled:false,...tuning});
await call('settings','POST',{asciiEnabled:true},cookie);
assert.deepEqual(await (await call('settings','GET',undefined,cookie)).json(),{...DEFAULT_SITE_SETTINGS,asciiEnabled:true,...tuning},'enable switch preserves tuning');
await call('settings','POST',{asciiParticleLimit:180},cookie);
assert.deepEqual(await (await call('settings','GET',undefined,cookie)).json(),{...DEFAULT_SITE_SETTINGS,asciiEnabled:true,...tuning},'partial tuning preserves enable switch');
for(const bad of [{asciiThrowCooldown:-1},{asciiThrowCooldown:11},{asciiLightCursorStrength:3001},{asciiLightCursorRadius:-1},{asciiLightCursorFalloff:0},{asciiLightMaxVelocity:601},{asciiGravityDimmingEnabled:1},{asciiGravityDimmingMultiplier:-0.1},{asciiGravityDimmingMultiplier:1.1},{gridContentGlowMultiplier:-0.1},{gridContentGlowMultiplier:1.1},{gridContentGlowMultiplier:"0.25"},{asciiCursorIdleTimeout:-1},{asciiCursorIdleTimeout:61},{asciiCursorIdleTimeout:"2"},{asciiCursorReleaseDistance:-1},{asciiCursorReleaseDistance:501},{asciiCursorCooldown:-1},{asciiCursorCooldown:11},{asciiCursorEscapeNudge:-1},{asciiCursorEscapeNudge:601},{asciiCursorStrength:-1},{asciiCursorStrength:3001},{asciiCursorRadius:2001},{asciiCursorRadius:-1},{asciiCursorFalloff:0},{asciiCursorFalloff:7},{asciiMaxVelocity:601},{asciiMaxVelocity:-1},{asciiCursorStrength:"400"},{asciiScaleMultiplier:0},{asciiScaleMultiplier:4},{asciiRotationMultiplier:-1},{asciiRotationMultiplier:5},{asciiParticleLimit:501},{asciiParticleLimit:1.5},{asciiSpawnWidth:30},{asciiParticleLimit:'180'},{unknown:1},null,{}]) {
  assert.equal((await call('settings','POST',bad,cookie)).status,400,JSON.stringify(bad));
}

// Legacy shared gravity values hydrate both themes without modifying stored settings.
value=JSON.stringify({asciiEnabled:false,asciiCursorStrength:750,asciiCursorRadius:450,asciiCursorFalloff:3,asciiMaxVelocity:350});
const migrated=await (await call('settings','GET',undefined,cookie)).json();
assert.equal(migrated.asciiLightCursorStrength,750);assert.equal(migrated.asciiLightCursorRadius,450);assert.equal(migrated.asciiLightCursorFalloff,3);assert.equal(migrated.asciiLightMaxVelocity,350);assert.equal(migrated.asciiThrowCooldown,1.5);
await call('settings','POST',{asciiLightCursorStrength:250,asciiThrowCooldown:2.5},cookie);
const separate=await (await call('settings','GET',undefined,cookie)).json();assert.equal(separate.asciiCursorStrength,750);assert.equal(separate.asciiLightCursorStrength,250);assert.equal(separate.asciiThrowCooldown,2.5);

assert.equal((await call('settings','POST',{heroCameraDuration:7.4,heroRevealDuration:5.7},cookie)).status,200);
assert.equal((await (await call('settings','GET',undefined,cookie)).json()).heroCameraDuration,7.4);
assert.equal((await (await call('settings','GET',undefined,cookie)).json()).heroRevealDuration,5.7);
for(const bad of [0,.4,10.1,'3']) assert.equal((await call('settings','POST',{heroRevealDuration:bad},cookie)).status,400);
for (const bad of [0,10.1,'3.2',null]) assert.equal((await call('settings','POST',{heroCameraDuration:bad},cookie)).status,400);
await call('settings','POST',{...DEFAULT_SITE_SETTINGS},cookie);
let transforms=0;
globalThis.HTMLRewriter=class {
  handlers=[];
  on(selector,handler){this.handlers.push([selector,handler]);return this;}
  transform(response){transforms++;const inserted=[];for(const [selector,handler] of this.handlers)handler.element({setAttribute(key,value){inserted.push([key,value])},append(html){inserted.push([selector,html])},prepend(html){inserted.push([selector,html])}});return new Response(JSON.stringify(inserted),{headers:response.headers});}
};
const html=await readFile(root+'/index.html','utf8');
assert(!/ascii/i.test(html));assert(!/ascii/i.test(await readFile(root+'/script.js','utf8')));assert(!/ascii/i.test(await readFile(root+'/styles.css','utf8')));
const page=(path='/')=>middleware({env,request:new Request('https://portfolio.test'+path),next:async()=>new Response(html,{headers:{'Content-Type':'text/html'}})});
let response=await page();assert.equal(JSON.parse(await response.text())[0][1],'0.25');assert.equal(response.headers.get('Cache-Control'),'no-store');
assert((await (await page()).text()).includes('data-hero-camera-duration'),'camera duration reaches public pages with particles disabled');
assert((await (await page()).text()).includes('data-hero-reveal-duration'),'cylinder duration reaches public pages independently');
assert((await (await page()).text()).includes('script.js?v=20261027-no-autoscroll'),'public script reference stays current');
assert.equal((await page('/ascii-physics.js')).status,404);assert.equal((await page('/ascii-physics.css')).status,404);
assert.equal((await call('settings','POST',{asciiEnabled:true},cookie)).status,200);
assert.deepEqual(await (await call('settings','GET',undefined,cookie)).json(),{...DEFAULT_SITE_SETTINGS,asciiEnabled:true});
response=await page();const injected=await response.text();assert(!injected.includes('ascii-toggle'),'no ASCII switch on public portfolio');assert(injected.includes('ascii-physics.js'));assert(injected.includes('ascii-physics.css'));
assert.equal((await page('/ascii-physics.js')).status,200);
await call('settings','POST',{asciiEnabled:false},cookie);assert.equal((await page('/ascii-physics.js')).status,404);assert(!/ascii/i.test(await (await page()).text()));
const authenticatedPage=(path)=>middleware({env,request:new Request('https://portfolio.test'+path,{headers:{Cookie:cookie}}),next:async()=>new Response(html,{headers:{'Content-Type':'text/html'}})});
assert.equal((await page('/?debugSplatColor')).status,302);
assert.equal((await page('/?debugSplatCutoff')).status,302);
assert.equal((await page('/splat-cutoff-core.mjs')).status,200,'public cutoff runtime remains accessible');
assert.equal((await page('/?debugSplatFog')).status,302);
assert.equal((await page('/?debugSplatOverlay')).status,302);
for(const path of ['/splat-overlay-debug.js','/splat-overlay-debug.css']) {
 assert.equal((await page(path)).status,404);
 const response=await authenticatedPage(path);assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
}
assert.equal((await page('/splat-overlay-core.mjs')).status,200,'shared overlay runtime is public');
const overlayPage=await authenticatedPage('/?debugSplatOverlay');assert.equal(overlayPage.headers.get('X-Robots-Tag'),'noindex, nofollow');
assert((await overlayPage.text()).includes('splat-overlay-debug.js'));
assert(!(await (await page()).text()).includes('splat-overlay-debug.js'),'public page excludes overlay studio');
assert.equal((await page('/splat-fog-core.mjs')).status,200,'shared fog runtime is public');
for(const path of ['/splat-fog-debug.js','/splat-fog-debug.css']) {
 assert.equal((await page(path)).status,404,'fog studio requires authentication');
 const response=await authenticatedPage(path);assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
}
const fogResponse=await authenticatedPage('/?debugSplatFog');
assert.equal(fogResponse.headers.get('X-Robots-Tag'),'noindex, nofollow');
const fogMarkup=await fogResponse.text();assert(fogMarkup.includes('splat-fog-debug.js'));
assert(!fogMarkup.includes('ascii-physics.js'));
assert(!(await (await authenticatedPage('/')).text()).includes('splat-fog-debug'),'fog is private');
for(const path of ['/splat-cutoff-debug.js','/splat-cutoff-debug.css']) {
 assert.equal((await page(path)).status,404,'cutoff tools require authentication');
 const response=await authenticatedPage(path);assert.equal(response.status,200);
 assert.equal(response.headers.get('Cache-Control'),'no-store');
}
const cutoffResponse=await authenticatedPage('/?debugSplatCutoff');
assert.equal(cutoffResponse.headers.get('X-Robots-Tag'),'noindex, nofollow');
const cutoffMarkup=await cutoffResponse.text();assert(cutoffMarkup.includes('splat-cutoff-debug.js'));
assert(!cutoffMarkup.includes('ascii-physics.js'),'distance debug does not enable unrelated effects');
assert(!(await (await authenticatedPage('/')).text()).includes('splat-cutoff-debug'),'cutoff never runs on a normal public visit');

for (const path of ['/splat-color-debug.js', '/splat-color-debug.css']) {
  assert.equal((await page(path)).status,404,'grading assets require authentication');
  const asset = await authenticatedPage(path);
  assert.equal(asset.status,200);
  assert.equal(asset.headers.get('Cache-Control'),'no-store');
}
for (const path of ['/splat-color-core.mjs', '/splat-color-renderer.mjs']) {
  assert.equal((await page(path)).status,200,'shared grading runtime is available to public renderer');
}
const colorResponse = await authenticatedPage('/?debugSplatColor');
assert.equal(colorResponse.headers.get('X-Robots-Tag'),'noindex, nofollow');
const colorMarkup = await colorResponse.text();
assert(colorMarkup.includes('splat-color-debug.js'));
assert(!colorMarkup.includes('ascii-physics.js'),'grading does not enable the particle effect');
assert(!(await (await authenticatedPage('/')).text()).includes('splat-color-debug'),'normal visitors and admins do not load grading UI');
assert.equal((await page('/?debugPortfolio')).status,302);
assert.equal((await page('/portfolio-debug.js')).status,404);
assert.equal((await page('/portfolio-debug.css')).status,404);
const privateResponse=await authenticatedPage('/?debugPortfolio');
assert.equal(privateResponse.status,200);
assert.equal(privateResponse.headers.get('Cache-Control'),'no-store');
assert.equal(privateResponse.headers.get('X-Robots-Tag'),'noindex, nofollow');
const privateMarkup=await privateResponse.text();
assert(privateMarkup.includes('ascii-toggle'),'private preview retains its comparison switch');
assert(privateMarkup.includes('portfolio-debug.js') && privateMarkup.includes('ascii-physics.js'));
assert(privateMarkup.includes('data-ascii-config'));
await call('settings','POST',tuning,cookie);
const previewHtml=JSON.parse(await (await authenticatedPage('/?debugPortfolio')).text()).flat().join('');
const previewConfig=JSON.parse(previewHtml.match(/data-ascii-config='([^']+)'/)[1]);
assert.equal(previewConfig.asciiParticleLimit,180,'saved tuning reaches private preview');
for (const key of ['gridContentGlowMultiplier','asciiCursorStrength','asciiCursorRadius','asciiCursorFalloff','asciiMaxVelocity','asciiCursorReleaseDistance','asciiCursorCooldown','asciiCursorIdleTimeout','asciiCursorEscapeNudge']) assert.equal(previewConfig[key],tuning[key]);
assert(!/ascii/i.test(await (await page()).text()),'saving tuning leaves public feature off');
assert.equal(JSON.parse(await (await page()).text())[0][1],'0.4','grid setting reaches visitors with particles disabled');
assert.equal((await authenticatedPage('/portfolio-debug.js')).status,200);
assert.equal((await authenticatedPage('/ascii-physics.js')).status,200);
assert(!/ascii/i.test(await (await authenticatedPage('/')).text()),'normal admin visit must not enable disabled effect');
assert.equal((await page('/ascii-physics.js')).status,404,'private preview must not change public settings');
const forgedCookie=cookie.slice(0,-4)+'fake';
const forged=await middleware({env,request:new Request('https://portfolio.test/?debugPortfolio',{headers:{Cookie:forgedCookie}}),next:async()=>new Response(html)});
assert.equal(forged.status,302);
await call('logout','POST',undefined,cookie);
const signedOut=await middleware({env,request:new Request('https://portfolio.test/portfolio-debug.js'),next:async()=>new Response('should not be served')});
assert.equal(signedOut.status,404);
console.log('PASS: private debug preview requires valid signed session; preview bypasses public off switch without changing it; debug assets denied to visitors');
bucket.get=async()=>{throw Error('storage unavailable')};assert.equal((await page('/ascii-physics.js')).status,404);assert(!/ascii/i.test(await (await page()).text()));assert.equal((await call('settings','GET',undefined,cookie)).status,503);
console.log('PASS: authenticated settings, validation, origin checks, persistence, disabled by default, no public feature references, conditional injection, blocked assets, uncached pages, fail-closed storage errors');
