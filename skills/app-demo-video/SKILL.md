---
name: app-demo-video
description: "Turn working software into a demo film — drive a web app, a locally running app, or a command-line program through a real flow, film it, and cut the footage into a video. Use when the video needs something to *happen* in the product: a feature walkthrough, an onboarding clip, a changelog demo, a CLI tour, 'show how X works'. Unclear → /smashcut."
---

> **First, keep this skill fresh — confirm with the user before running:** `npx smashcut skills update app-demo-video`. A fast no-op when everything is current; otherwise it refreshes this skill plus the core domain skills it depends on before you rely on them.

> **media-use**: Before sourcing audio/images/logos, call `/media-use` to resolve BGM/SFX/images from the HeyGen catalog and brand logos from their official sources. Run `--adopt` first to register existing assets. See `/media-use` skill.

# Working software to a demo film

Use this skill to drive a real application through an asserted flow, record what
happened, and cut that footage into a film.

> **The front door is `/smashcut`.** You are the orchestrator. Run each step,
> verify its gate, and only then continue. This skill is for software that must be
> **operated and filmed**. A marketing page with nothing to operate is
> `/product-launch-video`. Any other intent, a bare "make a video", or any
> uncertainty → read `/smashcut` first.

Work in `videos/<project>/`. User-gated steps are Step 0, Step 3, and Step 6. Read
`../smashcut-core/references/brief-contract.md` before Step 0. Do every step
yourself except Step 5, where you dispatch one sub-agent per frame. Design and
motion rules live in the frame-worker sub-agent, in `../smashcut-animation/`, and
in `smashcut-creative` — not here.

Workflow: Step 0 setup → `smashcut.json` · Step 1 shoot → `shot/` · Step 2 design
system → `frame.md` · Step 3 storyboard/script → `STORYBOARD.md` + `SCRIPT.md` ·
Step 3.1 audio → `audio_meta.json` · Step 4 visual design → enriched
`STORYBOARD.md` · Step 5 frames → `compositions/frames/NN-*.html` + `index.html` ·
Step 6 transitions, checks, render → `renders/video.mp4`.

The visual source is a recording of real software, produced here rather than
captured from a page. Everything else — many small frames, one worker each, cited
blueprints and rules, a transition on every seam — is the same as
`product-launch-video`, `faceless-explainer` and `pr-to-video`.

---

## Step 0: Setup

Goal: enter with a confirmed brief, create the project, make the brief durable.

Opening rule, in order: **(1)** `BRIEF.md` exists → read it and ask nothing.
**(2)** No `BRIEF.md` but the project exists → resume from the storyboard's
frontmatter and recorded preferences. **(3)** Neither → read `/smashcut` and run
its intent layer, which hands back a locked brief. Edit requests skip all of this.

Initialize only if `smashcut.json` is missing:

`npx smashcut init "videos/<project>" --non-interactive --example=blank --skill=app-demo-video`

Let `<PROJECT_ROOT>` be `videos/<project>` and run every later relative-path
command with that directory as its working directory.

**Write `BRIEF.md` immediately after init**, shape per
`../smashcut-core/references/brief-format.md`, then record each preference-backed
answer with `node <MEDIA_DIR>/scripts/prefs.mjs record --smashcut .`.

**Show sign-in status before proceeding** — run `npx smashcut auth status` and
relay it verbatim. `auth status` **exits 1 when not signed in**; that is the normal
signed-out state, not a failure — don't retry it or chain it with `&&`.
Collaborative: wait for sign-in or an explicit `offline`/`go`. Autonomous: state
the status and continue on local engines. BGM has no local provider; if the brief
wants music and no credential exists, surface that here.

**Gate:** `smashcut.json` and `BRIEF.md` exist; preferences recorded; sign-in
status shown.

---

## Step 1: Shoot the app

Goal: drive the product through the real flow and record it, with a manifest.

Write the spec first; read `../smashcut-cli/` for the `shoot` command surface. A
demo behind a login uses a **saved storage state**, never credentials in the spec:
`signIn:` restores one off-camera. A frozen clock and mocked network make two
shoots of the same spec produce the same footage.

Verify the selectors before filming:

```bash
npx smashcut shoot <spec>.yaml --check
```

`--check` drives the whole flow — real navigation, real state waits, no holds, no
encode — and writes nothing. Run it after writing the spec and again whenever the
app may have moved under it.

In component UIs, `text=` matches text *content*, so it misses a `placeholder`
attribute, and `.first()` can bind to a hidden node from a list still mounted
behind the visible one. `[aria-label="…"]` and `>> visible=true` are stable.

Then film it:

```bash
npx smashcut shoot <spec>.yaml --out shot
```

Out comes `shot/footage.mp4` and `shot/shots.json`.

`shots.json` carries, in the recording's own time: `beats`, `captions`, `sfx`,
`narration`, `cards`. These times are exact because the driver caused them. Read
every downstream time from this file; never re-derive it from the script or place
it by ear. **The beats are the cut points.**

**Gate:** `shot/footage.mp4` and `shot/shots.json` exist; `--check` passed on the
final spec; you can state the flow in one sentence.

---

## Step 2: Design System

Goal: one `frame.md` for the film's look.

Sample the product's own accent, ground and type from the recording or the running
app into `capture/extracted/tokens.json`
(`{ "title": "", "description": "", "colors": [], "fonts": [] }` — create it by
hand; this route has no `capture` step), then:

```bash
node <SKILL_DIR>/scripts/build-frame.mjs --preset <name> --smashcut .
```

Read `../smashcut-creative/references/design-spec.md` to choose the preset; when
`BRIEF.md` names a `style_preset`, use it.

**This route stages no fonts of its own.** `build-frame.mjs` stages from
`capture/assets/fonts`, which the capture-based routes fill and this one does not.
Put the brand's `.woff2` files there before running it — named
`<Family>-<weight>.woff2`, since the weight is parsed back out of the filename —
or every frame renders in a generic face while `frame.md` names the brand.

**Gate:** `build-frame.mjs` exited 0; `frame.md` exists; a `## Font loading`
section is present when the brand ships faces; the preset was recorded.

---

## Step 3: Storyboard and Script

Goal: an approved frame-by-frame plan in which footage and designed frames
alternate.

Read `../smashcut-creative/references/story-spine.md`, `references/story-design.md`,
`../smashcut-animation/blueprints-index.md`,
`../smashcut-core/references/storyboard-format.md` and
`../smashcut-core/references/script-format.md`.

`smashcut init --shot <dir>` seeds `STORYBOARD.md` from `shots.json`: one candidate
frame per beat, each carrying `footage_at` and a `transition_in`. Then plan:

- **A frame is a shot, not a chapter.** Merge a beat that is a micro-step; split
  one that develops twice.
- **Cut the recording.** Consecutive footage frames should mount **non-contiguous**
  slices — the approach to a click and the result of it — so the picture actually
  cuts. Contiguous slices produce one continuous take with changing overlays.
- **Put designed frames between them** — hook, chapter marks, a stat, the end card.
  Pick each one's blueprint from `blueprints-index.md`.
- **Every frame gets a `transition_in`.** `cut` is a legitimate choice and must be
  a chosen one → `../smashcut-animation/transitions/overview.md`.
- The manifest's `captions` make good first-draft `voiceover` lines.
- Give every frame a `src:` (`compositions/frames/NN-*.html`) — the packet builder
  requires it.

Run the review loop's plan pass — `../smashcut-core/references/review-loop.md` § 1.

**Gate:** every footage frame has a `footage_at` traceable to a beat; every frame
has `transition_in` and `src`; designed frames sit between the footage; `SCRIPT.md`
exists when narration is needed; the plan was approved.

---

## Step 3.1: Audio

Goal: narration, word timings, music, metadata.

Start after Step 3 approval, in the background, then continue to Step 4.

```bash
node <SKILL_DIR>/scripts/audio.mjs --script ./SCRIPT.md --storyboard ./STORYBOARD.md \
  --smashcut . --out ./audio_meta.json --provider <provider> --voice <voice-id> &
```

`shoot` hands you narration and SFX already synchronised, which makes it easy to
skip the bed. BGM mood comes from the storyboard's `music:`; `music: none` turns it
off deliberately. A bed under narration wants a **carve**, not a duck →
`/smashcut-audio`; carve against a voice **group**, never a list of clip ids.

**Gate:** audio job started, or the project is marked silent (`music: none` + no
`SCRIPT.md`).

---

## Step 4: Frame Visual Design

Goal: the visual direction and motion choices for each frame.

Sketch the board first in collaborative mode —
`../smashcut-core/references/review-loop.md` § 2.

Edit `STORYBOARD.md` in place. Read `references/visual-design.md`,
`../smashcut-animation/blueprints-index.md`, `references/motion-language.md` and
`../smashcut-animation/rules-index.md`. Write a **time-coded shot sequence** for
every frame and one `## Video direction` block.

- **Footage frames get a shot sequence too.** The recording playing is not
  direction. Say what arrives, when, where it sits, and where the eye is sent.
- **Name every motion in backticks.** The packet builder inlines a rule's recipe
  only for a rule cited by name; an uncited Scene line ships an empty packet.
- Do not decide ease curves, millisecond durations or stagger here — Step 5 owns
  those.
- Add `handoff_out:`/`handoff_in:` with exact x/y, scale, opacity and direction
  wherever an element continues across a frame boundary.

`node <SKILL_DIR>/scripts/stage-assets.mjs --storyboard ./STORYBOARD.md --smashcut .`

**Gate:** every frame has a time-coded shot sequence paced to the voiceover; every
`compose` frame cites at least one rule; `## Video direction` exists.

---

## Step 5: Build Frames

Goal: build every frame as its own composition and assemble the video.

Wait for Step 3.1, then sync durations and fetch SFX (skip if silent):

```bash
node <SKILL_DIR>/scripts/audio.mjs sync-durations --audio-meta ./audio_meta.json --storyboard ./STORYBOARD.md
node <SKILL_DIR>/scripts/audio.mjs fetch-sfx --storyboard ./STORYBOARD.md --smashcut .
```

Real voice duration wins. **Re-check the footage windows afterwards**: a frame
whose synced duration now exceeds its slice runs out of picture, and one whose
window has grown into its neighbour's loses the cut between them.

Read `../smashcut-core/references/subagent-dispatch.md`, then:

```bash
node <SKILL_DIR>/scripts/frame-packets.mjs --project "$PROJECT_DIR" --storyboard "$PROJECT_DIR/STORYBOARD.md"
```

Dispatch **one sub-agent per frame**, in parallel where possible. Each worker gets
`_role.md` and exactly one packet, plus `PROJECT_DIR`, `frame_id`, canvas size, and
caption status + keep-out band. Workers read only their packet and `frame.md`, and
each writes only its own `compositions/frames/NN-*.html`.

**Packets are static.** If a `footage_at` moves after packets are built, tell the
affected workers directly — nothing else will.

Footage frames mount their slice as an approved frame video —
`<video data-frame-video="approved" src="footage.mp4" data-media-start="…">` with
numeric `data-frame-video-x/y/width/height` and `fit="contain"`.

**Full-bleed backgrounds ride on a `class="clip"` layer, never the `#root`.**

Mark each frame `animated` as its worker returns, then:

```bash
node <SKILL_DIR>/scripts/captions.mjs build --storyboard ./STORYBOARD.md --audio-meta ./audio_meta.json --smashcut . --out ./caption_groups.json &
node <SKILL_DIR>/scripts/assemble-index.mjs --storyboard ./STORYBOARD.md --smashcut .
```

**Assembly is one-way.** It hoists each approved video to the host root and writes
the stripped frame back to disk. Running it a second time finds nothing to hoist
and the film loses its footage silently — 23 frames still assemble, still lint,
still verify. Assemble once; if you must re-run it, restore the `<video>` tags from
`STORYBOARD.md` first, and confirm the index holds one `data-media-start` per
footage frame.

**Gate:** every frame is `animated`; `index.html` exists; the index holds one video
per footage frame; captions built or explicitly skipped.

---

## Step 6: Finalize

```bash
node <SKILL_DIR>/scripts/transitions.mjs inject --storyboard ./STORYBOARD.md --smashcut .
node <SKILL_DIR>/scripts/transitions.mjs verify --storyboard ./STORYBOARD.md --index ./index.html
npx smashcut lint
npx smashcut check
npx smashcut snapshot --at <frame-midpoints-and-each-cut-minus-0.1s-and-plus-0.2s>
```

`verify` is the gate that catches a film assembled without transitions.

Inspect the contact sheet: midpoints for layout failures, then the pair around
every cut. Check that consecutive footage frames actually differ — two frames
mounting overlapping slices at the same geometry make an invisible cut.

`content_overlap` on a deliberately stacked frame is declared with
`data-layout-allow-overlap` on each layering participant, never on a wrapper.

Pause for the review loop's final look (§ 4), then:

```bash
npx smashcut preview --background
npx smashcut render --skill=app-demo-video --quality high --output renders/video.mp4
```

Each render worker launches a Chrome (~256 MB) alongside ffmpeg and the decoded
audio graph; under ~8 GB pass `-w 2` or `-w 1` rather than letting `auto` pick. A
killed render orphans its `chrome-headless-shell` and `ffmpeg` children — reap them
before retrying.

**Gate:** `transitions verify`, `lint` and `check` passed and snapshots were
inspected; user approved; `renders/video.mp4` exists. Final reply states MP4 path
and duration.

---

## Things that will bite

- **The recording is a fact; the storyboard is a plan.** Extract real frames with
  `ffmpeg -ss <footage_at> -i footage.mp4 -frames:v 1` before placing anything
  against the app's UI. The page may still be settling, a list may reorder as a
  filter resolves, and a window that starts before the first click still shows the
  previous screen.
- **`shoot`'s own callouts and zooms are baked into the picture.** A `callout` step
  dims the page and burns in a tooltip; auto-zoom cuts the framing mid-window.
  Don't stack a second scrim on the app's own dim, and don't print words the
  recording already prints.
- **Never crop the footage.** `contain`, and no camera scale on a terminal at all.
  A micro-drift under 2% is not a crop.
- **A demo asserts what it shows.** Any figure on screen must be read off the
  product, not assumed. If it cannot be verified, drop it.
- **The footage is regenerable, the spec is not.** Commit the spec; `shot/` is
  build output.

## Quick Reference

| Read | When |
| --- | --- |
| `../smashcut-core/references/brief-contract.md` | Gate types, mode derivation. |
| `../smashcut-cli/` | Step 1: the `shoot` command surface and spec grammar. |
| `../smashcut-creative/references/story-spine.md` | Step 3: story doctrine. |
| `references/story-design.md` | Step 3: plan the demo's story. |
| `../smashcut-animation/blueprints-index.md` | Step 3–4: role→blueprint menu. |
| `../smashcut-animation/transitions/overview.md` | Step 3: choose each `transition_in`. |
| `../smashcut-core/references/storyboard-format.md` | Step 3: write `STORYBOARD.md`. |
| `../media-use/audio/references/tts.md` | Step 3.1: providers and voices. |
| `/smashcut-audio` | Step 3.1: the voiceover carve. |
| `references/visual-design.md` | Step 4: the shot sequence method. |
| `references/motion-language.md` | Step 4: motion vocabulary and doctrine. |
| `references/cut-catalog.md` | Step 4–5: within-frame seams. |
| `../smashcut-animation/rules-index.md` + `rules/` | Step 5: rule recipe bodies. |
| `../smashcut-core/references/frame-worker-core.md` | Step 5: shared worker contract. |
| `sub-agents/frame-worker.md` | Step 5: this route's worker delta. |
| `../smashcut-core/references/subagent-dispatch.md` | Step 5: dispatch safely. |
