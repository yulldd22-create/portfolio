/* The single-notebook scene: entry, scrub, automatic pan, and reversible exit. */
(() => {
  'use strict';
  const section = document.querySelector('[data-hero]');
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const core = window.YuriHeroScene;
  if (!section || !gsap || !ScrollTrigger || !core) return;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  const copy = section.querySelector('[data-hero-copy]');
  const title = copy?.querySelector('h1');
  const desc = copy?.querySelector('.hero-description');
  const cta = section.querySelector('[data-hero-cta]');
  const button = cta?.querySelector('a');
  const art = section.querySelector('[data-hero-art]');
  const fade = section.querySelector('[data-hero-fade]');
  if (!copy || !title || !desc || !cta || !button || !art || !fade) return;
  const originalTitle = title.innerHTML;
  const media = gsap.matchMedia();

  media.add({ mobile: '(max-width: 1024px)', desktop: '(min-width: 1025px)', reduced: '(prefers-reduced-motion: reduce)' }, context => {
    if (context.conditions.reduced) return;
    const mobile = context.conditions.mobile;
    let alive = true;
    let locked = false;
    let navigation = false;
    let drive = null;
    let driveForward = false;
    let atEnd = false;
    let pin = null;
    let scene = null;
    let ctaShown = false;
    let touchY = 0;
    let geometry;
    section.classList.add('is-motion-ready');
    document.documentElement.classList.add('hero-smooth-scroll');
    const measure = () => {
      geometry = core.geometry({ width: window.innerWidth, height: section.clientHeight, mockupHeight: art.offsetHeight, mockupTop: art.offsetTop,
        copyHeight: copy.offsetHeight, titleHeight: title.offsetHeight, descHeight: desc.offsetHeight,
        descMargin: parseFloat(getComputedStyle(desc).marginTop) || 0 });
      return geometry;
    };
    measure();
    const state = { copyY: 0, copyAlpha: 1, mockupY: 0, mockupAlpha: 1, ctaY: geometry.ctaStart, ctaAlpha: 0, fadeY: geometry.fadeHeight };
    const isEditable = target => target instanceof Element && Boolean(target.closest('input,textarea,select,[contenteditable="true"]'));

    const lenis = typeof window.Lenis === 'function' ? new window.Lenis({
      autoRaf: false, virtualScroll: () => !locked, duration: 1.35,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true, touchMultiplier: 1.35, wheelMultiplier: .82,
      prevent: node => node instanceof Element && Boolean(node.closest('dialog'))
    }) : null;
    const ticker = time => lenis?.raf(time * 1000);
    if (lenis) { lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add(ticker); gsap.ticker.lagSmoothing(0); }
    const scrollImmediately = y => {
      if (lenis) lenis.scrollTo(y, { immediate: true });
      else window.scrollTo({ top: y, behavior: 'instant' });
    };

    function popCta(show) {
      if (mobile || show === ctaShown) return;
      ctaShown = show;
      gsap.killTweensOf(button);
      if (!show) { gsap.to(button, { autoAlpha: 0, scale: .6, duration: .2, ease: 'back.in(2)' }); return; }
      gsap.set(button, { scaleX: .5, scaleY: .3 });
      gsap.to(button, { autoAlpha: 1, duration: .12 });
      gsap.to(button, { keyframes: [
        { scaleX: 1.14, scaleY: .78, duration: .14, ease: 'power2.out' },
        { scaleX: .93, scaleY: 1.12, duration: .14, ease: 'sine.inOut' },
        { scaleX: 1.03, scaleY: .97, duration: .12, ease: 'sine.inOut' },
        { scaleX: 1, scaleY: 1, duration: .3, ease: 'back.out(2)' }
      ] });
    }
    function paint() {
      gsap.set(copy, { xPercent: -50, yPercent: mobile ? -50 : 0, x: 0, y: state.copyY, autoAlpha: state.copyAlpha });
      gsap.set(art, { y: state.mockupY, autoAlpha: state.mockupAlpha });
      gsap.set(cta, { xPercent: -50, x: 0, y: state.ctaY, autoAlpha: 1 });
      gsap.set(fade, { y: state.fadeY });
      if (mobile) gsap.set(button, { autoAlpha: state.ctaAlpha });
      else if (scene) popCta(scene.progress() >= core.config.ctaThreshold);
    }
    gsap.set(button, { autoAlpha: 0, ...(mobile ? {} : { scale: .4, transformOrigin: '50% 100%' }) });
    scene = core.createTimeline(gsap, state, () => geometry, paint);
    scene.progress(0, true); paint();

    /* The first line arrives as a whole; the second is staggered by character. */
    const chars = [];
    title.setAttribute('aria-label', [...title.querySelectorAll('.hero-title-line')].map(line => line.textContent.trim()).join(' '));
    title.querySelectorAll('.hero-title-line').forEach((line, i) => {
      const value = line.textContent.trim();
      line.textContent = ''; line.setAttribute('aria-hidden', 'true');
      const parts = i ? Array.from(value) : [value];
      parts.forEach(part => {
        if (/^\s+$/.test(part)) { line.append(document.createTextNode(part)); return; }
        const span = document.createElement('span'); span.className = 'hero-title-char'; span.textContent = part;
        line.append(span); chars.push(span);
      });
    });
    const descLines = [...desc.querySelectorAll('.hero-description-line')];
    gsap.set(chars, { autoAlpha: 0, y: 60, scaleX: .7, scaleY: 1.3, transformOrigin: '50% 100%' });
    gsap.set(descLines, { autoAlpha: 0, y: 24, scale: .96, transformOrigin: '50% 100%' });
    const entry = gsap.timeline().to(chars, { keyframes: [
      { autoAlpha: 1, y: -8, scaleX: .92, scaleY: 1.12, duration: .22, ease: 'power2.out' },
      { y: 0, scaleX: 1.08, scaleY: .9, duration: .1, ease: 'sine.inOut' },
      { scaleX: 1, scaleY: 1, duration: .35, ease: 'back.out(3)' }
    ], stagger: .045 }, .15).to(descLines, { autoAlpha: 1, y: 0, scale: 1, duration: .5, ease: 'back.out(2)' }, '>-.3');

    function cancelDrive() { drive?.kill(); drive = null; locked = false; }
    function goTo(forward) {
      if (!pin) return;
      drive?.kill(); locked = true; driveForward = forward;
      const target = forward ? 1 : core.config.back;
      const cursor = { p: scene.progress(), y: window.scrollY };
      drive = gsap.to(cursor, { p: target, y: pin.start + (pin.end - pin.start) * target,
        duration: core.driveDuration(cursor.p, forward), ease: 'none',
        onUpdate() { scene.progress(cursor.p); scrollImmediately(cursor.y); },
        onComplete() { drive = null; atEnd = forward; locked = false; }
      });
    }
    const scrollKeys = { ArrowUp: -1, PageUp: -1, Home: -1, ArrowDown: 1, PageDown: 1, End: 1, ' ': 1, Spacebar: 1 };
    function input(event) {
      if (document.querySelector('dialog[open]')) return;
      if (event.type === 'touchstart') { touchY = event.touches[0].clientY; return; }
      if (navigation && ((event.type === 'wheel' && event.deltaY) || event.type === 'touchmove' || (event.type === 'keydown' && scrollKeys[event.key]))) navigation = false;
      if (!locked || isEditable(event.target)) return;
      if (event.type === 'keydown' && event.key === 'Escape') { cancelDrive(); return; }
      let direction = 0;
      if (event.type === 'wheel') direction = Math.sign(event.deltaY);
      if (event.type === 'touchmove') { const y = event.touches[0].clientY; direction = Math.sign(touchY - y); touchY = y; }
      if (event.type === 'keydown') {
        direction = scrollKeys[event.key] || 0;
        if (event.shiftKey && (event.key === ' ' || event.key === 'Spacebar')) direction *= -1;
        if (!direction) return;
      }
      if (event.cancelable) event.preventDefault();
      if (direction && drive && (direction > 0) !== driveForward) goTo(direction > 0);
    }
    if (mobile) {
      pin = ScrollTrigger.create({ trigger: section, start: 'top top', end: '+=120%', pin: true,
        animation: scene, scrub: .4, invalidateOnRefresh: true,
        onRefresh() { measure(); const p = scene.progress(); scene.invalidate(); scene.progress(p < 1 ? p + .001 : p - .001, true).progress(p, true); paint(); }
      });
    } else {
      pin = ScrollTrigger.create({ trigger: section, start: 'top top', end: '+=120%', pin: true, invalidateOnRefresh: true,
        onRefresh() {
          if (drive) return;
          measure(); const p = scene.progress(); scene.invalidate();
          scene.progress(p < 1 ? p + .001 : p - .001, true).progress(p, true); paint();
        },
        onUpdate(self) {
          if (drive) return;
          if (!pin) { atEnd = self.progress >= 1; scene.progress(self.progress); return; }
          if (navigation || self.progress <= 0 || self.progress >= 1) {
            atEnd = self.progress >= 1; scene.progress(self.progress); return;
          }
          if (self.direction > 0) {
            if (atEnd) return;
            if (self.progress >= core.config.intro) goTo(true);
            else scene.progress(self.progress);
          } else if (atEnd || scene.progress() > core.config.intro) goTo(false);
          else scene.progress(Math.min(core.config.intro, Math.max(0, self.progress)));
        }
      });
    }
    const spacer = section.parentElement;
    if (spacer?.classList.contains('pin-spacer')) spacer.style.backgroundColor = '#000';
    /* A restored tab can begin partway through the pin before `pin` is assigned. */
    if (!mobile && pin.progress > 0 && pin.progress < 1 && scene.progress() >= core.config.intro) goTo(true);
    const onAnchor = event => {
      const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const id = decodeURIComponent(link.hash.slice(1));
      const target = document.getElementById(id);
      if (!target || !lenis) return;
      event.preventDefault(); cancelDrive(); navigation = true;
      const finish = () => { navigation = false; };
      lenis.scrollTo(target, { duration: 1.35, offset: 0, onComplete: finish });
    };
    const refresh = () => { if (alive && !drive) ScrollTrigger.refresh(); };
    const onVisibility = () => { if (!document.hidden) refresh(); };
    window.addEventListener('wheel', input, { passive: false });
    window.addEventListener('touchstart', input, { passive: true });
    window.addEventListener('touchmove', input, { passive: false });
    window.addEventListener('keydown', input);
    window.addEventListener('load', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('click', onAnchor);
    document.fonts?.ready.then(refresh);
    return () => {
      alive = false; cancelDrive(); entry.kill(); pin?.kill(true); scene.kill();
      gsap.killTweensOf(button); gsap.ticker.remove(ticker); lenis?.destroy();
      window.removeEventListener('wheel', input); window.removeEventListener('touchstart', input);
      window.removeEventListener('touchmove', input); window.removeEventListener('keydown', input);
      window.removeEventListener('load', refresh); window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', onVisibility); document.removeEventListener('click', onAnchor);
      gsap.set([copy, cta, button, art, fade, ...descLines], { clearProps: 'all' });
      title.innerHTML = originalTitle; title.removeAttribute('aria-label');
      section.classList.remove('is-motion-ready'); document.documentElement.classList.remove('hero-smooth-scroll');
    };
  });
})();
