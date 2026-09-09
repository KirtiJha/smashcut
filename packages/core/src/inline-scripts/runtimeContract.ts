export const SMASHCUT_RUNTIME_GLOBALS = {
  player: "__player",
  playerReady: "__playerReady",
  renderReady: "__renderReady",
  timelines: "__timelines",
  clipManifest: "__clipManifest",
} as const;

export const SMASHCUT_BRIDGE_SOURCES = {
  parent: "sc-parent",
  preview: "sc-preview",
} as const;

export const SMASHCUT_CONTROL_ACTIONS = [
  "play",
  "pause",
  "seek",
  "set-muted",
  "set-playback-rate",
  "set-color-grading",
  "set-color-grading-compare",
  "enable-pick-mode",
  "disable-pick-mode",
] as const;

export type SmashcutControlAction = (typeof SMASHCUT_CONTROL_ACTIONS)[number];
