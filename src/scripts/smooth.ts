/**
 * Smooth scrolling with Lenis, driven by GSAP's ticker so the pinned chapters and the scroll stay in step.
 * Only with a mouse or trackpad: touch keeps the phone's own scrolling. Never under Reduce Motion.
 */
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from '@/lib/motion';

let lenis: Lenis | null = null;

export function startSmoothScroll() {
  if (lenis || prefersReducedMotion() || !matchMedia('(hover: hover) and (pointer: fine)').matches) return null;
  lenis = new Lenis({ lerp: 0.12, anchors: true, autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis?.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}
