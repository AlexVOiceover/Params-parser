export interface ReleaseNote {
  version: string;
  date: string;
  items: string[];
}

export const CHANGELOG: ReleaseNote[] = [
  {
    version: "0.15.0",
    date: "2026-05-11",
    items: [
      "Apply update now verifies params were written correctly and retries up to 4 passes automatically",
      "Failed flashes revert the drone to its previous state to avoid partial configurations",
    ],
  },
  {
    version: "0.14.0",
    date: "2026-05-11",
    items: [
      "Admins can now capture a connected drone's params directly to the catalog when the drone is ahead of the catalog version",
      "New review queue (/admin/review) — captured versions are held for admin approval before entering the catalog",
      "Red badge on the admin menu shows how many versions are pending review",
      "Version cards show an amber 'pending review' pill until an admin accepts or discards the capture",
    ],
  },
  {
    version: "0.13.0",
    date: "2026-05-10",
    items: [
      "Param sanity check: when a drone's version matches the catalog, the app now also compares actual param values. If they differ (e.g. someone changed params in Mission Planner), an amber 'Modified' badge appears with a Review link.",
      "Import modal shows 'N params differ from catalog' when version matches but values don't.",
      "Drone status banner shows 'N params modified' with a Review link for modified drones.",
    ],
  },
  {
    version: "0.12.0",
    date: "2026-05-08",
    items: [
      "NFC tag writing on Android Chrome — write a drone's serial number to an NFC sticker directly from the app. Available on drone rows in Clients & Drones and after the Register drone wizard.",
      "Tapping an NFC sticker opens the app at the drone's variant page via a new /drone/[serial] deep-link route.",
    ],
  },
  {
    version: "0.11.0",
    date: "2026-05-08",
    items: [
      "New 'Register drone' wizard — connects to a blank or unregistered drone (SCR_USER2=0), collects serial/family/variant/client, then creates the DB record and flashes the Default param set in one flow.",
      "'Register drone' button appears in the import modal and the catalog home banner when an unversioned drone is connected.",
      "Drone registration supports orphan mode (no client) — the drone tracks the Default param set without needing a client assignment.",
      "New POST /api/admin/drones endpoint supports creating drones without a client (for orphan bring-up).",
    ],
  },
  {
    version: "0.10.0",
    date: "2026-05-08",
    items: [
      "Orphan drones (no client assigned) now track the Default param set — they show version status and 'Update available' just like registered drones.",
      "The Default card on a variant page highlights as 'your drone (no client)' when an orphan drone is connected.",
      "The drone status banner and import modal show 'no client' for orphan drones instead of showing nothing.",
      "The Compare page now shows a full breadcrumb back-link (Family > Variant > Client set) when comparing versions from the same client set.",
    ],
  },
  {
    version: "0.9.0",
    date: "2026-05-07",
    items: [
      "Connected drones now show version status in the import modal: up to date, update available, or drone ahead of catalog.",
      "Variant page highlights the matching client set with a pulsing amber 'Update available' badge when the drone is behind.",
      "Catalog version columns in Compare now have an edit pencil — click to edit params inline, then save directly to the catalog.",
      "Upload form now has a 'From file / From drone' source toggle on any param set when a drone is connected.",
      "Default param sets always write SCR_USER1=0 (no serial) and SCR_USER2=version on upload.",
      "Clone dialog pre-fills the next version number automatically.",
      "Fix: cloned versions now correctly set the latest flag.",
    ],
  },
  {
    version: "0.8.0",
    date: "2026-05-06",
    items: [
      "Version labels are now plain integers (1, 2, 3…) — the .0 minor component was never used and has been removed throughout.",
      "Every uploaded .param file now has SCR_USER2 set to the version number, so drones will self-report their current version when connected.",
      "Middleware switched to Node.js runtime, fixing slow page loads on WSL.",
    ],
  },
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
