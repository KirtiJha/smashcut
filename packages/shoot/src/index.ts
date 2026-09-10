/**
 * `@smashcut/shoot` — filming a real application.
 *
 * ## What this package is for
 *
 * SmashCut renders HTML to video, and it is very good at it. What it has no way
 * to produce is *footage of a real product doing a real thing*: its own
 * `capture` reads a website's design — screenshots, tokens, fonts — so an agent
 * can rebuild it, which is a different job from driving an application through a
 * flow and recording what happened.
 *
 * That gap is this package's shape. It drives a web app, a locally running app,
 * or a command-line program through a scripted and asserted flow, films it, and
 * writes down every moment it caused.
 *
 * ## The seam
 *
 * A bare `.mp4` would be a poor handoff. A composition needs to *time* things
 * against the footage — a lower third when the user clicks Add, a push-in on the
 * moment a result appears — and without a manifest an author is left scrubbing
 * an mp4 and guessing at timestamps.
 *
 * So the deliverable is footage **plus** `shots.json`: every beat, caption,
 * sound cue and spoken line, in the recording's own time, written by the driver
 * at the instant it caused each one. That is the difference between an edit on
 * the beat and one two hundred milliseconds late, and it cannot be recovered by
 * eye afterwards.
 *
 * ## What it deliberately does not do
 *
 * Compose. No chrome, no burned-in captions, no title cards, no fades — every
 * one of those is the composition's decision, and a decision baked into a frame
 * cannot be unmade. Cards a spec asks for are recorded as markers for the
 * composition to build; see `ShotCard`.
 */

// The spec — the grammar a demo is written in.
export { loadSpec } from "./spec/load.js";
export type { LoadedSpec } from "./spec/load.js";
export { specSchema } from "./spec/schema.js";
export type { Spec, SpecInput, Step, StepInput } from "./spec/schema.js";
export { schemaDirective, SCHEMA_URL } from "./spec/schema-url.js";

// Filming a demo end to end.
export { shoot, checkShoot } from "./shoot/shoot.js";
export type { ShootOptions, ShootOutcome, ShootCheckOutcome } from "./shoot/shoot.js";

// Seeding a plan from what was recorded.
export { seedFrames, storyboardFromShot } from "./shoot/storyboard.js";
export type { SeededFrame } from "./shoot/storyboard.js";

// The shot manifest — the seam between filming and cutting.
export { buildManifest } from "./shoot/manifest.js";
export type {
  ShotBeat,
  ShotCaption,
  ShotCard,
  ShotLine,
  ShotManifest,
  ShotSfx,
} from "./shoot/manifest.js";
