# Healm site

The marketing site for Healm, an iPhone app that scans your skin, hair and body, reads your Apple Health data, and
coaches you through the day. The idea of the site: **the site is a scan**. It must look and feel like the app.

Served by GitHub Pages at https://suryad2007.github.io/healm-site/. `privacy.html` must keep loading at that exact
URL, because App Review links to it.

## Stack

- Astro 7, static output, `build.format: 'file'` (pages are `privacy.html`, `support.html`, `terms.html`).
  `base` is `/healm-site`; for a custom domain set `SITE_URL` and `SITE_BASE=/` and add `public/CNAME`.
- Tailwind CSS 4, driven by `src/styles/tokens.css`. Plain CSS components live in `src/styles/global.css`.
- Interactive pieces are small custom elements in `src/scripts/` (no framework). React islands only where React
  earns it: the 3D scan scene (React Three Fiber + drei, lazy-loaded after first paint).
- Every component is written here from the app's own code. No component libraries (no React Bits, no
  Aceternity, no shadcn registries), and nothing copied from one.
- GSAP + ScrollTrigger for the scroll chapters, Lenis for smooth scrolling, Motion for micro-interactions.
- No other heavy library without asking the owner.
- Commands: `npm run dev` (Astro 7 runs it as a daemon: `npx astro dev stop` / `status` / `logs`),
  `npm run build`, `npm run check`, `npm run poster` (with the dev server running).
- The hero's 3D: `src/three/head.ts` builds a generic bust from simple shapes and samples it as scan lines
  (seeded, so it is the same every time); `src/three/HeadScene.tsx` draws it; `src/scripts/hero.ts` decides
  when to load it. Change anything that affects the first frame (shape, camera, light, point size), then run
  `npm run poster` so the static render (`src/assets/hero/`) matches the live scene again.
- `src/three` is excluded from Astro's React plugin (astro.config.mjs) because it is mounted by hand, not as
  an island; Fast Refresh would fail there in dev.
- `scripts/cdp.mjs` drives headless Chrome with software WebGL for renders and checks. The gstack browse
  binary has no WebGL, so it only ever sees the static fallback.
- Packages are pinned exactly, each at least two weeks old when added. See docs/SKILLS.md.

## Design rules (from the app)

The app is the source of truth: `~/Developer/Healm` (read-only). Every token in `src/styles/tokens.css` names the
Swift file it came from. Change the app first, then the tokens.

- Use only tokens and the components in `src/styles/global.css` and `src/components/`. No raw colors, sizes or fonts.
- **No shadows, no gradients, no emoji.** Hairlines and space carry hierarchy. Depth in dark sections comes from the
  3D scene and the fixed `.grain` texture. Tailwind's shadow utilities are switched off.
- Type: Instrument Serif for what Healm says and for numbers; the system font for everything else. Sentence case
  everywhere. No all-caps labels, no eyebrow labels, no middle-dot meta strings, no arrows appended to links.
  Numbers use tabular figures (`.tabular`).
- Color: dark (harbor green `#0D1F22`) by default, light sections with `.theme-light`, legal pages `.theme-auto`.
  **Mint `#8FE3CF` (scanTickFilled) is the only accent and it means "scanned".** It stays on dark grounds
  (1.49:1 on white). Signal is amber, never red, for flags only; light signal is 4.42:1, so never body text in it.
- 44 px minimum targets. Visible focus (`:focus-visible`, action color). Pill 24, card 18, callout 14, small 8.
- Motion: the app's curves (`--ease-reveal`, `--ease-move`) and springs (`src/lib/motion.ts`). Motion answers a tap
  or a scroll; the exceptions are the hero's first scan and the breathing head. Every loop goes through
  `FrameLoop`, which pauses off screen and in hidden tabs.
- The scan ring is 60 ticks, filled at most 15 a second, never faster than 4 s for a full ring, one 1.06 pulse.
  The breath square is 4 s per side, in up the left, hold across the top, out down the right, hold across the bottom.
- Reduce Motion: no 3D motion, no pinning, no smooth scroll, only fades. The ring becomes a progress stroke.
- Low power or no WebGL: the static render of the scene and plain fades.
- Mobile first: perfect at 375 px with no sideways scroll. Fewer points and shorter pins on phones.
- Budgets: Lighthouse mobile 90+ and desktop 95+ for performance, 95+ for accessibility, best practices and SEO.
  First load under 1.5 MB; the 3D chunk is lazy.

## Contact

- The contact email is **gethealm@gmail.com**, set once in `src/lib/site.ts` and used everywhere (also in the
  old `index.html`, `privacy.html` and `terms.html`).
- **When the owner buys a domain, switch to an address on it**: change `src/lib/site.ts`, search the repo for
  `gethealm@gmail.com`, and update the app repo's `docs/site/` and in-app contact to match.

## App footage

- Real screens come from `~/Developer/healm-content/stills/` and `clips/` (the marketing Footage agent).
  Today (light and dark) exists. The scan, Ask, Live Activity, food quick add, Calm breath and privacy screens
  are being recorded there. Until each appears, its chapter uses a clean placeholder drawn from tokens; check
  that folder at the start of each session and swap in what has landed (AVIF/WebP with fallbacks).

## Words

- Clear, warm, a bit playful, Gen Z friendly but not slangy. Use the copywriting skill.
- **No medical claims.** Healm does not diagnose, treat or cure, and is not a doctor. No appearance scores.
- No fake testimonials, reviews, ratings or user counts.
- Apple's App Store badge only as Apple supplies it (`public/badges/`), at least 40 px tall.
- Privacy page words change only with the owner's approval. The app repo's `docs/site/` is their source.

## Skills

Project skills in `.claude/skills/` (sources, commits and licenses in docs/SKILLS.md):

- `web-design-guidelines`: run as a review after each section; rules are pinned in `guidelines.md`.
  Healm overrides its Title Case rule with sentence case.
- `vercel-react-best-practices`: for the React islands.
- `copywriting`, `cro`, `aso`, `ai-seo`, `site-architecture`: for words, structure and SEO.
- The `frontend-design` plugin for every page and component.

## Read-only sources

- `~/Developer/Healm`: tokens, sounds (`Healm/Resources/Sounds`), icon, the `waitlist` edge function.
  Never edit it. The Supabase plugin is read-only here: never change anything in Supabase.
- `~/Developer/healm-content`: stills and clips from the marketing footage agent.
- The guard hook (`.claude/hooks/bash_guard.py`, from the app) asks before broad deletes, paths outside this repo,
  any write into those two folders, and git history changes outside this repo.

## Git

- `~/Developer/healm-site` is its own repo. **The home folder `/Users/gunnu` is a separate git repo; never commit
  to it.** Check with `git rev-parse --show-toplevel` before any commit.
- Work on `site-v2`. Merge to `main` only after the owner approves. Never force-push. Delete the branch after merge.
- GitHub Pages deploys from `main` through a GitHub Action.
- Never commit `.env*`, `.claude/settings.local.json`, or anything with a key.
