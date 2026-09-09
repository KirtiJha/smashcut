import { buildSmashcutRuntimeScript } from "./smashcutRuntime.engine";
import { HYPERFRAME_BRIDGE_SOURCES, HYPERFRAME_RUNTIME_GLOBALS } from "./runtimeContract";

export const HYPERFRAME_RUNTIME_ARTIFACTS = {
  iife: "smashcut.runtime.iife.js",
  esm: "smashcut.runtime.mjs",
  manifest: "smashcut.manifest.json",
} as const;

export type HyperframeRuntimeContract = {
  globals: typeof HYPERFRAME_RUNTIME_GLOBALS;
  messageSources: typeof HYPERFRAME_BRIDGE_SOURCES;
};

export const HYPERFRAME_RUNTIME_CONTRACT: HyperframeRuntimeContract = {
  globals: HYPERFRAME_RUNTIME_GLOBALS,
  messageSources: HYPERFRAME_BRIDGE_SOURCES,
};

export function loadHyperframeRuntimeSource(): string | null {
  return buildSmashcutRuntimeScript();
}
