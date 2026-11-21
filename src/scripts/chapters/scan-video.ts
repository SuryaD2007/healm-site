/**
 * The phone's scan video in chapter 1 (ScanChapter.astro): the real face scan, looping.
 *
 * It plays only while it is shown: in the scroll sequence, once the phone has closed in (progress 0.86,
 * from the "scanprogress" event); in the plain layout, once it is mostly on screen. It stops off screen,
 * in a hidden tab, and when the visitor presses pause (it loops past 5 seconds, so it needs one: WCAG
 * 2.2.2). The file (150 KB) loads only as the phone gets near. Under Reduce Motion nothing here runs and
 * the still stays.
 */
import { prefersReducedMotion } from '@/lib/motion';

export function setupScanVideo(chapter: HTMLElement, { sequenced }: { sequenced: boolean }) {
  const video = chapter.querySelector<HTMLVideoElement>('[data-sc-video]');
  const toggle = chapter.querySelector<HTMLButtonElement>('[data-sc-video-toggle]');
  if (!video || !toggle || prefersReducedMotion()) return;

  video.hidden = false; // its poster is the loop's first frame, over the still
  let shown = !sequenced;
  let onScreen = false;
  let userPaused = false;

  const load = () => {
    if (video.preload !== 'auto') video.preload = 'auto';
  };
  const sync = () => {
    const play = shown && onScreen && !userPaused && document.visibilityState === 'visible';
    if (play && video.paused) {
      load();
      video.play().catch((error: DOMException) => {
        // Autoplay refused (Low Power Mode on iOS, for one): the poster stays, with play on the button.
        // An AbortError only means it was paused again before it started, which is not the visitor's call.
        if (error?.name !== 'NotAllowedError') return;
        userPaused = true;
        render();
      });
    } else if (!play && !video.paused) {
      video.pause();
    }
    toggle.hidden = !(shown && onScreen);
  };
  const render = () => {
    toggle.classList.toggle('is-paused', userPaused);
    const label = toggle.querySelector('[data-label]');
    if (label) label.textContent = userPaused ? 'Play the scan video' : 'Pause the scan video';
  };

  new IntersectionObserver((entries) => {
    onScreen = entries.some((e) => e.intersectionRatio >= 0.4);
    if (onScreen && !sequenced) load();
    sync();
  }, { threshold: [0, 0.4, 1] }).observe(video);

  if (sequenced) {
    chapter.addEventListener('scanprogress', (e) => {
      const p = (e as CustomEvent<number>).detail;
      if (p > 0.6) load();
      const next = p >= 0.86;
      if (next !== shown) {
        shown = next;
        sync();
      }
    });
  }
  document.addEventListener('visibilitychange', sync);
  toggle.addEventListener('click', () => {
    userPaused = !userPaused;
    render();
    sync();
  });
  render();
}
