/**
 * Chapter 6, Privacy: points burst out from the middle of the phone's screen, hit its edges and bounce back
 * in, each hit lighting the point mint for a moment, then slow to a rest inside. 4.6 seconds, once, when the
 * phone is mostly on screen (under WCAG 2.2.2's 5 seconds); Play it again replays it. Seeded, so every run
 * is the same. Under Reduce Motion the points are drawn already at rest.
 */
import { mulberry32 } from '@/three/head';
import { prefersReducedMotion } from '@/lib/motion';

const COUNT = 120;
const SECONDS = 4.6;

type P = { x: number; y: number; vx: number; vy: number; hit: number; r: number };

function setup() {
  const chapter = document.querySelector<HTMLElement>('[data-privacy-chapter]');
  const canvas = chapter?.querySelector<HTMLCanvasElement>('[data-pv-canvas]');
  if (!chapter || !canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const replay = chapter.querySelector<HTMLButtonElement>('[data-privacy-replay]')!;
  const styles = getComputedStyle(canvas);
  const ink = styles.getPropertyValue('--ink').trim() || '#ECF2EF';
  const mint = styles.getPropertyValue('--scan-tick-filled').trim() || '#8FE3CF';

  let w = 0, h = 0, pt = 1, dpr = 1;
  let points: P[] = [];
  const size = () => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width;
    h = r.height;
    pt = w / 440;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  };

  const seed = () => {
    const rand = mulberry32(611);
    points = Array.from({ length: COUNT }, () => {
      const a = rand() * Math.PI * 2;
      const speed = (260 + rand() * 360) * pt;
      return { x: w / 2 + Math.cos(a) * 20 * pt, y: h / 2 + Math.sin(a) * 20 * pt, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, hit: 0, r: (1.4 + rand() * 1.3) * pt };
    });
  };

  // The screen's inside edge, a little in from the glass.
  const inset = () => 14 * pt;

  const step = (dt: number) => {
    const m = inset();
    const damp = Math.exp(-0.72 * dt);
    for (const p of points) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < m) { p.x = m; p.vx = Math.abs(p.vx); p.hit = 1; }
      if (p.x > w - m) { p.x = w - m; p.vx = -Math.abs(p.vx); p.hit = 1; }
      if (p.y < m + 50 * pt) { p.y = m + 50 * pt; p.vy = Math.abs(p.vy); p.hit = 1; }
      if (p.y > h - m) { p.y = h - m; p.vy = -Math.abs(p.vy); p.hit = 1; }
      p.vx *= damp;
      p.vy *= damp;
      p.hit = Math.max(0, p.hit - dt * 2.2);
    }
  };

  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const p of points) {
      ctx.globalAlpha = 0.55 + 0.45 * p.hit;
      ctx.fillStyle = p.hit > 0.05 ? mint : ink;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (1 + 0.6 * p.hit), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  // At rest: the same run, played out without drawing.
  const settle = () => {
    seed();
    for (let t = 0; t < SECONDS; t += 1 / 60) step(1 / 60);
    for (const p of points) p.hit = 0;
    draw();
  };

  let raf = 0;
  const play = () => {
    played = true;
    cancelAnimationFrame(raf);
    replay.hidden = true;
    seed();
    let last = 0, t = 0;
    const frame = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      t += dt;
      step(dt);
      draw();
      if (t < SECONDS) raf = requestAnimationFrame(frame);
      else {
        raf = 0;
        replay.hidden = false;
      }
    };
    raf = requestAnimationFrame(frame);
  };

  size();
  let played = false;
  new ResizeObserver(() => {
    if (raf !== 0) return size();
    size();
    if (played || prefersReducedMotion()) settle();
    else {
      seed();
      draw();
    }
  }).observe(canvas);

  if (prefersReducedMotion()) {
    settle();
    return;
  }
  // Before it plays: gathered in the middle, where the burst starts.
  seed();
  draw();
  let started = false;
  const io = new IntersectionObserver((entries) => {
    if (!started && entries.some((e) => e.intersectionRatio >= 0.55)) {
      started = true;
      io.disconnect();
      play();
    }
  }, { threshold: [0, 0.55, 1] });
  io.observe(canvas);
  replay.addEventListener('click', play);
}

setup();
