// node --test tests/  (Node 22.18+ runs TypeScript directly)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTO_SECONDS, COMPLETE_COUNT, DEMO_SECONDS, HeadingSpring, RING, autoHeading, demoHeading, headingAt,
  magnitude, ringAngle, ticksAround, ticksFor,
} from '../src/lib/scan.ts';

test('the ring completes at 51 of 60 ticks, like the app', () => {
  assert.equal(COMPLETE_COUNT, 51);
});

test('ring angle is clockwise from the top', () => {
  assert.equal(ringAngle({ right: 0, up: 10 }), 0);
  assert.equal(ringAngle({ right: 10, up: 0 }), 90);
  assert.equal(ringAngle({ right: 0, up: -10 }), 180);
  assert.equal(ringAngle({ right: -10, up: 0 }), 270);
});

test('nothing fills inside the 8 degree fill tilt', () => {
  assert.deepEqual(ticksFor({ right: 5, up: 5 }), []); // 7.07 degrees
  assert.ok(ticksFor({ right: 8, up: 0 }).length > 0);
});

test('a heading fills every tick within 20 degrees: 7 ticks, wrapping past the top', () => {
  assert.deepEqual(ticksAround(90), [12, 13, 14, 15, 16, 17, 18]);
  assert.deepEqual(ticksAround(0), [0, 1, 2, 3, 57, 58, 59]);
});

test('headingAt points where it says', () => {
  const h = headingAt(135, 12);
  assert.ok(Math.abs(ringAngle(h) - 135) < 1e-9);
  assert.ok(Math.abs(magnitude(h) - 12) < 1e-9);
});

test('the spring settles on its target without overshoot', () => {
  const s = new HeadingSpring(0.4);
  let peak = 0;
  for (let i = 0; i < 120; i++) peak = Math.max(peak, s.step({ right: 20, up: 0 }, 1 / 60).right);
  assert.ok(Math.abs(s.value.right - 20) < 0.05);
  assert.ok(peak <= 20.05);
});

test('the auto scan covers the whole ring and ends', () => {
  const filled = new Set<number>();
  for (let t = 0; t < AUTO_SECONDS; t += 1 / 60) {
    const h = autoHeading(t);
    if (h) ticksFor(h).forEach((i) => filled.add(i));
  }
  assert.ok(filled.size >= COMPLETE_COUNT, `auto scan filled only ${filled.size}`);
  assert.equal(autoHeading(AUTO_SECONDS), null);
});

test('the idle demo fills about a third of the ring', () => {
  const filled = new Set<number>();
  for (let t = 0; t < DEMO_SECONDS; t += 1 / 60) {
    const h = demoHeading(t);
    if (h) ticksFor(h).forEach((i) => filled.add(i));
  }
  const share = filled.size / RING.ticks;
  assert.ok(share > 0.25 && share < 0.45, `demo filled ${filled.size} ticks`);
});
