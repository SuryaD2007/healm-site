// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages serves the site at suryad2007.github.io/healm-site. For a custom domain later,
// set SITE_URL to the domain and SITE_BASE to "/" (and add public/CNAME).
const site = process.env.SITE_URL ?? 'https://suryad2007.github.io';
const base = process.env.SITE_BASE ?? '/healm-site';

export default defineConfig({
  site,
  base,
  // "file" keeps the old URLs: privacy.html, terms.html, support.html. App Review links to privacy.html.
  build: { format: 'file', inlineStylesheets: 'auto' },
  trailingSlash: 'ignore',
  integrations: [
    // src/three is mounted by hand from src/scripts/hero.ts, not as an Astro island, so Fast Refresh has no
    // preamble there. Vite compiles its JSX itself (tsconfig: react-jsx). No component on the site is a
    // React island today; add an island's folder to `include` if one appears.
    react({ exclude: ['**/src/three/**'] }),
    // The style preview and the share image's page are tools, not pages.
    sitemap({
      filter: (page) => !/styleguide|share-card/.test(page),
      // The pages are files (privacy.html), the same addresses the canonical links and App Review use.
      serialize: (item) => ({ ...item, url: item.url.endsWith('/') ? item.url : `${item.url}.html` }),
    }),
  ],
  vite: { plugins: [tailwindcss()] },
  devToolbar: { enabled: false },
});
