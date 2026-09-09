import type { Example } from "./_examples.js";
import { createInspectCommand } from "./layout.js";

export const examples: Example[] = [
  ["Inspect visual layout across the current composition", "smashcut inspect"],
  ["Inspect a specific project", "smashcut inspect ./my-video"],
  ["Output agent-readable JSON", "smashcut inspect --json"],
  ["Use explicit hero-frame timestamps", "smashcut inspect --at 1.5,4.0,7.25"],
  [
    "Also sample at tween boundaries to catch transient overlaps",
    "smashcut inspect --at-transitions",
  ],
  [
    "Verify motion intent (add a *.motion.json sidecar next to the composition)",
    "smashcut inspect --json",
  ],
  ["Run the compatibility alias", "smashcut layout --json"],
];

export default createInspectCommand("inspect");
