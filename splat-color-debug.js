import { HERO_COLOR_GRADE, installSplatColorGrade } from './splat-color-renderer.mjs?v=1';
import { CHANNELS, PRESETS, defaultGrade, validGrade, identityCurve, curveAt } from './splat-color-core.mjs';

const STORAGE_KEY = 'portfolio-hero-color-grade-v1';
let grade = structuredClone(HERO_COLOR_GRADE);
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (validGrade(saved)) grade = saved;
} catch { /* Storage is optional. */ }
let channel = 'rgb';
let selected = 4;
let original = false;
let viewer;
let material;
let panel;
let applyGrade;
let failure;
function status(message) { if (panel) panel.querySelector('[data-status]').textContent = message; }
function paint() { applyGrade?.(grade, original); }
window.__splatColorDebug = {
  attach(nextViewer) {
    try {
      viewer = nextViewer;
      material = viewer.getSplatMesh().material;
      applyGrade = installSplatColorGrade(viewer, grade);
      status('Live preview ready. Changes stay in this browser.');
    } catch (error) { failure = error.message; status(failure); console.error('[SPLAT COLOR]', error); }
  },
};
function update(save = true) {
  if (!panel) return;
  panel.querySelector('[data-preset]').value = grade.lut;
  panel.querySelector('[data-strength]').value = Math.round(grade.strength * 100);
  panel.querySelector('[data-strength-value]').textContent = `${Math.round(grade.strength * 100)}%`;
  panel.querySelector('[data-original]').checked = original;
  panel.querySelector('[data-export]').value = JSON.stringify(grade, null, 2);
  panel.querySelectorAll('[data-channel]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.channel === channel)));
  const points = grade.curves[channel];
  const path = Array.from({ length: 129 }, (_, i) => `${i ? 'L' : 'M'} ${i*2} ${256*(1-curveAt(points, i/128))}`).join(' ');
  panel.querySelector('[data-curve-line]').setAttribute('d', path);
  const svg = panel.querySelector('svg');
  svg.dataset.channel = channel;
  svg.querySelectorAll('circle').forEach((circle, i) => {
    circle.setAttribute('cy', String(256*(1-points[i])));
    circle.setAttribute('r', i === selected ? '6' : '4');
  });
  panel.querySelectorAll('[data-point]').forEach((input, i) => {
    if (document.activeElement !== input) input.value = Math.round(points[i]*255);
    input.closest('label').classList.toggle('selected', i === selected);
  });
  paint();
  if (material && !failure) status(original ? 'Showing original. Your grade is preserved.' : 'Live preview ready. Changes stay in this browser.');
  if (save) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(grade)); } catch { /* Preview still works. */ }
  }
}
function mount() {
  panel = document.createElement('aside');
  panel.id = 'splat-color-panel';
  panel.setAttribute('aria-label', 'Hero splat color grading');
  panel.innerHTML = `
    <div class="grade-top"><a href="/admin/">← Admin</a><button type="button" data-collapse aria-expanded="true" aria-controls="splat-grade-body">Hide controls</button></div>
    <div id="splat-grade-body">
      <p class="grade-eyebrow">Private preview · Fairview</p>
      <h2>Splat color studio</h2>
      <p class="grade-note">Grade the hero splat in place. Scroll to check the transition, or switch the site theme to check both backgrounds.</p>
      <label class="grade-field">Creative LUT<select data-preset>${PRESETS.map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}</select></label>
      <p class="grade-note">Built-in creative LUTs inspired by common looks; these are not camera conversion or film-stock LUTs.</p>
      <label class="grade-field">LUT strength <output data-strength-value></output><input data-strength type="range" min="0" max="100" step="1"></label>
      <div class="grade-channels" role="group" aria-label="Curve channel">${CHANNELS.map(c => `<button type="button" data-channel="${c}" aria-pressed="${c === channel}">${c === 'rgb' ? 'RGB' : c[0].toUpperCase()+c.slice(1)}</button>`).join('')}</div>
      <svg viewBox="-10 -10 276 276" data-channel="rgb" aria-label="Color curve editor. Use the numbered inputs below for keyboard editing." role="img">
        <path class="grade-grid" d="M0 0H256V256H0Z M64 0V256 M128 0V256 M192 0V256 M0 64H256 M0 128H256 M0 192H256" />
        <path class="grade-diagonal" d="M0 256L256 0" />
        <path data-curve-line fill="none" />
        ${identityCurve().map((v, i) => `<circle cx="${v*256}" cy="${(1-v)*256}" r="4" data-node="${i}" />`).join('')}
      </svg>
      <p class="grade-note">Input → output, 0–255. Drag a point up/down or edit its output below. RGB adjusts all channels before the individual curves.</p>
      <div class="grade-points">${identityCurve().map((v, i) => `<label>${Math.round(v*255)}<input type="number" data-point="${i}" aria-label="Output for input ${Math.round(v*255)}" min="0" max="255" step="1"></label>`).join('')}</div>
      <div class="grade-actions"><button type="button" data-reset-curve>Reset curve</button><button type="button" data-reset-all>Reset all</button></div>
      <label class="grade-compare"><input data-original type="checkbox"> Show original (bypass grade)</label>
      <button type="button" class="grade-copy" data-copy>Copy settings</button>
      <p data-status role="status" aria-live="polite">${failure || (material ? 'Live preview ready. Changes stay in this browser.' : 'Waiting for the splat to load…')}</p>
      <details><summary>Settings to share</summary><p class="grade-note">Paste these values into chat and ask to apply this grade to the hero splat. Public colors change only after that code update.</p><textarea data-export readonly aria-label="Color grade settings" spellcheck="false"></textarea></details>
    </div>`;
  document.body.append(panel);
  const stage = document.querySelector('#splat-stage');
  if (stage) new MutationObserver(() => {
    if (stage.dataset.loadState === 'error') status('The splat could not load. Reload to try again.');
  }).observe(stage, { attributes: true, attributeFilter: ['data-load-state'] });
  panel.querySelector('[data-collapse]').addEventListener('click', event => {
    const body = panel.querySelector('#splat-grade-body');
    body.hidden = !body.hidden;
    event.currentTarget.textContent = body.hidden ? 'Show controls' : 'Hide controls';
    event.currentTarget.setAttribute('aria-expanded', String(!body.hidden));
  });
  panel.querySelector('[data-preset]').addEventListener('change', event => { grade.lut = event.target.value; update(); });
  panel.querySelector('[data-strength]').addEventListener('input', event => { grade.strength = Number(event.target.value)/100; update(); });
  panel.querySelector('[data-original]').addEventListener('change', event => { original = event.target.checked; update(false); });
  panel.querySelectorAll('[data-channel]').forEach(button => button.addEventListener('click', () => { channel = button.dataset.channel; update(false); }));
  panel.querySelectorAll('[data-point]').forEach((input, i) => {
    input.addEventListener('focus', () => { selected = i; update(false); });
    input.addEventListener('input', () => {
      if (input.value === '' || !input.validity.valid) return;
      grade.curves[channel][i] = Number(input.value)/255;
      update();
    });
    input.addEventListener('change', () => { input.value = Math.round(grade.curves[channel][i]*255); });
  });
  panel.querySelector('[data-reset-curve]').addEventListener('click', () => { grade.curves[channel] = identityCurve(); update(); });
  panel.querySelector('[data-reset-all]').addEventListener('click', () => { grade = defaultGrade(); original = false; update(); status('Grade reset to original.'); });
  panel.querySelector('[data-copy]').addEventListener('click', async () => {
    const value = JSON.stringify(grade, null, 2);
    try {
      await navigator.clipboard.writeText(value);
      status('Settings copied. Paste them into chat to apply this grade.');
    } catch {
      panel.querySelector('details').open = true;
      const output = panel.querySelector('[data-export]');
      output.focus(); output.select();
      status('Select and copy the settings below.');
    }
  });
  const svg = panel.querySelector('svg');
  let dragging = false;
  const drag = event => {
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    grade.curves[channel][selected] = Math.round(Math.max(0, Math.min(1, 1-point.y/256))*255)/255;
    update();
  };
  svg.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
    selected = Math.max(0, Math.min(8, Math.round(point.x/32)));
    dragging = true; svg.setPointerCapture(event.pointerId); drag(event);
  });
  svg.addEventListener('pointermove', event => { if (dragging) drag(event); });
  svg.addEventListener('pointerup', () => { dragging = false; });
  svg.addEventListener('pointercancel', () => { dragging = false; });
  svg.addEventListener('lostpointercapture', () => { dragging = false; });
  update(false);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
else mount();
