import { defineCommand } from "citty";
import { shoot } from "@smashcut/shoot";
import { loadSpec } from "@smashcut/shoot";
import { failCommand } from "../utils/commandResult.js";
import { normalizeErrorMessage } from "../utils/errorMessage.js";
import type { Example } from "./_examples.js";

/**
 * `smashcut shoot` — film a real application, and stop there.
 *
 * ## Why this is not `smashcut capture`
 *
 * `capture` reads a website's *design* — screenshots, tokens, fonts — so an
 * agent can rebuild it. `shoot` drives an application through a scripted,
 * asserted flow and records what happened. One reads a page; the other operates
 * a product. They are close enough in English to be confused and far enough
 * apart in practice that confusing them wastes a render.
 *
 * ## Why it films so little
 *
 * No chrome, no burned-in captions, no title cards, no fades. Every one of
 * those is the composition's decision, and a decision baked into a frame cannot
 * be unmade. What comes out is raw footage plus `shots.json`: every beat,
 * caption, sound cue, spoken line and card the driver knows about, in the
 * recording's own time, written at the instant it caused each one.
 *
 * The camera is the single judgement call left in the shoot. Zoom stays on by
 * default because a push-in is a property of the *shot* — chosen while the app
 * was being driven, with the element's real box in hand — and cannot be
 * recovered from a flat recording afterwards without upscaling. `--flat` turns
 * it off for compositions that would rather do their own framing.
 */

export const examples: Example[] = [
  ["Film a demo into ./shot/", "smashcut shoot demo.smashcut.yaml"],
  ["Film to a different directory", "smashcut shoot demo.smashcut.yaml -o taskflow-shot"],
  [
    "Let the composition do all the framing",
    "smashcut shoot demo.smashcut.yaml --flat",
  ],
];

export default defineCommand({
  meta: {
    name: "shoot",
    description: "Film a web app, local app or CLI as footage plus a shot manifest",
  },
  args: {
    spec: {
      type: "positional",
      description: "Path to the demo spec (.yaml)",
      required: true,
    },
    out: {
      type: "string",
      description: "Where the footage and manifest go (default: ./shot)",
      alias: "o",
      default: "shot",
    },
    flat: {
      type: "boolean",
      description: "No camera moves at all — the composition does its own framing",
      default: false,
    },
    json: {
      type: "boolean",
      description: "Emit the result as JSON, for agents",
      default: false,
    },
  },
  async run({ args }) {
    try {
      const loaded = await loadSpec(args.spec as string);
      const res = await shoot(loaded, {
        out: args.out as string,
        flat: Boolean(args.flat),
        version: "0.8.33",
      });

      if (args.json) {
        console.log(
          JSON.stringify(
            {
              ok: true,
              dir: res.dir,
              footage: res.footage,
              manifest: res.manifest,
              duration: res.shot.duration,
              beats: res.shot.beats.length,
              captions: res.shot.captions.length,
              cards: res.shot.cards.length,
              narration: res.shot.narration.length,
            },
            null,
            2,
          ),
        );
      }
    } catch (err) {
      console.error(normalizeErrorMessage(err));
      failCommand();
    }
  },
});
