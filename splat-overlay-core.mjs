export const defaultOverlays = () => ({version:2,target:'hero-edge-scroll-overlay',themes:{dark:{strength:1,start:.5},light:{strength:1,start:.5,backdrop:{start:.08,end:.5,color:"#ffffff"}}}});
export function validOverlays(value) {
 return value?.version===2 && value.target==='hero-edge-scroll-overlay' && ['dark','light'].every(theme=>{
  const v=value.themes?.[theme];return Number.isFinite(v?.strength)&&v.strength>=0&&v.strength<=100&&Number.isFinite(v?.start)&&v.start>=0&&v.start<=.97 && (theme==='dark' || (Number.isFinite(v.backdrop?.start)&&v.backdrop.start>=0&&v.backdrop.start<=.99&&Number.isFinite(v.backdrop?.end)&&v.backdrop.end>v.backdrop.start&&v.backdrop.end<=1&&/^#[0-9a-f]{6}$/i.test(v.backdrop.color)));
 });
}
export function overlayOpacity(progress,start) {
 const t=Math.max(0,Math.min(1,(progress-start)/(.98-start)));return t*t*(3-2*t);
}
export function overlayBackground(theme,strength) {
 const a=alpha=>1-Math.pow(1-alpha,strength);
 const stops=theme==='light'?[[247,247,248,.42,42],[243,243,244,.78,72],[243,243,244,.94,100]]:[[4,6,14,.42,42],[2,4,10,.78,72],[0,0,0,.92,100]];
 const base=theme==='light'?[247,247,248,.48]:[3,5,12,.48];
 return `radial-gradient(ellipse 108% 96% at 50% 48%, transparent 6%, ${stops.map(([r,g,b,alpha,pos])=>`rgba(${r},${g},${b},${a(alpha)}) ${pos}%`).join(', ')}), rgba(${base.slice(0,3).join(',')},${a(base[3])})`;
}

export function hydrateOverlays(value) {
 if(value?.version===1 && value.themes?.light) value={...value,version:2,themes:{...value.themes,light:{...value.themes.light,backdrop:defaultOverlays().themes.light.backdrop}}};
 return validOverlays(value)?value:defaultOverlays();
}
export function backdropColor(progress,{start,end,color}) {
 const t=Math.max(0,Math.min(1,(progress-start)/(end-start))),amount=t*t*(3-2*t);
 return `rgb(${[1,3,5].map(i=>Math.round(17+(parseInt(color.slice(i,i+2),16)-17)*amount)).join(', ')})`;
}
