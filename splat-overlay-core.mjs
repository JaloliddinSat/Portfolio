export const defaultOverlays = () => ({version:1,target:'hero-edge-scroll-overlay',themes:{dark:{strength:1,start:.5},light:{strength:1,start:.5}}});
export function validOverlays(value) {
 return value?.version===1 && value.target==='hero-edge-scroll-overlay' && ['dark','light'].every(theme=>{
  const v=value.themes?.[theme];return Number.isFinite(v?.strength)&&v.strength>=0&&v.strength<=100&&Number.isFinite(v?.start)&&v.start>=0&&v.start<=.97;
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
