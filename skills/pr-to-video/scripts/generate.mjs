#!/usr/bin/env node
/**
 * Drive the pr-to-video route from one command.
 *
 * The route has six steps. Four of them are mechanical — fetch the PR, fold it
 * into a capture package, build the design system, generate audio, build the
 * packets, assemble, inject transitions, check, render. Two are not: writing the
 * storyboard, and building the frames. Those need judgment and stay with the
 * agent.
 *
 * So this runs the mechanical parts and stops, loudly, at each point where the
 * agent has to take over. It does not try to write a storyboard for you.
 *
 *   node generate.mjs --pr <url | owner/repo#N | N> [--project <dir>] [--preset <name>]
 *   node generate.mjs --project <dir> --resume    # after STORYBOARD.md exists
 *   node generate.mjs --project <dir> --finish    # after the frames are built
 *
 * Everything it runs is a script this skill already ships; nothing here is new
 * behaviour, and any step can be run by hand from SKILL.md instead.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const S = (name) => join(SKILL_DIR, "scripts", name);

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};

if (flag("help") || argv.length === 0) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].split("/**")[1]);
  process.exit(0);
}

const PR = opt("pr");
const PRESET = opt("preset", "code-editorial");
const RESUME = flag("resume");
const FINISH = flag("finish");

/** `acme-sdk#1842` → `acme-sdk-pr-1842`, per the route's naming rule. */
function projectFromPr(ref) {
  const m = String(ref).match(/(?:github\.com\/)?([\w.-]+)\/([\w.-]+)(?:\/pull\/|#)(\d+)/);
  if (m) return `videos/${m[2]}-pr-${m[3]}`;
  const n = String(ref).match(/^(\d+)$/);
  return n ? `videos/pr-${n[1]}` : "videos/pr-video";
}

const PROJECT = resolve(opt("project", PR ? projectFromPr(PR) : "videos/pr-video"));

// ── running ──────────────────────────────────────────────────────────────────
function run(label, cmd, args, { cwd = PROJECT, fatal = true } = {}) {
  process.stdout.write(`\n▶ ${label}\n`);
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    if (!fatal) {
      process.stdout.write(`  (non-fatal — continuing)\n`);
      return false;
    }
    console.error(`\n✗ ${label} failed (exit ${r.status}). Fix it and re-run; every step is idempotent except assembly.`);
    process.exit(1);
  }
  return true;
}

function stop(heading, lines) {
  console.log(`\n${"─".repeat(64)}\n${heading}\n`);
  for (const l of lines) console.log(`  ${l}`);
  console.log("");
  process.exit(0);
}

// ── phase 3: assemble → transitions → checks → render ────────────────────────
if (FINISH) {
  const frames = join(PROJECT, "compositions", "frames");
  if (!existsSync(frames)) {
    console.error(`✗ no compositions/frames in ${PROJECT} — build the frames first.`);
    process.exit(1);
  }

  // Assembly hoists each approved frame video to the host root and writes the
  // stripped frame back, so it is one-way. Running it twice silently drops the
  // media. Refuse rather than do that.
  const already = existsSync(join(PROJECT, "index.html"))
    && readFileSync(join(PROJECT, "index.html"), "utf8").includes("data-composition-src");
  if (already && !flag("force")) {
    console.error(
      `✗ ${PROJECT}/index.html is already assembled.\n` +
        `  Assembly is one-way: it moves media out of the frames, so a second run\n` +
        `  can silently produce a film with no media. Re-run with --force only if\n` +
        `  you have restored the frames.`,
    );
    process.exit(1);
  }

  run("assemble index", "node", [S("assemble-index.mjs"), "--storyboard", "./STORYBOARD.md", "--smashcut", "."]);
  run("inject transitions", "node", [S("transitions.mjs"), "inject", "--storyboard", "./STORYBOARD.md", "--smashcut", "."]);
  run("verify transitions", "node", [S("transitions.mjs"), "verify", "--storyboard", "./STORYBOARD.md", "--index", "./index.html"]);
  run("lint", "npx", ["smashcut", "lint"]);
  run("check", "npx", ["smashcut", "check"], { fatal: false });

  mkdirSync(join(PROJECT, "renders"), { recursive: true });
  const workers = opt("workers", "2"); // a Chrome per worker; 2 is safe under ~8 GB
  run("render", "npx", [
    "smashcut", "render", "--skill=pr-to-video", "--quality", "high",
    "--output", "renders/video.mp4", "-w", workers,
  ]);

  console.log(`\n✓ ${join(PROJECT, "renders", "video.mp4")}\n`);
  process.exit(0);
}

// ── phase 2: audio + packets ─────────────────────────────────────────────────
if (RESUME) {
  if (!existsSync(join(PROJECT, "STORYBOARD.md"))) {
    console.error(`✗ no STORYBOARD.md in ${PROJECT} — write it first (Step 3).`);
    process.exit(1);
  }
  const hasScript = existsSync(join(PROJECT, "SCRIPT.md"));

  if (hasScript) {
    run("audio (narration + bgm)", "node", [
      S("audio.mjs"), "--script", "./SCRIPT.md", "--storyboard", "./STORYBOARD.md",
      "--smashcut", ".", "--out", "./audio_meta.json",
    ]);
    run("sync durations", "node", [S("audio.mjs"), "sync-durations", "--audio-meta", "./audio_meta.json", "--storyboard", "./STORYBOARD.md"]);
  } else {
    console.log("\n▶ no SCRIPT.md — treating the film as silent (BGM only if the storyboard names a music mood)");
    run("audio (bgm only)", "node", [S("audio.mjs"), "--storyboard", "./STORYBOARD.md", "--smashcut", ".", "--out", "./audio_meta.json"], { fatal: false });
  }

  run("build frame packets", "node", [S("frame-packets.mjs"), "--project", PROJECT, "--storyboard", join(PROJECT, "STORYBOARD.md")]);

  stop("Packets are built. The frames are yours to build.", [
    "Dispatch ONE sub-agent per frame. Each gets, in full:",
    "",
    `  ${join(PROJECT, ".smashcut", "frame-packets", "_role.md")}`,
    `  ${join(PROJECT, ".smashcut", "frame-packets")}\\<frame-id>.md`,
    "",
    "plus PROJECT_DIR, frame_id, canvas size and the caption keep-out band.",
    "Each worker writes only compositions/frames/<frame-id>.html.",
    "",
    "Durations may have moved when the real voice length landed — re-check any",
    "frame whose media window no longer fits before dispatching.",
    "",
    "Then:  node generate.mjs --project <dir> --finish",
  ]);
}

// ── phase 1: setup + ingest + design system ──────────────────────────────────
if (!PR) {
  console.error("✗ --pr is required for the first run (url, owner/repo#N, or N).");
  process.exit(1);
}

run("preflight", "node", [S("preflight.mjs")], { cwd: process.cwd() });

if (!existsSync(join(PROJECT, "smashcut.json"))) {
  run("init project", "npx", [
    "smashcut", "init", PROJECT, "--non-interactive", "--example=blank", "--skill=pr-to-video",
  ], { cwd: process.cwd() });
} else {
  console.log(`\n▶ init project — already exists at ${PROJECT}, skipping`);
}

run("auth status", "npx", ["smashcut", "auth", "status"], { fatal: false });

run("fetch PR", "node", [S("fetch-pr.mjs"), "--pr", PR, "--out-dir", "./capture"]);
run("ingest", "node", [
  S("ingest.mjs"), "--pr-json", "./capture/pr.json",
  "--diff", "./capture/diff.patch", "--out-dir", "./capture/extracted",
]);
run("contributor avatars", "node", [S("fetch-people-avatars.mjs"), "--people", "./capture/extracted/people.json"], { fatal: false });
run(`design system (${PRESET})`, "node", [S("build-frame.mjs"), "--preset", PRESET, "--smashcut", "."]);

stop("Ingest is done. The story is yours to write.", [
  `Project:  ${PROJECT}`,
  "",
  "Read capture/extracted/visible-text.txt and capture/pr.json, then write:",
  "",
  "  BRIEF.md       the locked brief (smashcut-core/references/brief-format.md)",
  "  STORYBOARD.md  one frame per beat — every frame needs duration, src,",
  "                 transition_in, and a blueprint (or `compose`)",
  "  SCRIPT.md      the narration, if the film is narrated",
  "",
  "Cite every motion by name in backticks — an uncited scene line ships an",
  "empty packet and the worker invents the motion.",
  "",
  "Then:  node generate.mjs --project <dir> --resume",
]);
