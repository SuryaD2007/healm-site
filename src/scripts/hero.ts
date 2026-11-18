/**
 * The hero: the scan ring fills around the head once, the way the app's does, then pulses.
 *
 * First paint is the static render of the scene (src/assets/hero/poster-*.png, made by
 * scripts/render-poster.mjs from this same scene). The live 3D scene loads after that:
 *   - desktop: right after first paint, and the ring waits up to 1.8 s for it, so the head lights up tick
 *     by tick as the ring fills;
 *   - phone: on the first touch or scroll, or 2.5 s after load, so loading never competes with the page;
 *   - never under Reduce Motion, without WebGL 2, with Save-Data on, or on a device with two cores or less.
 * If it runs slowly once loaded, it hands back to the static render.
 *
 * ?poster=desktop or ?poster=mobile renders only the scene, frozen, for the static render.
 */
import { prefersReducedMotion } from '@/lib/motion';
import type { HealmScanRing } from '@/scripts/scan-ring';
import type { HeadPoints } from '@/three/head';
import type { SceneHandle } from '@/three/HeadScene';
import { sound } from '@/scripts/sound';

const DESKTOP_POINTS = 22000;
const PHONE_POINTS = 10000;

const hero = document.querySelector<HTMLElement>('[data-hero]');
const posterMode = new URLSearchParams(location.search).get('poster');

function canRun3D() {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  if (prefersReducedMotion()) return false;
  if (nav.connection?.saveData) return false;
  if ((nav.hardwareConcurrency ?? 4) <= 2) return false;
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 2) return false;
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

function makePoints(count: number): Promise<HeadPoints> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../three/head.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<HeadPoints>) => {
      resolve(e.data);
      worker.terminate();
    };
    worker.onerror = (e) => {
      reject(e);
      worker.terminate();
    };
    worker.postMessage({ count });
  });
}

function afterFirstPaint(fn: () => void) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
      idle ? idle(fn, { timeout: 600 }) : setTimeout(fn, 60);
    }),
  );
}

function onFirstInteraction(fn: () => void, fallbackMs: number) {
  let done = false;
  const events = ['pointerdown', 'touchstart', 'scroll', 'keydown', 'pointermove'] as const;
  const run = () => {
    if (done) return;
    done = true;
    events.forEach((e) => window.removeEventListener(e, run));
    fn();
  };
  events.forEach((e) => window.addEventListener(e, run, { passive: true, once: true }));
  const later = () => setTimeout(() => afterFirstPaint(run), fallbackMs);
  if (document.readyState === 'complete') later();
  else window.addEventListener('load', later, { once: true });
}

if (hero) {
  const stage = hero.querySelector<HTMLElement>('[data-stage]')!;
  const mount = hero.querySelector<HTMLElement>('[data-canvas]')!;
  const ring = hero.querySelector<HealmScanRing>('healm-scan-ring');
  const pause = hero.querySelector<HTMLButtonElement>('[data-motion-toggle]');
  const phone = matchMedia('(max-width: 767px)').matches;
  let scene: SceneHandle | null = null;
  let ringStarted = false;
  let paused = false;

  // The head moves for as long as the page is open, so it gets a pause (WCAG 2.2.2). The label says what
  // the button will do.
  pause?.addEventListener('click', () => {
    paused = !paused;
    scene?.setPaused(paused);
    pause.classList.toggle('is-paused', paused);
    const label = pause.querySelector('[data-label]');
    if (label) label.textContent = paused ? 'Play the moving head' : 'Pause the moving head';
  });

  const startRing = () => {
    if (ringStarted || !ring) return;
    ringStarted = true;
    ring.play();
  };

  ring?.addEventListener('ringtick', (e) => {
    scene?.tick((e as CustomEvent<number>).detail);
    sound.tick();
  });
  ring?.addEventListener('ringcomplete', () => {
    scene?.pulse();
    sound.complete();
    hero.classList.add('is-scanned');
  });
  // Turning sound on while the hero is in view plays the scan again, so there is something to hear.
  sound.addEventListener('change', () => {
    if (!sound.enabled || !ring) return;
    const r = hero.getBoundingClientRect();
    if (r.bottom > 0 && r.top < innerHeight) ring.play();
  });

  const loadScene = async (count: number, poster = false) => {
    try {
      const [{ mountHeadScene }, points] = await Promise.all([import('@/three/HeadScene'), makePoints(count)]);
      await new Promise<void>((resolve) => {
        scene = mountHeadScene({
          container: mount,
          points,
          poster,
          onReady: () => {
            stage.classList.add('is-live');
            if (pause && !poster) pause.hidden = false;
            resolve();
          },
          onSlow: () => {
            // Back to the static render, on the reveal curve, then free the GPU.
            stage.classList.remove('is-live');
            if (pause) pause.hidden = true;
            setTimeout(() => {
              scene?.destroy();
              scene = null;
            }, 700);
          },
        });
      });
      if (poster) document.title = 'poster-ready';
    } catch (error) {
      // The static render is already on screen, so visitors see no difference.
      if (import.meta.env.DEV) console.warn('[hero] 3D scene did not load', error);
    }
  };

  if (posterMode) {
    document.documentElement.classList.add('poster-mode', `poster-${posterMode}`);
    loadScene(posterMode === 'mobile' ? PHONE_POINTS : DESKTOP_POINTS, true);
  } else if (prefersReducedMotion()) {
    // The app's Reduce Motion ring: one progress stroke, shown full. Nothing moves.
    startRing();
  } else if (!canRun3D()) {
    afterFirstPaint(() => setTimeout(startRing, 400));
  } else if (phone) {
    afterFirstPaint(() => setTimeout(startRing, 500));
    onFirstInteraction(() => loadScene(PHONE_POINTS), 2500);
  } else {
    afterFirstPaint(() => {
      const fallback = setTimeout(startRing, 1800);
      loadScene(DESKTOP_POINTS).then(() => {
        clearTimeout(fallback);
        // Let the crossfade land before the first tick.
        setTimeout(startRing, 350);
      });
    });
  }
}
