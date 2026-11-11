/* Archive-only motion, using the reference's wheel response and text reveal. */
(() => {
  'use strict';
  if (!document.body?.classList.contains('portfolio-index-page')) return;
  window.YuriPortfolioScroll?.destroy();

  const root = document.documentElement;
  const intro = document.querySelector('.directory-intro');
  const titleBlock = intro?.querySelector('.directory-shell');
  const header = document.querySelector('[data-site-header]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let revealed = Boolean(intro?.classList.contains('is-directory-revealed'));
  let active = null;
  let suspended = false;
  let destroyed = false;
  let failed = false;

  const listen = (target, name, handler, options, removers) => {
    target.addEventListener(name, handler, options);
    removers.push(() => target.removeEventListener(name, handler, options));
  };
  const reveal = () => {
    revealed = true;
    intro?.classList.add('is-directory-revealed');
  };
  const visible = () => {
    intro?.classList.remove('directory-reveal-ready');
    reveal();
    header?.classList.remove('directory-header--hidden');
  };
  const stop = () => {
    active?.dispose();
    active = null;
  };

  function start(smooth) {
    let lenis = null;
    let rafId = 0;
    let observer = null;
    let alive = true;
    let burst = 0;
    let lastWheelAt = 0;
    let previousY = Math.max(0, window.scrollY || 0);
    let pendingAnchor = null;
    let anchorTimer = 0;
    let ownsScrollBehavior = false;
    const removers = [];
    const dialogs = [...document.querySelectorAll('dialog')];
    const oldBehavior = root.style.getPropertyValue('scroll-behavior');
    const oldPriority = root.style.getPropertyPriority('scroll-behavior');
    const showHeader = () => header?.classList.remove('directory-header--hidden');
    const dialogOpen = () => document.querySelector('dialog[open]');

    function dispose() {
      if (!alive) return;
      alive = false;
      cancelAnimationFrame(rafId);
      clearTimeout(anchorTimer);
      observer?.disconnect();
      removers.splice(0).forEach(remove => remove());
      pendingAnchor = null;
      try { lenis?.destroy(); } catch (_) { /* Keep native content usable. */ }
      if (ownsScrollBehavior) {
        if (oldBehavior) root.style.setProperty('scroll-behavior', oldBehavior, oldPriority);
        else root.style.removeProperty('scroll-behavior');
      }
      intro?.classList.remove('directory-reveal-ready');
      showHeader();
    }
    function fallback() {
      failed = true;
      dispose();
      if (active?.dispose === dispose) active = null;
      visible();
    }
    function adjustWheel(data) {
      if (!data.event?.type?.includes('wheel')) return;
      const now = Date.now();
      burst = now - lastWheelAt < 120 ? Math.min(burst + 1, 6) : 0;
      lastWheelAt = now;
      const distance = Math.abs(data.deltaY);
      if (distance <= 28) return;
      const repeated = burst >= 2;
      data.deltaY = (Math.sign(data.deltaY) || 1)
        * Math.min(28 + (distance - 28) * (repeated ? .08 : .18), repeated ? 46 : 60);
    }
    function frame(time) {
      if (!alive) return;
      try { lenis.raf(time); }
      catch (_) { fallback(); return; }
      rafId = requestAnimationFrame(frame);
    }
    function onScroll() {
      const y = Math.max(0, window.scrollY || 0);
      const focused = document.activeElement;
      const keyboardFocus = header?.contains(focused) && focused?.matches?.(':focus-visible');
      if (dialogOpen() || keyboardFocus) showHeader();
      else if (y > previousY && y > 10) header?.classList.add('directory-header--hidden');
      else if (y < previousY || y <= 10) showHeader();
      previousY = y;
    }
    function onFocus() {
      if (dialogOpen() || header?.contains(document.activeElement)) showHeader();
    }
    function followAnchor(anchor) {
      if (!alive) return;
      clearTimeout(anchorTimer);
      pendingAnchor = null;
      const { id, target, url } = anchor;
      const offset = id === 'top' ? 0 : (header?.getBoundingClientRect().height || 68) + 24;
      const y = id === 'top' ? 0 : Math.max(0, target.getBoundingClientRect().top + (window.scrollY || 0) - offset);
      try {
        if (window.location.hash !== url.hash) window.history.pushState(window.history.state, '', url.href);
        lenis.scrollTo(y, { duration: 1, easing: t => 1 - (1 - t) ** 4 });
      } catch (_) {
        fallback();
        window.scrollTo({ top: y, behavior: 'instant' });
      }
    }
    function onDialogClose() {
      showHeader();
      if (pendingAnchor && !dialogOpen()) followAnchor(pendingAnchor);
    }
    function onAnchor(event) {
      if (event.defaultPrevented || (event.button !== undefined && event.button !== 0)
        || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target?.closest?.('a[href]');
      if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      let url;
      let id;
      try {
        url = new URL(link.getAttribute('href'), window.location.href);
        id = decodeURIComponent(url.hash.slice(1));
      } catch (_) { return; }
      if (url.origin !== window.location.origin || url.pathname !== window.location.pathname
        || url.search !== window.location.search || !['portfolio-list', 'contact', 'top'].includes(id)) return;
      const target = document.getElementById(id);
      if (!target) return;
      event.preventDefault();
      const anchor = { id, target, url };
      const dialog = link.closest('dialog[open]');
      if (!dialog) { followAnchor(anchor); return; }
      pendingAnchor = anchor;
      clearTimeout(anchorTimer);
      // The native menu normally closes after its 350ms exit; tolerate a missing animation event.
      anchorTimer = setTimeout(() => {
        if (!alive || pendingAnchor !== anchor) return;
        try { if (dialog.open && typeof dialog.close === 'function') dialog.close(); }
        catch (_) { /* The native close event may already have completed. */ }
        if (pendingAnchor === anchor && !dialogOpen()) followAnchor(anchor);
      }, 500);
    }

    try {
      if (smooth) {
        lenis = new window.Lenis({
          duration: 1,
          easing: t => 1 - (1 - t) ** 4,
          wheelMultiplier: 1.5,
          smoothWheel: true,
          infinite: false,
          gestureOrientation: 'vertical',
          autoRaf: false,
          virtualScroll: adjustWheel,
          prevent: node => Boolean(node?.closest?.('dialog,.directory-filters'))
        });
        root.style.setProperty('scroll-behavior', 'auto');
        ownsScrollBehavior = true;
      }
      listen(window, 'scroll', onScroll, { passive: true }, removers);
      listen(document, 'focusin', onFocus, false, removers);
      if (smooth) listen(document, 'click', onAnchor, false, removers);
      dialogs.forEach(dialog => {
        listen(dialog, 'close', onDialogClose, false, removers);
        listen(dialog, 'toggle', onFocus, false, removers);
      });
      showHeader();

      if (smooth && intro && titleBlock && !revealed && typeof window.IntersectionObserver === 'function') {
        try {
          observer = new window.IntersectionObserver(entries => {
            if (!alive || !entries.some(entry => entry.target === titleBlock && entry.isIntersecting)) return;
            reveal();
            observer?.disconnect();
          }, { threshold: .5 });
          observer.observe(titleBlock);
          intro.classList.add('directory-reveal-ready');
        } catch (_) { observer?.disconnect(); reveal(); }
      } else reveal();

      if (smooth) rafId = requestAnimationFrame(frame);
      return { dispose, smooth };
    } catch (_) {
      dispose();
      failed = true;
      visible();
      return null;
    }
  }

  function sync() {
    if (destroyed || suspended) return;
    if (failed || reduced.matches) {
      stop();
      visible();
      return;
    }
    const smooth = window.innerWidth > 768 && typeof window.Lenis === 'function';
    if (active?.smooth === smooth) return;
    stop();
    active = start(smooth);
  }
  const suspend = () => { suspended = true; stop(); };
  const resume = () => { suspended = false; sync(); };
  const globalRemovers = [];
  listen(window, 'resize', sync, { passive: true }, globalRemovers);
  listen(window, 'pagehide', suspend, false, globalRemovers);
  listen(window, 'pageshow', resume, false, globalRemovers);
  if (typeof reduced.addEventListener === 'function') listen(reduced, 'change', sync, false, globalRemovers);
  else {
    reduced.addListener(sync);
    globalRemovers.push(() => reduced.removeListener(sync));
  }
  window.YuriPortfolioScroll = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      globalRemovers.splice(0).forEach(remove => remove());
      visible();
    }
  };
  sync();
})();
