/**
 * CJS-interop banner prepended to the ESM handler bundle.
 *
 * Lambda's Node 22 runtime treats `.mjs` as ESM, which has no `require`,
 * `__filename`, or `__dirname`. The handler bundle inlines CJS deps that
 * assume all three exist at module scope:
 *   - postcss et al. call top-level `require(...)`
 *   - wawoff2's emscripten build (pulled in unconditionally via
 *     producer → fontCompression) reads `__dirname` at module scope
 * Without the shims the handler throws "Dynamic require of <X> is not
 * supported" / "__dirname is not defined in ES module scope" at import time,
 * before it can run — which is exactly how a freshly deployed stack crashed
 * on every render (#1932).
 *
 * This mirrors the producer's own CJS banner (packages/producer/build.mjs);
 * the handler bundle inlines producer source, so it needs the same shim.
 *
 * Kept in its own module (not inline in build-zip.ts, which self-executes on
 * import) so build-zip.test.ts can import the exact banner, bundle a fixture
 * with it, and assert the globals actually resolve.
 */
export const HANDLER_BANNER = [
  "// smashcut-aws-lambda handler bundle",
  'import { createRequire as __sc_createRequire } from "module";',
  'import { fileURLToPath as __sc_fileURLToPath } from "url";',
  'import { dirname as __sc_dirname } from "path";',
  "const require = __sc_createRequire(import.meta.url);",
  "const __filename = __sc_fileURLToPath(import.meta.url);",
  "const __dirname = __sc_dirname(__filename);",
].join("\n");
