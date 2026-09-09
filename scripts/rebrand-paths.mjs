#!/usr/bin/env node
/**
 * Rename the files and directories that carry the old brand in their path.
 *
 * Separate from the content rebrand because it has a different hazard: renaming
 * deepest-first is required, or renaming a parent directory invalidates every
 * child path still queued behind it.
 *
 * Logo assets are deliberately NOT renamed here. `hyperframes-logo-*.svg` is
 * HeyGen's actual mark, and Apache-2.0 grants no trademark rights (section 6) —
 * shipping their logo under a `smashcut-logo` filename would be worse than
 * leaving it, because the name would assert it is ours. Those are listed for
 * replacement instead.
 *
 * Usage: node scripts/rebrand-paths.mjs [--dry-run]
 */
import { execFileSync } from "node:child_process";
import { basename, dirname } from "node:path";

// Paths stay in forward slashes throughout. `join()` normalises to backslashes
// on Windows, which made a renamed path differ from its source only by
// separator — so the "did anything change?" guard passed and git was handed a
// move onto itself.
const slash = (p) => p.replace(/\\/g, "/");
const withBase = (p, name) => {
  const d = slash(dirname(p));
  return d === "." ? name : `${d}/${name}`;
};

const DRY = process.argv.includes("--dry-run");

/**
 * Brand-mark assets: reported, never renamed.
 *
 * Matched narrowly on the upstream logo filename rather than on "logo"
 * anywhere, which also caught a blueprint *about* logo lockups and an example
 * that merely animates one. Those are ordinary files and must be renamed.
 */
const TRADEMARK = /hyperframes-logo/i;

const rename = (s) =>
  s
    .replace(/HyperFrames/g, "SmashCut")
    .replace(/Hyperframes/g, "Smashcut")
    .replace(/hyperframes/g, "smashcut")
    .replace(/HyperFrame/g, "SmashCut")
    .replace(/Hyperframe/g, "Smashcut")
    .replace(/hyperframe/g, "smashcut");

const files = execFileSync("git", ["ls-files"], { encoding: "utf8", maxBuffer: 1 << 28 })
  .split("\n")
  .map((f) => f.trim())
  .filter((f) => f && /hyperframe/i.test(f));

// Every directory segment that needs renaming, and every file. Deepest first so
// a parent rename never strands a queued child path.
const dirs = new Set();
for (const f of files) {
  let d = dirname(f);
  while (d && d !== "." && d !== "/") {
    if (/hyperframe/i.test(basename(d))) dirs.add(d);
    d = dirname(d);
  }
}

const trademarked = [];
const moves = [];

for (const f of files) {
  if (TRADEMARK.test(basename(f))) {
    trademarked.push(f);
    continue;
  }
  const to = withBase(f, rename(basename(f)));
  if (to !== f) moves.push([f, to]);
}

const dirMoves = [...dirs]
  .sort((a, b) => b.split(/[\\/]/).length - a.split(/[\\/]/).length)
  .map((d) => [d, withBase(d, rename(basename(d)))]);

for (const [from, to] of moves) {
  if (slash(from) === slash(to)) continue;
  if (!DRY) execFileSync("git", ["mv", from, to]);
}
for (const [from, to] of dirMoves) {
  if (slash(from) === slash(to)) continue;
  if (!DRY) execFileSync("git", ["mv", from, to]);
}

console.log(`${DRY ? "[dry-run] " : ""}renamed ${moves.length} file(s), ${dirMoves.length} dir(s)`);
if (trademarked.length > 0) {
  console.log(`\nLEFT ALONE — third-party brand marks, replace rather than rename:`);
  for (const f of trademarked) console.log(`  ${f}`);
}
