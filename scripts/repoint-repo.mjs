#!/usr/bin/env node
/**
 * Point this fork's own references at its own repository.
 *
 * The rebrand deliberately left every `heygen-com/hyperframes` URL alone,
 * because renaming one before the fork had a home would have invented an
 * address that did not exist. It has a home now, so the *operational* ones move
 * — the repository field, the issue tracker, clone and skills-install commands,
 * the registry fetch URL. Those have to resolve for the CLI to work at all.
 *
 * Three kinds stay pointing upstream, and each would be a lie to rewrite:
 *
 *  1. **History.** `docs/changelog.mdx`, `docs/weekly-updates.mdx`, `releases/`
 *     and `CHANGELOG.md` link to real commits and pull requests in HeyGen's
 *     repository. Repointing them would claim this repository contains work it
 *     has never seen, and every link would 404.
 *  2. **Specific commits and PRs anywhere else.** Same reason, outside those
 *     files: a `/pull/1315` or `/commit/8fcbb63a` is a fact about upstream.
 *  3. **Other HeyGen repositories.** `heygen-com/hyperframes-cloudflare-template`
 *     is a different project that was never forked; it still lives where it did.
 *
 * Usage: node scripts/repoint-repo.mjs [--dry-run]
 */
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";

const DRY = process.argv.includes("--dry-run");

const FROM = "heygen-com/hyperframes";
const TO = "KirtiJha/smashcut";

/** Files that are a record of upstream's history, not this fork's plumbing. */
const HISTORY = [
  "docs/changelog.mdx",
  "docs/weekly-updates.mdx",
  "CHANGELOG.md",
];
const HISTORY_DIRS = ["releases/"];

const SKIP_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".mp4", ".mov", ".webm",
  ".mp3", ".wav", ".woff", ".woff2", ".ttf", ".otf", ".zip", ".gz", ".pdf",
]);

/**
 * `heygen-com/hyperframes` where it means *this project* — not a sibling repo
 * (`hyperframes-cloudflare-template`), and not a specific commit or PR.
 */
const OPERATIONAL = new RegExp(
  `heygen-com/hyperframes(?!-)(?!/pull/)(?!/commit/)(?!/compare/)(?!/releases/tag/)`,
  "g",
);

const files = execFileSync("git", ["ls-files"], { encoding: "utf8", maxBuffer: 1 << 28 })
  .split("\n")
  .map((f) => f.trim())
  .filter(Boolean);

let changed = 0;
let occurrences = 0;
let keptHistory = 0;

for (const file of files) {
  if (SKIP_EXT.has(extname(file).toLowerCase())) continue;
  if (HISTORY.includes(file) || HISTORY_DIRS.some((d) => file.startsWith(d))) {
    keptHistory += 1;
    continue;
  }

  let src;
  try {
    src = await readFile(file, "utf8");
  } catch {
    continue;
  }
  if (!src.includes(FROM)) continue;

  const hits = (src.match(OPERATIONAL) ?? []).length;
  if (hits === 0) continue;

  const out = src.replace(OPERATIONAL, TO);
  changed += 1;
  occurrences += hits;
  if (!DRY) await writeFile(file, out, "utf8");
}

console.log(
  `${DRY ? "[dry-run] " : ""}repointed ${occurrences} reference(s) in ${changed} file(s); ` +
    `left ${keptHistory} history file(s) pointing upstream`,
);
