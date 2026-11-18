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
    react(),
    sitemap({ filter: (page) => !page.includes('styleguide') }),
  ],
  vite: { plugins: [tailwindcss()] },
  devToolbar: { enabled: false },
});
