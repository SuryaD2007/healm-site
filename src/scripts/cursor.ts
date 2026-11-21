/**
 * The cursor: a small ink dot that becomes a little scan ring over anything you can click, its ticks
 * filling clockwise in mint like the app's ring. Desktop only (a fine pointer), never under Reduce Motion,
 * More Contrast or Forced Colors, and the system cursor comes back over text fields.
 */
const TICKS = 24;
const INTERACTIVE = 'a[href], button:not(:disabled), [role="button"], summary, label[for], select, [data-cursor="ring"]';
const TEXT = 'input:not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]), textarea, [contenteditable="true"]';

export function startCursor() {
  const ok =
    matchMedia('(pointer: fine) and (hover: hover)').matches &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches &&
    !matchMedia('(prefers-contrast: more)').matches &&
    !matchMedia('(forced-colors: active)').matches;
  if (!ok || document.querySelector('.cursor')) return;

  const el = document.createElement('div');
  el.className = 'cursor';
  el.setAttribute('aria-hidden', 'true');
  const ticks = Array.from({ length: TICKS }, (_, i) => {
    const a = (i * 360) / TICKS;
    return `<rect class="cursor-tick" x="-0.75" y="-15.5" width="1.5" height="4.5" rx="0.75" transform="rotate(${a})" style="--i:${i}"/>`;
  }).join('');
  el.innerHTML = `<svg viewBox="-18 -18 36 36" width="36" height="36"><circle class="cursor-dot" r="3"/>${ticks}</svg>`;
  document.body.append(el);
  document.documentElement.classList.add('has-cursor');

  let x = -100, y = -100, raf = 0;
  const place = () => {
    raf = 0;
    el.style.transform = `translate3d(${x - 18}px, ${y - 18}px, 0)`;
  };
  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      el.classList.add('is-visible');
      if (!raf) raf = requestAnimationFrame(place);
    },
    { passive: true },
  );
  document.addEventListener('pointerleave', () => el.classList.remove('is-visible'));
  window.addEventListener('blur', () => el.classList.remove('is-visible'));

  let lastScope: Element | null = null;
  document.addEventListener('pointerover', (e) => {
    const target = e.target as Element | null;
    el.classList.toggle('is-ring', !!target?.closest(INTERACTIVE));
    el.classList.toggle('is-text', !!target?.closest(TEXT));
    // Take the ink of the section underneath. Mint is only for dark grounds (1.49:1 on white), so on a
    // light section the ticks fill in ink instead.
    if (target && target !== lastScope) {
      lastScope = target;
      const style = getComputedStyle(target);
      const ink = style.getPropertyValue('--ink').trim();
      const light = style.getPropertyValue('--ground').trim().toLowerCase() === '#ffffff';
      el.style.setProperty('--cursor-ink', ink || '#ECF2EF');
      el.style.setProperty('--cursor-tick', light ? ink : 'var(--scan-tick-filled)');
    }
  });
  document.addEventListener('pointerdown', () => el.classList.add('is-down'));
  document.addEventListener('pointerup', () => el.classList.remove('is-down'));
}
