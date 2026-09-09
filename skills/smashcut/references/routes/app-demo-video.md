# Route: app-demo-video

- **Input:** Software that can be *operated* — a web app at a URL or behind a local dev server, a desktop app served locally, or a command-line program — plus a flow worth showing. A `.yaml` demo spec if one already exists; otherwise the interview derives the flow, or `smashcut shoot --author` records one by watching somebody perform it.
- **Output:** A product demo, feature walkthrough, changelog clip, onboarding video, or CLI tour. The footage is the real software doing the real thing. Sweet spot 20–90s; a walkthrough covering several features can run longer because each is a chapter.
- **Triggers:** "demo of our app", "show this feature working", "record a walkthrough", "video of the CLI", "demo video from our staging site", "show how X works in the product", "turn this user flow into a video".

## What makes this route different

Every other route *draws* its subject. This one **operates** it. The distinction
decides the route, and getting it wrong is expensive:

- `/product-launch-video` reads a website's **design** — screenshots, tokens,
  fonts — so the frames can be rebuilt as motion graphics. Nothing is clicked.
- `/app-demo-video` **drives** the software: types into fields, clicks buttons,
  waits for real state to arrive, asserts it did, and films what happened.

So "market our website" is route 8 even when the site is an app's marketing
page, and "show someone adding a task in our app" is this one even when the app
is at the same domain. Ask which is wanted when a request could be either — the
tell is whether the video needs anything to *happen*.

A CLI has no design to capture at all, so a terminal demo is always this route.

## The step this route adds

Its Step 1 is `smashcut shoot`, not `smashcut capture`:

```bash
smashcut shoot demo.yaml --out shot
```

It boots the app if the spec declares one, drives every step, and writes
`shot/footage.mp4` plus `shot/shots.json` — the shot manifest. Everything
downstream is the ordinary production loop.

**The manifest is what this route contributes.** It carries every beat, caption,
sound cue, spoken line and card in the recording's own time, written by the
driver at the instant it caused each one. That is the difference between a
lower third that lands on the click and one two hundred milliseconds late, and
it cannot be recovered from the footage afterwards by eye. Cut against it.

## Interview

- **Must-haves:** **the flow** — what the viewer should watch happen, end to end,
  in the order it happens · **how to reach the app** — a URL, or the command that
  starts it locally · **length** — 20–90s for one flow; longer only when the demo
  is genuinely several chapters.
- **Conditional:** an app behind a login adds **how to sign in** (a saved storage
  state, never credentials in the spec) · a CLI adds **which commands**, and
  whether their output is deterministic · a spec that already exists skips all of
  the above — read it.
- **Ask about failure once:** should the demo *assert* what it shows? A flow with
  assertions doubles as a smoke test and fails loudly when the product changes
  under it, which is most of why a demo like this stays true. Default yes.
- **Pitch round:** after the flow is settled, not before — the pitches are about
  how to frame what the software does, and that needs to be known first.
- **Run-shape:** both.

## What the shoot deliberately does not do

No chrome, no burned-in captions, no title cards, no fades. Each of those is the
composition's decision and a decision baked into a frame cannot be unmade. A
`scene:` step in the spec records a **card marker** rather than filming a card,
so the composition builds it out of the frame presets like every other scene.

Zoom is the exception and stays on: a push-in is a property of the *shot*,
chosen while the app was being driven with the element's real box in hand, and
it cannot be recovered from a flat recording without upscaling. `--flat` turns
it off when the composition would rather do all its own framing.
