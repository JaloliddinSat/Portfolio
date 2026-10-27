import { defaultCutoff, validCutoff, radiusToSlider, sliderToRadius, installDistanceCutoff } from './splat-cutoff-core.mjs';
const KEY = 'portfolio-hero-distance-cutoff-v1';
let config = defaultCutoff();
try { const saved = JSON.parse(localStorage.getItem(KEY)); if (validCutoff(saved)) config = saved; } catch {}
let panel, applyCutoff, fullScene = false, failure;
const status = message => { if (panel) panel.querySelector('[data-status]').textContent = message; };
window.__splatCutoffDebug = {
  attach(viewer, context) {
    try {
      applyCutoff = installDistanceCutoff(viewer, config, context);
      status('Preparing live preview…');
    } catch (error) { failure = error.message; status(failure); console.error('[SPLAT CUTOFF]', error); }
  },
};
function update(save = true) {
  panel.querySelector('[data-radius]').value = radiusToSlider(config.radius);
  const exact = panel.querySelector('[data-exact]');
  if (document.activeElement !== exact) exact.value = config.radius;
  panel.querySelector('[data-radius-output]').textContent = `${config.radius.toFixed(1)} units`;
  panel.querySelector('[data-feather]').value = config.feather;
  panel.querySelector('[data-feather-output]').textContent = `${config.feather.toFixed(1)} units`;
  panel.querySelector('[data-full]').checked = fullScene;
  panel.querySelector('[data-export]').value = JSON.stringify(config, null, 2);
  applyCutoff?.(config, fullScene);
  if (failure) status(failure);
  else if (applyCutoff) status(fullScene ? 'Comparing the full scene. Copied settings retain your cutoff.' : 'Live cutoff preview. Public settings are unchanged.');
  if (save) { try { localStorage.setItem(KEY, JSON.stringify(config)); } catch {} }
}
function mount() {
  panel = document.createElement('aside');
  panel.id = 'splat-cutoff-panel';
  panel.setAttribute('aria-label', 'Splat distance cutoff preview');
  panel.innerHTML = `
    <div class="cutoff-top"><a href="/admin/">← Admin</a><button type="button" data-collapse aria-expanded="true" aria-controls="cutoff-body">Hide controls</button></div>
    <div id="cutoff-body">
      <p class="cutoff-eyebrow">Private preview · Fairview</p>
      <h2>Splat distance cutoff</h2>
      <p class="cutoff-note">Hide distant geometry beyond a radius around your body. Move the slider to update the scene immediately; scroll and move your cursor to inspect it.</p>
      <label class="cutoff-label" for="cutoff-radius">Distance from body <output data-radius-output for="cutoff-radius"></output></label>
      <input id="cutoff-radius" data-radius type="range" min="0" max="1000" step="1" aria-describedby="cutoff-help">
      <div class="cutoff-scale"><span>Closer · 1 unit</span><span>Farther · 300 units</span></div>
      <label class="cutoff-exact">Exact distance <input data-exact type="number" min="1" max="300" step="0.1"></label>
      <p class="cutoff-note" id="cutoff-help">3D distance in scene units. Try 15–20 for the room; the distant background is around 240. The slider gives more precision at smaller distances.</p>
      <label class="cutoff-label" for="cutoff-feather">Edge softness <output data-feather-output for="cutoff-feather"></output></label>
      <input id="cutoff-feather" data-feather type="range" min="0" max="5" step="0.1">
      <p class="cutoff-note">Fade geometry inside the cutoff edge. 0 creates a hard boundary.</p>
      <label class="cutoff-compare"><input data-full type="checkbox"> Show full scene (disable cutoff)</label>
      <div class="cutoff-actions"><button type="button" data-replay>Replay intro</button><button type="button" data-reset>Reset cutoff</button></div>
      <button type="button" class="cutoff-copy" data-copy>Copy cutoff settings</button>
      <p data-status role="status" aria-live="polite">Waiting for the splat to load…</p>
      <details><summary>Settings to share</summary><p class="cutoff-note">Paste these settings into chat to request applying the cutoff. This preview only saves a draft in your browser.</p><textarea data-export readonly aria-label="Distance cutoff settings" spellcheck="false"></textarea></details>
    </div>`;
  document.body.append(panel);
  panel.querySelector('[data-radius]').addEventListener('input', event => { config.radius = sliderToRadius(Number(event.target.value)); update(); });
  const exact = panel.querySelector('[data-exact]');
  exact.addEventListener('input', () => {
    if (exact.value === '' || !exact.validity.valid) return;
    config.radius = Number(exact.value); update();
  });
  exact.addEventListener('change', () => { exact.value = config.radius; });
  panel.querySelector('[data-feather]').addEventListener('input', event => { config.feather = Number(event.target.value); update(); });
  panel.querySelector('[data-full]').addEventListener('change', event => { fullScene = event.target.checked; update(false); });
  panel.querySelector('[data-reset]').addEventListener('click', () => { config = defaultCutoff(); fullScene = false; update(); });
  panel.querySelector('[data-replay]').addEventListener('click', () => location.reload());
  panel.querySelector('[data-collapse]').addEventListener('click', event => {
    const body = panel.querySelector('#cutoff-body'); body.hidden = !body.hidden;
    event.currentTarget.textContent = body.hidden ? 'Show controls' : 'Hide controls';
    event.currentTarget.setAttribute('aria-expanded', String(!body.hidden));
  });
  panel.querySelector('[data-copy]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      status('Cutoff settings copied. Paste them into chat to share your choice.');
    } catch {
      panel.querySelector('details').open = true;
      const output = panel.querySelector('[data-export]'); output.focus(); output.select();
      status('Select and copy the settings below.');
    }
  });
  const stage = document.querySelector('#splat-stage');
  const reflectLoad = () => {
    if (stage?.dataset.loadState === 'error') status('The splat could not load. Reload to try again.');
    else if (stage?.dataset.loadState === 'ready') update(false);
  };
  if (stage) new MutationObserver(reflectLoad).observe(stage, { attributes:true, attributeFilter:['data-load-state'] });
  update(false); reflectLoad();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once:true });
else mount();
