---
name: app-demo-video
description: "Turn working software into a demo film — drive a web app, a locally running app, or a command-line program through a real flow, film it, and cut the footage into a video. Use when the video needs something to *happen* in the product: a feature walkthrough, an onboarding clip, a changelog demo, a CLI tour, 'show how X works'. Unclear → /smashcut."
---

> **First, keep this skill fresh — confirm with the user before running:** `npx smashcut skills update app-demo-video`. A fast no-op when everything is current; otherwise it refreshes this skill plus the core domain skills it depends on.

# Working software to a demo film

Use this skill to operate a real product, record what it did, and build a film
around the recording.

> **The front door is `/smashcut`.** You are the orchestrator. Run each step,
> verify its gate, and only then continue. This skill is for software that gets
> **driven** — clicked, typed into, run. A video that only needs a site's
> *design* is `/product-launch-video`; it captures screens and clicks nothing.
> Any other intent, a bare "make a video", or any uncertainty → read
> `/smashcut` first.

Work in `videos/<project>/`. Do every step yourself except Step 5, where you
dispatch one sub-agent per frame.

Workflow: Step 0 setup → `smashcut.json` · Step 1 **shoot** → `shot/` ·
Step 2 design system → `frame.md` · Step 3 storyboard → `STORYBOARD.md` ·
Step 3.1 audio → `audio_meta.json` · Step 4 visual design → enriched
`STORYBOARD.md` · Step 5 frames → `compositions/frames/` · Step 6 render.

Only Step 1 is new. Everything from Step 2 on is the ordinary production loop
(`smashcut-core` `references/production-loop.md`), and it is unchanged — which
is the point: the footage arrives as ordinary material, and the whole pipeline
already knows what to do with it.

---

## Step 0: Setup

Enter with a confirmed brief. Initialize only if `smashcut.json` is missing:

```bash
npx smashcut init "videos/<project>" --non-interactive --example=blank --skill=app-demo-video
```

Write `BRIEF.md` immediately after init, per
`../smashcut-core/references/brief-format.md`. This route's brief carries two
extra things: **how to reach the app** (a URL, or the command that starts it)
and **the flow** the viewer should watch happen.

**Gate:** `smashcut.json` and `BRIEF.md` exist.

---

## Step 1: Shoot

Goal: real footage of the software, plus the manifest that makes it editable.

A demo is written as a spec — a YAML file naming the app and the steps to drive
through it. Three ways to get one, in order of preference:

1. **It already exists.** Read it. Do not rewrite a working spec to taste.
2. **Record one.** `smashcut shoot --author` watches somebody perform the flow in
   a browser and writes the spec down, selectors and all. Best when the flow is
   known but nobody has written it.
3. **Write it** from the brief. The grammar is in
   `references/spec.md`; the short version is a `url:` (or `run:` to boot the
   app, or `terminal:` for a CLI) and a list of steps.

Then film it:

```bash
smashcut shoot demo.yaml --out shot
```

**Assert, don't just perform.** A step that waits for real state — `waitFor`,
`expectOutput`, `expectCode` — makes the demo a smoke test of the product, so it
fails loudly the day the flow breaks instead of quietly filming the wrong thing.
This is most of why a demo built this way stays true. Prefer `waitFor: text=…`
over a fixed delay everywhere.

**Check before you film.** `smashcut shoot` drives a real browser and encodes
video; a broken selector costs minutes. `smashcut check demo.yaml` runs every
step headlessly and exits non-zero on the first one that cannot complete.

**Gate:** `shot/footage.mp4` and `shot/shots.json` both exist, and the manifest
`duration` is what you expected. A shoot that "succeeded" in two seconds drove
nothing.

### Step 1b: seed the project from the shoot

```bash
smashcut init <project> --shot shot
```

This mounts the footage **and** writes `STORYBOARD.md` from the manifest: one
frame per caption span and per card, each carrying the beats recorded inside it,
with the direction left as `TODO`. Step 3 then edits a plan built from recorded
fact instead of starting blank.

Use `--video` instead only when you have footage with no manifest. It mounts the
file and nothing else.

### What the manifest gives you, and why it matters downstream

`shots.json` carries, in the recording's own time:

| Field       | What it is                                                       |
| ----------- | ---------------------------------------------------------------- |
| `beats`     | Named moments — the driver wrote each at the instant it caused it |
| `captions`  | What the demo claimed, and when                                   |
| `sfx`       | Every sound it made: a tick per click, key texture per field      |
| `narration` | Spoken lines, with audio when it exists                           |
| `cards`     | Cards the spec asked for, for **you** to build                    |

**Cut against the beats.** They are exact because the driver caused them. A
push-in landing on the beat reads as direction; the same push-in 200ms late
reads as a mistake, and no editor can tell the difference by eye afterwards.

**`cards` are markers, not footage.** A `scene:` step records what a card should
say and takes no recording time at all. Build each one as its own frame in the
composition, from `frame.md` and the blueprints — never as a burn-in.

---

## Steps 2 – 6: the ordinary loop

From here the footage is material like any other. Follow
`../smashcut-core/references/production-loop.md`, with these route-specific
notes:

- **Step 2, design system.** There is no site to harvest tokens from, so the
  look comes from the product's own UI or from a frame preset
  (`/smashcut-creative`). Sampling the app's real accent out of the footage is
  usually right — a demo that looks like the product is the point.
- **Step 3, storyboard.** The manifest's captions are the demo's own claims and
  make good first-draft `voiceover` lines. The beats are natural frame
  boundaries: a chapter per feature.
- **Step 4, visual design.** Footage frames get a **lower third**, not floating
  text: the picture moves and anything laid over it collides eventually. The
  band goes at the bottom edge.
- **Step 5, frames.** Footage frames mount the recording; `object-fit: contain`,
  always. A demo cropped to fill the frame loses the thing it is about — and a
  terminal cropped loses the text, which *is* the demo.
- **Step 6, render.** As usual.

---

## Things that will bite

- **Never crop the footage.** `contain`, and no camera scale on a terminal at
  all: its content already runs the full width, so any push-in pushes characters
  off the edge.
- **A demo behind a login uses a saved storage state**, never credentials in the
  spec. `signIn:` restores one off-camera.
- **Determinism is the spec's job.** A frozen clock and mocked network make two
  shoots of the same spec produce the same footage; without them the film
  changes every time somebody re-records it.
- **The footage is regenerable, the spec is not.** Commit the spec. `shot/` is
  build output.
