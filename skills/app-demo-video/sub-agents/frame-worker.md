# Frame worker — app-demo delta

You are building ONE frame of a demo film. The product was driven through a real
flow and recorded; `shot/shots.json` wrote down every moment the driver caused.
Your packet says which of the two kinds of frame you have.

## The two kinds of frame

**A footage frame** shows the product doing something. Its packet carries
`footage_at` — a recorded beat time in the recording's own clock — plus the
frame's `duration`, and the storyboard header names the source file. Mount
exactly that slice; never invent or round an offset.

**A designed frame** has no `footage_at`: a chapter opener, a claim, a stat,
the end card. Build it from its blueprint like any other route. Nothing about
this route makes designed frames plainer — they are the film's punctuation and
they carry its argument.

## Mounting a footage slice

```html
<video
  data-frame-video="approved"
  src="shot/footage.mp4"
  data-media-start="46.5"          <!-- footage_at, from the packet. Never guessed. -->
  data-start="0" data-duration="6.2" data-track-index="0"
  data-frame-video-x="0" data-frame-video-y="0"
  data-frame-video-width="1920" data-frame-video-height="1080"
  data-frame-video-fit="contain"
  muted playsinline
></video>
```

`assemble-index.mjs` hoists this to the host root and translates its timing, so
it never ends up nested inside a timed element. Two consequences:

- **Geometry must be numeric on the element.** Frame-local CSS classes and inline
  styles do NOT cross the hoist boundary. If you want the recording inset in a
  card, say so in `data-frame-video-x/y/width/height`.
- `data-media-start` IS forwarded, which is what makes a slice possible. The same
  `footage.mp4` may be mounted by many frames at different offsets; that is the
  normal shape of this route, not a duplication to avoid.

**`fit` is `contain` for a web app and `contain` for a terminal, always.** A demo
cropped to fill loses the thing it is about, and a cropped terminal loses the
text, which *is* the demo.

## What the footage does and does not excuse

The recording moves, so a frame built around it looks alive in a snapshot and
reads as a screen capture at speed. Everything the other routes require still
applies here:

- **Cite the recipe before writing the motion.** Your packet inlines the
  blueprint and every rule it names. The chrome around the footage — the lower
  third, the chapter mark, the callout — arrives on a cited rule, not on a fade
  you invented. `waterfall-entry` is the usual arrival, and it is explicit that
  opacity is binary via `tl.set`: **never fade an arrival.**
- **The frame must develop across its whole window.** A footage frame that mounts
  a clip and then does nothing has front-loaded itself; the recording is playing,
  but the frame is not directing. Time your reveals to the voiceover.
- **Exit animations are banned** except on the final frame. The transition is the
  exit, and the orchestrator injects it — outgoing content must still be fully
  visible when your window ends.

## Directing attention inside the shot

The viewer does not know where to look in a full-frame application. Pick one and
say it in motion:

- **Dim and spotlight.** A ground-colour scrim at ~40–55% over the whole picture
  with a soft radial hole over the region being discussed reads instantly and
  costs nothing in fidelity — nothing is cropped, everything is still there.
- **A callout anchored to a real box.** The packet's beat carries the element the
  driver acted on; put the label beside it, not centred.
- **Micro-drift only for camera.** `multi-phase-camera`, drift register, **≤2%
  scale**. Above that you are cropping, which this route forbids. Zero on a
  terminal.

## Chrome, keep-outs and audio

The lower third owns the bottom band; keep the frame's own content out of it when
captions are enabled (your dispatch context gives the band). Never place a label
over the app's own wordmark or primary navigation — that is the one region a
product demo must leave visible.

Audio stays orchestrator-owned: **never author `<audio>` in a frame**, and never
unmute the footage. The recording's sound, where it exists, is mixed from the
manifest by the orchestrator.

## Cross-frame handoffs

When an element visibly continues across a frame boundary, your packet carries
`handoff_in:` / `handoff_out:` with exact x/y, scale, opacity and direction. Hit
those numbers exactly — a parallel worker is building the other side of that seam
from the same block, and the two must agree.
