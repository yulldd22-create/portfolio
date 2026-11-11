/* One owner for visibility, pause, loading, and the three independent glass reels. */
(() => {
  'use strict';
  window.YuriStatementMotion?.destroy();
  const section=document.querySelector('[data-statement]');
  const windowEl=section?.querySelector('[data-icon-window]');
  const row=windowEl?.querySelector('.inline-icons-row');
  const slots=row?[...row.querySelectorAll('.inline-icon-slot')]:[];
  const button=section?.querySelector('[data-pause-icons]');
  if (!section || !windowEl || !row || slots.length!==3) return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const gsap=window.gsap, ScrollTrigger=window.ScrollTrigger;
  const abort=new AbortController();
  const on=(target,type,listener,options={})=>target.addEventListener(type,listener,{...options,signal:abort.signal});
  let scene=null, loading=null, generation=0, opening=null, trigger=null, observer=null;
  let visible=false, userPaused=false, suspended=document.hidden, failed=false, alive=true;
  const state=()=>({ visible,userPaused,reduced:reduced.matches,suspended });
  function updateButton() {
    if (!button) return;
    button.disabled=reduced.matches || failed;
    button.setAttribute('aria-label','아이콘 움직임 일시 정지');
    button.setAttribute('aria-pressed',String(userPaused || reduced.matches || failed));
    button.textContent='';
    button.title=userPaused?'아이콘 움직임 재생':'아이콘 움직임 일시 정지';
  }
  async function ensureScene() {
    if (!alive || scene || loading || failed || reduced.matches || !visible) return;
    const token=++generation;
    loading=import('./glass-scene.mjs?v=4a860843414e');
    try {
      const module=await loading;
      if (!alive || token!==generation || reduced.matches) return;
      scene=module.createGlassScene({ row,slots,onFailure:()=>{failed=true;scene=null;updateButton();} });
      scene.setState(state());
    } catch (_) { if (alive && token===generation) {failed=true;updateButton();} }
    finally { if (token===generation) loading=null; }
  }
  function sync() {
    if (!alive) return;
    scene?.setState(state()); updateButton();
    if (visible && !reduced.matches && !suspended) ensureScene();
  }
  function setVisible(next) {
    visible=Boolean(next);
    if (visible) opening?.play(); else opening?.reverse();
    sync();
  }
  function setupOpening() {
    opening?.kill(); opening=null;
    windowEl.style.removeProperty('width');
    if (!reduced.matches && gsap && ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      opening=gsap.timeline({paused:true}).fromTo(windowEl,{width:0},{width:()=>row.offsetWidth,duration:.45,ease:'power3.out'});
      if (visible) opening.play();
    }
  }
  function onReducedChange() {
    generation++; loading=null;
    if (reduced.matches) { scene?.dispose();scene=null; }
    setupOpening();sync();
  }
  function resize() {
    if (!alive) return;
    scene?.resize();
    if (opening) {
      const progress=opening.progress(); opening.invalidate();
      opening.progress(progress<1?Math.min(1,progress+.001):.999,true).progress(progress,true);
    }
  }
  setupOpening();
  if (ScrollTrigger && gsap) {
    trigger=ScrollTrigger.create({trigger:section,start:'top 65%',end:'bottom 10%',invalidateOnRefresh:true,
      onEnter:()=>setVisible(true),onLeave:()=>setVisible(false),onEnterBack:()=>setVisible(true),onLeaveBack:()=>setVisible(false),
      onRefresh:self=>{resize();setVisible(self.isActive);}
    });
    setVisible(trigger.isActive);
  } else if ('IntersectionObserver' in window) {
    observer=new IntersectionObserver(entries=>entries.forEach(entry=>setVisible(entry.isIntersecting)),{rootMargin:'0px',threshold:.01});
    observer.observe(section);
  } else setVisible(true);
  if (button) on(button,'click',()=>{if(!button.disabled){userPaused=!userPaused;sync();}});
  on(document,'visibilitychange',()=>{suspended=document.hidden;sync();});
  on(window,'pagehide',()=>{suspended=true;sync();});
  on(window,'pageshow',()=>{suspended=document.hidden;trigger?.refresh();resize();sync();});
  on(window,'resize',resize,{passive:true});
  if(reduced.addEventListener)reduced.addEventListener('change',onReducedChange);
  else reduced.addListener(onReducedChange);
  document.fonts?.ready.then(()=>{if(alive){resize();trigger?.refresh();}});
  window.YuriStatementMotion={destroy(){
    if(!alive)return;alive=false;generation++;abort.abort();observer?.disconnect();trigger?.kill();opening?.kill();scene?.dispose();scene=null;
    windowEl.style.removeProperty('width');
    if(reduced.removeEventListener)reduced.removeEventListener('change',onReducedChange);
    else reduced.removeListener(onReducedChange);
  }};
  updateButton();
})();
