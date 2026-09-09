import type { ShotManifest } from "./manifest.js";

/**
 * A storyboard seeded from what the driver actually recorded.
 *
 * ## The gap this closes
 *
 * `smashcut shoot` writes a manifest carrying every beat, caption, sound cue,
 * spoken line and card in the recording's own time. Until now nothing read it:
 * `init --video` mounted the footage and threw the rest away, so an author
 * opened a blank storyboard and re-derived the film's structure by scrubbing an
 * mp4 — which is exactly the work the manifest exists to make unnecessary, and
 * the only reason this is better than dropping a clip into a video editor.
 *
 * ## Why the segmentation is arithmetic rather than a guess
 *
 * A demo already tells you where its chapters are. Each caption is a claim the
 * demo made, so a caption opening is a frame boundary; each card is its own
 * scene by definition. Both are recorded facts with exact times, so the frame
 * list is derived, not invented — and an author who disagrees is editing a plan
 * rather than starting one.
 *
 * What is deliberately *not* derived is the direction: what is on screen, what
 * moves, where it sits. That is judgement, and a plausible-sounding line nobody
 * wrote is worse than a blank, because it reads as a decision and gets built.
 * So each frame carries the recorded facts and an explicit TODO.
 */

/** One frame of the seeded plan. */
export interface SeededFrame {
  title: string;
  /** Seconds into the footage. */
  at: number;
  duration: number;
  kind: "footage" | "card";
  /** Contact-sheet caption. */
  scene: string;
  /** The narration guide for this span, when the demo said anything. */
  voiceover?: string;
  /** Recorded facts inside this span, for the author to cut against. */
  beats: { label: string; t: number }[];
  /**
   * Captions from spans too short to be their own frame.
   *
   * Kept so a claim the demo made on screen still reaches the plan; the frame
   * covers their time, so an author building it needs to know what the footage
   * underneath is saying.
   */
  folded?: string[];
}

/** Shortest span worth its own frame — below this it is a twitch, not a chapter. */
const MIN_SPAN = 1.5;

/**
 * Cut the recording into frames at its own boundaries.
 *
 * Cards first, because a card is a scene in its own right and splits whatever
 * footage it lands in. Then captions, because each is a claim the demo made.
 * A span shorter than `MIN_SPAN` is folded into the one before it: a demo can
 * caption twice in a second, and one frame each is a plan nobody can direct.
 */
export function seedFrames(shot: ShotManifest): SeededFrame[] {
  const marks: { at: number; kind: "footage" | "card"; title: string; card?: boolean }[] = [];

  marks.push({ at: 0, kind: "footage", title: shot.name });
  for (const c of shot.captions) marks.push({ at: c.t, kind: "footage", title: c.text });
  for (const c of shot.cards) {
    marks.push({ at: c.t, kind: "card", title: String(c.fields["title"] ?? c.kind) });
  }
  marks.sort((a, b) => a.at - b.at || (a.kind === "card" ? -1 : 1));

  const out: SeededFrame[] = [];
  for (const [i, m] of marks.entries()) {
    const end = marks[i + 1]?.at ?? shot.duration;
    const duration = Number((end - m.at).toFixed(3));
    // Too short to direct: give its time to the frame before it, but keep what
    // the demo said. Dropping the span silently would lose a claim the product
    // actually made on screen — the caption is the evidence, and a plan that
    // quietly omits one sends an author to build a frame that contradicts the
    // footage under it.
    if (duration < MIN_SPAN && out.length > 0 && m.kind !== "card") {
      const prev = out[out.length - 1]!;
      prev.duration = Number((prev.duration + duration).toFixed(3));
      prev.folded = [...(prev.folded ?? []), m.title];
      continue;
    }
    if (duration <= 0) continue;

    const beats = shot.beats.filter((b) => b.t >= m.at && b.t < end);
    const said = shot.narration.filter((l) => l.t >= m.at && l.t < end).map((l) => l.text);

    out.push({
      title: m.title,
      at: Number(m.at.toFixed(3)),
      duration,
      kind: m.kind,
      scene:
        m.kind === "card"
          ? `Card — ${m.title}. Build it as its own scene; the shoot filmed nothing here.`
          : `Real footage of ${shot.name}${beats.length ? `; beats ${beats.map((b) => b.label).join(", ")}` : ""}.`,
      ...(said.length ? { voiceover: said.join(" ") } : {}),
      beats,
    });
  }
  return out;
}

/**
 * Render the seeded frames as `STORYBOARD.md`.
 *
 * The footage path is written into each footage frame's `extra` as
 * `footage_at`, so a frame worker knows which second of the recording it is
 * mounting without re-reading the manifest.
 */
export function storyboardFromShot(
  shot: ShotManifest,
  opts: { footage: string; message?: string } = { footage: "footage.mp4" },
): string {
  const frames = seedFrames(shot);

  const head = `---
format: ${shot.width}x${shot.height}
duration: ${shot.duration.toFixed(1)}s
message: ${opts.message ?? shot.name}
arc: ${frames.map((f) => (f.kind === "card" ? "Card" : "Demo")).join(" → ")}
mode: autonomous
---

# ${shot.name}

Seeded by \`smashcut shoot\` from a real recording. Every time below is a
**recorded fact**: the driver wrote each beat and caption at the instant it
caused it, so a cut that lands on one is exact in a way no amount of scrubbing
can reproduce.

What is **not** here is the direction — what is on screen, what moves, where it
sits. Each frame says \`TODO\` for that, deliberately: a plausible line nobody
wrote reads as a decision and gets built.

Footage: \`${opts.footage}\` · ${shot.duration.toFixed(2)}s · ${shot.width}x${shot.height} @ ${shot.fps}fps
`;

  const body = frames
    .map((f, i) => {
      const facts = [
        f.beats.length ? `beats ${f.beats.map((b) => `\`${b.label}\` at ${b.t.toFixed(2)}s`).join(", ")}` : "",
        f.kind === "footage" ? `footage ${f.at.toFixed(2)}–${(f.at + f.duration).toFixed(2)}s` : "",
        f.folded?.length ? `also says “${f.folded.join("”, “")}” inside this span` : "",
      ]
        .filter(Boolean)
        .join(" · ");

      return `
## Frame ${i + 1} — ${f.title}

- status: outline
- duration: ${f.duration.toFixed(3)}s
- transition_in: ${i === 0 ? "cut" : "crossfade"}
- scene: ${f.scene}
- poster: ${Math.min(1.2, f.duration / 2).toFixed(2)}${f.voiceover ? `\n- voiceover: ${f.voiceover}` : ""}${
        f.kind === "footage" ? `\n- footage_at: ${f.at.toFixed(3)}` : ""
      }

${facts ? `${facts}. ` : ""}TODO — what is on screen, what moves, and where it sits.
`;
    })
    .join("");

  return head + body;
}
