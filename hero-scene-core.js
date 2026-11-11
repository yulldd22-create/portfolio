/* Viewport-normalized scene geometry and timeline; no DOM is required. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.YuriHeroScene = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const config = Object.freeze({ intro: .45, back: .41, ctaThreshold: .12, pinRatio: 1.2, forward: 1.3, backward: 1.1 });
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  function geometry(m) {
    const mobile = m.width <= 1024;
    const frame = mobile ? 812 : 1007;
    const fy = n => n / frame * m.height;
    const mobileScale = m.width > 767 ? 1 : clamp(1 + (m.width - 375) * .3 / 392, 1, 1.3);
    const copyStart = mobile ? (m.height - m.copyHeight) / 2 : fy(302);
    const copyMid = fy(mobile ? 155 : 159) - copyStart;
    const mockupStart = Number.isFinite(m.mockupTop) ? m.mockupTop : (mobile ? m.height : fy(788));
    const mockupMid = fy(mobile ? 323 : 458) - mockupStart;
    const mockupEnd = mobile ? mockupMid : (m.height - m.mockupHeight) / 2 - fy(23) - mockupStart;
    const copyEnd = mobile ? copyMid : copyMid + mockupEnd - mockupMid;
    const ctaBase = fy(mobile ? 685 : 638);
    const block = m.titleHeight + m.descHeight + m.descMargin;
    const ctaFromCopy = y => copyStart + y + block + 42 * mobileScale - ctaBase;
    return { mobile, copyStart, copyMid, copyEnd, mockupStart, mockupMid, mockupEnd,
      ctaBase, ctaStart: mobile ? 0 : ctaFromCopy(0), ctaMid: mobile ? 0 : ctaFromCopy(copyMid), ctaEnd: mobile ? 0 : fy(249),
      fadeHeight: mobile ? 0 : fy(520) };
  }
  function driveDuration(from, forward) {
    const target = forward ? 1 : config.back;
    return Math.max(.35, (forward ? config.forward : config.backward) * Math.abs(target - from) / (1 - config.back));
  }
  function createTimeline(gsap, state, getGeometry, update) {
    const mobile = getGeometry().mobile;
    const g = () => getGeometry();
    const t = gsap.timeline({ paused: true, onUpdate: update });
    t.fromTo(state, { copyY: 0, copyAlpha: 1 }, { copyY: () => g().copyMid, copyAlpha: 1, duration: .45, ease: 'none' }, 0)
      .fromTo(state, { mockupY: 0, mockupAlpha: 1 }, { mockupY: () => g().mockupMid, mockupAlpha: 1, duration: .45, ease: 'none' }, 0)
      .to(state, { copyY: () => g().copyEnd, duration: .55, ease: 'power3.inOut' }, .45)
      .to(state, { copyAlpha: mobile ? 1 : 0, duration: .3, ease: 'power1.in' }, .55)
      .to(state, { mockupY: () => g().mockupEnd, duration: .55, ease: 'power3.inOut' }, .45);
    if (mobile) t.fromTo(state, { ctaAlpha: 0 }, { ctaAlpha: 1, duration: .45, ease: 'none' }, 0);
    else t.fromTo(state, { ctaY: () => g().ctaStart }, { ctaY: () => g().ctaMid, duration: .45, ease: 'none' }, 0)
      .to(state, { ctaY: () => g().ctaEnd, duration: .55, ease: 'power3.inOut' }, .45);
    t.fromTo(state, { fadeY: () => g().fadeHeight }, { fadeY: 0, duration: .4, ease: 'power2.inOut' }, .6);
    return t;
  }
  return Object.freeze({ config, geometry, driveDuration, createTimeline });
});
