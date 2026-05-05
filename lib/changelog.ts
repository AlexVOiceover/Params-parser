export interface ReleaseNote {
  version: string;
  date: string;
  items: string[];
}

export const CHANGELOG: ReleaseNote[] = [
  {
    version: "0.7.0",
    date: "2026-05-05",
    items: [
      "Creating a family now also creates a 'Base' variant with a 'Default' reference set, so the catalog is never empty after one click.",
      "Creating a variant now also creates a 'Default' reference set under it.",
      "Default sets can be renamed — the new name shows on the card. The 'catalog reference' label still marks them, regardless of name.",
    ],
  },
  {
    version: "0.6.0",
    date: "2026-05-04",
    items: [
      "Connected drones are now matched to the catalog via SCR_USER1. Plug in a drone, finish import, and the modal shows the drone's serial, client and family/variant.",
      "Catalog and family pages highlight the family / variant / client set that matches the connected drone with an emerald 'your drone' badge.",
      "Default param sets are now labelled 'Default' and 'catalog reference' across the app, instead of the underlying client_name string.",
      "Fixed a render bug where client sets on a variant without a Default were duplicated.",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-05-04",
    items: [
      "Sign-in is now passwordless: enter your email and click the magic link.",
      "New \"Client\" role: a user account tied to one company. Clients sign in, see only their own drones and param sets (plus the relevant Defaults to compare against), and can upload param sets for their own drones.",
      "Admins can invite users with a chosen role; for client users, they pick which company the user belongs to.",
      "User table now has a delete button (you can't delete yourself).",
      "Catalog home and family pages hide families/variants a client doesn't own a drone on, so they only see relevant items.",
      "Header drop-down now shows the company a client is linked to.",
      "Mobile header layout: long labels collapse to icons so all controls stay reachable on narrow screens.",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-05-04",
    items: [
      "New Clients & Drones admin section: register companies and their drones, each drone bound to a family/variant",
      "Upload page now has a Default vs Client toggle — pick a Family/Variant for catalog defaults, or a Client/Drone for client-supplied param sets",
      "Variant page's \"Add client + drone\" picker reads from registered clients and drones (no more free-text)",
      "Diff counts on the variant page now show \"X params differ from Default\" and reflect the full param set",
      "Download .param button now downloads the file instead of opening it in a new tab",
      "Edit Default form drops the Client/Serial fields (only Description is editable)",
      "Friendlier error when a variant can't be deleted because a drone still references it",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-05-02",
    items: [
      "New \"Client + Serial\" layer under each variant for tracking per-drone configs",
      "Connected-drone card now has View / Save / Upload buttons",
      "Variant page shows Default config on top with each client's diff count and a one-click compare",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-05-01",
    items: [
      "Renamed \"Drone types\" to \"Families\" and \"Param sets\" to \"Variants\" throughout the catalog",
    ],
  },
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
