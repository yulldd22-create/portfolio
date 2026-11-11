/* Progressive enhancement: the full document and native details work without JavaScript. */
(() => {
  'use strict';

  const navLinks = document.body.classList.contains('home-page')
    ? [...document.querySelectorAll('.site-nav a[href^="#"]')]
    : [];
  const navTargets = navLinks.map(link => {
    const id = decodeURIComponent(link.hash.slice(1));
    return { link, section: id === 'top' ? document.querySelector('[data-hero]') : id ? document.getElementById(id) : null };
  }).filter(item => item.section);

  const setCurrent = current => {
    for (const { link } of navTargets) {
      if (link === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  };
  if ('IntersectionObserver' in window && navTargets.length) {
    const visible = new Set();
    const navObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      const current = navTargets.find(item => visible.has(item.section));
      if (current) setCurrent(current.link);
    }, { rootMargin: '-15% 0px -55% 0px', threshold: 0 });
    navTargets.forEach(({ section }) => navObserver.observe(section));
  }
  navTargets.forEach(({ link }) => link.addEventListener('click', () => setCurrent(link)));

  document.querySelectorAll('[data-work-filters]').forEach(group => {
    const buttons = [...group.querySelectorAll('[data-work-filter]')];
    const scope = group.dataset.workTarget
      ? document.getElementById(group.dataset.workTarget)
      : document;
    const cards = scope ? [...scope.querySelectorAll('[data-work-category]')] : [];
    const status = document.querySelector('[data-filter-status]');
    if (!buttons.length || !cards.length) return;
    const filter = value => {
      let count = 0;
      cards.forEach(card => {
        const categories = card.dataset.workCategory.split(/\s+/);
        card.hidden = value !== 'all' && !categories.includes(value);
        if (!card.hidden) count++;
      });
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.workFilter === value)));
      if (status) status.textContent = `${count}개의 작업`;
    };
    buttons.forEach(button => button.addEventListener('click', () => filter(button.dataset.workFilter)));
    filter(buttons.find(button => button.getAttribute('aria-pressed') === 'true')?.dataset.workFilter || 'all');
    group.hidden = false;
  });

  const imageTriggers = [...document.querySelectorAll('[data-lightbox-src]')];
  if (imageTriggers.length && typeof HTMLDialogElement !== 'undefined' && 'showModal' in HTMLDialogElement.prototype) {
    const dialog = document.createElement('dialog');
    dialog.className = 'lightbox';
    dialog.setAttribute('aria-label', '작업 이미지 크게 보기');
    const panel = document.createElement('div');
    panel.className = 'lightbox-panel';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'lightbox-close';
    close.setAttribute('aria-label', '이미지 닫기');
    close.textContent = '×';
    const image = document.createElement('img');
    image.className = 'lightbox-image';
    const caption = document.createElement('p');
    caption.className = 'lightbox-caption';
    panel.append(image, caption);
    dialog.append(close, panel);
    document.body.append(dialog);
    let trigger = null;
    imageTriggers.forEach(button => {
      button.setAttribute('aria-haspopup', 'dialog');
      button.addEventListener('click', event => {
        event.preventDefault();
        trigger = button;
        image.src = button.dataset.lightboxSrc;
        image.alt = button.dataset.lightboxAlt || button.querySelector('img')?.alt || '';
        caption.textContent = button.dataset.lightboxCaption || image.alt;
        dialog.showModal();
        document.body.classList.add('lightbox-open');
        dialog.scrollTop = 0;
        close.focus();
      });
    });
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = panel.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      document.body.classList.remove('lightbox-open');
      image.removeAttribute('src');
      trigger?.focus();
    });
  }
})();
