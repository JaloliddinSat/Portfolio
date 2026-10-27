import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {defaultFog,validFog,fogAmountAtDistance,patchFogShaders,installDistanceFog} from '../splat-fog-core.mjs';
import {defaultCutoff,patchCutoffShader} from '../splat-cutoff-core.mjs';
import {patchRevealShader,patchRevealFragment} from '../splat-reveal.mjs';
import {patchGradeShader} from '../splat-color-core.mjs';
const config=defaultFog();
assert.deepEqual(config,{version:1,target:'hero',asset:'/splats/Fairview.ksplat',pipeline:'warm-film -> distance-fog-v1',metric:'3d-distance',originSpace:'model',origin:[-.24,-.06,-.05],cutoff:{radius:10,feather:0},start:1.1,falloff:2.2,darkening:.47,blur:4.2,fogginess:.52,color:'#000000'},'public fog exactly matches the supplied settings');
assert(validFog(JSON.parse(JSON.stringify(config))));
for(const bad of [{start:-1},{falloff:0},{blur:13},{darkening:1.1},{fogginess:NaN},{color:'red'},{origin:[0,0,0]},{cutoff:{radius:20,feather:1.5}},{metric:'camera-depth'}]) assert(!validFog({...config,...bad}));
assert.equal(fogAmountAtDistance(1,2,4),0);
assert.equal(fogAmountAtDistance(2,2,4),0);
assert.equal(fogAmountAtDistance(4,2,4),.5);
assert.equal(fogAmountAtDistance(6,2,4),1);
assert.equal(fogAmountAtDistance(10,2,4),1);
// Compose with the real renderer shader, grading, reveal, and approved cutoff.
const projection=await readFile('GaussianSplats3D/src/splatmesh/SplatMaterial3D.js','utf8');
const vertex=patchCutoffShader(patchGradeShader(patchRevealShader('vec3 splatCenter;'+projection)));
const fragment=patchRevealFragment(projection);
const patched=patchFogShaders(vertex,fragment);
assert(patched.vertex.includes('splatDistanceCutoff(splatCenter)'));
assert(patched.vertex.indexOf('if (cutoffAlpha <= 0.0)') < patched.vertex.indexOf('heroRevealMask(splatCenter)'),'cut splats exit before reveal, grade, blur and projection work');
assert(patched.vertex.includes('vStudioFog = studioFogEnabled * smoothstep'),'fog stays independent of scroll');
assert(patched.vertex.includes('heroRevealMask(splatCenter)'));
assert(patched.vertex.includes('vColor.rgb = gradeSplatColor(vColor.rgb)'),'grade runs once per splat in the vertex stage');
assert(!patched.fragment.includes('gradeSplatColor'),'no per-fragment LUT or curve reads remain');
assert(patched.fragment.includes('color = mix(color, studioFogColor'));
assert(patched.vertex.includes('sqrt(fogDetBefore / fogDetAfter)'),'blur conserves integrated Gaussian opacity');
assert(patched.vertex.indexOf('float fogVariance') < patched.vertex.indexOf('vec3 cov2Dv ='),'blur modifies covariance before projection basis');
assert.throws(()=>patchFogShaders('unsupported','unsupported'),/does not support/);
for(const scale of [.75,.75*.73]) {
 const material={vertexShader:vertex,fragmentShader:fragment,uniforms:{}};let renders=0;
 const viewer={getSplatMesh:()=>({material}),renderer:{getPixelRatio:()=>2},forceRenderNextFrame(){},render(){renders++;}};
 const apply=installDistanceFog(viewer,config,{position:[-1.65,.87,-.71],scale});
 assert.deepEqual(material.uniforms.studioFogOrigin.value,config.origin.map((v,i)=>v*scale+[-1.65,.87,-.71][i]));
 assert.equal(material.uniforms.studioFogStart.value,1.1);assert.equal(material.uniforms.studioFogFalloff.value,2.2);
 assert.equal(material.uniforms.studioFogBlur.value,4.2);assert.equal(material.uniforms.studioFogDarkening.value,.47);assert.equal(material.uniforms.studioFogDensity.value,.52);assert.deepEqual(material.uniforms.studioFogColor.value,[0,0,0]);
 const originalVertex=material.vertexShader, originalFragment=material.fragmentShader;
 apply({...config,start:3,falloff:2,blur:8,darkening:.8,fogginess:.6,color:'#ff0000'});
 assert.equal(material.uniforms.studioFogStart.value,3);assert.equal(material.uniforms.studioFogFalloff.value,2);
 assert.equal(material.uniforms.studioFogBlur.value,8);assert.equal(material.uniforms.studioFogDensity.value,.6);
 assert.deepEqual(material.uniforms.studioFogColor.value,[1,0,0]);
 apply(config,true);assert.equal(material.uniforms.studioFogEnabled.value,0);
 apply(config);assert.equal(material.uniforms.studioFogEnabled.value,1);
 assert.equal(material.vertexShader,originalVertex);assert.equal(material.fragmentShader,originalFragment);
 assert.equal(renders,3,'live edits render even on an idle mobile viewer');
}
assert.equal(defaultCutoff().radius,10);assert.equal(defaultCutoff().feather,0);
const script=await readFile('script.js','utf8');assert(script.includes('else installDistanceCutoff(viewer, defaultCutoff(), distanceContext)'),'approved cutoff is public');
assert(script.includes('else installDistanceFog(viewer, defaultFog(), distanceContext)'),'approved fog is installed publicly');
assert(script.indexOf('else installDistanceFog') < script.indexOf('await prepareHeroReveal'),'fog is included in hidden shader warmup');
console.log('PASS: fog export/validation, distance falloff, shader composition, compensated blur, both scene scales, idle rendering, bypass and approved public cutoff');

// Exercise actual forward/back scrolling: the transition must never disable fog.
const {runInNewContext}=await import('node:vm');
const helpers=script.slice(script.indexOf('const smoothstepRange ='),script.indexOf('const getAnimationProgress ='));
for(const light of [false,true]) {
 const fogUniforms={studioFogEnabled:{value:1},studioFogDarkening:{value:config.darkening},studioFogDensity:{value:config.fogginess},studioFogBlur:{value:config.blur}};
 const material={isShaderMaterial:true,vertexShader:'varying vec4 vColor; gl_Position = quadPos;',fragmentShader:'varying vec4 vColor; vec3 color = vColor.rgb;',uniforms:structuredClone(fogUniforms)};
 const update=runInNewContext(helpers+'\ninstallHeroDepthShader(mesh)',{
  mesh:{material},HERO_DEPTH_CONFIG:{revealStart:.08,revealEnd:.3,collapseStart:.3,collapseEnd:.96,near:.28,far:1.4,recedeDistance:1.3},
  isLightTheme:()=>light,splatContainer:{setAttribute(){},style:{setProperty(){}}},console,
 });
 for(const progress of [0,.04,.08,.2,.5,.98,.5,.04,0]) {
  update(progress);
  for(const key of Object.keys(fogUniforms)) assert.deepEqual(material.uniforms[key],fogUniforms[key],'scroll leaves selected fog active');
  if(progress>=.3) assert.equal(material.uniforms.heroDepthMix.value,1,'existing scroll transition still works');
 }
}
assert(!script.includes('studioFogScrollStrength'),'scroll-driven fog bypass removed');
console.log('PASS: actual scroll updater preserves fog and blur throughout forward/back scrolling in both themes');
