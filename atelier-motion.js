/* Native scrolling only. Every effect starts from visible, readable HTML. */
(() => {
  'use strict';

  const init = () => {
    const root = document.documentElement;
    const header = document.querySelector('[data-site-header]');
    const progressLines = [...document.querySelectorAll('[data-scroll-progress]')];
    const themed = [...document.querySelectorAll('[data-header-theme]')]
      .filter(node => ['dark', 'light'].includes(node.dataset.headerTheme));
    const chapters = [...document.querySelectorAll('[data-chapter]')];
    const measured = [...new Set([...themed, ...chapters])];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const clamp = value => Math.min(1, Math.max(0, value));
    let frame = 0;
    let previousProgress = '';
    let activeChapter = null;
    let previousTone = '';

    const render = () => {
      frame = 0;
      const scrollY = Math.max(0, window.scrollY || 0);
      const height = window.innerHeight || root.clientHeight;
      const range = Math.max(0, root.scrollHeight - height);
      const pageProgress = (range ? clamp(scrollY / range) : 0).toFixed(4);
      const rectangles = new Map(measured.map(node => [node, node.getBoundingClientRect()]));
      const headerRect = header?.getBoundingClientRect();
      let nextTheme = null, headerTone = 1;
      if (headerRect && headerRect.height > 0) {
        let covered = 0, sum = 0;
        for (const node of themed) {
          const rect = rectangles.get(node);
          let overlap = Math.min(headerRect.bottom, rect.bottom) - Math.max(headerRect.top, rect.top);
          if (overlap <= 0 || !rect.height) continue;
          overlap = Math.min(overlap, headerRect.height - covered);
          covered += overlap;
          sum += (node.dataset.headerTheme === 'light' ? 1 : 0) * overlap;
          if (covered >= headerRect.height) break;
        }
        headerTone = clamp((sum + headerRect.height - covered) / headerRect.height);
        nextTheme = headerTone < .5 ? 'dark' : 'light';
      }

      const chapterY = height * 0.45;
      let nextChapter = null;
      for (const chapter of chapters) {
        const rect = rectangles.get(chapter);
        if (rect.top <= chapterY && rect.bottom > chapterY) nextChapter = chapter;
      }

      /* Write only after all layout reads, once per animation frame. */
      if (pageProgress !== previousProgress) {
        root.style.setProperty('--scroll-progress', pageProgress);
        progressLines.forEach(line => line.style.setProperty('--scroll-progress', pageProgress));
        previousProgress = pageProgress;
      }
      if (header && nextTheme && header.dataset.theme !== nextTheme) header.dataset.theme = nextTheme;
      const tone = headerTone.toFixed(3);
      if (header && tone !== previousTone) { header.style.setProperty('--header-tone', tone); previousTone = tone; }
      if (nextChapter !== activeChapter) {
        activeChapter?.classList.remove('is-active');
        nextChapter?.classList.add('is-active');
        activeChapter = nextChapter;
      }
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(render);
    };

    if ('IntersectionObserver' in window) {
      const reveals = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          if (!reduced.matches) entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.06, rootMargin: '0px 0px -24px 0px' });
      document.querySelectorAll('[data-reveal]').forEach(node => reveals.observe(node));
    }

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule, { passive: true });
    window.addEventListener('pageshow', schedule);
    document.addEventListener('load', schedule, true);
    if (reduced.addEventListener) reduced.addEventListener('change', schedule);
    else if (reduced.addListener) reduced.addListener(schedule);
    if ('ResizeObserver' in window && document.body) {
      const resizeObserver = new ResizeObserver(schedule);
      resizeObserver.observe(document.body);
    }
    document.fonts?.ready.then(schedule);
    schedule();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
