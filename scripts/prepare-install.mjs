#!/usr/bin/env node
/**
 * Build the CLI when this repository is installed *as a dependency*.
 *
 * ## Why this exists
 *
 * There are two ways to get SmashCut without npm: clone it and build it by
 * hand, or install it straight from git. The second only works if something
 * builds `dist/` on the way in, because `dist/` is not committed — so
 * `npm i -g github:KirtiJha/smashcut` would otherwise install a package whose
 * binary immediately fails on a missing module.
 *
 * It has to live at the repository root rather than on `packages/cli`, because
 * npm cannot install a subdirectory from a git URL: the whole repository is
 * what gets cloned, and only the root manifest's lifecycle scripts run.
 *
 * ## Why it does nothing in a normal checkout
 *
 * `prepare` also fires on every ordinary `bun install` / `npm install` inside
 * the repository, and building the whole monorepo on each of those would add
 * minutes to a one-line dependency change and make CI build twice. A working
 * copy is the case where the developer runs `bun run build` when they mean to.
 *
 * The signal is git metadata: a git *install* exports a tree with no `.git`
 * (npm strips it), while a checkout always has one. `SMASHCUT_SKIP_PREPARE=1`
 * forces the skip either way, for a CI job that builds explicitly.
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

if (process.env["SMASHCUT_SKIP_PREPARE"] === "1") {
  process.exit(0);
}

// A checkout has .git; a git install does not. Only the latter needs building
// here — in a checkout, `bun run build` is the developer's own step.
if (existsSync(join(root, ".git"))) {
  process.exit(0);
}

// Already built (a re-run, or a packed tarball that shipped dist).
if (existsSync(join(root, "packages", "cli", "dist", "cli.js"))) {
  process.exit(0);
}

console.log("[smashcut] installed from source — building the CLI (this takes a few minutes)...");

// bun is the repository's package manager and the only thing that understands
// its workspace filters. Without it there is nothing sensible to do, and
// failing the install with a clear reason beats installing a broken binary.
const bun = spawnSync("bun", ["run", "build"], { cwd: root, stdio: "inherit", shell: true });

if (bun.status !== 0) {
  console.error(
    "\n[smashcut] Could not build from source.\n" +
      "  This install needs Bun (https://bun.sh) to compile the workspace.\n" +
      "  Install Bun and retry, or use the published package instead:\n" +
      "      npm i -g smashcut\n",
  );
  process.exit(1);
}
