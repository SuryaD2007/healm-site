/** What the hero exposes to the chapters below it: set by src/scripts/hero.ts, read by the chapters. */
import type { SceneHandle } from '@/three/HeadScene';
import type { HeroScan } from '@/scripts/hero-scan';
import type { HealmScanRing } from '@/scripts/scan-ring';

export const heroState: {
  scan: HeroScan | null;
  scene: SceneHandle | null;
  ring: HealmScanRing | null;
} = { scan: null, scene: null, ring: null };
