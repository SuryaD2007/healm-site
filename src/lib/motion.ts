/**
 * Healm's motion on the web: the curves and springs of Healm/Core/Design/HealmMotion.swift, read from
 * the CSS tokens (src/styles/tokens.css) so there is one source of numbers.
 */

/** A CSS cubic-bezier as a function of progress 0...1, solved by Newton's method with a bisection fallback. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-6) return t;
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0, hi = 1;
    t = x;
    while (lo < hi) {
      const v = sampleX(t);
      if (Math.abs(v - x) < 1e-6) return t;
      if (x > v) lo = t; else hi = t;
      t = (lo + hi) / 2;
      if (hi - lo < 1e-7) break;
    }
    return t;
  };
  return (p: number) => (p <= 0 ? 0 : p >= 1 ? 1 : sampleY(solve(p)));
}

/** HealmMotion.reveal's curve: a strong ease-out. */
export const reveal = cubicBezier(0.23, 1, 0.32, 1);
/** HealmMotion.move's curve: a strong ease-in-out. */
export const move = cubicBezier(0.77, 0, 0.175, 1);

/**
 * A SwiftUI spring(response:dampingFraction:) from rest at 0 to 1, as a function of seconds.
 * Mass 1, stiffness (2π / response)², damping 4π · dampingFraction / response.
 */
export function spring(response: number, dampingFraction: number) {
  const w0 = (2 * Math.PI) / response;
  const z = dampingFraction;
  const settle = -Math.log(0.001) / (z * w0);
  const value = (t: number): number => {
    if (t <= 0) return 0;
    if (z < 1) {
      const wd = w0 * Math.sqrt(1 - z * z);
      return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
    }
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  };
  return { value, duration: settle };
}

/** Reads a token from :root, such as "--ring-ticks", as a number (the first number in it). */
export function tokenNumber(name: string, fallback: number): number {
  if (typeof document === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Reads a spring token, such as "--spring-tick-fill" ("0.28 0.72"). */
export function tokenSpring(name: string, fallback: [number, number]) {
  if (typeof document === 'undefined') return spring(...fallback);
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim().split(/\s+/).map(parseFloat);
  const [r, d] = raw.length === 2 && raw.every(Number.isFinite) ? raw : fallback;
  return spring(r, d);
}

export const prefersReducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Runs a frame loop only while the element is on screen and the tab is visible. Every animation on
 * the site goes through this, so nothing burns a battery off screen.
 */
export class FrameLoop {
  private raf = 0;
  private visible = false;
  private running = false;
  private observer?: IntersectionObserver;
  private onVisibility = () => this.sync();
  private last = 0;
  /** Seconds this loop has run. It stops while paused, so an animation resumes where it was. */
  time = 0;

  /** `tick` gets the loop's own clock in seconds. Return false to stop. */
  constructor(private el: Element, private tick: (time: number) => boolean | void) {}

  start() {
    this.running = true;
    if (!this.observer) {
      this.observer = new IntersectionObserver((entries) => {
        this.visible = entries.some((e) => e.isIntersecting);
        this.sync();
      });
      this.observer.observe(this.el);
      document.addEventListener('visibilitychange', this.onVisibility);
    }
    this.sync();
  }

  stop() {
    this.running = false;
    this.sync();
  }

  destroy() {
    this.stop();
    this.observer?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  get active() {
    return this.raf !== 0;
  }

  private sync() {
    const should = this.running && this.visible && document.visibilityState === 'visible';
    if (should && !this.raf) {
      const loop = (now: number) => {
        // A long frame (a busy main thread) counts as at most 64 ms, so nothing leaps.
        const dt = this.last ? Math.min(now - this.last, 64) : 16;
        this.last = now;
        this.time += dt / 1000;
        const keep = this.tick(this.time);
        if (keep === false) {
          this.raf = 0;
          this.last = 0;
          this.running = false;
          return;
        }
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    } else if (!should && this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.last = 0;
    }
  }
}
