/* Shared cursor, button pop and magnetic pull. Hero and scene transforms stay independent. */
(() => {
  'use strict';
  if (!window.gsap) return;
  window.YuriPointerMotion?.destroy();
  const gsap = window.gsap;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  let dispose = null;
  let destroyed = false;
  const sync = () => {
    if (destroyed) return;
    if (fine.matches && !reduced.matches) { if (!dispose) dispose = start(); }
    else { dispose?.(); dispose = null; }
  };

  const POINT_FILL = 'rgb(43, 95, 255)';
  const FILL_TARGETS = '.header-contact,.statement-cta,.filter-button,[data-work-filter],.pill--ghost';
  const LINK_TARGETS = '.site-nav a,.hero-cta a,.portfolio-footer__link,.portfolio-footer__top,.back-link,.wordmark';
  const FILTER_TARGETS = '.filter-button,[data-work-filter]';
  const isSelectedFilter = node => Boolean(node?.matches?.(FILTER_TARGETS)
    && node.getAttribute('aria-pressed') === 'true');

  // Computed styles can use comma-separated or modern space/slash RGB notation.
  function parseRgba(value) {
    const source = String(value || '').trim();
    if (source === 'transparent') return { r:0, g:0, b:0, a:0 };
    if (!/^rgba?\(/i.test(source)) return { r:0, g:0, b:0, a:0 };
    const values = source.match(/[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?%?/gi) || [];
    if (values.length < 3) return { r:0, g:0, b:0, a:0 };
    const channel = value => Math.min(255, Math.max(0, parseFloat(value) * (value.endsWith('%') ? 2.55 : 1)));
    const alpha = values[3] === undefined ? 1 : parseFloat(values[3]) / (values[3].endsWith('%') ? 100 : 1);
    return { r:channel(values[0]), g:channel(values[1]), b:channel(values[2]), a:Math.min(1, Math.max(0, alpha)) };
  }

  function resolveCursorFill(btn) {
    const style = getComputedStyle(btn);
    const bg = parseRgba(style.backgroundColor);
    const border = parseRgba(style.borderTopColor);
    const borderWidth = parseFloat(style.borderTopWidth) || 0;
    const height = btn.getBoundingClientRect().height || parseFloat(style.height) || 0;
    const luminance = .2126 * bg.r + .7152 * bg.g + .0722 * bg.b;
    const transparent = bg.a < .25;
    const whiteish = bg.a > .85 && luminance > 230;
    const blackish = bg.a > .85 && luminance < 45;
    const whiteBorder = borderWidth >= 1 && Math.abs(border.r - 255) + Math.abs(border.g - 255) + Math.abs(border.b - 255) < 50;
    const alreadyBlue = bg.a > .85 && Math.abs(bg.r - 43) + Math.abs(bg.g - 95) + Math.abs(bg.b - 255) < 50;
    if (btn.classList.contains('header-contact') && (blackish || transparent || luminance < 80)) return { fill:POINT_FILL, text:'#fff', hideBorder:true };
    if (alreadyBlue) return { fill:'#fff', text:POINT_FILL, hideBorder:false };
    if (btn.matches('.pill--ghost,.is-ghost') || (transparent && whiteBorder)) return { fill:'#fff', text:'#000', hideBorder:false };
    if (blackish || btn.classList.contains('btn--fill')) return { fill:POINT_FILL, text:'#fff', hideBorder:true };
    if (whiteish || btn.matches('.btn--line,.is-solid')) return { fill:height >= 50 ? POINT_FILL : '#000', text:'#fff', hideBorder:false };
    return { fill:POINT_FILL, text:'#fff', hideBorder:false };
  }

  function start() {
    const layer = document.createElement('div');
    const canvas = document.createElement('canvas');
    layer.className = 'yuri-pointer';
    layer.setAttribute('aria-hidden', 'true');
    layer.append(canvas);
    let ctx;
    try { ctx = canvas.getContext('2d'); } catch (_) { return null; }
    if (!ctx) return null;
    const abort = new AbortController();
    const on = (el, name, fn, options = {}) => el.addEventListener(name, fn, { ...options, signal:abort.signal });
    const sections = [...document.querySelectorAll('[data-header-theme]')].reverse();
    const pointer = { x:-100, y:-100, active:false };
    const head = { x:-100, y:-100 };
    const points = Array.from({ length:11 }, () => ({ x:-100, y:-100 }));
    const ring = { v:0 };
    const press = { v:1 };
    const idle = { v:0, on:false, since:0 };
    const text = { v:0, h:20, drag:0, on:false, dragging:false };
    const controls = [];
    const rests = new WeakMap();
    const controlResets = new WeakMap();
    let pressed = null;
    let light = false;
    let ringOn = false;
    let blocked = false;
    let alive = true;
    let lastMove = performance.now();
    let toneFrame = 0;
    let textTimer = 0;
    let width = innerWidth;
    let height = innerHeight;
    document.body.append(layer);

    function size() {
      width = innerWidth; height = innerHeight;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      requestTone();
    }
    function setIdle(on) {
      if (on === idle.on) return;
      idle.on = on;
      if (on) idle.since = performance.now();
      gsap.to(idle, { v:on ? 1 : 0, duration:on ? .6 : .2, ease:on ? 'back.out(1.8)' : 'power2.out', overwrite:true });
    }
    function setRing(on) {
      if (on === ringOn) return;
      ringOn = on;
      gsap.to(ring, { v:on ? 1 : 0, duration:on ? .4 : .25, ease:on ? 'back.out(2)' : 'power2.out', overwrite:true });
    }
    function textHeightAt(x,y) {
      let node, offset;
      if (document.caretRangeFromPoint) {
        const caret=document.caretRangeFromPoint(x,y);
        if (!caret) return 0;
        node=caret.startContainer; offset=caret.startOffset;
      } else if (document.caretPositionFromPoint) {
        const caret=document.caretPositionFromPoint(x,y);
        if (!caret) return 0;
        node=caret.offsetNode; offset=caret.offset;
      } else return 0;
      if (!node || node.nodeType!==3 || !node.textContent.trim()) return 0;
      const el=node.parentElement;
      if (!el || el.closest('a,button,input,textarea,select,[role="button"],.yuri-magnet-target') || getComputedStyle(el).userSelect==='none') return 0;
      const range=document.createRange(), start=Math.min(offset,node.textContent.length-1);
      const hit=rect=>rect.width>0 && x>=rect.left-2 && x<=rect.right+2 && y>=rect.top && y<=rect.bottom;
      range.setStart(node,start); range.setEnd(node,start+1);
      let rect=range.getBoundingClientRect();
      if (!hit(rect) && start>0) { range.setStart(node,start-1); range.setEnd(node,start); rect=range.getBoundingClientRect(); }
      return hit(rect) ? rect.height : 0;
    }
    function setText(on,height) {
      if (height) {
        const h=Math.min(56,Math.max(14,height*.9));
        if (!text.on) text.h=h;
        else gsap.to(text,{h,duration:.25,ease:'power2.out',overwrite:'auto'});
      }
      if (text.on===on) return;
      text.on=on;
      gsap.to(text,{v:on?1:0,duration:on ? .4 : .22,ease:on?'back.out(2.2)':'power2.out',overwrite:'auto'});
    }
    function setTextDrag(on) {
      text.dragging=on;
      gsap.to(text,{drag:on?1:0,duration:on ? .35 : .3,ease:on?'back.out(2.5)':'power2.out',overwrite:'auto'});
    }
    function requestText() {
      if (textTimer) return;
      textTimer=setTimeout(()=>{
        textTimer=0;
        if (!alive || blocked || !pointer.active) return;
        if (ring.v>.5) { setText(false); return; }
        const height=textHeightAt(pointer.x,pointer.y);
        if (height) setText(true,height);
        else if (!text.dragging) setText(false);
      },40);
    }
    function barPath(x,y,w,h) {
      const radius=w/2;
      ctx.moveTo(x-radius,y-h/2+radius); ctx.arc(x,y-h/2+radius,radius,Math.PI,0);
      ctx.lineTo(x+radius,y+h/2-radius); ctx.arc(x,y+h/2-radius,radius,0,Math.PI); ctx.closePath();
    }
    function hide() {
      pointer.active = false;
      root.classList.remove('yuri-pointer-ready');
      layer.classList.remove('is-visible');
      setIdle(false); setRing(false);
      clearTimeout(textTimer); textTimer=0; setText(false); setTextDrag(false);
      if (pressed) { gsap.killTweensOf(pressed,'--pop-sx,--pop-sy'); gsap.set(pressed,{'--pop-sx':1,'--pop-sy':1}); pressed=null; }
      gsap.set(press, { v:1 });
      ctx.clearRect(0,0,width,height);
    }
    function updateTone() {
      toneFrame = 0; light = false;
      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= pointer.y && rect.bottom > pointer.y && rect.left <= pointer.x && rect.right >= pointer.x) {
          light = section.dataset.headerTheme === 'light'; break;
        }
      }
    }
    function requestTone() { if (!toneFrame) toneFrame = requestAnimationFrame(updateTone); }
    function dialogState() {
      const next = Boolean(document.querySelector('dialog[open]'));
      if (next === blocked) return;
      blocked = next;
      if (blocked) { hide(); controls.forEach(control => control.reset()); }
    }
    const observer = new MutationObserver(records => {
      dialogState();
      records.forEach(record => {
        if (record.type !== 'attributes' || record.attributeName !== 'aria-pressed'
          || !isSelectedFilter(record.target)) return;
        controlResets.get(record.target)?.();
        if (record.target.matches(':hover')) setRing(false);
      });
    });
    observer.observe(document.body, { subtree:true, childList:true, attributes:true, attributeFilter:['open','aria-pressed'] });
    dialogState();

    function draw() {
      ctx.clearRect(0,0,width,height);
      // Difference blending makes this complement appear as #2b5fff over a light section.
      const rgb = light ? '212,160,0' : '255,255,255';
      const r = Math.max(0, Math.min(ring.v,1.2));
      const tv=Math.max(0,text.v);
      const radius = 6 * Math.max(0,1-r) * Math.max(.3,1-tv*.7);
      const spine = [head, ...points];
      let spread = 0;
      for (let i=1;i<spine.length;i++) spread += Math.abs(spine[i].x-spine[i-1].x)+Math.abs(spine[i].y-spine[i-1].y);
      const alpha = .35 * Math.min(1,spread/140);
      if (radius > .3 && alpha > .01) {
        const left = [], right = [];
        spine.forEach((point,i) => {
          const prev = spine[Math.max(0,i-1)], next = spine[Math.min(spine.length-1,i+1)];
          const dx = next.x-prev.x, dy = next.y-prev.y, len = Math.hypot(dx,dy)||1;
          const w = radius*.7*(1-i/(spine.length-1));
          left.push({ x:point.x-dy/len*w, y:point.y+dx/len*w });
          right.push({ x:point.x+dy/len*w, y:point.y-dx/len*w });
        });
        const outline = left.concat(right.reverse()), end = spine.at(-1);
        ctx.beginPath(); ctx.moveTo(outline[0].x,outline[0].y);
        for (let i=1;i<outline.length-1;i++) ctx.quadraticCurveTo(outline[i].x,outline[i].y,(outline[i].x+outline[i+1].x)/2,(outline[i].y+outline[i+1].y)/2);
        ctx.lineTo(outline.at(-1).x,outline.at(-1).y); ctx.closePath();
        const gradient = ctx.createLinearGradient(head.x,head.y,end.x,end.y);
        gradient.addColorStop(0,`rgba(${rgb},${alpha})`); gradient.addColorStop(1,`rgba(${rgb},0)`);
        ctx.fillStyle = gradient; ctx.fill();
      }
      ctx.beginPath();
      if (tv>.01 && r<.01) {
        const barW=Math.max(2,12+(3-12)*Math.min(1,tv));
        const barH=Math.max(barW,12+(text.h*(1+.3*text.drag)-12)*tv);
        barPath(head.x,head.y,barW,barH);
        if (text.drag>.01) {
          const cap=9*text.drag;
          ctx.rect(head.x-cap/2,head.y-barH/2,cap,2);
          ctx.rect(head.x-cap/2,head.y+barH/2-2,cap,2);
        }
      } else ctx.arc(head.x,head.y,Math.max(.5,(12+26*ring.v)/2*press.v),0,Math.PI*2);
      if (r < .99) { ctx.fillStyle = `rgba(${rgb},${Math.max(0,1-r)})`; ctx.fill(); }
      if (r > .01) { ctx.lineWidth=1.2; ctx.strokeStyle=`rgba(${rgb},${Math.min(1,r)})`; ctx.stroke(); }
      const fade = Math.min(1,Math.max(0,idle.v))*Math.max(0,1-r);
      if (fade > .01) {
        ctx.lineWidth=1.2; ctx.strokeStyle=`rgba(${rgb},${.9*fade})`;
        ctx.beginPath(); ctx.arc(head.x,head.y,Math.max(.5,22*idle.v),0,Math.PI*2); ctx.stroke();
        for (let i=0;i<2;i++) {
          const phase = ((performance.now()-idle.since)/1600+i*.5)%1;
          ctx.strokeStyle=`rgba(${rgb},${(1-phase)**2*.6*fade})`;
          ctx.beginPath(); ctx.arc(head.x,head.y,22+24*phase,0,Math.PI*2); ctx.stroke();
        }
      }
    }
    function tick() {
      if (!alive || !pointer.active || blocked || document.hidden) return;
      const follow = 1-Math.pow(.5,gsap.ticker.deltaRatio(60));
      head.x += (pointer.x-head.x)*follow; head.y += (pointer.y-head.y)*follow;
      points.forEach((point,i) => {
        const target = i ? points[i-1] : head;
        point.x += (target.x-point.x)*follow; point.y += (target.y-point.y)*follow;
      });
      if (!idle.on && performance.now()-lastMove > 2000) setIdle(true);
      try { draw(); } catch (_) { cleanup(); dispose = null; }
    }
    on(window,'pointermove',event => {
      if ((event.pointerType && event.pointerType !== 'mouse') || blocked || document.hidden) return;
      pointer.x=event.clientX; pointer.y=event.clientY; lastMove=performance.now(); setIdle(false);
      if (!pointer.active) {
        head.x=pointer.x; head.y=pointer.y;
        points.forEach(point => { point.x=pointer.x; point.y=pointer.y; });
        updateTone();
        try { draw(); } catch (_) { cleanup(); dispose=null; return; }
        pointer.active=true; layer.classList.add('is-visible'); root.classList.add('yuri-pointer-ready');
      }
      const target=event.target instanceof Element ? event.target.closest('a,button,[role="button"]') : null;
      setRing(Boolean(target && !isSelectedFilter(target)));
      requestTone(); requestText();
    }, { passive:true });
    on(window,'pointerdown',event => {
      if (!pointer.active || event.pointerType!=='mouse' || event.button!==0) return;
      lastMove=performance.now(); setIdle(false);
      gsap.to(press,{v:.7,duration:.1,ease:'power2.out',overwrite:true});
      if (text.on) setTextDrag(true);
      pressed=event.target instanceof Element ? event.target.closest('.yuri-magnet-target') : null;
      if (isSelectedFilter(pressed)) pressed=null;
      if (pressed) { gsap.killTweensOf(pressed,'--pop-sx,--pop-sy'); gsap.to(pressed,{'--pop-sx':.92,'--pop-sy':.92,duration:.1,ease:'power2.out'}); }
    });
    on(window,'pointerup',event => {
      if (event.pointerType!=='mouse') return;
      gsap.to(press,{v:1,duration:.55,ease:'elastic.out(1.2, 0.4)',overwrite:true});
      if (text.dragging) { setTextDrag(false); requestText(); }
      if (isSelectedFilter(pressed)) controlResets.get(pressed)?.();
      if (pressed) {
        const rest=rests.get(pressed)||1;
        gsap.killTweensOf(pressed,'--pop-sx,--pop-sy');
        const filter = pressed.matches(FILTER_TARGETS);
        if (filter && !pressed.matches(':hover')) rests.set(pressed,1);
        gsap.to(pressed,{'--pop-sx':rests.get(pressed)||rest,'--pop-sy':rests.get(pressed)||rest,duration:filter ? .3 : .6,ease:filter?'power3.out':'elastic.out(1.3, 0.35)',overwrite:'auto'}); pressed=null;
      }
    });
    on(window,'scroll',()=>{ requestTone(); if (text.on&&!text.dragging) setText(false); },{passive:true});
    on(window,'resize',size,{passive:true});
    on(document,'mouseleave',hide); on(window,'blur',hide);
    on(document,'visibilitychange',() => { if (document.hidden) hide(); });
    on(document,'keydown',event => { if (event.key === 'Tab') hide(); });

    const properties = ['--pop-sx','--pop-sy','--pull-x','--pull-y','--pointer-fill-text','--pointer-ring'];
    for (const btn of document.querySelectorAll(`${FILL_TARGETS},${LINK_TARGETS}`)) {
      // Giant work-wall titles and the decorative icon toggle are never button targets.
      if (btn.matches('.wall-cta,[data-pause-icons]')) continue;
      const original = properties.map(name => [name,btn.style.getPropertyValue(name),btn.style.getPropertyPriority(name)]);
      const fillable = btn.matches(FILL_TARGETS);
      const logo=!fillable;
      const filter=fillable && btn.matches(FILTER_TARGETS);
      const ownedClasses=['yuri-magnet-target','yuri-magnet-fillable','yuri-magnet-filter','yuri-magnet-filled','yuri-blue-fill'];
      const originalClasses=ownedClasses.map(name=>[name,btn.classList.contains(name)]);
      rests.set(btn,1);
      const fill = fillable ? document.createElement('span') : null;
      const mover = filter ? document.createElement('span') : null;
      if (mover) {
        mover.className='yuri-magnet-mover';
        const content=[...btn.childNodes];
        content.forEach(node=>mover.append(node));
        btn.append(mover);
        btn.classList.add('yuri-magnet-filter');
      }
      btn.classList.add('yuri-magnet-target');
      if (fill) { fill.className='yuri-magnet-fill'; fill.setAttribute('aria-hidden','true'); btn.prepend(fill); btn.classList.add('yuri-magnet-fillable'); }
      const reset = () => {
        rests.set(btn,1);
        if (pressed===btn) pressed=null;
        gsap.killTweensOf(btn,properties.join(','));
        gsap.set(btn,{'--pop-sx':1,'--pop-sy':1,'--pull-x':0,'--pull-y':0});
        if (fill) { gsap.killTweensOf(fill); gsap.set(fill,filter ? {scale:1,clipPath:'circle(0px at 50% 50%)'} : {scale:0}); }
        btn.classList.remove('yuri-magnet-filled','yuri-blue-fill');
      };
      controlResets.set(btn,reset);
      controls.push({reset,remove() {
        controlResets.delete(btn);
        reset(); fill?.remove();
        if (mover) mover.replaceWith(...mover.childNodes);
        originalClasses.forEach(([name,hadClass])=>btn.classList.toggle(name,hadClass));
        original.forEach(([name,value,priority]) => value ? btn.style.setProperty(name,value,priority) : btn.style.removeProperty(name));
      }});
      reset();
      on(btn,'pointerenter',event => {
        if (event.pointerType !== 'mouse' || blocked) return;
        if (isSelectedFilter(btn)) { reset(); setRing(false); return; }
        setRing(true); updateTone(); rests.set(btn,logo?1:1.06);
        if (fill) {
          const rect=btn.getBoundingClientRect(), rule=resolveCursorFill(btn);
          const x=event.clientX-rect.left,y=event.clientY-rect.top;
          btn.style.setProperty('--pointer-fill-text',rule.text);
          btn.style.setProperty('--pointer-ring','transparent');
          btn.classList.toggle('yuri-blue-fill',rule.hideBorder);
          btn.classList.add('yuri-magnet-filled'); gsap.killTweensOf(fill);
          if (filter) {
            const edge=parseFloat(getComputedStyle(btn).borderTopWidth)||0;
            gsap.set(fill,{left:0,top:0,width:'100%',height:'100%',x:0,y:0,xPercent:0,yPercent:0,scale:1,backgroundColor:rule.fill,clipPath:`circle(0px at ${x-edge}px ${y-edge}px)`});
            gsap.to(fill,{clipPath:`circle(${Math.ceil(Math.hypot(rect.width,rect.height))}px at ${x-edge}px ${y-edge}px)`,duration:.45,ease:'power3.out',overwrite:'auto'});
          } else {
            const size=2*Math.hypot(Math.max(x,rect.width-x),Math.max(y,rect.height-y));
            gsap.set(fill,{left:x,top:y,width:size,height:size,xPercent:-50,yPercent:-50,backgroundColor:rule.fill,scale:0});
            gsap.to(fill,{scale:1,duration:.45,ease:'power3.out'});
          }
        }
        gsap.killTweensOf(btn,'--pop-sx,--pop-sy');
        gsap.to(btn,{keyframes:logo?[
          {'--pop-sx':1.08,'--pop-sy':.9,duration:.09,ease:'power2.out'},
          {'--pop-sx':.97,'--pop-sy':1.05,duration:.1,ease:'sine.inOut'},
          {'--pop-sx':1,'--pop-sy':1,duration:.5,ease:'elastic.out(1.2, 0.4)'}
        ]:[
          {'--pop-sx':1.14,'--pop-sy':.8,duration:.09,ease:'power2.out'},
          {'--pop-sx':.95,'--pop-sy':1.12,duration:.11,ease:'sine.inOut'},
          {'--pop-sx':1.06,'--pop-sy':1.06,duration:.55,ease:'elastic.out(1.2, 0.35)'}
        ]});
      });
      on(btn,'pointermove',event => {
        if (event.pointerType !== 'mouse' || blocked || isSelectedFilter(btn)) return;
        const rect=btn.getBoundingClientRect();
        gsap.to(btn,{'--pull-x':gsap.utils.clamp(logo?-8:-12,logo?8:12,(event.clientX-rect.left-rect.width/2)*(logo ? .15 : .22)),'--pull-y':gsap.utils.clamp(logo?-5:-8,logo?5:8,(event.clientY-rect.top-rect.height/2)*(logo ? .15 : .22)),duration:.35,ease:'power3.out',overwrite:'auto'});
      });
      on(btn,'pointerleave',event => {
        setRing(false); rests.set(btn,1);
        if (isSelectedFilter(btn)) { reset(); return; }
        gsap.to(btn,{'--pull-x':0,'--pull-y':0,duration:filter ? .35 : .8,ease:filter?'power3.out':'elastic.out(1, 0.35)',overwrite:'auto'});
        if (fillable || pressed===btn) {
          gsap.killTweensOf(btn,'--pop-sx,--pop-sy');
          gsap.to(btn,{'--pop-sx':1,'--pop-sy':1,duration:filter ? .3 : .6,ease:filter?'power3.out':'elastic.out(1.2, 0.4)',overwrite:'auto'});
        }
        btn.classList.remove('yuri-magnet-filled');
        if (fill) {
          const rect=btn.getBoundingClientRect(), x=event.clientX-rect.left, y=event.clientY-rect.top;
          if (filter) {
            const edge=parseFloat(getComputedStyle(btn).borderTopWidth)||0;
            gsap.to(fill,{clipPath:`circle(0px at ${x-edge}px ${y-edge}px)`,duration:.3,ease:'power3.inOut',overwrite:'auto'});
          } else gsap.to(fill,{left:x,top:y,scale:0,duration:.32,ease:'power3.inOut',overwrite:'auto'});
        }
      });
    }
    function cleanup() {
      if (!alive) return;
      alive=false; abort.abort(); observer.disconnect(); gsap.ticker.remove(tick);
      cancelAnimationFrame(toneFrame); clearTimeout(textTimer); root.classList.remove('yuri-pointer-ready');
      gsap.killTweensOf([ring,press,idle,text]); controls.forEach(control=>control.remove()); layer.remove();
    }
    try { size(); draw(); } catch (_) { cleanup(); return null; }
    gsap.ticker.add(tick);
    return cleanup;
  }
  const suspend = () => { dispose?.(); dispose=null; };
  fine.addEventListener('change',sync); reduced.addEventListener('change',sync);
  window.addEventListener('pagehide',suspend); window.addEventListener('pageshow',sync);
  window.YuriPointerMotion = { refresh:sync, destroy() {
    destroyed=true; suspend(); fine.removeEventListener('change',sync); reduced.removeEventListener('change',sync);
    window.removeEventListener('pagehide',suspend); window.removeEventListener('pageshow',sync);
  }};
  sync();
})();
