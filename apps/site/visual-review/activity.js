// Local, opt-in aggregates. Never transmit interaction events or store typed keys.
export function activity(get, save) {
  let last=performance.now(), activeUntil=0;
  function tick(now=performance.now()) {
    const d=get();
    if(d && activeUntil>last) d.ms=Math.min(86400000,d.ms+Math.max(0,Math.min(now,activeUntil)-last));
    last=now;
  }
  function pause(){tick();activeUntil=0;save()}
  function touch(){tick();if(get() && !document.hidden && document.hasFocus()) activeUntil=performance.now()+30000}
  addEventListener('blur',pause);addEventListener('pagehide',pause);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
  for(const name of ['pointerdown','keydown','scroll','input']) document.addEventListener(name,touch,{passive:true,capture:true});
  setInterval(()=>{if(get()){tick();save()}},1000);
  return {touch,pause,tick};
}
