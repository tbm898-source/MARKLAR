/** Contributor and catalog content lives in `src/data/*.json` — edit in git, redeploy. No CMS or DB required. */

export type FeaturedItem = {
  id: string;
  title: string;
  blurb: string;
  href: string;
  kind: "tool" | "doc" | "people" | "other";
};

export type PersonCard = {
  id: string;
  displayName: string;
  tagline: string;
  href: string;
  role?: string;
};

export type ReleaseNote = {
  version: string;
  date: string;
  notes: string[];
};

export type ToolRelease = {
  name: string;
  currentVersion: string;
  summary: string;
  changelog: ReleaseNote[];
  downloadNote: string;
  downloadUrl: string;
  repoPath: string;
  docsHref: string;
};
