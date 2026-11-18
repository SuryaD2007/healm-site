/**
 * <healm-scan-ring>: the skin scan's ring from the app, drawn in SVG.
 *
 * Geometry and timing follow Healm/Features/Skin/Scan/SkinScanView.swift (SkinRingView) and
 * Healm/Core/Scan/ScanEngine.swift (ScanRing, ScanPacing), through the tokens in src/styles/tokens.css:
 * 60 ticks 6° apart from the top, clockwise; a tick 12 long and 3 wide, 1.3x long once filled; a glow
 * capsule 2.5x wide and 1.6x long at 35% for 0.45 s, then fading on the reveal curve; the fill on the
 * tickFill spring; ticks shown at most 15 a second with a burst of 3; one pulse to 1.06 when done.
 * Under Reduce Motion the ticks are a plain progress stroke and nothing moves, as in the app.
 *
 * Attributes
 *   autoplay="visible"  play the fill once when it first comes on screen (otherwise call play())
 *   start-angle="200"   where the simulated head starts, in degrees clockwise from the top
 *   check               draw the app's checkmark when the ring completes
 *   label="..."         what VoiceOver reads (default "Scan ring"); decorative hides it instead
 *   decorative          hidden from assistive tech, because the page says the same thing in text
 *
 * Methods: play(), reset(), setProgress(0...1), pulse(). Events: "ringtick" (detail: tick index),
 * "ringcomplete".
 */
import { FrameLoop, prefersReducedMotion, reveal, tokenNumber, tokenSpring } from '@/lib/motion';

const SVG = 'http://www.w3.org/2000/svg';

// The app's face circle is at most 300 points; everything is drawn in those units and scaled by CSS.
const FACE = 300;
const VIEW = 400; // room for the ring, the glow and the 1.06 pulse

type TickState = { filled: boolean; at: number; glowAt: number; el: SVGRectElement; glow: SVGRectElement };

function parseHex(hex: string, fallback: [number, number, number]): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export class HealmScanRing extends HTMLElement {
  private ticks: TickState[] = [];
  private svg?: SVGSVGElement;
  private progressArc?: SVGCircleElement;
  private check?: SVGPathElement;
  private loop?: FrameLoop;
  private reduced = false;
  private queue: number[] = [];
  private budget = 0;
  private heading = -1;
  private sweepStart = -1;
  private completeAt = -1;
  private pulseAt = -1;
  private checkAt = -1;
  private played = false;
  private lastFrame = -1;
  private observer?: IntersectionObserver;

  // Tokens, read once on connect.
  private count = 60;
  private perSecond = 15;
  private burst = 3;
  private gap = 16;
  private len = 12;
  private width = 3;
  private filledLen = 1.3;
  private glowW = 2.5;
  private glowL = 1.6;
  private glowOpacity = 0.35;
  private glowHold = 0.45;
  private pulseScale = 1.06;
  private fill = tokenSpring('--spring-tick-fill', [0.28, 0.72]);
  private mint: [number, number, number] = [143, 227, 207];

  connectedCallback() {
    if (this.svg) return;
    this.reduced = prefersReducedMotion();
    this.count = tokenNumber('--ring-ticks', 60);
    this.perSecond = tokenNumber('--ring-ticks-per-second', 15);
    this.burst = tokenNumber('--ring-burst', 3);
    this.gap = tokenNumber('--ring-gap', 16);
    this.len = tokenNumber('--ring-tick-length', 12);
    this.width = tokenNumber('--ring-tick-width', 3);
    this.filledLen = tokenNumber('--ring-tick-filled-length', 1.3);
    this.glowW = tokenNumber('--ring-glow-width', 2.5);
    this.glowL = tokenNumber('--ring-glow-length', 1.6);
    this.glowOpacity = tokenNumber('--ring-glow-opacity', 0.35);
    this.glowHold = tokenNumber('--dur-tick-glow', 450) / 1000;
    this.pulseScale = tokenNumber('--ring-pulse-scale', 1.06);
    this.fill = tokenSpring('--spring-tick-fill', [0.28, 0.72]);
    this.mint = parseHex(getComputedStyle(document.documentElement).getPropertyValue('--scan-tick-filled'), this.mint);

    if (this.hasAttribute('decorative')) {
      this.setAttribute('aria-hidden', 'true');
    } else {
      this.setAttribute('role', 'img');
      this.setAttribute('aria-label', this.getAttribute('label') ?? 'Scan ring');
    }

    this.build();
    this.loop = new FrameLoop(this, (t) => this.frame(t));

    if (this.getAttribute('autoplay') === 'visible') {
      this.observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting) && !this.played) this.play();
      }, { threshold: 0.35 });
      this.observer.observe(this);
    }
  }

  disconnectedCallback() {
    this.loop?.destroy();
    this.observer?.disconnect();
  }

  private get radius() {
    return FACE / 2 + this.gap;
  }

  private build() {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', `${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.classList.add('ring-svg');

    const R = this.radius;
    if (this.reduced) {
      // SkinRingView under Reduce Motion: a track and a trimmed stroke, twice the tick width.
      const track = document.createElementNS(SVG, 'circle');
      track.setAttribute('r', String(R));
      track.setAttribute('fill', 'none');
      track.setAttribute('stroke', 'var(--scan-tick)');
      track.setAttribute('stroke-width', String(this.width * 2));
      const arc = document.createElementNS(SVG, 'circle');
      arc.setAttribute('r', String(R));
      arc.setAttribute('fill', 'none');
      arc.setAttribute('stroke', 'var(--scan-tick-filled)');
      arc.setAttribute('stroke-width', String(this.width * 2));
      arc.setAttribute('stroke-linecap', 'round');
      arc.setAttribute('pathLength', '1');
      arc.setAttribute('stroke-dasharray', '0 1');
      arc.setAttribute('transform', 'rotate(-90)');
      svg.append(track, arc);
      this.progressArc = arc;
    } else {
      for (let i = 0; i < this.count; i++) {
        const g = document.createElementNS(SVG, 'g');
        g.setAttribute('transform', `rotate(${(i * 360) / this.count})`);
        const glow = document.createElementNS(SVG, 'rect');
        const gw = this.width * this.glowW, gl = this.len * this.glowL;
        glow.setAttribute('x', String(-gw / 2));
        glow.setAttribute('y', String(-R - gl / 2));
        glow.setAttribute('width', String(gw));
        glow.setAttribute('height', String(gl));
        glow.setAttribute('rx', String(gw / 2));
        glow.setAttribute('fill', 'var(--scan-tick-filled)');
        glow.setAttribute('opacity', '0');
        const tick = document.createElementNS(SVG, 'rect');
        tick.setAttribute('x', String(-this.width / 2));
        tick.setAttribute('width', String(this.width));
        tick.setAttribute('rx', String(this.width / 2));
        g.append(glow, tick);
        svg.append(g);
        this.ticks.push({ filled: false, at: -1, glowAt: -1, el: tick, glow });
        this.drawTick(i, 0);
      }
    }

    if (this.hasAttribute('check')) {
      // SkinCheckmark: one stroke, 0.32 of the face, over a scrim on the face.
      const size = FACE * 0.32;
      const x0 = -size / 2, y0 = -size / 2;
      const p = document.createElementNS(SVG, 'path');
      p.setAttribute('d', `M ${x0} ${y0 + size * 0.55} L ${x0 + size * 0.38} ${y0 + size * 0.88} L ${x0 + size} ${y0 + size * 0.12}`);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', 'var(--scan-tick-filled)');
      p.setAttribute('stroke-width', String(this.width * 2));
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      p.setAttribute('pathLength', '1');
      p.setAttribute('stroke-dasharray', '0 1');
      svg.append(p);
      this.check = p;
    }

    this.svg = svg;
    this.append(svg);
  }

  /** Draws one tick at the loop's time: its length and color on the fill spring, and its glow. */
  private drawTick(i: number, time: number): boolean {
    const t = this.ticks[i];
    const s = t.filled ? this.fill.value(time - t.at) : 0;
    const h = this.len * (1 + (this.filledLen - 1) * s);
    t.el.setAttribute('height', h.toFixed(2));
    t.el.setAttribute('y', (-this.radius - h / 2).toFixed(2));
    const c = Math.min(Math.max(s, 0), 1);
    const [r, g, b] = this.mint;
    const mix = (from: number, to: number) => Math.round(from + (to - from) * c);
    t.el.setAttribute('fill', `rgb(${mix(255, r)} ${mix(255, g)} ${mix(255, b)} / ${(0.24 + 0.76 * c).toFixed(3)})`);

    let glow = 0;
    if (t.glowAt >= 0) {
      const since = time - t.glowAt;
      glow = since < this.glowHold ? this.glowOpacity : this.glowOpacity * (1 - reveal((since - this.glowHold) / this.glowHold));
      if (since > this.glowHold * 2) t.glowAt = -1;
    }
    t.glow.setAttribute('opacity', glow.toFixed(3));
    // Still moving while the spring settles or the glow fades.
    return (t.filled && time - t.at < this.fill.duration) || t.glowAt >= 0;
  }

  private show(i: number, time: number) {
    const t = this.ticks[i];
    if (!t || t.filled) return;
    t.filled = true;
    t.at = time;
    t.glowAt = time;
    this.dispatchEvent(new CustomEvent('ringtick', { detail: i }));
  }

  private get filledCount() {
    return this.reduced ? Math.round(this.reducedFraction * this.count) : this.ticks.filter((t) => t.filled).length;
  }

  private reducedFraction = 0;

  /** Fills the ring as the app does while the head turns once around, then pulses. */
  play() {
    this.played = true;
    if (this.reduced) {
      this.setReducedFraction(1);
      this.finish();
      return;
    }
    this.reset();
    const time = this.loop!.time;
    this.sweepStart = time;
    this.heading = Number(this.getAttribute('start-angle') ?? 0);
    this.budget = this.burst;
    this.loop!.start();
  }

  reset() {
    this.lastFrame = -1;
    this.queue = [];
    this.sweepStart = -1;
    this.completeAt = -1;
    this.pulseAt = -1;
    this.checkAt = -1;
    this.style.transform = '';
    this.check?.setAttribute('stroke-dasharray', '0 1');
    if (this.reduced) {
      this.setReducedFraction(0);
      return;
    }
    this.ticks.forEach((t, i) => {
      t.filled = false;
      t.at = -1;
      t.glowAt = -1;
      this.drawTick(i, 0);
    });
  }

  /** Fills ticks up to a share of the ring, clockwise from the top, each on its spring. For scroll. */
  setProgress(p: number) {
    const target = Math.round(Math.min(Math.max(p, 0), 1) * this.count);
    if (this.reduced) {
      this.setReducedFraction(target / this.count);
      return;
    }
    const time = this.loop!.time;
    this.ticks.forEach((t, i) => {
      if (i < target && !t.filled) this.show(i, time);
      if (i >= target && t.filled) {
        t.filled = false;
        t.glowAt = -1;
      }
    });
    this.loop!.start();
    if (target === this.count && this.completeAt < 0) this.finish();
  }

  /** HealmMotion.ringPulse: out to 1.06 on the reveal curve, back from 0.25 s. */
  pulse() {
    if (this.reduced) return;
    this.pulseAt = this.loop!.time;
    this.loop!.start();
  }

  private setReducedFraction(f: number) {
    this.reducedFraction = f;
    this.progressArc?.setAttribute('stroke-dasharray', `${f} 1`);
  }

  private finish() {
    this.completeAt = this.loop ? this.loop.time : 0;
    this.dispatchEvent(new CustomEvent('ringcomplete'));
    if (this.reduced) {
      this.check?.setAttribute('stroke-dasharray', '1 0');
      return;
    }
    this.pulse();
    if (this.check) this.checkAt = this.completeAt + 0.1;
  }

  private frame(time: number): boolean {
    let moving = false;

    // The simulated head: one turn around in 3.6 s on the move curve. It fills every tick within 20°
    // of where it points, and those join the pacer's queue in the order the head reached them.
    if (this.sweepStart >= 0) {
      const p = Math.min((time - this.sweepStart) / 3.6, 1);
      const start = Number(this.getAttribute('start-angle') ?? 0);
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      this.heading = start + 360 * eased;
      for (let i = 0; i < this.count; i++) {
        const a = (i * 360) / this.count;
        let d = Math.abs(a - (this.heading % 360)) % 360;
        if (d > 180) d = 360 - d;
        if (d <= 20 && !this.ticks[i].filled && !this.queue.includes(i)) this.queue.push(i);
      }
      // A head that stopped short still leaves gaps; the end of the turn sweeps them up.
      if (p >= 1) {
        for (let i = 0; i < this.count; i++) if (!this.ticks[i].filled && !this.queue.includes(i)) this.queue.push(i);
        this.sweepStart = -1;
      }
      moving = true;
    }

    // ScanTickPacer: at most 15 a second, a burst of 3 after a wait.
    const dt = this.lastFrame >= 0 ? Math.max(time - this.lastFrame, 0) : 1 / 60;
    this.lastFrame = time;
    if (this.queue.length) {
      this.budget = Math.min(this.budget + this.perSecond * dt, this.burst);
      while (this.budget >= 1 && this.queue.length) {
        this.show(this.queue.shift()!, time);
        this.budget -= 1;
      }
      moving = true;
      if (!this.queue.length && this.sweepStart < 0 && this.filledCount === this.count && this.completeAt < 0) {
        this.finish();
      }
    }

    for (let i = 0; i < this.ticks.length; i++) if (this.drawTick(i, time)) moving = true;

    if (this.pulseAt >= 0) {
      const since = time - this.pulseAt;
      const amp = this.pulseScale - 1;
      let s: number;
      if (since < 0.25) s = amp * reveal(since / 0.5);
      else s = amp * reveal(0.5) * (1 - reveal((since - 0.25) / 0.5));
      this.style.transform = `scale(${(1 + Math.max(s, 0)).toFixed(4)})`;
      if (since >= 0.75) {
        this.style.transform = '';
        this.pulseAt = -1;
      } else moving = true;
    }

    if (this.checkAt >= 0 && this.check) {
      const p = reveal(Math.max(time - this.checkAt, 0) / 0.45);
      this.check.setAttribute('stroke-dasharray', `${p.toFixed(3)} 1`);
      if (p >= 1) this.checkAt = -1;
      else moving = true;
    }

    return moving;
  }
}

if (!customElements.get('healm-scan-ring')) customElements.define('healm-scan-ring', HealmScanRing);
