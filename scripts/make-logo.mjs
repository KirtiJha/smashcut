#!/usr/bin/env node
/**
 * Generate SmashCut's own wordmark, and remove the upstream one.
 *
 * The catalog blocks and docs use a logo asset as demo content. The rebrand
 * renamed every *reference* to `smashcut-logo-*.svg`, so those references now
 * point at nothing — and the obvious fix, renaming HeyGen's file to match, is
 * the one thing that must not happen: Apache-2.0 section 6 grants no trademark
 * rights, so shipping their mark under our filename would assert it is ours.
 *
 * So the mark is redrawn rather than borrowed. Same 263x79 viewBox as upstream,
 * so nothing in the demo layouts shifts.
 *
 * Usage: node scripts/make-logo.mjs
 */
import { execFileSync } from "node:child_process";
import { writeFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

/** ink -> the SVG. A wordmark plus the cut mark the name is built on. */
const svg = (ink) => `<svg width="263" height="79" viewBox="0 0 263 79" fill="none" xmlns="http://www.w3.org/2000/svg">
  <title>SmashCut</title>
  <!-- the cut: a hard diagonal through the mark -->
  <path d="M232 14 L252 14 L242 65 L222 65 Z" fill="${ink}"/>
  <path d="M206 14 L226 14 L216 65 L196 65 Z" fill="${ink}" opacity="0.45"/>
  <text x="0" y="56"
        font-family="'Bebas Neue','Oswald','Arial Narrow',Impact,sans-serif"
        font-size="54" font-weight="700" letter-spacing="1.5" fill="${ink}">SMASHCUT</text>
</svg>
`;

const files = execFileSync("git", ["ls-files"], { encoding: "utf8", maxBuffer: 1 << 28 })
  .split("\n")
  .map((f) => f.trim())
  .filter((f) => /hyperframes-logo/i.test(f));

let made = 0;
let removed = 0;

for (const f of files) {
  const dir = dirname(f);
  if (f.endsWith(".svg")) {
    const ink = /white/i.test(f) ? "#FFFFFF" : /dark/i.test(f) ? "#E8E8EA" : "#101014";
    const variant = /white/i.test(f) ? "white" : /dark/i.test(f) ? "dark" : "black";
    await writeFile(join(dir, `smashcut-logo-${variant}.svg`), svg(ink), "utf8");
    made++;
  }
  await rm(f, { force: true });
  removed++;
}

console.log(`wrote ${made} SmashCut mark(s); removed ${removed} upstream brand file(s)`);
