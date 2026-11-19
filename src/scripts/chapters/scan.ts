/**
 * Chapter 1, Scan: the hero pins and becomes the chapter (src/components/chapters/ScanChapter.astro).
 *
 * As the page scrolls through the pin: the hero's words step aside and the chapter's copy comes in; a mint
 * sweep goes once round the ring and fills it; the head turns and lights up by region, with a label for
 * each: Skin (it turns to show a cheek), Hair (it tips forward to show the crown), Body (the camera pulls
 * back and the shoulders come up); then a phone closes round the stage, the stage shrinks into the phone's
 * ring, and the app's real face scan screen takes its place.
 *
 * Words and the phone move on one GSAP timeline, scrubbed by the scroll. The head, the regions, the Body
 * view, the sweep and the ring are pure functions of the timeline's progress (drive), so scrolling back
 * up plays everything in reverse. The pin is shorter on narrow screens.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { REGION } from '@/three/head';
import { heroState } from '@/scripts/hero-state';
import { startSmoothScroll } from '@/scripts/smooth';

gsap.registerPlugin(ScrollTrigger);

const SVG = 'http://www.w3.org/2000/svg';
type Scan = 'skin' | 'hair' | 'body';

/** Where each label points, as a share of the stage: points on the head's right side, so leaders run right. */
const ANCHORS: Record<Scan, [number, number]> = { skin: [0.6, 0.5], hair: [0.56, 0.21], body: [0.74, 0.82] };
/** When each scan has the stage, as timeline progress: rise, hold, fall. */
const PHASES: Record<Scan, [number, number, number, number]> = {
  skin: [0.16, 0.22, 0.34, 0.42],
  hair: [0.38, 0.44, 0.56, 0.64],
  body: [0.58, 0.64, 0.76, 0.84],
};
/** The head's pose through the chapter: [progress, degrees right, degrees up]. */
const POSES: [number, number, number][] = [
  [0, 0, 0], [0.1, 0, 0], [0.2, 12, 3], [0.34, 12, 3], [0.42, 0, -17], [0.56, 0, -17],
  [0.64, 0, 3], [0.76, 0, 3], [0.84, 0, 0], [1, 0, 0],
];
/** The sweep goes once round between these. */
const SWEEP: [number, number] = [0.12, 0.8];

// The app's face scan screen (src/assets/chapters/scan-screen.png): the ring's middle sits 47.5% down the
// screen and its ticks span 78.1% of its width. On the stage the ticks reach 173.8 of 200 from the middle.
const SCREEN_RING_Y = 0.4749;
const SCREEN_RING_W = 0.781;
const STAGE_RING_W = 347.6 / 400;
const SCREEN_ASPECT = 1320 / 2868;
const BEZEL = 0.03; // PhoneFrame: padding is 3% of the frame's width

const clamp = (x: number, a = 0, b = 1) => Math.min(Math.max(x, a), b);
const smooth = (t: number) => t * t * (3 - 2 * t);
function bump(p: number, [a, b, c, d]: [number, number, number, number]) {
  if (p <= a || p >= d) return 0;
  if (p < b) return smooth((p - a) / (b - a));
  if (p <= c) return 1;
  return 1 - smooth((p - c) / (d - c));
}
function pose(p: number): [number, number] {
  for (let i = 1; i < POSES.length; i++) {
    const [p1, r1, u1] = POSES[i];
    if (p <= p1) {
      const [p0, r0, u0] = POSES[i - 1];
      const t = smooth(clamp((p - p0) / (p1 - p0)));
      return [r0 + (r1 - r0) * t, u0 + (u1 - u0) * t];
    }
  }
  return [0, 0];
}

export function setupScanSequence() {
  const seq = document.querySelector<HTMLElement>('[data-scan-sequence]');
  const chapter = document.querySelector<HTMLElement>('[data-scan-chapter]');
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  if (!seq || !chapter || !hero) return;
  const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
  const stage = $('[data-stage]', hero);
  const copy = $('[data-sc-copy]', chapter);
  const device = $('[data-sc-device]', chapter);
  const svg = $<SVGSVGElement>('[data-sc-leaders]', chapter);
  const labels = Object.fromEntries((['skin', 'hair', 'body'] as Scan[]).map((k) => [k, $(`.sc-label[data-region="${k}"]`, chapter)])) as Record<Scan, HTMLElement>;

  const lenis = startSmoothScroll();

  // The sweep: eight ticks the app's size, a bright head and a fading tail, turned as one.
  const sweep = document.createElementNS(SVG, 'g');
  const leaders = Object.fromEntries((['skin', 'hair', 'body'] as Scan[]).map((k) => {
    const g = document.createElementNS(SVG, 'g');
    g.append(document.createElementNS(SVG, 'line'), document.createElementNS(SVG, 'circle'));
    return [k, g];
  })) as Record<Scan, SVGGElement>;
  svg.append(sweep, ...Object.values(leaders));

  const geo = { cx: 0, cy: 0, ss: 0, end: { dx: 0, dy: 0, s: 1 }, leaderLen: { skin: 0, hair: 0, body: 0 } as Record<Scan, number> };
  const wide = () => window.innerWidth >= 1100;

  /** Measures the stage and places everything round it. Runs on every refresh (load, resize). */
  const layout = () => {
    gsap.set(stage, { clearProps: 'transform' });
    const box = seq.getBoundingClientRect();
    const r = stage.getBoundingClientRect();
    const vw = box.width;
    const vh = Math.min(box.height, window.innerHeight);
    const sx = r.left - box.left, sy = r.top - box.top, ss = r.width;
    const cx = sx + ss / 2, cy = sy + ss / 2;
    Object.assign(geo, { cx, cy, ss });
    const gutter = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gutter')) || 16;
    const css = chapter.style;

    if (wide()) {
      const copyW = Math.min(416, sx - gutter - 48);
      css.setProperty('--copy-x', `${sx - 48 - copyW}px`);
      css.setProperty('--copy-w', `${copyW}px`);
      css.setProperty('--copy-y', `${cy}px`);
    } else {
      css.setProperty('--copy-x', `${gutter}px`);
      css.setProperty('--copy-w', `${vw - 2 * gutter}px`);
      css.setProperty('--copy-y', `${sy + ss + 20}px`);
      css.setProperty('--row-y', `${sy + ss + 28 + copy.offsetHeight}px`);
    }

    // Labels to the right of the ring, level with what they point at, and a leader from the head to each.
    for (const k of ['skin', 'hair', 'body'] as Scan[]) {
      const [ax, ay] = ANCHORS[k];
      const x1 = sx + ax * ss, y1 = sy + ay * ss;
      const lx = sx + ss + 28, ly = y1;
      labels[k].style.setProperty('--lx', `${lx}px`);
      labels[k].style.setProperty('--ly', `${ly}px`);
      const [line, dot] = leaders[k].children as unknown as [SVGLineElement, SVGCircleElement];
      const x2 = lx - 10;
      line.setAttribute('x1', String(x1)); line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(x2)); line.setAttribute('y2', String(ly));
      dot.setAttribute('cx', String(x1)); dot.setAttribute('cy', String(y1)); dot.setAttribute('r', '3.5');
      const len = Math.hypot(x2 - x1, ly - y1);
      geo.leaderLen[k] = len;
      line.style.strokeDasharray = `${len}`;
      leaders[k].style.display = wide() ? '' : 'none';
    }

    // The sweep, at the ring's radius.
    sweep.replaceChildren();
    const R = (166 / 400) * ss, w = (3 / 400) * ss * 1.4, len = (15.6 / 400) * ss;
    const fades = [1, 0.75, 0.55, 0.4, 0.28, 0.18, 0.1, 0.05];
    fades.forEach((o, i) => {
      const t = document.createElementNS(SVG, 'rect');
      t.setAttribute('x', String(cx - w / 2)); t.setAttribute('y', String(cy - R - len / 2));
      t.setAttribute('width', String(w)); t.setAttribute('height', String(len)); t.setAttribute('rx', String(w / 2));
      t.setAttribute('fill', 'var(--scan-tick-filled)'); t.setAttribute('opacity', String(o));
      t.setAttribute('transform', `rotate(${-i * 6} ${cx} ${cy})`);
      sweep.append(t);
    });

    // The phone: as tall as the screen allows; the stage ends centred on the phone's ring, at its size.
    const H = Math.min(vh * (wide() ? 0.86 : 0.8), 780);
    const W = H / (2 * BEZEL + (1 - 2 * BEZEL) / SCREEN_ASPECT);
    const SW = W * (1 - 2 * BEZEL), SH = SW / SCREEN_ASPECT;
    const px = (wide() ? cx : vw / 2) - W / 2, py = (vh - H) / 2;
    css.setProperty('--phone-x', `${px}px`);
    css.setProperty('--phone-y', `${py}px`);
    css.setProperty('--phone-size', `${W}px`);
    const tx = px + W / 2, ty = py + W * BEZEL + SCREEN_RING_Y * SH;
    geo.end = { dx: tx - cx, dy: ty - cy, s: (SCREEN_RING_W * SW) / (STAGE_RING_W * ss) };
    drive(tl.progress());
  };

  /** The 3D head, the regions, the Body view, the sweep and the ring, from the timeline's progress. */
  let lastSweep = -1;
  const drive = (p: number) => {
    const { scan, scene, ring } = heroState;
    if (p < 0.03) scan?.steer(null);
    else {
      const [right, up] = pose(p);
      scan?.steer({ right, up });
    }
    const skin = bump(p, PHASES.skin), hair = bump(p, PHASES.hair), body = bump(p, PHASES.body);
    for (const region of [REGION.forehead, REGION.cheeks, REGION.nose, REGION.face, REGION.jaw]) scene?.setRegion(region, 0.75 * skin);
    scene?.setRegion(REGION.hair, 0.75 * hair);
    scene?.setRegion(REGION.ears, 0.4 * hair);
    scene?.setRegion(REGION.body, 0.75 * body);
    scene?.setBody(body);

    const a = clamp((p - SWEEP[0]) / (SWEEP[1] - SWEEP[0])) * 360;
    sweep.setAttribute('transform', `rotate(${a.toFixed(2)} ${geo.cx} ${geo.cy})`);
    // The ring fills where the sweep has been (paced like the app's), all the way round, and keeps what it
    // has on the way back.
    if (ring && p > SWEEP[0]) {
      const n = Math.min(60, Math.floor(a / 6) + 1);
      if (n !== lastSweep || ring.filledCount < n) {
        lastSweep = n;
        ring.queue([...Array(n).keys()], true);
      }
    }
  };

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' }, onUpdate: () => drive(tl.progress()) });

  const build = () => {
    tl.clear();
    const narrow = !wide();
    const heroBits = (sel: string) => [...hero.querySelectorAll<HTMLElement>(sel)];
    tl.to(heroBits('.hero-l'), { x: narrow ? 0 : -60, opacity: 0, duration: 0.1 }, 0)
      .to(heroBits('.hero-r, .hero-aside'), { x: narrow ? 0 : 60, opacity: 0, duration: 0.1 }, 0)
      .to(heroBits('.hero-title, .hero-scanbar, .hero-foot, .hero-pause'), { opacity: 0, duration: 0.06 }, 0)
      .fromTo(copy, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.08 }, 0.08)
      .fromTo(svg, { opacity: 0 }, { opacity: 1, duration: 0.03 }, 0.1)
      .fromTo(sweep, { opacity: 0 }, { opacity: 1, duration: 0.03 }, 0.1)
      .to(sweep, { opacity: 0, duration: 0.05 }, SWEEP[1]);

    for (const k of ['skin', 'hair', 'body'] as Scan[]) {
      const [a, , c] = PHASES[k];
      if (narrow) {
        // In a row under the ring: the row comes in with the copy, then each lights while its scan has
        // the stage and rests half lit after.
        tl.fromTo(labels[k], { opacity: 0 }, { opacity: 0.3, duration: 0.06 }, 0.1)
          .to(labels[k], { opacity: 1, duration: 0.05 }, a)
          .to(labels[k], { opacity: 0.5, duration: 0.05 }, c + 0.04);
      } else {
        const line = leaders[k].firstElementChild as SVGLineElement;
        // Only the scan that has the stage gets a leader: the camera moves between scans, so an old
        // leader would point at the wrong place. Its label stays, half lit.
        tl.fromTo(labels[k], { opacity: 0, x: 12 }, { opacity: 1, x: 0, duration: 0.05 }, a + 0.02)
          .fromTo(line, { strokeDashoffset: () => geo.leaderLen[k] }, { strokeDashoffset: 0, duration: 0.05 }, a)
          .fromTo(leaders[k], { opacity: 0 }, { opacity: 1, duration: 0.02 }, a);
        if (k !== 'body') {
          tl.to(leaders[k], { opacity: 0, duration: 0.03 }, c + 0.02)
            .to(labels[k], { opacity: 0.5, duration: 0.03 }, c + 0.02);
        }
      }
    }

    tl.to([...Object.values(labels), ...Object.values(leaders)], { opacity: 0, duration: 0.05 }, 0.8)
      // On a narrow screen the phone covers the copy's place, so the copy steps out for it.
      .to(copy, { opacity: narrow ? 0 : 1, duration: 0.05 }, 0.8)
      .to(stage, { x: () => geo.end.dx, y: () => geo.end.dy, scale: () => geo.end.s, duration: 0.1, ease: 'power2.inOut' }, 0.82)
      .fromTo(device, { opacity: 0, scale: 1.12 }, { opacity: 1, scale: 1, duration: 0.1, ease: 'power2.out' }, 0.82)
      .to(stage, { opacity: 0, duration: 0.05 }, 0.91)
      .to({}, { duration: 0.04 }, 0.96); // hold the phone a moment before the pin lets go
  };

  build();
  const trigger = ScrollTrigger.create({
    trigger: seq,
    start: 'top top',
    end: () => `+=${(wide() ? 2.2 : 1.5) * window.innerHeight}`,
    pin: true,
    scrub: 0.6,
    animation: tl,
    invalidateOnRefresh: true,
    onRefreshInit: () => {
      tl.progress(0);
      build();
    },
    onRefresh: layout,
  });
  layout();

  // "How it works" and "Scroll to scan" land a little way into the chapter, not on the hero again.
  document.querySelectorAll<HTMLAnchorElement>('a[href$="#scan"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const y = trigger.start + (trigger.end - trigger.start) * 0.24;
      if (lenis) lenis.scrollTo(y, { duration: 1.4 });
      else window.scrollTo({ top: y, behavior: 'smooth' });
    }),
  );
}
