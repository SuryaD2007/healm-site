# Skills, plugins and borrowed code

Everything an agent loads to work on this site, and every outside source of code or rules, with where it
came from and under what license. Nothing here is installed globally. Read a skill's files before adding or
updating it, and record the commit.

## Project skills (`.claude/skills/`)

Installed on 2026-11-18 with `npx skills@1.9.0 add <repo> --skill <names> -a claude-code --copy -y`
(project scope, copied files, telemetry off with `DO_NOT_TRACK=1 DISABLE_TELEMETRY=1`). The `add-skill`
command named in the brief is deprecated and now prints "use `npx skills add`"; both come from
[vercel-labs/skills](https://github.com/vercel-labs/skills) (MIT). `skills-lock.json` records each skill's
source commit and content hash.

Every SKILL.md and reference file was read before keeping it. None of the seven skills contains a script.

| Skill | Source | Commit | License | Notes |
|---|---|---|---|---|
| web-design-guidelines | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) `skills/web-design-guidelines` | `1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62` | MIT (stated in the repo README; the repo has no LICENSE file) | **Changed locally**, see below. Run as a review after each section. |
| vercel-react-best-practices | vercel-labs/agent-skills `skills/react-best-practices` | `1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62` | MIT (in its SKILL.md and the README) | Most rules are for Next.js servers; the bundle, re-render and client rules apply to the React islands. |
| copywriting | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) `skills/copywriting` | `73573e94a06a39965978b3fa1f9c1eace8cebc7c` | MIT | Includes ideas adapted from Profound's skills-marketing-library (MIT), credited in the file. |
| cro | coreyhaines31/marketingskills `skills/cro` | `73573e94a06a39965978b3fa1f9c1eace8cebc7c` | MIT | |
| aso | coreyhaines31/marketingskills `skills/aso` | `73573e94a06a39965978b3fa1f9c1eace8cebc7c` | MIT | Tells the agent to treat fetched listings and reviews as untrusted data. |
| ai-seo | coreyhaines31/marketingskills `skills/ai-seo` | `73573e94a06a39965978b3fa1f9c1eace8cebc7c` | MIT | Mentions `npx is-agentic` as an optional audit; not run without asking. |
| site-architecture | coreyhaines31/marketingskills `skills/site-architecture` | `73573e94a06a39965978b3fa1f9c1eace8cebc7c` | MIT | |

Not installed: `vercel-deploy-claimable` is no longer in vercel-labs/agent-skills (the repo now has
`deploy-to-vercel`, also left out, because this site deploys to GitHub Pages).

### The local change to web-design-guidelines

Upstream, the skill fetches its rules from the `main` branch of
[vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) (MIT) on
every run, so the instructions it follows could change without review. Here the rules are pinned:

- `guidelines.md` is `command.md` from commit `434b7f91364665f2f733b310ec54809bf8f37937`, read in full
  before saving. SHA-256 `d246b026f4f29b5823a9cc857f9edf3d2507002e055e32040cadeaf3b38e0234`.
- `SKILL.md` reads that file instead of fetching, and adds two project overrides: sentence case (the app's
  style) instead of Title Case, and no first person.

To update: fetch `command.md` at a new commit, read it, replace `guidelines.md`, and update the commit and
hash here.

## Plugins already installed for the user (not vendored)

| Plugin | Use here |
|---|---|
| frontend-design (`frontend-design@claude-plugins-official`) | For every page and component. |
| superpowers | Planning and testing habits; the brief's STOP points win over its workflow. |
| supabase | Read-only, only to check how the `waitlist` function is called. Nothing in Supabase is changed. |

## Code and assets from outside

| What | Source | License | Where |
|---|---|---|---|
| Instrument Serif (Regular, Italic) | The app, `Healm/Resources/Fonts`, originally Google Fonts | SIL Open Font License 1.1 (`public/fonts/OFL.txt`) | `public/fonts/`, subset to Latin as WOFF2 with fonttools |
| App icon glyph | The app, `Healm/Resources/Icon` | Healm's own | `public/brand/`, `src/components/HealmMark.astro` |
| "Download on the App Store" badge | Apple, `developer.apple.com/assets/elements/badges/download-on-the-app-store.svg` | Apple's marketing guidelines: unmodified, at least 40 px tall, clear space of a quarter of its height | `public/badges/app-store-black.svg` |

### Component libraries: not used yet, pending a decision

The brief names both as MIT. Neither is plain MIT:

- **React Bits** ([DavidHDev/react-bits](https://github.com/DavidHDev/react-bits)): **MIT + Commons Clause**.
  Free to use inside an application or website, including a commercial one. The components themselves may
  not be sold, sublicensed or redistributed on their own.
- **Aceternity UI** ([ui.aceternity.com/licence](https://ui.aceternity.com/licence)): the **Aceternity
  License**. Allows unlimited end products such as websites. Prohibits "re-distribut[ing] the Item as a
  stock image or its source files, regardless of modifications".

This repository is public, because GitHub Pages serves it for free. A public repo containing their source
could be read as redistributing it. Until the owner decides, nothing is copied from either. Each piece the
site needs so far (the ring, the breath square, the dial, the buttons) is written from the app's own code.
If a piece is borrowed later, it gets a row here with the file, the original component, the commit and the
license, and the license notice goes in the file.

## npm packages

Pinned exactly in `package.json` (`.npmrc` has `save-exact=true`), each at its newest release at least two
weeks old on 2026-11-18, to avoid brand-new versions. `@vitejs/plugin-react` is overridden to 6.2.1 so that
it and `oxc-transform-react` 0.156.0 agree; `@astrojs/react` 7.1.2 still warns that it wants 0.145, but its
code never imports that package.

`npm audit` reports two advisories, neither reachable on a static site: Astro's image endpoint in the
`@astrojs/node` server adapter (not used), and a ReDoS in `picomatch` (used only by the build's file
matching). `npm audit fix --force` would downgrade Astro, so it is not run.
