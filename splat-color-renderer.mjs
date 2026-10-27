import * as THREE from 'three';
import { defaultGrade, validGrade, makeLut, makeCurves, patchGradeShader } from './splat-color-core.mjs';

// Grade selected in the private studio, applied only to the Fairview hero.
export const HERO_COLOR_GRADE = { ...defaultGrade(), lut: 'warm-film', strength: 1 };

export function installSplatColorGrade(viewer, initialGrade = HERO_COLOR_GRADE) {
  if (!validGrade(initialGrade)) throw new Error('Invalid hero color grade.');
  const material = viewer.getSplatMesh().material;
  const shader = patchGradeShader(material.vertexShader);
  const texture = (data, width, height) => {
    const result = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    result.minFilter = result.magFilter = THREE.LinearFilter;
    result.wrapS = result.wrapT = THREE.ClampToEdgeWrapping;
    result.generateMipmaps = false;
    result.needsUpdate = true;
    return result;
  };
  const lut = texture(makeLut(initialGrade.lut), 256, 16);
  const curves = texture(makeCurves(initialGrade), 256, 1);
  let lastLut = initialGrade.lut;
  Object.assign(material.uniforms, {
    gradeLut: { value: lut }, gradeCurves: { value: curves },
    gradeStrength: { value: initialGrade.strength }, gradeEnabled: { value: 1 },
  });
  material.vertexShader = shader;
  material.needsUpdate = true;
  viewer.forceRenderNextFrame();
  return (grade, original = false) => {
    if (!validGrade(grade)) throw new Error('Invalid hero color grade.');
    if (lastLut !== grade.lut) {
      lut.image.data.set(makeLut(grade.lut));
      lut.needsUpdate = true;
      lastLut = grade.lut;
    }
    curves.image.data.set(makeCurves(grade));
    curves.needsUpdate = true;
    material.uniforms.gradeStrength.value = grade.strength;
    material.uniforms.gradeEnabled.value = original ? 0 : 1;
    viewer.forceRenderNextFrame();
    // Mobile parks its render loop while idle; a studio edit must still render.
    viewer.render();
  };
}
