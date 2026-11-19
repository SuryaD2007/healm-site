import type { APIRoute } from 'astro';

// Crawlers read robots.txt only at a domain's root, so this one counts once Healm has its own domain
// (on suryad2007.github.io the root belongs to another repository). The sitemap works either way.
export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const sitemap = new URL(`${base}/sitemap-index.xml`, site).href;
  const body = [
    'User-agent: *',
    'Allow: /',
    `Disallow: ${base}/styleguide.html`,
    `Disallow: ${base}/share-card.html`,
    '',
    `Sitemap: ${sitemap}`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
