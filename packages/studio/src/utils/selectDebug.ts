// Canvas selection diagnostics — grep [sc-select]. Off by default; opt in with
// `localStorage.setItem("sc-select-debug", "1")` (then reload).
//
// Selection failures are silent by nature: a handler returns early and nothing
// happens, which looks identical to a click that never landed. These lines say
// which branch ran and what it decided.
import { makeStudioDebugLogger } from "./studioDebug";

export const logSelect = makeStudioDebugLogger("select");
