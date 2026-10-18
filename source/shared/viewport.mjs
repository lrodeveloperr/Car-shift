export function viewportMetrics(width, height, deviceScale = 1) {
  if (![width,height,deviceScale].every(Number.isFinite) || width <= 0 || height <= 0 || deviceScale <= 0) throw Error('Invalid viewport');
  const ratio = Math.max(1,Math.min(2,deviceScale));
  return {width,height,ratio,backingWidth:Math.ceil(width*ratio),backingHeight:Math.ceil(height*ratio),landscape:width>height};
}
export function normalizedPointer(event, rect) {
  if (rect.width <= 0 || rect.height <= 0) throw Error('Input rectangle has no area');
  return {x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height};
}
export function observeViewport(root,canvas,onChange,{isPaused=()=>false}={}) {
  let last='';
  const measure=()=>{
    const rect=root.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    if (isPaused()) return; // No backing-canvas mutation or rendering while host-paused.
    const metrics=viewportMetrics(rect.width,rect.height,globalThis.devicePixelRatio||1);
    const signature=JSON.stringify(metrics);if(signature===last)return;last=signature;
    canvas.width=metrics.backingWidth;canvas.height=metrics.backingHeight;
    root.dataset.orientation=metrics.landscape?'landscape':'portrait';
    onChange(metrics); // Update camera/layout only; never reset domain state.
  };
  const observer=new ResizeObserver(measure);observer.observe(root);
  globalThis.addEventListener('resize',measure);measure();
  return {refresh:measure,dispose:()=>{observer.disconnect();globalThis.removeEventListener('resize',measure);}};
}
