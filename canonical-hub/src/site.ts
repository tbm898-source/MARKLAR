/** Site-wide strings. IONOS holds DNS; Base44 may host the live app until .org is wired to this build. */
export const SITE = {
  name: "CANONICAL",
  /** Primary domain (IONOS) — eventual canonical URL once DNS points at this deploy. */
  canonicalDomain: "pure-canonical-core.org",
  /** Where the CANONICAL app is publicly reachable today (Base44). */
  deployedUrl: "https://pure-canonical-core.base44.app",
  tagline: "A core for projects, people, and shipped work.",
  contactEmail: "hello@pure-canonical-core.org",
  githubOrg: "",
  /**
   * Other domains on your IONOS account (reference only — not all may serve HTTP yet).
   */
  registeredDomains: [
    "dialhomedesigns.com",
    "honey-home-sync.com",
    "honey-home-sync.info",
    "honey-home-sync.online",
    "honey-home-sync.store",
    "pure-canonical-core.org",
    "smart-cycle-sync.com",
    "MadMindsProductions.com",
  ],
} as const;
