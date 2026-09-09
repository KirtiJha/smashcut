/**
 * Where the runtime comes from.
 *
 * Split out of composition-probe so the probe's late injection and the srcdoc's
 * parse-time injection cannot drift onto different URLs.
 */
declare const __SMASHCUT_RUNTIME_CDN_URL__: string;

export function runtimeCdnUrlForVersion(version: string): string {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid SmashCut runtime version: ${version}`);
  }
  return `https://cdn.jsdelivr.net/npm/@smashcut/core@${version}/dist/smashcut.runtime.iife.js`;
}

export const RUNTIME_CDN_URL =
  typeof __SMASHCUT_RUNTIME_CDN_URL__ === "string"
    ? __SMASHCUT_RUNTIME_CDN_URL__
    : runtimeCdnUrlForVersion("0.0.0-dev");
