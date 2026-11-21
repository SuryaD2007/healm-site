/**
 * The app's face scan rules, ported for the web. Pure, so they can be tested (tests/scan.test.ts).
 *
 * Healm/Core/Scan/ScanEngine.swift (ScanRing, ScanPacing) and Healm/Core/Skin/SkinScanTracker.swift
 * (SkinHeading, SkinRing): a heading is how far the head points right and up, in degrees. Its ring angle
 * is atan2(right, up), clockwise from the top. Once it is 8 degrees or more off center, every tick within
 * 20 degrees of that angle fills. The ring is done at 85% of its 60 ticks, never in under 4 seconds, and
 * ticks show at most 15 a second (a burst of 3 after a wait).
 */

export const RING = {
  ticks: 60,
  degreesPerTick: 6,
  fillTilt: 8,
  fillHalfWidth: 20,
  completeShare: 0.85,
  minimumSeconds: 4,
  ticksPerSecond: 15,
  burst: 3,
} as const;

/** 51: the ticks that complete a scan. */
export const COMPLETE_COUNT = Math.ceil(RING.ticks * RING.completeShare);

export interface Heading {
  /** Degrees to the right (negative is left). */
  right: number;
  /** Degrees up (negative is down). */
  up: number;
}

export const magnitude = (h: Heading) => Math.hypot(h.right, h.up);

/** Degrees clockwise from the top, 0 up to 360. */
export function ringAngle(h: Heading): number {
  const a = (Math.atan2(h.right, h.up) * 180) / Math.PI;
  return a < 0 ? a + 360 : a;
}

/** Every tick within the fill half width of a ring angle. */
export function ticksAround(angle: number): number[] {
  const out: number[] = [];
  for (let tick = 0; tick < RING.ticks; tick++) {
    let d = Math.abs(tick * RING.degreesPerTick - angle) % 360;
    if (d > 180) d = 360 - d;
    if (d <= RING.fillHalfWidth) out.push(tick);
  }
  return out;
}

/** The ticks a heading fills: none inside the fill tilt. */
export function ticksFor(h: Heading): number[] {
  return magnitude(h) >= RING.fillTilt ? ticksAround(ringAngle(h)) : [];
}

/** A heading pointing at a ring angle, this many degrees off center. */
export function headingAt(angle: number, degrees: number): Heading {
  const r = (angle * Math.PI) / 180;
  return { right: Math.sin(r) * degrees, up: Math.cos(r) * degrees };
}

/**
 * A 2D critically damped spring for the head, like the app's step (response 0.4 s, no overshoot).
 * Semi-implicit Euler with the step capped, so a dropped frame never makes it jump.
 */
export class HeadingSpring {
  value: Heading = { right: 0, up: 0 };
  private velocity: Heading = { right: 0, up: 0 };
  private response: number;
  constructor(response = 0.4) {
    this.response = response;
  }

  step(target: Heading, dt: number): Heading {
    const w = (2 * Math.PI) / this.response;
    const h = Math.min(dt, 1 / 30);
    for (const k of ['right', 'up'] as const) {
      this.velocity[k] += (w * w * (target[k] - this.value[k]) - 2 * w * this.velocity[k]) * h;
      this.value[k] += this.velocity[k] * h;
    }
    return this.value;
  }

  get settled() {
    return Math.hypot(this.velocity.right, this.velocity.up) < 0.05;
  }

  reset() {
    this.value = { right: 0, up: 0 };
    this.velocity = { right: 0, up: 0 };
  }
}

/**
 * The scan that runs by itself (phones, and the Auto scan button): the head turns once around in a slow,
 * natural circle, easing in and out, about 18 degrees off center, like a person doing the face scan.
 * `t` is seconds since it started; returns null when the turn is over.
 */
export const AUTO_SECONDS = 4.4;
export function autoHeading(t: number, startAngle = 210): Heading | null {
  if (t >= AUTO_SECONDS) return null;
  const p = t / AUTO_SECONDS;
  // One turn and a bit, easing in and out, so the last wedge overlaps the first.
  const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  const angle = startAngle + 400 * eased;
  const reach = Math.min(t / 0.5, 1) * Math.min((AUTO_SECONDS - t) / 0.4, 1);
  return headingAt(angle, 18 * Math.max(reach, 0));
}

/**
 * The idle demo for mouse users: the head turns slowly through about a third of the ring, then comes back
 * to center and waits. Returns null when it is over.
 */
export const DEMO_SECONDS = 3;
export function demoHeading(t: number, startAngle = 200): Heading | null {
  if (t >= DEMO_SECONDS) return null;
  const p = t / DEMO_SECONDS;
  const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  const reach = Math.min(t / 0.6, 1) * Math.min((DEMO_SECONDS - t) / 0.6, 1);
  return headingAt(startAngle + 95 * eased, 15 * Math.max(reach, 0));
}
