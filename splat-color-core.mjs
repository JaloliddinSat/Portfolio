// Versioned, deterministic grading math shared by the preview and exported grades.
export const CHANNELS = ['rgb', 'red', 'green', 'blue'];
export const LUT_SIZE = 16;
export const PRESETS = [
  ['none', 'Original / no LUT'],
  ['teal-orange', 'Teal & orange'],
  ['warm-film', 'Warm film'],
  ['cool-cinema', 'Cool cinema'],
  ['matte', 'Faded matte'],
  ['bleach', 'Bleach bypass'],
  ['mono', 'Black & white'],
  ['sepia', 'Sepia'],
];
export const clamp = x => Math.max(0, Math.min(1, x));
export const identityCurve = () => Array.from({ length: 9 }, (_, i) => i / 8);
export const defaultGrade = () => ({ version: 1, target: 'hero', asset: '/splats/Fairview.ksplat', pipeline: 'creative-lut-v1 -> rgb-curves-v1', lut: 'none', strength: 1, curves: Object.fromEntries(CHANNELS.map(channel => [channel, identityCurve()])) });
export function validGrade(value) {
  return value?.version === 1 && value.target === 'hero' && value.asset === '/splats/Fairview.ksplat' &&
    value.pipeline === 'creative-lut-v1 -> rgb-curves-v1' && PRESETS.some(([id]) => id === value.lut) &&
    Number.isFinite(value.strength) && value.strength >= 0 && value.strength <= 1 &&
    CHANNELS.every(channel => Array.isArray(value.curves?.[channel]) && value.curves[channel].length === 9 && value.curves[channel].every(y => Number.isFinite(y) && y >= 0 && y <= 1));
}
// Cubic Hermite interpolation with slope limiting preserves straight lines and
// avoids overshooting between control points, including non-monotonic curves.
export function curveAt(points, x) {
  const n = points.length - 1;
  const slopes = Array.from({ length: n }, (_, i) => (points[i + 1] - points[i]) * n);
  const tangent = i => {
    if (i === 0) return slopes[0];
    if (i === n) return slopes[n - 1];
    const a = slopes[i - 1], b = slopes[i];
    return a * b <= 0 ? 0 : 2 * a * b / (a + b);
  };
  const scaled = clamp(x) * n, i = Math.min(n - 1, Math.floor(scaled)), t = scaled - i;
  return clamp((2*t**3 - 3*t*t + 1)*points[i] + (t**3 - 2*t*t + t)*tangent(i)/n + (-2*t**3 + 3*t*t)*points[i+1] + (t**3 - t*t)*tangent(i+1)/n);
}
export function creativeLook(id, rgb) {
  const [r, g, b] = rgb, l = .2126*r + .7152*g + .0722*b;
  const contrast = (v, amount) => .5 + (v - .5) * amount;
  let out = rgb;
  switch (id) {
    case 'teal-orange': out = [contrast(r, 1.08) + .09*l - .045*(1-l), contrast(g, 1.04) + .025*(1-l), contrast(b, 1.08) + .08*(1-l) - .08*l]; break;
    case 'warm-film': out = [contrast(r, 1.08) + .045, contrast(g, 1.04) + .012, contrast(b, .96) - .035]; break;
    case 'cool-cinema': out = [contrast(r, 1.12) - .025, contrast(g, 1.08) + .01, contrast(b, 1.05) + .05]; break;
    case 'matte': out = [.075 + .87*r, .065 + .88*g, .09 + .83*b]; break;
    case 'bleach': out = rgb.map(v => contrast(.45*v + .55*l, 1.25)); break;
    case 'mono': out = [l, l, l]; break;
    case 'sepia': out = [.393*r + .769*g + .189*b, .349*r + .686*g + .168*b, .272*r + .534*g + .131*b]; break;
  }
  return out.map(clamp);
}
export function makeLut(id, size = LUT_SIZE) {
  const data = new Uint8Array(size * size * size * 4);
  for (let g = 0; g < size; g++) for (let b = 0; b < size; b++) for (let r = 0; r < size; r++) {
    const offset = (g * size * size + b * size + r) * 4;
    const color = creativeLook(id, [r/(size-1), g/(size-1), b/(size-1)]);
    color.forEach((v, c) => { data[offset+c] = Math.round(v*255); });
    data[offset+3] = 255;
  }
  return data;
}
export function makeCurves(grade) {
  const data = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const master = curveAt(grade.curves.rgb, i / 255);
    CHANNELS.slice(1).forEach((channel, c) => { data[i*4+c] = Math.round(curveAt(grade.curves[channel], master)*255); });
    data[i*4+3] = 255;
  }
  return data;
}
export const GRADE_GLSL = `
uniform sampler2D gradeLut;
uniform sampler2D gradeCurves;
uniform float gradeStrength;
uniform float gradeEnabled;
vec3 gradeSplatColor(vec3 source) {
  if (gradeEnabled < 0.5) return source;
  vec3 c = clamp(source, 0.0, 1.0);
  float blue = c.b * 15.0;
  float slice = floor(blue);
  vec2 uv = vec2((c.r * 15.0 + slice * 16.0 + 0.5) / 256.0, (c.g * 15.0 + 0.5) / 16.0);
  vec2 nextUV = vec2((c.r * 15.0 + min(slice + 1.0, 15.0) * 16.0 + 0.5) / 256.0, uv.y);
  vec3 look = mix(texture2D(gradeLut, uv).rgb, texture2D(gradeLut, nextUV).rgb, fract(blue));
  c = mix(c, look, gradeStrength);
  return vec3(texture2D(gradeCurves, vec2((c.r * 255.0 + 0.5) / 256.0, 0.5)).r,
              texture2D(gradeCurves, vec2((c.g * 255.0 + 0.5) / 256.0, 0.5)).g,
              texture2D(gradeCurves, vec2((c.b * 255.0 + 0.5) / 256.0, 0.5)).b);
}`;
export function patchGradeShader(shader) {
  const depth = 'mix(vColor.rgb, depthColor, heroDepthMix)';
  const plain = 'vec3 color = vColor.rgb;';
  if (!shader.includes(depth) && !shader.includes(plain)) throw new Error('This splat shader does not support color grading.');
  return GRADE_GLSL + shader.replace(depth, 'mix(gradeSplatColor(vColor.rgb), depthColor, heroDepthMix)').replace(plain, 'vec3 color = gradeSplatColor(vColor.rgb);');
}
