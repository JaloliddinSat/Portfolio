const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const elements = new Map();
const node = id => {
  if (!elements.has(id)) elements.set(id, {
    hidden: false, disabled: false, checked: false, value: '', dataset: {}, events: {},
    style: { setProperty(key, value) { this[key] = value; } },
    classList: { add() {}, remove() {} },
    addEventListener(key, callback) { this.events[key] = callback; },
    setAttribute() {}, removeAttribute() {}, reset() {}, focus() {},
    reportValidity() { return true; }, querySelector: selector => node(id + selector),
  });
  return elements.get(id);
};
let published = { asciiEnabled: false, asciiRotationMultiplier: 1, asciiScaleMultiplier: 1, asciiSpawnWidth: 100, asciiParticleLimit: 240, asciiCursorStrength: 0, asciiCursorRadius: 300, asciiCursorFalloff: 2, asciiMaxVelocity: 600, asciiCursorReleaseDistance: 40, asciiCursorCooldown: 1, asciiCursorIdleTimeout: 2, asciiCursorEscapeNudge: 100 };
let fail = false;
const scope = {
  document: { querySelector: node }, window: {}, URL, Intl, Date,
  fetch: async (path, options = {}) => {
    if (path.endsWith('/session')) return Response.json({ resume: null });
    if (!path.endsWith('/settings')) throw Error(path);
    if (fail) return Response.json({ error: 'Save failed' }, { status: 503 });
    if (options.method === 'POST') published = { ...published, ...JSON.parse(options.body) };
    return Response.json(published);
  },
};
vm.createContext(scope);
vm.runInContext(fs.readFileSync('admin/admin.js', 'utf8'), scope);
(async () => {
  await new Promise(setImmediate);
  assert.equal(node('#ascii-feature-toggle').checked, false);
  assert.equal(node('#ascii-tuning-fields').disabled, false);
  assert.equal(Number(node('#ascii-particle-limit').value), 240);
  assert.equal(Number(node('#ascii-cursor-strength').value), 0);
  assert.equal(Number(node('#ascii-cursor-release-distance').value),40);
  node('#ascii-cursor-release-distance').value = '55';
  assert.equal(Number(node('#ascii-cursor-idle-timeout').value),2);
  node('#ascii-cursor-idle-timeout').value = '3.5';
  node('#ascii-cursor-cooldown').value = '1.5';
  node('#ascii-cursor-escape-nudge').value = '120';
  node('#ascii-cursor-strength').value = '400';
  node('#ascii-cursor-radius').value = '350';
  node('#ascii-cursor-falloff').value = '1.5';
  node('#ascii-max-velocity').value = '250';
  node('#ascii-rotation-multiplier').value = '0.5';
  node('#ascii-scale-multiplier').value = '1.5';
  node('#ascii-spawn-width').value = '20';
  node('#ascii-particle-limit').value = '180';
  node('#ascii-settings-form').events.input();
  assert.equal(node('#ascii-spawn-output').textContent, '20%');
  assert.equal(node('#ascii-spawn-preview').style['--spawn-width'], '20%');
  await node('#ascii-settings-form').events.submit({ preventDefault() {} });
  assert.deepEqual(published, { asciiEnabled: false, asciiRotationMultiplier: 0.5, asciiScaleMultiplier: 1.5, asciiSpawnWidth: 20, asciiParticleLimit: 180, asciiCursorStrength: 400, asciiCursorRadius: 350, asciiCursorFalloff: 1.5, asciiMaxVelocity: 250, asciiCursorReleaseDistance: 55, asciiCursorCooldown: 1.5, asciiCursorIdleTimeout: 3.5, asciiCursorEscapeNudge: 120 });
  assert.equal(node('#ascii-tuning-status').dataset.state, 'success');
  node('#ascii-scale-multiplier').value = '2';
  node('#ascii-feature-toggle').checked = true;
  await node('#ascii-feature-toggle').events.change();
  assert.equal(published.asciiEnabled, true);
  assert.equal(published.asciiScaleMultiplier, 1.5);
  assert.equal(node('#ascii-scale-multiplier').value, '2', 'toggling effect preserves unsaved draft');
  fail = true;
  node('#ascii-particle-limit').value = '100';
  await node('#ascii-settings-form').events.submit({ preventDefault() {} });
  assert.equal(published.asciiParticleLimit, 180, 'failed save preserves published configuration');
  assert.equal(node('#ascii-particle-limit').value, '100', 'failed save keeps editable draft');
  assert.equal(node('#ascii-tuning-status').dataset.state, 'error');
  assert.equal(node('#ascii-tuning-fields').disabled, false);
  node('#ascii-feature-toggle').checked = false;
  await node('#ascii-feature-toggle').events.change();
  assert.equal(node('#ascii-feature-toggle').checked, true, 'failed toggle rolls back');
  console.log('PASS: admin tuning load/save, edge preview, flag preservation, draft preservation, failed-save recovery');
})().catch(error => { console.error(error); process.exitCode = 1; });
