#!/usr/bin/env node
/**
 * The HyperFrames -> SmashCut rebrand, as a script rather than a sed one-liner.
 *
 * A blind search-and-replace over 30,000 occurrences gets three things wrong,
 * and each of them is silent:
 *
 *  1. **Third-party URLs.** `hyperframes.heygen.com` is upstream's real site and
 *     `heygen-com/hyperframes` is their real repository. Renaming the brand
 *     inside those invents addresses that do not exist, and worse, implies
 *     HeyGen hosts this fork. Both are protected.
 *  2. **Provider plumbing.** HeyGen is a *service this software calls* — the
 *     `heygen` CLI, `api.heygen.com`, `HEYGEN_*` credentials, the
 *     `X-HeyGen-Client-Source` header. None of that is branding, and renaming
 *     any of it breaks TTS, music and asset retrieval. Left entirely alone.
 *  3. **Bare `hf`.** There are ~6,000 bare `hf` tokens in the TypeScript, and
 *     they are ordinary local identifiers as often as they are the brand. Only
 *     the unambiguous forms are renamed: the `hf-` prefix and the `__hf`
 *     globals.
 *
 * Apache-2.0 section 4 obligations are handled outside this script and
 * deliberately so: LICENSE and CREDITS.md are skipped and preserved verbatim.
 *
 * Usage: node scripts/rebrand.mjs [--dry-run]
 */
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";

const DRY = process.argv.includes("--dry-run");

/** Files whose contents are never touched. */
const SKIP_FILES = new Set(["LICENSE", "CREDITS.md", "NOTICE", "scripts/rebrand.mjs"]);

/** Extensions we never rewrite (binary, or a lockfile that regenerates). */
const SKIP_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".mp4", ".mov", ".webm",
  ".mp3", ".wav", ".m4a", ".woff", ".woff2", ".ttf", ".otf", ".eot", ".zip",
  ".gz", ".pdf", ".cube", ".bin", ".node", ".lock",
]);

/**
 * Strings protected from the brand rename: sentinelled first, restored after.
 * The sentinel is deliberately something that cannot occur in real source.
 */
const PROTECT = [
  /[a-z0-9-]*\.heygen\.com/gi,   // hyperframes.heygen.com, api.heygen.com, ...
  /heygen-com\/[a-z0-9._-]+/gi,  // the upstream GitHub org/repo
];

const OPEN = "@@RBP";
const CLOSE = "PBR@@";

/** The rename itself, applied in order. */
const RENAME = [
  [/HyperFrames/g, "SmashCut"],
  [/Hyperframes/g, "Smashcut"],
  [/HYPERFRAMES/g, "SMASHCUT"],
  [/hyperframes/g, "smashcut"],
  // No word boundary: the brand also appears inside compound identifiers
  // (HyperframeHtml, hyperframeLinter, HyperframeLintFinding). An earlier pass
  // used \b here while the path rename did not, so files were renamed to
  // smashcutLinter.ts while their imports still said hyperframeLinter — the
  // build broke on modules that had been renamed out from under it. No English
  // word contains "hyperframe", so the boundary buys nothing and costs that.
  [/HyperFrame/g, "SmashCut"],
  [/Hyperframe/g, "Smashcut"],
  [/HYPERFRAME/g, "SMASHCUT"],
  [/hyperframe/g, "smashcut"],
  // Runtime identifiers. `hf-` only when a letter or digit follows, so a stray
  // "hf-" in prose is left alone; `__hf` only as a global prefix.
  [/\bhf-(?=[a-z0-9])/g, "sc-"],
  [/__hf(?=[A-Za-z0-9_])/g, "__sc"],
  [/__hf\b/g, "__sc"],
];

const BRAND = /hyperframes|HyperFrames|Hyperframes|HYPERFRAMES|\bhf-[a-z0-9]|__hf/g;

const files = execFileSync("git", ["ls-files"], { encoding: "utf8", maxBuffer: 1 << 28 })
  .split("\n")
  .map((f) => f.trim())
  .filter(Boolean);

let changed = 0;
let occurrences = 0;
let skipped = 0;

for (const file of files) {
  if (SKIP_FILES.has(file) || SKIP_EXT.has(extname(file).toLowerCase())) {
    skipped++;
    continue;
  }

  let src;
  try {
    src = await readFile(file, "utf8");
  } catch {
    skipped++;
    continue;
  }
  // A NUL byte means the extension list misjudged this and it is binary.
  if (src.indexOf("\u0000") !== -1) {
    skipped++;
    continue;
  }

  const before = src;
  const hits = (src.match(BRAND) ?? []).length;

  const vault = [];
  for (const re of PROTECT) {
    src = src.replace(re, (m) => {
      vault.push(m);
      return `${OPEN}${vault.length - 1}${CLOSE}`;
    });
  }

  for (const [re, to] of RENAME) src = src.replace(re, to);

  src = src.replace(new RegExp(`${OPEN}(\\d+)${CLOSE}`, "g"), (_, i) => vault[Number(i)]);

  if (src !== before) {
    changed++;
    occurrences += hits;
    if (!DRY) await writeFile(file, src, "utf8");
  }
}

console.log(
  `${DRY ? "[dry-run] " : ""}rewrote ${changed} file(s), ~${occurrences} occurrence(s); skipped ${skipped}`,
);
