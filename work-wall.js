/* CSS marquee motion, scroll response and keyboard access for the project wall. */
(() => {
  'use strict';
  const section=document.querySelector('[data-work-wall]');
  if (!section) return;
  window.YuriWorkWall?.destroy();
  const stage=section.querySelector('[data-wall-stage]');
  const plane=section.querySelector('[data-wall-plane]');
  const tracks=[...section.querySelectorAll('[data-wall-track]')];
  const cta=section.querySelector('.wall-cta');
  const veil=section.querySelector('.wall-veil');
  const pauseButton=section.querySelector('[data-wall-pause]');
  if (!stage || !plane || !tracks.length) return;
  const gsap=window.gsap, ScrollTrigger=window.ScrollTrigger;
  if (!gsap || !ScrollTrigger) { section.classList.add('wall-is-static'); if (pauseButton) pauseButton.hidden=true; return; }
  gsap.registerPlugin(ScrollTrigger);
  const abort=new AbortController();
  const on=(el,type,fn,options={})=>el.addEventListener(type,fn,{...options,signal:abort.signal});
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const clamp=(min,max,value)=>Math.max(min,Math.min(max,value));
  const attributes=['data-wall-active','data-wall-idle','data-wall-kbd','data-wall-paused'];
  const originalAttributes=attributes.map(name=>[name,section.getAttribute(name)]);
  const originalStatic=section.classList.contains('wall-is-static');
  const originalButton=pauseButton ? { html:pauseButton.innerHTML,hidden:pauseButton.hidden,pressed:pauseButton.getAttribute('aria-pressed'),label:pauseButton.getAttribute('aria-label'),title:pauseButton.getAttribute('title') } : null;
  const trackOriginal=tracks.map(track=>({track,values:['animation-duration','transform','translate'].map(name=>[name,track.style.getPropertyValue(name),track.style.getPropertyPriority(name)])}));
  const durationFallback=[72,90.7,61.3];
  tracks.forEach((track,index)=>{
    const duration=Number(track.dataset.duration)||durationFallback[index%3];
    track.style.animationDuration=`${duration}s`;
  });
  let userPaused=pauseButton?.getAttribute('aria-pressed')==='true';
  let context=null, resetTween=null, enterTween=null;
  let rateTimer=0, refreshFrame=0, alive=true;
  const rate={value:1};
  let animations=[];
  const restoreTrackPositions=()=>trackOriginal.forEach(({track,values})=>values.slice(1).forEach(([name,value,priority])=>value?track.style.setProperty(name,value,priority):track.style.removeProperty(name)));
  const applyRate=()=>animations.forEach(animation=>{ animation.playbackRate=rate.value; });

  function updatePause() {
    section.toggleAttribute('data-wall-paused',userPaused);
    if (!pauseButton) return;
    const labelText='작품 자동 이동 일시정지';
    pauseButton.setAttribute('aria-pressed',String(userPaused));
    pauseButton.setAttribute('aria-label',labelText);
    pauseButton.title=userPaused?'자동 이동이 멈췄습니다. 다시 누르면 재생합니다.':'자동 이동을 일시정지합니다.';
    const label=pauseButton.querySelector('[data-wall-pause-label]');
    if (label) label.textContent=labelText;
    else pauseButton.textContent=labelText;
  }
  updatePause();
  if (pauseButton) on(pauseButton,'click',()=>{userPaused=!userPaused;updatePause();});

  const initialRect=section.getBoundingClientRect();
  let outside=initialRect.bottom<=0||initialRect.top>=innerHeight;
  const updateIdle=()=>section.toggleAttribute('data-wall-idle',outside||document.hidden);
  const intersection=typeof IntersectionObserver==='function' ? new IntersectionObserver(entries=>{
    outside=!entries[0].isIntersecting; updateIdle();
  }) : null;
  updateIdle();
  intersection?.observe(section);
  on(document,'visibilitychange',()=>{
    const rect=section.getBoundingClientRect(); outside=rect.bottom<=0||rect.top>=innerHeight; updateIdle();
  });

  on(section,'focusin',event=>{
    const target=event.target;
    if (!(target instanceof Element) || !target.matches(':focus-visible')) return;
    section.setAttribute('data-wall-kbd','');
    if (enterTween) { enterTween.progress(1).kill(); enterTween=null; }
    if (reduced.matches || !target.matches('.wall-card')) return;
    const track=target.closest('[data-wall-track]'), viewport=track?.parentElement;
    if (!track || !viewport) return;
    const center=viewport.clientWidth/2-(target.offsetLeft+target.offsetWidth/2);
    const animation=track.getAnimations().find(item=>item.animationName==='yuri-work-wall-flow')||track.getAnimations()[0];
    const timing=animation?.effect?.getComputedTiming(), duration=Number(timing?.duration)||0;
    if (animation && duration>0) {
      const half=track.scrollWidth/2;
      const position=clamp(-half+1,-1,center), progress=half>0?-position/half:0;
      animation.currentTime=duration*(timing?.direction==='reverse'?1-progress:progress);
      track.style.transform=center!==position?`translateX(${center-position}px)`:'';
    } else track.style.translate=`${center}px 0`;
  });
  on(section,'focusout',event=>{
    if (section.contains(event.relatedTarget)) return;
    section.removeAttribute('data-wall-kbd'); restoreTrackPositions();
  });

  function stopMode() {
    clearTimeout(rateTimer); rateTimer=0; cancelAnimationFrame(refreshFrame);
    resetTween?.kill(); resetTween=null; enterTween=null;
    context?.revert(); context=null;
    rate.value=1; applyRate(); animations=[];
    section.removeAttribute('data-wall-active');
    restoreTrackPositions();
  }
  function rebuild() {
    if (!alive) return;
    stopMode();
    section.classList.toggle('wall-is-static',reduced.matches);
    if (pauseButton) pauseButton.hidden=reduced.matches;
    if (reduced.matches) return;
    section.setAttribute('data-wall-active',''); updatePause();
    animations=tracks.flatMap(track=>track.getAnimations().filter(animation=>animation.animationName==='yuri-work-wall-flow'));
    context=gsap.context(()=>{
      gsap.set(stage,{y:22,opacity:0,pointerEvents:'none'});
      enterTween=gsap.to(stage,{y:0,opacity:1,duration:.9,ease:'expo.out',
        onUpdate(){stage.style.pointerEvents=parseFloat(stage.style.opacity)>0?'':'none';},
        scrollTrigger:{trigger:section,start:'top 78%',once:true}
      });
      ScrollTrigger.create({trigger:section,start:'top bottom',end:'bottom top',onUpdate(self){
        resetTween?.kill(); rate.value=clamp(1,3.2,1+Math.abs(self.getVelocity())/900); applyRate();
        clearTimeout(rateTimer);
        rateTimer=setTimeout(()=>{ if (alive) resetTween=gsap.to(rate,{value:1,duration:.5,ease:'power2.out',onUpdate:applyRate}); },140);
      }});
      if (veil) {
        gsap.set(veil,{opacity:.82});
        gsap.timeline({scrollTrigger:{trigger:section,start:'top bottom',end:'bottom top',scrub:.6,invalidateOnRefresh:true},defaults:{ease:'none'}})
          .fromTo(veil,{opacity:.82},{opacity:0,duration:.5,ease:'sine.inOut'})
          .to(veil,{opacity:.97,duration:.35,ease:'sine.inOut'})
          .to(veil,{opacity:.97,duration:.15});
      }
      if (cta) {
        const timeline=gsap.timeline({scrollTrigger:{trigger:section,start:'top bottom',end:'bottom top',scrub:1,invalidateOnRefresh:true}});
        timeline.fromTo(cta,{y:120},{y:-120,duration:1,ease:'none'},0)
          .fromTo(cta,{scale:1},{scale:1.1,duration:.5,ease:'sine.out'},0)
          .to(cta,{scale:.85,duration:.5,ease:'sine.in'},.5)
          .to(cta,{autoAlpha:0,duration:.22,ease:'sine.in'},.46);
      }
      gsap.fromTo(plane,{'--shot-zoom':1},{'--shot-zoom':1.09,ease:'none',scrollTrigger:{trigger:section,start:'top bottom',end:'bottom top',scrub:1,invalidateOnRefresh:true}});
    },section);
    refreshFrame=requestAnimationFrame(()=>{if(alive)ScrollTrigger.refresh();});
  }
  reduced.addEventListener('change',rebuild);
  function destroy() {
    if (!alive) return;
    alive=false; stopMode(); abort.abort(); intersection?.disconnect(); reduced.removeEventListener('change',rebuild);
    section.classList.toggle('wall-is-static',originalStatic);
    originalAttributes.forEach(([name,value])=>value===null?section.removeAttribute(name):section.setAttribute(name,value));
    trackOriginal.forEach(({track,values})=>values.forEach(([name,value,priority])=>value?track.style.setProperty(name,value,priority):track.style.removeProperty(name)));
    if (pauseButton && originalButton) {
      pauseButton.innerHTML=originalButton.html; pauseButton.hidden=originalButton.hidden;
      [['aria-pressed',originalButton.pressed],['aria-label',originalButton.label],['title',originalButton.title]].forEach(([name,value])=>value===null?pauseButton.removeAttribute(name):pauseButton.setAttribute(name,value));
    }
  }
  window.YuriWorkWall={destroy,refresh:rebuild};
  rebuild();
})();
