import assert from 'node:assert/strict';
import { defaultGrade, validGrade, identityCurve, curveAt, PRESETS, makeLut, makeCurves, patchGradeShader } from '../splat-color-core.mjs';
const grade = defaultGrade();
assert(validGrade(JSON.parse(JSON.stringify(grade))), 'copied settings round-trip');
assert(!validGrade({ ...grade, version: 2 }));
assert(!validGrade({ ...grade, lut: 'unknown' }));
assert(!validGrade({ ...grade, strength: NaN }));
assert(!validGrade({ ...grade, target: 'stepnote' }));
for (const curve of [identityCurve(), [0, .2, .1, .5, .2, .8, .7, 1, 1]]) {
  curve.forEach((y, i) => assert.equal(curveAt(curve, i/8), y, 'curve passes through each control point'));
  for (let i = 0; i <= 1024; i++) {
    const x = i / 1024, y = curveAt(curve, x), segment = Math.min(7, Math.floor(x*8));
    assert(y >= Math.min(curve[segment], curve[segment+1]) - 1e-12 && y <= Math.max(curve[segment], curve[segment+1]) + 1e-12, 'no cubic overshoot');
  }
}
const identity = makeCurves(grade);
for (let i = 0; i < 256; i++) assert.deepEqual([...identity.slice(i*4, i*4+4)], [i, i, i, 255], 'default curves are exactly neutral');
grade.curves.red = Array(9).fill(.5);
const changed = makeCurves(grade);
assert.equal(changed[100*4], 128);
assert.equal(changed[100*4+1], 100, 'red edits preserve green');
assert.equal(changed[100*4+2], 100, 'red edits preserve blue');
const neutral = makeLut('none');
for (let g=0; g<16; g++) for(let b=0; b<16; b++) for(let r=0; r<16; r++) {
  const offset = (g*256+b*16+r)*4;
  assert.deepEqual([...neutral.slice(offset, offset+4)], [r*17, g*17, b*17, 255], 'LUT atlas uses the shader slice layout');
}
for (const [id] of PRESETS.slice(1)) {
  const data = makeLut(id);
  assert.equal(data.length, 16**3*4);
  assert.notDeepEqual(data, neutral, `${id} changes the LUT`);
}
const source = 'varying vec4 vColor; void main() { vec3 color = vColor.rgb; gl_FragColor = vec4(color.rgb, vColor.a); }';
assert(patchGradeShader(source).includes('vec3 color = gradeSplatColor(vColor.rgb);'));
const depth = patchGradeShader('vec3 color = mix(vColor.rgb, depthColor, heroDepthMix);');
assert(depth.includes('mix(gradeSplatColor(vColor.rgb), depthColor, heroDepthMix)'), 'grade precedes depth transition');
assert.throws(() => patchGradeShader('incompatible'), /does not support/);
console.log('PASS: neutral grading, independent channels, curve interpolation, LUT layout and looks, export validation, shader/depth compatibility');
