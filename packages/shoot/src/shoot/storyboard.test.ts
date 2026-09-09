import { describe, test } from "vitest";
import assert from "node:assert/strict";
import { seedFrames, storyboardFromShot } from "./storyboard.js";
import type { ShotManifest } from "./manifest.js";

function shot(over: Partial<ShotManifest> = {}): ShotManifest {
  return {
    version: 1,
    spec: "demo.yaml",
    name: "TaskFlow",
    footage: "footage.mp4",
    width: 1200,
    height: 864,
    fps: 30,
    duration: 15.34,
    beats: [],
    captions: [],
    sfx: [],
    narration: [],
    cards: [],
    ...over,
  };
}

describe("seedFrames", () => {
  test("a recording with no captions is one frame", () => {
    const f = seedFrames(shot());
    assert.equal(f.length, 1);
    assert.equal(f[0]!.duration, 15.34);
  });

  test("each caption opens a frame, because each is a claim the demo made", () => {
    const f = seedFrames(
      shot({
        captions: [
          { t: 0, text: "Meet TaskFlow" },
          { t: 9.49, text: "Click a task to complete it" },
          { t: 13.09, text: "That's it" },
        ],
      }),
    );
    assert.deepEqual(
      f.map((x) => x.title),
      ["Meet TaskFlow", "Click a task to complete it", "That's it"],
    );
    // The spans tile the recording exactly, with nothing lost at the end.
    assert.equal(
      Number(f.reduce((n, x) => n + x.duration, 0).toFixed(2)),
      15.34,
    );
  });

  test("a span too short to direct is folded into the one before it", () => {
    // A demo can caption twice in a second; one frame each is a plan nobody
    // can direct. B lasts 0.4s, so its time joins A and C keeps its own frame.
    const f = seedFrames(
      shot({ captions: [{ t: 0, text: "A" }, { t: 5, text: "B" }, { t: 5.4, text: "C" }] }),
    );
    assert.deepEqual(f.map((x) => x.title), ["A", "C"]);
    assert.equal(f[0]!.duration, 5.4);
  });

  test("a folded caption is still reported, not silently dropped", () => {
    // The caption is evidence of a claim the product made on screen. An author
    // building the frame that now covers that time needs to know what the
    // footage underneath is saying, or the frame contradicts it.
    const f = seedFrames(
      shot({ captions: [{ t: 0, text: "A" }, { t: 5, text: "B" }, { t: 5.4, text: "C" }] }),
    );
    assert.deepEqual(f[0]!.folded, ["B"]);
  });

  test("a card is its own frame and is never folded away", () => {
    // A card is a scene by definition — it has no footage to be folded into.
    const f = seedFrames(
      shot({ cards: [{ t: 5, kind: "title", fields: { title: "Chapter Two" } }] }),
    );
    assert.equal(f.length, 2);
    assert.equal(f[1]!.kind, "card");
    assert.equal(f[1]!.title, "Chapter Two");
  });

  test("beats land in the frame whose span contains them", () => {
    const f = seedFrames(
      shot({
        captions: [{ t: 0, text: "A" }, { t: 8, text: "B" }],
        beats: [
          { label: "hero", t: 0.95 },
          { label: "done", t: 11.79 },
        ],
      }),
    );
    assert.deepEqual(f[0]!.beats.map((b) => b.label), ["hero"]);
    assert.deepEqual(f[1]!.beats.map((b) => b.label), ["done"]);
  });

  test("narration in a span becomes that frame's voiceover guide", () => {
    const f = seedFrames(
      shot({
        captions: [{ t: 0, text: "A" }, { t: 8, text: "B" }],
        narration: [
          { t: 1, text: "First line." },
          { t: 9, text: "Second line." },
        ],
      }),
    );
    assert.equal(f[0]!.voiceover, "First line.");
    assert.equal(f[1]!.voiceover, "Second line.");
  });
});

describe("storyboardFromShot", () => {
  const md = storyboardFromShot(
    shot({
      captions: [{ t: 0, text: "Meet TaskFlow" }, { t: 9.49, text: "Click a task" }],
      beats: [{ label: "hero", t: 0.95 }],
      narration: [{ t: 1, text: "Capture work in a snap." }],
    }),
    { footage: "footage.mp4" },
  );

  test("carries the canvas and duration the recording actually has", () => {
    assert.match(md, /^format: 1200x864$/m);
    assert.match(md, /^duration: 15\.3s$/m);
  });

  test("writes a frame per span, in order", () => {
    assert.match(md, /## Frame 1 — Meet TaskFlow/);
    assert.match(md, /## Frame 2 — Click a task/);
  });

  test("states the recorded beat with its exact second", () => {
    // The whole point of the manifest: a cut on this is exact, and no amount
    // of scrubbing an mp4 reproduces it.
    assert.match(md, /beats `hero` at 0\.95s/);
  });

  test("leaves the direction unwritten rather than inventing it", () => {
    // What is on screen is judgement. A plausible line nobody wrote reads as a
    // decision and gets built.
    assert.match(md, /TODO — what is on screen, what moves, and where it sits\./);
  });

  test("tells each footage frame which second of the recording it mounts", () => {
    assert.match(md, /^- footage_at: 9\.490$/m);
  });

  test("a card frame carries no footage offset, because it films nothing", () => {
    const withCard = storyboardFromShot(
      shot({ cards: [{ t: 4, kind: "title", fields: { title: "Two" } }] }),
      { footage: "footage.mp4" },
    );
    const cardBlock = withCard.split("## Frame 2 — Two")[1] ?? "";
    assert.ok(!cardBlock.includes("footage_at"));
    assert.match(cardBlock, /Build it as its own scene/);
  });
});
