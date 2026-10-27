import assert from 'node:assert/strict';
import { defaultCutoff, validCutoff, radiusToSlider, sliderToRadius, patchCutoffShader, installDistanceCutoff } from '../splat-cutoff-core.mjs';
const config=defaultCutoff();
assert(validCutoff(JSON.parse(JSON.stringify(config))), 'copied settings round trip');
for(const bad of [{radius:0},{radius:301},{feather:-1},{feather:6},{radius:NaN},{origin:[0,0,0]},{metric:'screen-distance'},{asset:'/other.ksplat'}]) assert(!validCutoff({...config,...bad}));
for(const radius of [1,5,15,20,50,240,300]) assert(Math.abs(sliderToRadius(radiusToSlider(radius))-radius)<=.051,'precise logarithmic slider conversion');
const shader='void main(){ vec3 splatCenter; vColor.a *= existingReveal; gl_Position = quadPos; }';
assert(patchCutoffShader(shader).includes('vColor.a *= existingReveal; vColor.a *= splatDistanceCutoff(splatCenter);'),'cutoff multiplies existing reveal rather than replacing it');
assert(patchCutoffShader(shader).includes('length((center - cutoffOrigin) / cutoffScale)'),'cutoff measures 3D model distance');
assert.throws(()=>patchCutoffShader('incompatible'),/does not support/);
for(const scale of [.75,.75*.73]) {
 const material={vertexShader:shader,uniforms:{}};let forced=0,renders=0;
 const viewer={getSplatMesh:()=>({material}),forceRenderNextFrame:()=>forced++,render:()=>renders++};
 const apply=installDistanceCutoff(viewer,config,{position:[-1.65,.87,-.71],scale});
 assert.deepEqual(material.uniforms.cutoffOrigin.value,config.origin.map((v,i)=>v*scale+[-1.65,.87,-.71][i]));
 assert.equal(material.uniforms.cutoffScale.value,scale);
 const patched=material.vertexShader;
 apply({...config,radius:16.4,feather:.8});
 assert.equal(material.uniforms.cutoffRadius.value,16.4);assert.equal(material.uniforms.cutoffFeather.value,.8);
 apply(config,true);assert.equal(material.uniforms.cutoffEnabled.value,0,'full-scene comparison bypasses cutoff');
 apply(config,false);assert.equal(material.uniforms.cutoffEnabled.value,1);
 assert.equal(material.vertexShader,patched,'slider edits do not recompile shaders');
 assert.equal(renders,3,'edits render even when mobile renderer is parked');assert.equal(forced,4);
}
console.log('PASS: distance cutoff validation/export, log slider precision, geometry-space shader composition, both scene scales, live uniform updates and full-scene comparison');
