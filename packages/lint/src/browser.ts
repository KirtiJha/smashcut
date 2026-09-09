/**
 * Browser-safe entry for @smashcut/lint.
 *
 * Exposes the composition rule engine — HTML-string in, findings out — with
 * **zero Node.js dependencies**: no `node:fs`, no filesystem, no server. This
 * lets browser-only editors and tools validate compositions entirely
 * client-side, before any network call.
 *
 * The Node-only project layer (`lintProject`, which walks a directory) is NOT
 * exported here — import it from the main `@smashcut/lint` entry in Node.
 */
export type {
  SmashcutLintSeverity,
  SmashcutLintFinding,
  SmashcutLintResult,
  SmashcutLinterOptions,
} from "./types.js";
export { lintSmashcutHtml, lintMediaUrls } from "./smashcutLinter.js";
export { shouldBlockRender } from "./shouldBlockRender.js";
