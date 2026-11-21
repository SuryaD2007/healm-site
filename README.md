# healm-site

Healm's website: the scan story, the privacy policy, the terms of use, and support. Astro, built and published
to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`.

- `npm run dev`: the site at http://127.0.0.1:4321/healm-site/ (Astro 7 runs it in the background:
  `npx astro dev stop` to stop it).
- `npm run build`, `npm run check`, `npm test`.
- `npm run poster` and `npm run share-image` re-render the hero's still and the share image from the live
  scene (dev server running).

The privacy policy and terms keep their URLs (`privacy.html`, `terms.html`); App Review links to the privacy
policy. Their words live in `src/content/legal/` and come from the app repository's `docs/site/`.

See `CLAUDE.md` for the design rules, the stack and the Git rules, and `docs/SKILLS.md` for every outside
source and its license.
