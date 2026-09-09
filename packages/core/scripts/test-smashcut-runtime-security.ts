function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const ALLOWED_HOSTS = new Set(["runtime.example.com"]);
const ALLOWED_PATH_PREFIX = "/static/smashcut-runtime/";

function isAllowedRuntimeUrl(candidate: string): boolean {
  try {
    const parsed = new URL(candidate);
    return (
      parsed.protocol === "https:" &&
      ALLOWED_HOSTS.has(parsed.hostname.toLowerCase()) &&
      parsed.pathname.startsWith(ALLOWED_PATH_PREFIX) &&
      parsed.pathname.endsWith(".js")
    );
  } catch {
    return false;
  }
}

function isGuardedPreviewMessage(data: unknown): boolean {
  if (!data || typeof data !== "object") {
    return false;
  }
  const record = data as { source?: unknown; type?: unknown };
  const source = typeof record.source === "string" ? record.source : null;
  const type = typeof record.type === "string" ? record.type : null;
  const guardedTypes = new Set([
    "state",
    "timeline",
    "element-picked",
    "element-picked-many",
    "element-pick-candidates",
    "pick-mode-cancelled",
  ]);
  if (!type || !guardedTypes.has(type)) {
    return false;
  }
  return source === "sc-preview";
}

const allowedRuntimeFixtures = [
  "https://runtime.example.com/static/smashcut-runtime/smashcut.runtime.iife.js",
  "https://runtime.example.com/static/smashcut-runtime/v2026.02.20/smashcut.runtime.iife.js",
];

const blockedRuntimeFixtures = [
  "http://runtime.example.com/static/smashcut-runtime/smashcut.runtime.iife.js",
  "javascript:alert(1)",
  "data:text/javascript,alert(1)",
  "https://evil.example/static/smashcut-runtime/smashcut.runtime.iife.js",
  "https://runtime.example.com/static/other/smashcut.runtime.iife.js",
  "https://runtime.example.com/static/smashcut-runtime/smashcut.runtime.iife.css",
];

for (const fixture of allowedRuntimeFixtures) {
  assert(isAllowedRuntimeUrl(fixture), `Expected runtime URL to be allowed: ${fixture}`);
}

for (const fixture of blockedRuntimeFixtures) {
  assert(!isAllowedRuntimeUrl(fixture), `Expected runtime URL to be blocked: ${fixture}`);
}

const allowedMessages = [
  { type: "state", source: "sc-preview" },
  { type: "timeline", source: "sc-preview" },
  { type: "element-picked", source: "sc-preview" },
];
const blockedMessages = [
  { type: "state", source: "sc-parent" },
  { type: "timeline", source: "evil-origin" },
  { type: "element-picked", source: "sc-parent" },
  { type: "pick-mode-cancelled", source: null },
  { type: "unknown-type", source: "sc-preview" },
];

for (const fixture of allowedMessages) {
  assert(
    isGuardedPreviewMessage(fixture),
    `Expected message fixture to pass guard: ${JSON.stringify(fixture)}`,
  );
}

for (const fixture of blockedMessages) {
  assert(
    !isGuardedPreviewMessage(fixture),
    `Expected message fixture to fail guard: ${JSON.stringify(fixture)}`,
  );
}

console.log(
  JSON.stringify({
    event: "hyperframe_runtime_security_fixtures_verified",
    allowedRuntimeFixtures: allowedRuntimeFixtures.length,
    blockedRuntimeFixtures: blockedRuntimeFixtures.length,
    allowedMessages: allowedMessages.length,
    blockedMessages: blockedMessages.length,
  }),
);
