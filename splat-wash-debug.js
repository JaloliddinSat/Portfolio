// Private admin preview for the light-theme white wash that rises over the
// splat at the end of the hero scroll. Loaded only via ?debugSplatWash behind
// admin auth (see functions/_middleware.js). Public values live in script.js.
const KEY = 'portfolio-hero-wash-v1';
let defaults = { start: 0.78, end: 0.98, max: 0.9 };
let config = { ...defaults };
let panel, refresh, bypass = false, progress = 0, lastValue = 0;

try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (saved && [saved.start, saved.end, saved.max].every(Number.isFinite)) config = { ...config, ...saved };
} catch {}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smoothstep = (v) => { const t = clamp(v, 0, 1); return t * t * (3 - 2 * t); };
const washAt = (p, { start, end, max }) => max * smoothstep((p - start) / Math.max(0.001, end - start));
const isLight = () => document.documentElement.dataset.theme === 'light';
const pct = (v) => `${Math.round(v * 100)}%`;

window.__splatWashDebug = {
  attach(context) {
    refresh = context.refresh;
    if (context.defaults) {
      defaults = { ...context.defaults };
      if (!localStorage.getItem(KEY)) config = { ...defaults };
      if (panel) update(false);
    }
  },
  evaluate(context) {
    progress = context.smoothed;
    lastValue = bypass ? context.lightWash : washAt(progress, config);
    if (panel) {
      const scrub = panel.querySelector('[data-scrub]');
      if (document.activeElement !== scrub) scrub.value = Math.round(progress * 100);
      const label = `${pct(progress)} scroll · wash ${pct(lastValue)}${isLight() ? '' : ' · (hidden in dark theme)'}`;
      const out = panel.querySelector('[data-progress]');
      if (out.textContent !== label) out.textContent = label;
    }
    return lastValue;
  },
};

function status(message) { panel.querySelector('[data-status]').textContent = message; }

function update(save = true) {
  panel.querySelector('[data-theme]').value = isLight() ? 'light' : 'dark';
  for (const key of ['start', 'end', 'max']) {
    const input = panel.querySelector(`[data-field="${key}"]`);
    if (document.activeElement !== input) input.value = Math.round(config[key] * 100);
    panel.querySelector(`[data-label="${key}"]`).textContent = pct(config[key]);
  }
  panel.querySelector('[data-bypass]').checked = bypass;
  panel.querySelector('[data-export]').value = JSON.stringify(config, null, 2);
  refresh?.();
  status(bypass
    ? 'Comparing the published wash. Your draft is preserved.'
    : isLight()
      ? 'Private live preview. The public wash is unchanged.'
      : 'Switch to the light theme to see the wash.');
  if (save) { try { localStorage.setItem(KEY, JSON.stringify(config)); } catch {} }
}

function mount() {
  panel = document.createElement('aside');
  panel.id = 'splat-wash-panel';
  panel.setAttribute('aria-label', 'Light theme wash preview');
  panel.innerHTML = `<div class="wash-top"><a href="/admin/">← Admin</a><button type="button" data-collapse aria-expanded="true" aria-controls="wash-body">Hide controls</button></div>
  <div id="wash-body"><p class="wash-eyebrow">Private preview · Light theme</p><h2>End-of-scroll white wash</h2>
  <label class="wash-label">Preview theme <select data-theme aria-label="Preview theme"><option value="dark">Dark</option><option value="light">Light</option></select></label>
  <p class="wash-note">A flat white layer over the splat that eases from 0 to the max opacity between the start and end points. Positions are a percentage of the hero scroll cycle. Scroll the page or use the scrub slider.</p>
  <label class="wash-label" for="wash-start">Start <output data-label="start"></output></label>
  <input id="wash-start" data-field="start" type="range" min="0" max="99" step="1">
  <label class="wash-label" for="wash-end">End <output data-label="end"></output></label>
  <input id="wash-end" data-field="end" type="range" min="1" max="100" step="1">
  <label class="wash-label" for="wash-max">Max opacity <output data-label="max"></output></label>
  <input id="wash-max" data-field="max" type="range" min="0" max="100" step="1">
  <label class="wash-label" for="wash-scrub">Preview scroll position <output data-progress></output></label>
  <input id="wash-scrub" data-scrub type="range" min="0" max="100" step="1" value="0">
  <label class="wash-compare"><input data-bypass type="checkbox"> Compare published wash</label>
  <div class="wash-actions"><button type="button" data-top>Back to top</button><button type="button" data-end>Jump to end</button><button type="button" data-reset>Reset</button></div>
  <button type="button" class="wash-copy" data-copy>Copy wash settings</button><p role="status" data-status aria-live="polite"></p>
  <details><summary>Settings to share</summary><textarea data-export readonly aria-label="Wash settings" spellcheck="false"></textarea></details></div>`;
  document.body.append(panel);

  for (const key of ['start', 'end', 'max']) {
    panel.querySelector(`[data-field="${key}"]`).addEventListener('input', (event) => {
      config[key] = Number(event.target.value) / 100;
      if (config.start >= config.end) {
        if (key === 'start') config.end = Math.min(1, config.start + 0.01);
        else config.start = Math.max(0, config.end - 0.01);
      }
      update();
    });
  }
  panel.querySelector('[data-theme]').addEventListener('change', (event) => {
    if ((event.target.value === 'light') !== isLight()) document.querySelector('#theme-toggle')?.click();
  });
  panel.querySelector('[data-bypass]').addEventListener('change', (event) => { bypass = event.target.checked; update(false); });

  const scrollToProgress = (value) => {
    const track = document.querySelector('#hero-scroll-track');
    const hero = track?.querySelector('.hero');
    if (!track || !hero) return;
    window.scrollTo({ top: track.getBoundingClientRect().top + window.scrollY + (track.offsetHeight - hero.offsetHeight) * value, behavior: 'instant' });
  };
  panel.querySelector('[data-scrub]').addEventListener('input', (event) => scrollToProgress(Number(event.target.value) / 100));
  panel.querySelector('[data-top]').addEventListener('click', () => scrollToProgress(0));
  panel.querySelector('[data-end]').addEventListener('click', () => scrollToProgress(1));
  panel.querySelector('[data-reset]').addEventListener('click', () => { config = { ...defaults }; bypass = false; update(); });
  panel.querySelector('[data-collapse]').addEventListener('click', (event) => {
    const body = panel.querySelector('#wash-body');
    body.hidden = !body.hidden;
    event.currentTarget.textContent = body.hidden ? 'Show controls' : 'Hide controls';
    event.currentTarget.setAttribute('aria-expanded', String(!body.hidden));
  });
  panel.querySelector('[data-copy]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      status('Wash settings copied. Paste them into chat.');
    } catch {
      panel.querySelector('details').open = true;
      const out = panel.querySelector('[data-export]');
      out.focus(); out.select();
      status('Select and copy the settings below.');
    }
  });

  new MutationObserver(() => update(false)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // The wash only exists in the light theme, so the preview opens there. This
  // module runs before script.js (head vs. end of body), so wait until every
  // module has executed and the toggle has its handler and saved theme applied.
  const openInLight = () => {
    if (!isLight()) {
      const toggle = document.querySelector('#theme-toggle');
      if (toggle) toggle.click();
      else document.documentElement.dataset.theme = 'light';
    }
  };
  if (document.readyState === 'complete') openInLight();
  else document.addEventListener('DOMContentLoaded', openInLight, { once: true });
  update(false);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
else mount();
