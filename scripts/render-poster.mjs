// Renders the hero's static image from the live 3D scene, frozen at its first frame, so first paint shows
// exactly what the scene will draw. Needs the dev server running (npm run dev).
//
//   node scripts/render-poster.mjs [http://127.0.0.1:4321/healm-site/]
//
// Writes src/assets/hero/poster-desktop.png (22,000 points, 600 px stage at 2x) and poster-mobile.png
// (10,000 points, 360 px at 2x, a typical phone stage). Astro turns them into AVIF and WebP at build time.
import { mkdirSync } from 'node:fs';
import { launch } from './cdp.mjs';

const base = process.argv[2] ?? 'http://127.0.0.1:4321/healm-site/';
const out = new URL('../src/assets/hero/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

for (const [name, size] of [['desktop', 600], ['mobile', 360]]) {
  const chrome = await launch({ width: size, height: size, scale: 2 });
  try {
    await chrome.goto(`${base}?poster=${name}`);
    await chrome.waitFor('document.title === "poster-ready"', 60000);
    // Two more frames, so the canvas holds the settled first frame.
    await chrome.evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
    await chrome.screenshot(`${out}poster-${name}.png`);
    console.log(`poster-${name}.png  ${size * 2}x${size * 2}`);
  } catch (e) {
    console.error(name, e.message, chrome.logs.join('\n'));
    process.exitCode = 1;
  } finally {
    await chrome.close();
  }
}
