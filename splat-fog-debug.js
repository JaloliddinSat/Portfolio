import { defaultFog, validFog, FOG_CONTROLS, installDistanceFog } from './splat-fog-core.mjs?v=2';
const KEY = 'portfolio-hero-fog-v1';
let config = defaultFog();
try { const saved = JSON.parse(localStorage.getItem(KEY)); if (validFog(saved)) config = saved; } catch {}
let panel, applyFog, bypass=false, failure;
const status = message => { if(panel) panel.querySelector('[data-status]').textContent=message; };
window.__splatFogDebug = {
  attach(viewer, context) {
    try { applyFog=installDistanceFog(viewer,config,context); status('Preparing live preview…'); }
    catch(error) { failure=error.message; status(failure); console.error('[SPLAT FOG]',error); }
  },
};
function update(save=true) {
  for(const [key,,, , ,unit] of FOG_CONTROLS) {
    panel.querySelector(`[data-control="${key}"]`).value=config[key];
    panel.querySelector(`[data-output="${key}"]`).textContent=unit==='%' ? `${Math.round(config[key]*100)}%` : `${config[key].toFixed(1)}${unit}`;
  }
  panel.querySelector('[data-color]').value=config.color;
  panel.querySelector('[data-color-output]').textContent=config.color;
  panel.querySelector('[data-bypass]').checked=bypass;
  panel.querySelector('[data-export]').value=JSON.stringify(config,null,2);
  applyFog?.(config,bypass);
  if(failure) status(failure);
  else if(applyFog) status(bypass ? 'Comparing without fog. Your 10-unit cutoff stays active.' : 'Live fog preview. Public fog settings are unchanged by this preview.');
  if(save) { try { localStorage.setItem(KEY,JSON.stringify(config)); } catch {} }
}
function mount() {
  panel=document.createElement('aside'); panel.id='splat-fog-panel'; panel.setAttribute('aria-label','Splat fog preview');
  panel.innerHTML=`
    <div class="fog-top"><a href="/admin/">← Admin</a><button type="button" data-collapse aria-expanded="true" aria-controls="fog-body">Hide controls</button></div>
    <div id="fog-body"><p class="fog-eyebrow">Private preview · Fairview</p><h2>Foreground &amp; background fog</h2>
    <p class="fog-note">Keep nearby geometry clear and soften the surrounding scene. Measured in 3D from your body, with your 10-unit cutoff active.</p>
    ${FOG_CONTROLS.map(([key,label,min,max,step])=>`<label class="fog-label" for="fog-${key}">${label}<output data-output="${key}" for="fog-${key}"></output></label><input id="fog-${key}" data-control="${key}" type="range" min="${min}" max="${max}" step="${step}">`).join('')}
    <p class="fog-note">The effect starts at Start distance and reaches full strength after Falloff distance. Blur softens the background splats themselves; it approximates lens blur.</p>
    <label class="fog-label" for="fog-color">Fog color <output data-color-output></output></label><input id="fog-color" data-color type="color" aria-label="Fog color">
    <label class="fog-compare"><input data-bypass type="checkbox"> Compare without fog</label>
    <div class="fog-actions"><button type="button" data-replay>Replay intro</button><button type="button" data-reset>Reset fog</button></div>
    <button type="button" class="fog-copy" data-copy>Copy fog settings</button><p data-status role="status" aria-live="polite">Waiting for the splat to load…</p>
    <details><summary>Settings to share</summary><p class="fog-note">Paste these settings into chat. Drafts save only in this browser; public fog remains unchanged by this preview.</p><textarea data-export readonly aria-label="Fog settings" spellcheck="false"></textarea></details></div>`;
  document.body.append(panel);
  for(const [key] of FOG_CONTROLS) panel.querySelector(`[data-control="${key}"]`).addEventListener('input',event=>{config[key]=Number(event.target.value);update();});
  panel.querySelector('[data-color]').addEventListener('input',event=>{config.color=event.target.value;update();});
  panel.querySelector('[data-bypass]').addEventListener('change',event=>{bypass=event.target.checked;update(false);});
  panel.querySelector('[data-reset]').addEventListener('click',()=>{config=defaultFog();bypass=false;update();});
  panel.querySelector('[data-replay]').addEventListener('click',()=>location.reload());
  panel.querySelector('[data-collapse]').addEventListener('click',event=>{
    const body=panel.querySelector('#fog-body');body.hidden=!body.hidden;
    event.currentTarget.textContent=body.hidden?'Show controls':'Hide controls';event.currentTarget.setAttribute('aria-expanded',String(!body.hidden));
  });
  panel.querySelector('[data-copy]').addEventListener('click',async()=>{
    try { await navigator.clipboard.writeText(JSON.stringify(config,null,2));status('Fog settings copied. Paste them into chat to share your choice.'); }
    catch {panel.querySelector('details').open=true;const output=panel.querySelector('[data-export]');output.focus();output.select();status('Select and copy the settings below.');}
  });
  const stage=document.querySelector('#splat-stage');
  const reflectLoad=()=>{if(stage?.dataset.loadState==='error') status('The splat could not load. Reload to try again.');else if(stage?.dataset.loadState==='ready') update(false);};
  if(stage) new MutationObserver(reflectLoad).observe(stage,{attributes:true,attributeFilter:['data-load-state']});
  update(false);reflectLoad();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
