import { buildSmashcutRuntimeScript } from "./smashcutRuntime.engine";
import { SMASHCUT_BRIDGE_SOURCES, SMASHCUT_RUNTIME_GLOBALS } from "./runtimeContract";

export const SMASHCUT_RUNTIME_ARTIFACTS = {
  iife: "smashcut.runtime.iife.js",
  esm: "smashcut.runtime.mjs",
  manifest: "smashcut.manifest.json",
} as const;

export type SmashcutRuntimeContract = {
  globals: typeof SMASHCUT_RUNTIME_GLOBALS;
  messageSources: typeof SMASHCUT_BRIDGE_SOURCES;
};

export const SMASHCUT_RUNTIME_CONTRACT: SmashcutRuntimeContract = {
  globals: SMASHCUT_RUNTIME_GLOBALS,
  messageSources: SMASHCUT_BRIDGE_SOURCES,
};

export function loadSmashcutRuntimeSource(): string | null {
  return buildSmashcutRuntimeScript();
}
