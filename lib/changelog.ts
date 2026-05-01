export interface ReleaseNote {
  version: string;
  date: string;
  items: string[];
}

export const CHANGELOG: ReleaseNote[] = [
  {
    version: "0.1.0",
    date: "2026-05-01",
    items: [
      "Catalog is now the home page; Filter tool moved to /filter",
      "Single shared header across all pages with user dropdown (admin actions, sign out)",
      "Drone-import is global: one button stores params in memory; pages reuse them",
      "Filter tool: 'Load drone' replaces in-tool dialog; pulls from imported params",
      "Compare: search by name or value, narrower single-version layout, full-bleed on multi",
      "Param sets: per-row Apply/Protect actions reclaim the middle column",
      "Breadcrumbs across every page (Catalog > section)",
      "Light theme contrast fixes for destructive and emerald accents",
    ],
  },
];

export const CURRENT_VERSION = CHANGELOG[0].version;
