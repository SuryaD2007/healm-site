/**
 * The hero: the visitor does the scan (src/scripts/hero-scan.ts).
 *
 *   - Mouse (hover and a fine pointer): the ring starts empty. The head turns toward the cursor and the
 *     ring fills in the direction it points. A hint until filling starts; an idle demo after 8 seconds.
 *   - Touch and everything else: once the hero is on screen the head turns once around by itself and the
 *     ring fills behind it, in about 4 to 5 seconds. No hints, no dragging, no tilt.
 *   - Keyboard: arrow keys on the focused stage; the Auto scan button runs it by itself.
 *   - Reduce Motion: no 3D and no turning; Auto scan fills the ring as a plain progress stroke.
 *
 * First paint is the static render of the scene (src/assets/hero/poster-*.png, made by
 * scripts/render-poster.mjs). The live scene loads after first paint, never under Reduce Motion, without
 * WebGL 2, with Save-Data on, or on a device with two cores or less; if it runs slowly it hands back to
 * the static render. Without the 3D, the scan still works: the ring fills from the same heading.
 *
 * ?poster=desktop or ?poster=mobile renders only the scene, frozen, for the static render.
 */
import { prefersReducedMotion } from '@/lib/motion';
import type { HealmScanRing } from '@/scripts/scan-ring';
import type { HeadPoints } from '@/three/head';
import type { SceneHandle } from '@/three/HeadScene';
import { HeroScan } from '@/scripts/hero-scan';

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

function afterLoad(fn: () => void) {
  if (document.readyState === 'complete') afterFirstPaint(fn);
  else window.addEventListener('load', () => afterFirstPaint(fn), { once: true });
}

if (hero) {
  const stage = hero.querySelector<HTMLElement>('[data-stage]')!;
  const mount = hero.querySelector<HTMLElement>('[data-canvas]')!;
  const ring = hero.querySelector<HealmScanRing>('healm-scan-ring')!;
  const pause = hero.querySelector<HTMLButtonElement>('[data-motion-toggle]');
  const reduced = prefersReducedMotion();
  const mouse = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const phone = matchMedia('(max-width: 767px)').matches;
  let scene: SceneHandle | null = null;
  let paused = false;

  const scan = posterMode
    ? null
    : new HeroScan(
        {
          hero,
          stage,
          ring,
          status: hero.querySelector<HTMLElement>('[data-scan-status]')!,
          live: hero.querySelector<HTMLElement>('[data-scan-live]')!,
          autoButton: hero.querySelector<HTMLButtonElement>('[data-scan-auto]')!,
          againButton: hero.querySelector<HTMLButtonElement>('[data-scan-again]')!,
          cta: hero.querySelector<HTMLElement>('[data-hero-cta]'),
        },
        { mouse, reduced },
      );

  // The head moves for as long as the page is open, so it gets a pause (WCAG 2.2.2). The label says what
  // the button will do.
  pause?.addEventListener('click', () => {
    paused = !paused;
    scene?.setPaused(paused);
    pause.classList.toggle('is-paused', paused);
    const label = pause.querySelector('[data-label]');
    if (label) label.textContent = paused ? 'Play the moving head' : 'Pause the moving head';
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
            if (scan) scan.scene = scene;
            resolve();
          },
          onSlow: () => {
            // Back to the static render, on the reveal curve, then free the GPU. The scan keeps working.
            stage.classList.remove('is-live');
            if (pause) pause.hidden = true;
            if (scan) scan.scene = null;
            setTimeout(() => {
              scene?.destroy();
              scene = null;
            }, 700);
          },
        });
      });
      if (poster) document.title = 'poster-ready';
    } catch (error) {
      // The static render is already on screen and the ring still scans, so visitors see no difference.
      if (import.meta.env.DEV) console.warn('[hero] 3D scene did not load', error);
    }
  };

  /** Runs once the hero is mostly on screen. */
  const whenOnScreen = (fn: () => void) => {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.intersectionRatio >= 0.5)) {
        io.disconnect();
        fn();
      }
    }, { threshold: [0, 0.5, 1] });
    io.observe(stage);
  };

  if (posterMode) {
    document.documentElement.classList.add('poster-mode', `poster-${posterMode}`);
    loadScene(posterMode === 'mobile' ? PHONE_POINTS : DESKTOP_POINTS, true);
  } else if (scan) {
    const with3D = canRun3D();
    const ready = with3D ? new Promise<void>((resolve) => afterLoad(() => loadScene(phone ? PHONE_POINTS : DESKTOP_POINTS).then(resolve))) : Promise.resolve();
    if (reduced) {
      // Nothing moves by itself. Auto scan is there for anyone who wants to see the ring fill.
    } else if (mouse) {
      whenOnScreen(() => scan.armDemo());
    } else {
      // Phones and tablets: the scan runs by itself once the hero is on screen and the head is there,
      // or after 2.5 seconds without it.
      whenOnScreen(() => {
        const start = () => setTimeout(() => scan.startAuto(), 400);
        Promise.race([ready, new Promise((r) => setTimeout(r, 2500))]).then(start);
      });
    }
  }
}
