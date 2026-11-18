/**
 * The hero's scan: the visitor does it, like the app's face scan.
 *
 * One heading (where the head points, in degrees right and up) on one critically damped spring, fed by
 * whichever input is in charge:
 *   - pointer: the cursor's direction from the middle of the ring, up to 24 degrees at the ring's edge;
 *   - keys:    the arrow keys while the stage has focus, 22 degrees each way;
 *   - auto:    the head turns once around by itself (phones, and the Auto scan button);
 *   - demo:    after 8 seconds without a mouse move, the head turns through a third of the ring, once.
 * Every frame, the app's fill rule (src/lib/scan.ts) turns the heading into ticks for the ring, which
 * paces them at 15 a second and completes at 85%. The head (if the 3D scene is running) turns to the same
 * heading, and its scan lines light where the ring fills.
 */
import { FrameLoop } from '@/lib/motion';
import { COMPLETE_COUNT, HeadingSpring, autoHeading, demoHeading, ticksFor, type Heading } from '@/lib/scan';
import type { HealmScanRing } from '@/scripts/scan-ring';
import type { SceneHandle } from '@/three/HeadScene';
import { sound } from '@/scripts/sound';

type Mode = 'idle' | 'pointer' | 'keys' | 'auto' | 'demo' | 'done';

/** How far the head turns with the cursor at the ring's edge, and with an arrow key held. */
const POINTER_TURN = 24;
const KEY_TURN = 22;
/** No mouse movement for this long: the demo plays once. */
const DEMO_AFTER_MS = 8000;
/** The ring's radius as a share of the stage's width (SkinRingView: 166 of 400). */
const RING_RADIUS = 166 / 400;

const HINT = 'Move your cursor around the ring to scan.';

export interface HeroScanElements {
  hero: HTMLElement;
  stage: HTMLElement;
  ring: HealmScanRing;
  /** The visible line under the ring: the hint, then "Scan complete". */
  status: HTMLElement;
  /** A visually hidden live region for screen readers. */
  live: HTMLElement;
  autoButton: HTMLButtonElement;
  againButton: HTMLButtonElement;
  cta: HTMLElement | null;
}

export class HeroScan {
  scene: SceneHandle | null = null;
  private els: HeroScanElements;
  private mouse: boolean;
  private reduced: boolean;
  private mode: Mode = 'idle';
  private modeAt = 0;
  private spring = new HeadingSpring(0.4);
  private target: Heading = { right: 0, up: 0 };
  private lastTime = -1;
  private loop: FrameLoop;
  private keys = new Set<string>();
  private pointerHeading: Heading = { right: 0, up: 0 };
  private interacted = false;
  private demoPlayed = false;
  private demoTimer = 0;
  private announced = 0;
  private onScreen = false;

  constructor(els: HeroScanElements, opts: { mouse: boolean; reduced: boolean }) {
    this.els = els;
    this.mouse = opts.mouse;
    this.reduced = opts.reduced;
    this.loop = new FrameLoop(els.stage, (t) => this.frame(t));
    // Mouse moves far down the page cost nothing: the cursor only steers the head while the hero shows.
    new IntersectionObserver((entries) => {
      this.onScreen = entries.some((e) => e.isIntersecting);
    }).observe(els.stage);

    els.ring.addEventListener('ringtick', (e) => this.onTick((e as CustomEvent<number>).detail));
    els.ring.addEventListener('ringcomplete', () => this.onComplete());
    els.autoButton.addEventListener('click', () => this.startAuto());
    els.againButton.addEventListener('click', () => this.again());

    if (this.mouse && !this.reduced) {
      window.addEventListener('pointermove', (e) => this.onPointer(e), { passive: true });
      this.setStatus(HINT);
    }
    if (this.reduced) {
      // Nothing turns under Reduce Motion, so the stage is not a stop on the way to Auto scan.
      els.stage.removeAttribute('tabindex');
      els.stage.removeAttribute('aria-describedby');
    } else {
      els.stage.addEventListener('keydown', (e) => this.onKey(e, true));
      els.stage.addEventListener('keyup', (e) => this.onKey(e, false));
      els.stage.addEventListener('blur', () => {
        this.keys.clear();
        this.updateKeyTarget();
      });
    }
    // Phones run the scan by themselves, so they get no Auto scan button until the scan is over.
    els.autoButton.hidden = !this.mouse && !this.reduced;
  }

  /** Starts the idle timer once the hero is on screen (mouse users only). */
  armDemo() {
    if (!this.mouse || this.reduced || this.demoPlayed || this.interacted) return;
    clearTimeout(this.demoTimer);
    this.demoTimer = window.setTimeout(() => {
      if (this.interacted || this.mode !== 'idle' || this.els.ring.complete) return;
      this.demoPlayed = true;
      this.setMode('demo');
    }, DEMO_AFTER_MS);
  }

  /** The head turns once around by itself and the ring fills behind it. */
  startAuto() {
    if (this.els.ring.complete) this.resetScan();
    this.setMode('auto');
    this.setStatus('');
  }

  private setMode(mode: Mode) {
    this.mode = mode;
    this.modeAt = this.loop.time;
    this.loop.start();
  }

  private onPointer(e: PointerEvent) {
    if (e.pointerType !== 'mouse' || !this.onScreen) return;
    this.interacted = true;
    clearTimeout(this.demoTimer);
    if (this.mode === 'done' || this.mode === 'auto') return;
    const r = this.els.stage.getBoundingClientRect();
    const radius = r.width * RING_RADIUS;
    let x = (e.clientX - (r.left + r.width / 2)) / radius;
    let y = (e.clientY - (r.top + r.height / 2)) / radius;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    this.pointerHeading = { right: x * POINTER_TURN, up: -y * POINTER_TURN };
    if (this.mode !== 'pointer') this.setMode('pointer');
    else this.loop.start();
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    if (!e.key.startsWith('Arrow')) return;
    e.preventDefault();
    if (this.mode === 'done' || this.mode === 'auto') return;
    if (down) this.keys.add(e.key);
    else this.keys.delete(e.key);
    this.interacted = true;
    clearTimeout(this.demoTimer);
    this.updateKeyTarget();
    if (this.mode !== 'keys') this.setMode('keys');
    else this.loop.start();
  }

  private updateKeyTarget() {
    const right = (this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('ArrowLeft') ? 1 : 0);
    const up = (this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('ArrowDown') ? 1 : 0);
    const len = Math.hypot(right, up) || 1;
    this.target = { right: (right / len) * KEY_TURN, up: (up / len) * KEY_TURN };
  }

  private frame(t: number): boolean {
    const dt = this.lastTime >= 0 ? Math.max(t - this.lastTime, 0) : 1 / 60;
    this.lastTime = t;
    const since = t - this.modeAt;

    switch (this.mode) {
      case 'pointer':
        this.target = this.pointerHeading;
        break;
      case 'keys':
        break; // set by the keys
      case 'auto': {
        const h = autoHeading(since);
        this.target = h ?? { right: 0, up: 0 };
        // The turn is over: the ring finishes from its queue; the head comes back to center.
        if (!h) this.mode = 'idle';
        break;
      }
      case 'demo': {
        const h = demoHeading(since);
        this.target = h ?? { right: 0, up: 0 };
        if (!h) {
          this.mode = 'idle';
          if (!this.interacted) this.setStatus(HINT);
        }
        break;
      }
      default:
        this.target = { right: 0, up: 0 };
    }

    const h = this.spring.step(this.target, dt);
    this.scene?.look(h.right, h.up);
    if (this.mode !== 'idle' && this.mode !== 'done') this.els.ring.queue(ticksFor(h));

    // Keep going while something drives the head or it is still moving; a resting cursor or released
    // keys let the loop sleep until the next input wakes it.
    const driven = this.mode === 'auto' || this.mode === 'demo' || (this.mode === 'keys' && this.keys.size > 0);
    const moving = !this.spring.settled || Math.hypot(h.right - this.target.right, h.up - this.target.up) > 0.05;
    return driven || moving;
  }

  private onTick(index: number) {
    this.scene?.tick(index);
    sound.tick();
    if (this.els.status.dataset.text === HINT) this.setStatus('');
    // Three spoken updates on the way, for anyone who can't see the ring.
    const share = this.els.ring.filledCount / COMPLETE_COUNT;
    const step = share >= 0.75 ? 3 : share >= 0.5 ? 2 : share >= 0.25 ? 1 : 0;
    if (step > this.announced && share < 1) {
      this.announced = step;
      this.say(`Scan ${step * 25} percent.`);
    }
  }

  private onComplete() {
    this.mode = 'done';
    this.loop.start(); // the head settles forward
    this.scene?.pulse();
    sound.complete();
    this.els.hero.classList.add('is-scanned');
    this.setStatus('Scan complete');
    this.say('Scan complete.');
    const hadFocus = document.activeElement === this.els.autoButton;
    this.els.autoButton.hidden = true;
    this.els.againButton.hidden = false;
    if (hadFocus) this.els.againButton.focus();
    // Then the waitlist button glows once.
    window.setTimeout(() => {
      const cta = this.els.cta;
      if (!cta) return;
      cta.classList.remove('is-glowing');
      void cta.offsetWidth;
      cta.classList.add('is-glowing');
      cta.addEventListener('animationend', () => cta.classList.remove('is-glowing'), { once: true });
    }, 700);
  }

  private resetScan() {
    this.els.ring.reset();
    this.scene?.reset();
    this.announced = 0;
    this.els.hero.classList.remove('is-scanned');
    this.els.againButton.hidden = true;
    this.els.autoButton.hidden = !this.mouse && !this.reduced;
    this.mode = 'idle';
  }

  /** Scan again: a fresh ring. Phones run it by themselves again; mouse users get the hint back. */
  private again() {
    this.resetScan();
    if (!this.mouse && !this.reduced) {
      this.startAuto();
      this.els.stage.focus({ preventScroll: true });
      return;
    }
    this.setStatus(this.mouse && !this.reduced ? HINT : '');
    (this.els.autoButton.hidden ? this.els.stage : this.els.autoButton).focus({ preventScroll: true });
  }

  private setStatus(text: string) {
    const el = this.els.status;
    el.dataset.text = text;
    if (text) {
      el.textContent = text;
      el.classList.add('is-shown');
    } else {
      el.classList.remove('is-shown');
    }
  }

  private say(text: string) {
    // Clear first, so the same words can be spoken twice.
    this.els.live.textContent = '';
    window.setTimeout(() => (this.els.live.textContent = text), 50);
  }
}
