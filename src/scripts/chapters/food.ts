/**
 * Chapter 4, Food: "2 eggs and toast" types into the field and sends, "Looking up what you ate", the food
 * appears as a row, Log, then the row flies into the day's bars, which grow on the reveal curve, and the
 * food lands in Breakfast. About 4.3 seconds, once, when the phone is mostly on screen (under the 5 seconds
 * after which motion that starts by itself needs a pause, WCAG 2.2.2); Play it again replays it. Under
 * Reduce Motion the logged day shows and nothing plays.
 */
import { prefersReducedMotion, reveal } from '@/lib/motion';

const TEXT = '2 eggs and toast';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmt = new Intl.NumberFormat('en-US');

function setup() {
  const chapter = document.querySelector<HTMLElement>('[data-food-chapter]');
  const screen = chapter?.querySelector<HTMLElement>('[data-fd]');
  if (!chapter || !screen || prefersReducedMotion()) return;
  const typed = screen.querySelector<HTMLElement>('[data-fd-typed]')!;
  const send = screen.querySelector<HTMLElement>('[data-fd-send]')!;
  const card = screen.querySelector<HTMLElement>('[data-fd-card]')!;
  const log = screen.querySelector<HTMLElement>('[data-fd-log]')!;
  const replay = chapter.querySelector<HTMLButtonElement>('[data-food-replay]')!;
  const d = screen.dataset;
  const num = (k: string) => Number(d[k] ?? 0);
  const bars = (['kcal', 'protein'] as const).map((key) => {
    const el = screen.querySelector<HTMLElement>(`[data-fd-bar="${key}"]`)!;
    const before = num(key === 'kcal' ? 'beforeKcal' : 'beforeProtein');
    const add = num(key === 'kcal' ? 'kcal' : 'protein');
    const target = num(key === 'kcal' ? 'targetKcal' : 'targetProtein');
    return { el, before, add, target, value: el.querySelector<HTMLElement>('[data-fd-value]')!, fill: el.querySelector<HTMLElement>('[data-fd-fill]')! };
  });

  const setBars = (t: number) => {
    for (const b of bars) {
      const v = b.before + b.add * t;
      b.value.textContent = fmt.format(Math.round(v));
      b.fill.style.transform = `scaleX(${(v / b.target).toFixed(4)})`;
    }
  };
  // The numbers count with the bar, on the same 600 ms reveal curve.
  const growBars = () =>
    new Promise<void>((resolve) => {
      const start = performance.now();
      const frame = (now: number) => {
        const p = Math.min((now - start) / 600, 1);
        setBars(reveal(p));
        if (p < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });

  let run = 0;
  const reset = () => {
    screen.classList.remove('is-typing', 'is-looking', 'is-carded', 'is-logged');
    screen.classList.add('is-playing');
    typed.textContent = '';
    send.classList.remove('is-ready');
    card.style.transform = '';
    card.style.transition = '';
    card.style.opacity = '';
    log.textContent = 'Log';
    setBars(0);
  };

  const play = async () => {
    const id = ++run;
    const alive = () => id === run;
    reset();
    replay.hidden = true;
    await sleep(300);
    screen.classList.add('is-typing');
    for (let i = 0; i < TEXT.length; i++) {
      typed.textContent += TEXT[i];
      send.classList.add('is-ready');
      await sleep(TEXT[i] === ' ' ? 60 : 38 + ((i * 29) % 20));
      if (!alive()) return;
    }
    await sleep(220);
    screen.classList.remove('is-typing');
    typed.textContent = '';
    send.classList.remove('is-ready');
    screen.classList.add('is-looking');
    await sleep(650);
    if (!alive()) return;
    screen.classList.remove('is-looking');
    screen.classList.add('is-carded');
    await sleep(650);
    if (!alive()) return;
    // Log: the row goes down into the bars and fades as they take it.
    log.textContent = 'Logged';
    await sleep(200);
    const from = card.getBoundingClientRect();
    const to = bars[0].el.getBoundingClientRect();
    card.style.transition = 'transform 520ms var(--ease-move), opacity 520ms var(--ease-reveal)';
    card.style.transform = `translateY(${(to.top - from.top).toFixed(1)}px) scale(0.86)`;
    card.style.opacity = '0';
    await sleep(380);
    if (!alive()) return;
    await growBars();
    if (!alive()) return;
    screen.classList.add('is-logged');
    await sleep(250);
    screen.classList.remove('is-playing');
    replay.hidden = false;
  };

  // Ready to play: the day before this food, nothing typed.
  reset();
  let started = false;
  const io = new IntersectionObserver((entries) => {
    if (!started && entries.some((e) => e.intersectionRatio >= 0.55)) {
      started = true;
      io.disconnect();
      play();
    }
  }, { threshold: [0, 0.55, 1] });
  io.observe(screen);
  replay.addEventListener('click', () => play());
}

setup();
