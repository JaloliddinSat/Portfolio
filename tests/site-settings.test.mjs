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
const tuning={asciiRotationMultiplier:0.5,asciiScaleMultiplier:1.5,asciiSpawnWidth:20,asciiParticleLimit:180,asciiCursorStrength:400,asciiCursorRadius:350,asciiCursorFalloff:1.5,asciiMaxVelocity:250,asciiCursorReleaseDistance:55,asciiCursorCooldown:1.5,asciiCursorIdleTimeout:3.5,asciiCursorEscapeNudge:120};
assert.equal((await call('settings','POST',tuning,cookie)).status,200);
assert.deepEqual(await (await call('settings','GET',undefined,cookie)).json(),{...DEFAULT_SITE_SETTINGS,asciiEnabled:false,...tuning});
await call('settings','POST',{asciiEnabled:true},cookie);
assert.deepEqual(await (await call('settings','GET',undefined,cookie)).json(),{...DEFAULT_SITE_SETTINGS,asciiEnabled:true,...tuning},'enable switch preserves tuning');
await call('settings','POST',{asciiParticleLimit:180},cookie);
assert.deepEqual(await (await call('settings','GET',undefined,cookie)).json(),{...DEFAULT_SITE_SETTINGS,asciiEnabled:true,...tuning},'partial tuning preserves enable switch');
for(const bad of [{asciiCursorIdleTimeout:-1},{asciiCursorIdleTimeout:61},{asciiCursorIdleTimeout:"2"},{asciiCursorReleaseDistance:-1},{asciiCursorReleaseDistance:501},{asciiCursorCooldown:-1},{asciiCursorCooldown:11},{asciiCursorEscapeNudge:-1},{asciiCursorEscapeNudge:601},{asciiCursorStrength:-1},{asciiCursorStrength:3001},{asciiCursorRadius:2001},{asciiCursorRadius:-1},{asciiCursorFalloff:0},{asciiCursorFalloff:7},{asciiMaxVelocity:601},{asciiMaxVelocity:-1},{asciiCursorStrength:"400"},{asciiScaleMultiplier:0},{asciiScaleMultiplier:4},{asciiRotationMultiplier:-1},{asciiRotationMultiplier:5},{asciiParticleLimit:501},{asciiParticleLimit:1.5},{asciiSpawnWidth:30},{asciiParticleLimit:'180'},{unknown:1},null,{}]) {
  assert.equal((await call('settings','POST',bad,cookie)).status,400,JSON.stringify(bad));
}
await call('settings','POST',{...DEFAULT_SITE_SETTINGS},cookie);
let transforms=0;
globalThis.HTMLRewriter=class {
  handlers=[];
  on(selector,handler){this.handlers.push([selector,handler]);return this;}
  transform(response){transforms++;const inserted=[];for(const [selector,handler] of this.handlers)handler.element({append(html){inserted.push([selector,html])},prepend(html){inserted.push([selector,html])}});return new Response(JSON.stringify(inserted),{headers:response.headers});}
};
const html=await readFile(root+'/index.html','utf8');
assert(!/ascii/i.test(html));assert(!/ascii/i.test(await readFile(root+'/script.js','utf8')));assert(!/ascii/i.test(await readFile(root+'/styles.css','utf8')));
const page=(path='/')=>middleware({env,request:new Request('https://portfolio.test'+path),next:async()=>new Response(html,{headers:{'Content-Type':'text/html'}})});
let response=await page();assert.equal(await response.text(),html);assert.equal(transforms,0);assert.equal(response.headers.get('Cache-Control'),'no-store');
assert.equal((await page('/ascii-physics.js')).status,404);assert.equal((await page('/ascii-physics.css')).status,404);
assert.equal((await call('settings','POST',{asciiEnabled:true},cookie)).status,200);
assert.deepEqual(await (await call('settings','GET',undefined,cookie)).json(),{...DEFAULT_SITE_SETTINGS,asciiEnabled:true});
response=await page();const injected=await response.text();assert(injected.includes('ascii-toggle'));assert(injected.includes('ascii-physics.js'));assert(injected.includes('ascii-physics.css'));assert.equal(transforms,1);
assert.equal((await page('/ascii-physics.js')).status,200);
await call('settings','POST',{asciiEnabled:false},cookie);assert.equal((await page('/ascii-physics.js')).status,404);assert.equal(await (await page()).text(),html);
const authenticatedPage=(path)=>middleware({env,request:new Request('https://portfolio.test'+path,{headers:{Cookie:cookie}}),next:async()=>new Response(html,{headers:{'Content-Type':'text/html'}})});
assert.equal((await page('/?debugPortfolio')).status,302);
assert.equal((await page('/portfolio-debug.js')).status,404);
assert.equal((await page('/portfolio-debug.css')).status,404);
const privateResponse=await authenticatedPage('/?debugPortfolio');
assert.equal(privateResponse.status,200);
assert.equal(privateResponse.headers.get('Cache-Control'),'no-store');
assert.equal(privateResponse.headers.get('X-Robots-Tag'),'noindex, nofollow');
const privateMarkup=await privateResponse.text();
assert(privateMarkup.includes('portfolio-debug.js') && privateMarkup.includes('ascii-physics.js'));
assert(privateMarkup.includes('data-ascii-config'));
await call('settings','POST',tuning,cookie);
const previewHtml=JSON.parse(await (await authenticatedPage('/?debugPortfolio')).text()).flat().join('');
const previewConfig=JSON.parse(previewHtml.match(/data-ascii-config='([^']+)'/)[1]);
assert.equal(previewConfig.asciiParticleLimit,180,'saved tuning reaches private preview');
for (const key of ['asciiCursorStrength','asciiCursorRadius','asciiCursorFalloff','asciiMaxVelocity','asciiCursorReleaseDistance','asciiCursorCooldown','asciiCursorIdleTimeout','asciiCursorEscapeNudge']) assert.equal(previewConfig[key],tuning[key]);
assert.equal(await (await page()).text(),html,'saving tuning leaves public feature off');
assert.equal((await authenticatedPage('/portfolio-debug.js')).status,200);
assert.equal((await authenticatedPage('/ascii-physics.js')).status,200);
assert.equal(await (await authenticatedPage('/')).text(),html,'normal admin visit must not enable disabled effect');
assert.equal((await page('/ascii-physics.js')).status,404,'private preview must not change public settings');
const forgedCookie=cookie.slice(0,-4)+'fake';
const forged=await middleware({env,request:new Request('https://portfolio.test/?debugPortfolio',{headers:{Cookie:forgedCookie}}),next:async()=>new Response(html)});
assert.equal(forged.status,302);
await call('logout','POST',undefined,cookie);
const signedOut=await middleware({env,request:new Request('https://portfolio.test/portfolio-debug.js'),next:async()=>new Response('should not be served')});
assert.equal(signedOut.status,404);
console.log('PASS: private debug preview requires valid signed session; preview bypasses public off switch without changing it; debug assets denied to visitors');
bucket.get=async()=>{throw Error('storage unavailable')};assert.equal((await page('/ascii-physics.js')).status,404);assert.equal(await (await page()).text(),html);assert.equal((await call('settings','GET',undefined,cookie)).status,503);
console.log('PASS: authenticated settings, validation, origin checks, persistence, disabled by default, no public feature references, conditional injection, blocked assets, uncached pages, fail-closed storage errors');
