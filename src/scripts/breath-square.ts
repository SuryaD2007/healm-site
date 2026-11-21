/**
 * <healm-breath-square>: Calm breath's square from the app (Healm/Features/Audio/SessionView.swift,
 * BreathSquare). A hairline square traced in ink once a round as it is breathed: in up the left side,
 * hold across the top, out down the right, hold across the bottom, 4 seconds each, one unbroken line
 * from the bottom left corner, with the phase's word under it. When the next round starts the finished
 * square fades out over 0.6 s on the reveal curve. It moves only after the visitor presses Breathe with
 * it; paused, it holds where it is. Under Reduce Motion each side lights whole and nothing travels.
 *
 * Markup (src/components/BreathSquare.astro): [data-trace], [data-fading], [data-word], [data-count],
 * [data-toggle].
 */
import { FrameLoop, prefersReducedMotion, reveal, tokenNumber } from '@/lib/motion';

const WORDS = ['Breathe in', 'Hold', 'Breathe out', 'Hold'] as const;

export class HealmBreathSquare extends HTMLElement {
  private loop?: FrameLoop;
  private reduced = false;
  private phase = 4;
  private fade = 0.6;
  private playing = false;
  private started = -1;
  private pausedAt = -1;
  private offset = 0;
  private lastSide = -1;
  private lastCount = -1;
  private trace?: SVGPolylineElement | null;
  private fading?: SVGPolygonElement | null;
  private word?: HTMLElement | null;
  private count?: HTMLElement | null;
  private toggle?: HTMLButtonElement | null;
  private corners: [number, number][] = [];

  connectedCallback() {
    if (this.loop) return;
    this.reduced = prefersReducedMotion();
    this.phase = tokenNumber('--dur-breath-phase', 4000) / 1000;
    this.fade = tokenNumber('--dur-breath-fade', 600) / 1000;
    this.trace = this.querySelector<SVGPolylineElement>('[data-trace]');
    this.fading = this.querySelector<SVGPolygonElement>('[data-fading]');
    this.word = this.querySelector<HTMLElement>('[data-word]');
    this.count = this.querySelector<HTMLElement>('[data-count]');
    this.toggle = this.querySelector<HTMLButtonElement>('[data-toggle]');

    // Corners in the order they are breathed: bottom left, top left, top right, bottom right.
    const size = Number(this.querySelector('svg')?.getAttribute('data-size') ?? 200);
    const inset = Number(this.querySelector('svg')?.getAttribute('data-inset') ?? 2);
    const lo = inset, hi = size - inset;
    this.corners = [[lo, hi], [lo, lo], [hi, lo], [hi, hi]];

    this.loop = new FrameLoop(this, (t) => this.frame(t));
    this.toggle?.addEventListener('click', () => (this.playing ? this.pause() : this.play()));
  }

  disconnectedCallback() {
    this.loop?.destroy();
  }

  play() {
    if (!this.loop) return;
    this.playing = true;
    if (this.started < 0) this.started = this.loop.time;
    if (this.pausedAt >= 0) {
      this.offset += this.loop.time - this.pausedAt;
      this.pausedAt = -1;
    }
    this.word?.setAttribute('aria-live', 'polite');
    this.setToggle(true);
    this.loop.start();
  }

  pause() {
    if (!this.loop) return;
    this.playing = false;
    this.pausedAt = this.loop.time;
    this.word?.removeAttribute('aria-live');
    this.setToggle(false);
    this.loop.stop();
  }

  private setToggle(on: boolean) {
    if (!this.toggle) return;
    // The label says what the button does next; no aria-pressed, which would read "Pause, pressed".
    const label = this.toggle.querySelector('[data-label]');
    if (label) label.textContent = on ? 'Pause' : (this.started >= 0 ? 'Keep breathing' : 'Breathe with it');
  }

  private frame(time: number): boolean {
    if (!this.playing) return false;
    const elapsed = time - this.started - this.offset;
    const round = this.phase * 4;
    const inRound = elapsed % round;
    const side = Math.floor(inRound / this.phase);
    const progress = this.reduced ? 1 : (inRound - side * this.phase) / this.phase;

    // The sides already breathed this round, then the one being breathed.
    const pts = [this.corners[0]];
    for (let i = 1; i <= side; i++) pts.push(this.corners[i]);
    const from = this.corners[side], to = this.corners[(side + 1) % 4];
    pts.push([from[0] + (to[0] - from[0]) * progress, from[1] + (to[1] - from[1]) * progress]);
    this.trace?.setAttribute('points', pts.map((p) => p.map((v) => v.toFixed(2)).join(',')).join(' '));

    // The round before, fading out on the reveal curve as this one starts.
    if (this.fading) {
      const f = elapsed >= round && inRound < this.fade ? 1 - reveal(inRound / this.fade) : 0;
      this.fading.setAttribute('opacity', f.toFixed(3));
    }

    if (side !== this.lastSide && this.word) {
      this.word.textContent = WORDS[side];
      this.lastSide = side;
    }
    const left = Math.max(1, Math.ceil(this.phase - (inRound - side * this.phase)));
    if (left !== this.lastCount && this.count) {
      this.count.textContent = String(left);
      this.lastCount = left;
    }
    return true;
  }
}

if (!customElements.get('healm-breath-square')) customElements.define('healm-breath-square', HealmBreathSquare);
