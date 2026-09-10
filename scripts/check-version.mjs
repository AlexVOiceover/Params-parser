#!/usr/bin/env node
/**
 * Fails if package.json and lib/changelog.ts disagree on the app version.
 *
 * lib/changelog.ts is the source of truth — CURRENT_VERSION is derived from
 * CHANGELOG[0] and drives the version badge in the header. package.json used
 * to drift silently because nothing compared the two.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const pkgVersion = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;

const changelog = readFileSync(join(root, "lib/changelog.ts"), "utf8");
const match = changelog.match(/version:\s*["']([^"']+)["']/);
if (!match) {
  console.error("✗ Could not find a version in lib/changelog.ts");
  process.exit(1);
}
const changelogVersion = match[1];

if (pkgVersion !== changelogVersion) {
  console.error(
    `✗ Version mismatch:\n` +
      `    lib/changelog.ts : ${changelogVersion}  (source of truth)\n` +
      `    package.json     : ${pkgVersion}\n\n` +
      `  Set package.json to ${changelogVersion}, or add a new changelog entry.`
  );
  process.exit(1);
}

console.log(`✓ Version ${pkgVersion} consistent`);
