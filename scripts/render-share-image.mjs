// Renders the share image (Open Graph and X, 1200 x 630) from src/pages/share-card.astro. Needs the dev
// server running (npm run dev). Writes public/share/healm.png.
//
//   node scripts/render-share-image.mjs [http://127.0.0.1:4321/healm-site/]
import { mkdirSync } from 'node:fs';
import { launch } from './cdp.mjs';

const base = process.argv[2] ?? 'http://127.0.0.1:4321/healm-site/';
const out = new URL('../public/share/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const chrome = await launch({ width: 1200, height: 630, scale: 1 });
try {
  await chrome.goto(`${base}share-card.html`);
  await chrome.waitFor('document.title === "share-ready"', 30000);
  await chrome.screenshot(`${out}healm.png`);
  console.log('public/share/healm.png  1200x630');
} catch (e) {
  console.error(e.message, chrome.logs.join('\n'));
  process.exitCode = 1;
} finally {
  await chrome.close();
}
