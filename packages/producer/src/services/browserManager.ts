/**
 * Re-exported from @smashcut/engine.
 * @see engine/src/services/browserManager.ts for implementation.
 */
export {
  acquireBrowser,
  releaseBrowser,
  drainBrowserPool,
  resolveHeadlessShellPath,
  buildChromeArgs,
  ENABLE_BROWSER_POOL,
  type BuildChromeArgsOptions,
  type CaptureMode,
  type AcquiredBrowser,
} from "@smashcut/engine";
