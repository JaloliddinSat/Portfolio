import {defaultOverlays,overlayOpacity,overlayBackground,hydrateOverlays,backdropColor} from './splat-overlay-core.mjs?v=3';
const KEY='portfolio-hero-overlay-v1';
let config=defaultOverlays(),panel,refresh,bypass=false,progress=0;
try {const saved=JSON.parse(localStorage.getItem(KEY));config=hydrateOverlays(saved);}catch{}
const theme=()=>document.documentElement.dataset.theme==='light'?'light':'dark';
const style=document.createElement('style');document.head.append(style);
window.__splatOverlayDebug={
 attach(context){refresh=context.refresh;},
 evaluate(context){
  progress=context.smoothed;
  const hero=document.querySelector(".hero");
  const color=backdropColor(progress,config.themes.light.backdrop);
  if(!bypass && hero && hero.style.getPropertyValue("--overlay-backdrop")!==color)hero.style.setProperty("--overlay-backdrop",color);
  if(panel){const scrub=panel.querySelector('[data-scrub]');if(document.activeElement!==scrub)scrub.value=Math.round(progress*100);const out=panel.querySelector('[data-progress]');const label=`${Math.round(progress*100)}% · ${theme()} theme`;if(out.textContent!==label)out.textContent=label;}
  return bypass?context.collapseOverlay:overlayOpacity(progress,config.themes[theme()].start);
 },
};
function status(message){panel.querySelector('[data-status]').textContent=message;}
function update(save=true){
 const active=theme();panel.querySelector('[data-theme]').value=active;
 for(const name of ['dark','light']){
  const values=config.themes[name];
  panel.querySelector(`[data-strength="${name}"]`).value=values.strength;
  const exact=panel.querySelector(`[data-exact="${name}"]`);if(document.activeElement!==exact)exact.value=values.strength;
  panel.querySelector(`[data-start="${name}"]`).value=values.start*100;
  panel.querySelector(`[data-strength-label="${name}"]`).textContent=`${values.strength.toFixed(1)}×`;
  panel.querySelector(`[data-start-label="${name}"]`).textContent=`${Math.round(values.start*100)}%`;
 }
 const backdrop=config.themes.light.backdrop;
 for(const key of ['start','end']){panel.querySelector(`[data-backdrop="${key}"]`).value=Math.round(backdrop[key]*100);panel.querySelector(`[data-backdrop-label="${key}"]`).textContent=`${Math.round(backdrop[key]*100)}%`;}
 panel.querySelector('[data-backdrop-color]').value=backdrop.color;panel.querySelector('[data-backdrop-color-label]').textContent=backdrop.color;
 panel.querySelector('[data-export]').value=JSON.stringify(config,null,2);
 panel.querySelector('[data-bypass]').checked=bypass;
 style.textContent=bypass?'':['dark','light'].map(name=>`html[data-theme="${name}"] .splat-stage::after {background:${overlayBackground(name,config.themes[name].strength)};}`).join('\n')+'\nhtml[data-theme="light"] .splat-stage {background-color:var(--overlay-backdrop,#111111);}\nhtml[data-theme="light"] .splat-viewer[data-depth-effect="ready"]::before {background:var(--overlay-backdrop,#111111);}';
 refresh?.();
 status(bypass?'Comparing original overlays. Your draft is preserved.':'Private live preview. Public overlay settings are unchanged.');
 if(save){try{localStorage.setItem(KEY,JSON.stringify(config));}catch{}}
}
function mount(){
 panel=document.createElement('aside');panel.id='splat-overlay-panel';panel.setAttribute('aria-label','Edge and scroll overlay preview');
 panel.innerHTML=`<div class="overlay-top"><a href="/admin/">← Admin</a><button type="button" data-collapse aria-expanded="true" aria-controls="overlay-body">Hide controls</button></div>
 <div id="overlay-body"><p class="overlay-eyebrow">Private preview · Both themes</p><h2>Edge / scroll gradient</h2>
 <label class="overlay-label">Preview theme <select data-theme aria-label="Preview theme"><option value="dark">Dark</option><option value="light">Light</option></select></label>
 <p class="overlay-note">Each theme has independent settings. Scroll the page to inspect the gradient over your fogged splat. Strength 1× is the base gradient; up to 100× makes it much denser. Reset loads the current public settings.</p>
 ${['dark','light'].map(name=>`<section class="overlay-theme"><h3>${name==='dark'?'Dark':'Light'} theme</h3>
 <label class="overlay-label" for="${name}-strength">${name==='dark'?'Dark':'Light'} strength <output data-strength-label="${name}"></output></label>
 <input id="${name}-strength" data-strength="${name}" type="range" min="0" max="100" step="0.1">
 <label class="overlay-exact">Exact strength <input data-exact="${name}" type="number" min="0" max="100" step="0.1" aria-label="${name} exact strength"></label>
 <label class="overlay-label" for="${name}-start">${name==='dark'?'Dark':'Light'} scroll start <output data-start-label="${name}"></output></label>
 <input id="${name}-start" data-start="${name}" type="range" min="0" max="97" step="1"></section>`).join('')}
 <p class="overlay-note">Scroll start is a percentage of the hero scroll cycle. 0% starts immediately; 0% is the current public setting. The fade finishes at 98%.</p>
 <section class="overlay-theme"><h3>Light theme backdrop</h3>
 <p class="overlay-note">Starts dark (#111111), then changes to the chosen color behind the splat as you scroll. Only affects light theme.</p>
 <label class="overlay-label" for="backdrop-start">Background transition start <output data-backdrop-label="start"></output></label><input id="backdrop-start" data-backdrop="start" type="range" min="0" max="99" step="1">
 <label class="overlay-label" for="backdrop-end">Background transition end <output data-backdrop-label="end"></output></label><input id="backdrop-end" data-backdrop="end" type="range" min="1" max="100" step="1">
 <label class="overlay-label" for="backdrop-color">Final background color <output data-backdrop-color-label></output></label><input id="backdrop-color" data-backdrop-color type="color" aria-label="Final background color">
 </section>
 <label class="overlay-label" for="overlay-scrub">Preview scroll position <output data-progress></output></label><input id="overlay-scrub" data-scrub type="range" min="0" max="100" step="1" value="0">
 <label class="overlay-compare"><input data-bypass type="checkbox"> Compare original overlays</label>
 <div class="overlay-actions"><button type="button" data-top>Back to top</button><button type="button" data-reset>Reset both themes</button></div>
 <button type="button" class="overlay-copy" data-copy>Copy overlay settings</button><p role="status" data-status aria-live="polite"></p>
 <details><summary>Settings to share</summary><textarea data-export readonly aria-label="Overlay settings" spellcheck="false"></textarea></details></div>`;
 document.body.append(panel);
 for(const name of ['dark','light']){
  panel.querySelector(`[data-strength="${name}"]`).addEventListener('input',event=>{config.themes[name].strength=Number(event.target.value);update();});
  const exact=panel.querySelector(`[data-exact="${name}"]`);
  exact.addEventListener('input',()=>{if(exact.value!==''&&exact.validity.valid){config.themes[name].strength=Number(exact.value);update();}});
  exact.addEventListener('change',()=>{exact.value=config.themes[name].strength;});
  panel.querySelector(`[data-start="${name}"]`).addEventListener('input',event=>{config.themes[name].start=Number(event.target.value)/100;update();});
 }
 for(const key of ['start','end'])panel.querySelector(`[data-backdrop="${key}"]`).addEventListener('input',event=>{const b=config.themes.light.backdrop;b[key]=Number(event.target.value)/100;if(b.start>=b.end){if(key==='start')b.end=Math.min(1,b.start+.01);else b.start=Math.max(0,b.end-.01);}update();});
 panel.querySelector('[data-backdrop-color]').addEventListener('input',event=>{config.themes.light.backdrop.color=event.target.value;update();});
 panel.querySelector('[data-theme]').addEventListener('change',event=>{if(theme()!==event.target.value)document.querySelector('#theme-toggle')?.click();});
 panel.querySelector('[data-bypass]').addEventListener('change',event=>{bypass=event.target.checked;update(false);});
 const scrollToProgress=value=>{const track=document.querySelector('#hero-scroll-track'),hero=track.querySelector('.hero');window.scrollTo({top:track.getBoundingClientRect().top+window.scrollY+(track.offsetHeight-hero.offsetHeight)*value,behavior:'instant'});};
 panel.querySelector('[data-scrub]').addEventListener('input',event=>scrollToProgress(Number(event.target.value)/100));
 panel.querySelector('[data-top]').addEventListener('click',()=>{panel.querySelector('[data-scrub]').value=0;scrollToProgress(0);});
 panel.querySelector('[data-reset]').addEventListener('click',()=>{config=defaultOverlays();bypass=false;update();});
 panel.querySelector('[data-collapse]').addEventListener('click',event=>{const body=panel.querySelector('#overlay-body');body.hidden=!body.hidden;event.currentTarget.textContent=body.hidden?'Show controls':'Hide controls';event.currentTarget.setAttribute('aria-expanded',String(!body.hidden));});
 panel.querySelector('[data-copy]').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(JSON.stringify(config,null,2));status('Overlay settings copied. Paste them into chat.');}catch{panel.querySelector('details').open=true;const out=panel.querySelector('[data-export]');out.focus();out.select();status('Select and copy the settings below.');}});
 new MutationObserver(()=>update(false)).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 update(false);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
