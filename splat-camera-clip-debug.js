import { defaultCameraClip, validCameraClip, installCameraClip } from './splat-camera-clip-core.mjs?v=1';
const KEY = 'portfolio-hero-camera-clip-v1';
let config = defaultCameraClip();
try { const saved = JSON.parse(localStorage.getItem(KEY)); if (validCameraClip(saved)) config = saved; } catch {}
let panel, applyClip, highlight = false, failure;
const status = message => { if (panel) panel.querySelector('[data-status]').textContent = message; };
window.__splatCameraClipDebug = {
  attach(viewer) {
    try {
      applyClip = installCameraClip(viewer, config);
      status('Preparing live preview…');
    } catch (error) { failure = error.message; status(failure); console.error('[SPLAT CAMERA CLIP]', error); }
  },
};
const fmt = v => `${v.toFixed(2)} units`;
function update(save = true) {
  for (const key of ['radius', 'feather']) {
    const slider = panel.querySelector(`[data-field="${key}"]`);
    if (document.activeElement !== slider) slider.value = config[key];
    const exact = panel.querySelector(`[data-exact="${key}"]`);
    if (document.activeElement !== exact) exact.value = config[key];
    panel.querySelector(`[data-output="${key}"]`).textContent = fmt(config[key]);
  }
  ['x', 'y', 'z'].forEach((axis, index) => {
    const slider = panel.querySelector(`[data-offset="${axis}"]`);
    if (document.activeElement !== slider) slider.value = config.offset[index];
    panel.querySelector(`[data-offset-output="${axis}"]`).textContent = fmt(config.offset[index]);
  });
  panel.querySelector('[data-enabled]').checked = config.enabled;
  panel.querySelector('[data-highlight]').checked = highlight;
  panel.querySelector('[data-export]').value = JSON.stringify(config, null, 2);
  applyClip?.(config, { highlight });
  if (failure) status(failure);
  else if (applyClip) status(!config.enabled ? 'Clip disabled. Showing the full scene.' : highlight ? 'Highlighting splats inside the sphere in red instead of erasing them.' : 'Live camera clip preview. Public settings are unchanged.');
  if (save) { try { localStorage.setItem(KEY, JSON.stringify(config)); } catch {} }
}
function mount() {
  panel = document.createElement('aside');
  panel.id = 'splat-camera-clip-panel';
  panel.setAttribute('aria-label', 'Camera clip sphere preview');
  panel.innerHTML = `
    <div class="cclip-top"><a href="/admin/">← Admin</a><button type="button" data-collapse aria-expanded="true" aria-controls="cclip-body">Hide controls</button></div>
    <div id="cclip-body">
      <p class="cclip-eyebrow">Private preview · Fairview</p>
      <h2>Camera clip sphere</h2>
      <p class="cclip-note">A sphere attached to the camera erases every splat inside it, so geometry that sits next to the lens no longer flies past as the camera travels. Scrub the scroll or replay the intro to watch the camera move.</p>
      <label class="cclip-label" for="cclip-radius">Sphere radius <output data-output="radius"></output></label>
      <input id="cclip-radius" data-field="radius" type="range" min="0" max="10" step="0.01">
      <label class="cclip-exact">Exact radius <input data-exact="radius" type="number" min="0" max="50" step="0.01"></label>
      <label class="cclip-label" for="cclip-feather">Edge softness <output data-output="feather"></output></label>
      <input id="cclip-feather" data-field="feather" type="range" min="0" max="3" step="0.01">
      <label class="cclip-exact">Exact softness <input data-exact="feather" type="number" min="0" max="10" step="0.01"></label>
      <p class="cclip-note">Scene units, same as the distance cutoff. Softness fades splats just inside the edge; 0 is a hard boundary.</p>
      <section class="cclip-section"><h3>Sphere centre offset</h3>
      <p class="cclip-note">Relative to the camera: x right, y up, z ahead of the lens. 0,0,0 centres the sphere on the camera.</p>
      ${['x', 'y', 'z'].map(axis => `<label class="cclip-label" for="cclip-offset-${axis}">Offset ${axis} <output data-offset-output="${axis}"></output></label>
      <input id="cclip-offset-${axis}" data-offset="${axis}" type="range" min="-5" max="5" step="0.01">`).join('')}
      </section>
      <label class="cclip-label" for="cclip-scrub">Preview scroll position <output data-progress>0%</output></label>
      <input id="cclip-scrub" data-scrub type="range" min="0" max="100" step="1" value="0">
      <label class="cclip-compare"><input data-highlight type="checkbox"> Highlight clipped splats in red</label>
      <label class="cclip-compare"><input data-enabled type="checkbox"> Clip enabled</label>
      <div class="cclip-actions"><button type="button" data-replay>Replay intro</button><button type="button" data-reset>Reset</button></div>
      <button type="button" class="cclip-copy" data-copy>Copy clip settings</button>
      <p data-status role="status" aria-live="polite">Waiting for the splat to load…</p>
      <details><summary>Settings to share</summary><p class="cclip-note">Paste these settings into chat to request applying the clip publicly. This preview only saves a draft in your browser.</p><textarea data-export readonly aria-label="Camera clip settings" spellcheck="false"></textarea></details>
    </div>`;
  document.body.append(panel);
  for (const key of ['radius', 'feather']) {
    panel.querySelector(`[data-field="${key}"]`).addEventListener('input', event => { config[key] = Number(event.target.value); update(); });
    const exact = panel.querySelector(`[data-exact="${key}"]`);
    exact.addEventListener('input', () => { if (exact.value !== '' && exact.validity.valid) { config[key] = Number(exact.value); update(); } });
    exact.addEventListener('change', () => { exact.value = config[key]; });
  }
  ['x', 'y', 'z'].forEach((axis, index) => {
    panel.querySelector(`[data-offset="${axis}"]`).addEventListener('input', event => { config.offset[index] = Number(event.target.value); update(); });
  });
  panel.querySelector('[data-enabled]').addEventListener('change', event => { config.enabled = event.target.checked; update(); });
  panel.querySelector('[data-highlight]').addEventListener('change', event => { highlight = event.target.checked; update(false); });
  panel.querySelector('[data-reset]').addEventListener('click', () => { config = defaultCameraClip(); highlight = false; update(); });
  panel.querySelector('[data-replay]').addEventListener('click', () => location.reload());
  const scrollToProgress = value => {
    const track = document.querySelector('#hero-scroll-track'), hero = track?.querySelector('.hero');
    if (!track || !hero) return;
    window.scrollTo({ top: track.getBoundingClientRect().top + window.scrollY + (track.offsetHeight - hero.offsetHeight) * value, behavior: 'instant' });
  };
  panel.querySelector('[data-scrub]').addEventListener('input', event => { scrollToProgress(Number(event.target.value) / 100); panel.querySelector('[data-progress]').textContent = `${event.target.value}%`; });
  panel.querySelector('[data-collapse]').addEventListener('click', event => {
    const body = panel.querySelector('#cclip-body'); body.hidden = !body.hidden;
    event.currentTarget.textContent = body.hidden ? 'Show controls' : 'Hide controls';
    event.currentTarget.setAttribute('aria-expanded', String(!body.hidden));
  });
  panel.querySelector('[data-copy]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      status('Clip settings copied. Paste them into chat to share your choice.');
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
  if (stage) new MutationObserver(reflectLoad).observe(stage, { attributes: true, attributeFilter: ['data-load-state'] });
  update(false); reflectLoad();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
else mount();
