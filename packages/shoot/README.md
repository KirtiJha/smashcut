# @smashcut/shoot

Drive a real application through an asserted flow, film it, and write down every
moment you caused.

SmashCut renders HTML to video and is very good at it. What it has no way to
produce is *footage of a real product doing a real thing* — its own `capture`
reads a website's design so an agent can rebuild it, which is a different job
from operating software and recording the result. That gap is this package.

```bash
smashcut shoot demo.yaml --out shot
```

Out comes `footage.mp4` and `shots.json`.

Verify the flow first — this drives the app but films nothing, and a selector
that resolves to nothing fails in seconds instead of after the driver has
operated the whole product at human speed:

```bash
smashcut shoot demo.yaml --check
```

## The manifest is the point

A bare `.mp4` is a poor handoff. A composition needs to *time* things against
the footage — a lower third when the user clicks Add, a push-in on the moment a
result appears — and without a manifest an author is left scrubbing a video and
guessing at timestamps.

`shots.json` carries, in the recording's own time:

| Field       | What it is                                                        |
| ----------- | ----------------------------------------------------------------- |
| `beats`     | Named moments, written at the instant the driver caused each one   |
| `captions`  | What the demo claimed, and when                                    |
| `sfx`       | Every sound it made: a tick per click, key texture per typed field |
| `narration` | Spoken lines, with audio when it exists                            |
| `cards`     | Cards the spec asked for, for the composition to build             |

Those times are exact because the driver caused them. An edit that lands on a
beat reads as direction; the same edit two hundred milliseconds late reads as a
mistake, and there is no way to tell the difference by eye afterwards.

`smashcut init --shot <dir>` turns the manifest into a seeded `STORYBOARD.md`.

## What it deliberately does not do

Compose. No chrome, no burned-in captions, no title cards, no fades — every one
of those is the composition's decision, and a decision baked into a frame cannot
be unmade. A `scene:` step records a card *marker* rather than filming a card,
so the composition draws it from the frame presets like any other scene.

Zoom is the exception and stays on by default: a push-in is a property of the
shot, chosen while the app was being driven with the element's real box in hand,
and it cannot be recovered from a flat recording without upscaling. `--flat`
turns it off.

## Licence

Apache-2.0. See `NOTICE` at the repository root.
