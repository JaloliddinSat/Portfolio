const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const script = fs.readFileSync('script.js', 'utf8');
const start = script.indexOf('const LINE_GLOW_REACH');
const end = script.indexOf('const initLineGlow');
const scope = {};
vm.createContext(scope);
vm.runInContext(script.slice(start, end) + '\nthis.alpha = lineGlowAlpha; this.reach = LINE_GLOW_REACH;', scope);

assert.equal(scope.alpha(0), 1, 'cursor on the line gives full strength');
assert.equal(scope.alpha(scope.reach), 0, 'strength reaches zero at the reach distance');
assert.equal(scope.alpha(scope.reach * 2), 0, 'never negative beyond the reach');
assert.equal(scope.alpha(-scope.reach / 2), 0.25, 'symmetric, quadratic falloff');
assert(scope.alpha(10) > scope.alpha(40), 'closer is stronger');

const html = fs.readFileSync('index.html', 'utf8');
assert(!/class="grid-(cursor|panel)-glow"/.test(html), 'old grid glow is gone');
assert(html.includes('data-glow-line="rail"'), 'timeline rail participates');
assert(!/data-glow-line="top" class="section about-section"/.test(html), 'the first, invisible section rule does not glow');
console.log('PASS: hairline glow falloff and markup hooks');
