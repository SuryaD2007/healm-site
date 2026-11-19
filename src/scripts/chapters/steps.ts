/**
 * Chapter 3, Live steps: while the chapter is on screen, the Live Activity counts at a walking pace (about
 * 110 steps a minute, a little uneven, as a walk is). Each step rolls the digits that changed and pulses the
 * footstep dot; the walk's clock ticks each second; the line moves toward the goal. It stops off screen, in
 * a hidden tab, and on pause. Under Reduce Motion the numbers stand still and there is no pause button.
 */
import { prefersReducedMotion } from '@/lib/motion';

const GOAL = 10000;
const fmt = new Intl.NumberFormat('en-US');

function setup() {
  const chapter = document.querySelector<HTMLElement>('[data-steps-chapter]');
  if (!chapter) return;
  const $ = (sel: string) => chapter.querySelector<HTMLElement>(sel)!;
  const countEl = $('[data-la-count]');
  const dot = $('[data-la-dot]');
  const walkEl = $('[data-la-walk]');
  const milesEl = $('[data-la-miles]');
  const timeEl = $('[data-la-time]');
  const fill = $('[data-la-fill]');
  const pause = chapter.querySelector<HTMLButtonElement>('[data-demo-pause]')!;

  // Today's date on the lock screen, in the visitor's own format.
  const dateEl = chapter.querySelector<HTMLElement>('[data-lock-date]');
  if (dateEl) dateEl.textContent = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date()).replace(',', '');

  if (prefersReducedMotion()) return;

  let today = 8455;
  let walk = 21;
  let seconds = 33;
  let onScreen = false;
  let userPaused = false;
  let stepTimer = 0;
  let clockTimer = 0;
  let beat = 0;

  // The count as one span per character, so only the digits that change roll.
  const render = (el: HTMLElement, text: string) => {
    const old = el.textContent ?? '';
    if (el.children.length !== text.length) {
      el.replaceChildren(...[...text].map((c) => Object.assign(document.createElement('span'), { textContent: c })));
      return;
    }
    [...text].forEach((c, i) => {
      if (old[i] === c) return;
      const span = el.children[i] as HTMLElement;
      span.textContent = c;
      span.classList.remove('is-rolling');
      void span.offsetWidth;
      span.classList.add('is-rolling');
    });
  };

  const step = () => {
    today += 1;
    walk += 1;
    render(countEl, fmt.format(today));
    walkEl.textContent = String(walk);
    milesEl.textContent = (walk / 2000).toFixed(1);
    fill.style.transform = `scaleX(${Math.min(today / GOAL, 1).toFixed(4)})`;
    dot.classList.remove('is-pulsing');
    void dot.offsetWidth;
    dot.classList.add('is-pulsing');
    // About 110 a minute, with the slight unevenness of a real walk.
    beat = (beat + 1) % 6;
    stepTimer = window.setTimeout(step, [520, 560, 540, 580, 530, 550][beat]);
  };
  const tick = () => {
    seconds += 1;
    timeEl.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    clockTimer = window.setTimeout(tick, 1000);
  };

  const sync = () => {
    const run = onScreen && !userPaused && document.visibilityState === 'visible';
    const running = stepTimer !== 0;
    if (run && !running) {
      stepTimer = window.setTimeout(step, 400);
      clockTimer = window.setTimeout(tick, 1000);
    } else if (!run && running) {
      clearTimeout(stepTimer);
      clearTimeout(clockTimer);
      stepTimer = 0;
      clockTimer = 0;
    }
    pause.hidden = !onScreen;
  };

  render(countEl, fmt.format(today));
  new IntersectionObserver((entries) => {
    onScreen = entries.some((e) => e.intersectionRatio >= 0.4);
    sync();
  }, { threshold: [0, 0.4, 1] }).observe($('[data-lock]'));
  document.addEventListener('visibilitychange', sync);
  pause.addEventListener('click', () => {
    userPaused = !userPaused;
    pause.classList.toggle('is-paused', userPaused);
    pause.querySelector('[data-label]')!.textContent = userPaused ? 'Play the step count' : 'Pause the step count';
    sync();
  });
}

setup();
