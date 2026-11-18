/**
 * Facts about Healm that appear on more than one page. Change them here only.
 */
export const site = {
  name: 'Healm',
  /** Switch to an address on Healm's own domain when there is one (see CLAUDE.md, Contact). */
  email: 'gethealm@gmail.com',
  /**
   * The App Store ID (the digits after "id" in the App Store link). While it is null the site shows the
   * waitlist; once set, the App Store badge replaces it and the Smart App Banner turns on.
   */
  appStoreId: null as string | null,
  /**
   * The `web-waitlist` endpoint the Healm app project is building. POST JSON
   * {email, source: "web", website} (website is the honeypot); it answers {ok: true} or {ok: false, error}.
   * A placeholder until the owner sends the real URL; while it is, the form says to email instead.
   */
  waitlistUrl: 'https://REPLACE-WITH-PROJECT-REF.supabase.co/functions/v1/web-waitlist',
  socials: [
    { name: 'TikTok', handle: '@healm.health', url: 'https://www.tiktok.com/@healm.health' },
    { name: 'Instagram', handle: '@healm.health', url: 'https://www.instagram.com/healm.health/' },
    { name: 'X', handle: '@healmhealth', url: 'https://x.com/healmhealth' },
  ],
} as const;

export const appStoreUrl = site.appStoreId ? `https://apps.apple.com/app/id${site.appStoreId}` : null;

/** False while the waitlist URL is still the placeholder. */
export const waitlistReady = !site.waitlistUrl.includes('REPLACE-WITH');
