/**
 * Chapter 7, Download: the ring fills clockwise as the chapter scrolls up, from when it enters the screen to
 * when the ring's middle is 60% of the way down it, and pulses once each time it closes. Scroll
 * drives it, so it moves only as fast as the visitor does; with sound on, the ticks click as they fill.
 * Under Reduce Motion the ring shows full, as a plain stroke, once it is on screen.
 */
import type { HealmScanRing } from '@/scripts/scan-ring';
import { prefersReducedMotion } from '@/lib/motion';
import { sound } from '@/scripts/sound';

function setup() {
  const chapter = document.querySelector<HTMLElement>('[data-download-chapter]');
  const ring = chapter?.querySelector<HealmScanRing>('healm-scan-ring');
  if (!chapter || !ring) return;

  if (prefersReducedMotion()) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        ring.setProgress(1);
      }
    });
    io.observe(ring);
    return;
  }

  let closed = false;
  let raf = 0;
  let near = false;
  const update = () => {
    raf = 0;
    const r = ring.getBoundingClientRect();
    const vh = window.innerHeight;
    const middle = r.top + r.height / 2;
    // 0 as the ring's middle comes up past the bottom of the screen, 1 a little below the middle, so the
    // ring is whole by the time the chapter is centred.
    const p = Math.min(Math.max((vh * 1.05 - middle) / (vh * 0.45), 0), 1);
    ring.setProgress(p);
    if (p >= 1 && !closed) {
      closed = true;
      ring.pulse();
      sound.complete();
    } else if (p < 0.9) {
      closed = false;
    }
  };
  const onScroll = () => {
    if (near && !raf) raf = requestAnimationFrame(update);
  };
  ring.addEventListener('ringtick', () => sound.tick());
  new IntersectionObserver((entries) => {
    near = entries.some((e) => e.isIntersecting);
    if (near) onScroll();
  }, { rootMargin: '20% 0px' }).observe(chapter);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
}

setup();
