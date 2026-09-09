import { defineConfig } from "tsup";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { sourceAliases } from "../../scripts/package-subpaths.mjs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")) as {
  version: string;
};
const producerPkg = JSON.parse(
  readFileSync(new URL("../producer/package.json", import.meta.url), "utf-8"),
) as { version: string };

export default defineConfig({
  entry: {
    cli: "src/cli.ts",
    fontLocalizeCli: "src/fontLocalizeCli.ts",
    runtimeVersion: "src/runtimeVersion.ts",
    shaderTransitionWorker: "../producer/src/services/shaderTransitionWorker.ts",
  },
  format: ["esm"],
  outDir: "dist",
  target: "node22",
  platform: "node",
  bundle: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  banner: {
    js: `import { createRequire as __sc_createRequire } from "node:module";
import { fileURLToPath as __sc_fileURLToPath } from "node:url";
import { dirname as __sc_dirname } from "node:path";
var require = __sc_createRequire(import.meta.url);
var __filename = __sc_fileURLToPath(import.meta.url);
var __dirname = __sc_dirname(__filename);`,
  },
  external: [
    "puppeteer-core",
    "puppeteer",
    "@puppeteer/browsers",
    // Native module — its platform binary (@img/sharp-<os>-<arch>) must be
    // resolved from node_modules at runtime, never bundled. Loaded lazily by
    // the capture pipeline; runtime resolution comes from the `dependencies`
    // entry in package.json.
    "sharp",
    "open",
    "hono",
    "hono/*",
    "@hono/node-server",
    "adm-zip",
    "esbuild",
    "giget",
    "postcss",
    // aws-lambda transitively pulls @aws-sdk/* + @smithy/* which include
    // .browser.js conditional exports esbuild can't bundle cleanly into
    // a node binary. Keep it external; the lambda subverb files dynamic-
    // import it only when the user runs `smashcut lambda *`, so the
    // CLI's cold start doesn't load it. Runtime resolution comes from
    // @smashcut/aws-lambda being a `dependencies` entry in package.json.
    "@smashcut/aws-lambda",
    "@smashcut/aws-lambda/sdk",
    // Same treatment for the GCP adapter: the cloudrun subverb files
    // dynamic-import `@smashcut/gcp-cloud-run/sdk` only when the user runs
    // `smashcut cloudrun *`. Keep it external; runtime resolution comes
    // from the `dependencies`/workspace entry, not the bundled CLI.
    "@smashcut/gcp-cloud-run",
    "@smashcut/gcp-cloud-run/sdk",
    "@smashcut/gcp-cloud-run/terraform",
  ],
  noExternal: [
    "@smashcut/core",
    "@smashcut/parsers",
    "@smashcut/studio-server",
    "@smashcut/lint",
    "@smashcut/producer",
    "@smashcut/engine",
    "@clack/prompts",
    "@clack/core",
    "picocolors",
    "linkedom",
    "sisteransi",
    "is-unicode-supported",
    "citty",
  ],
  define: {
    __CLI_VERSION__: JSON.stringify(pkg.version),
    __PRODUCER_VERSION__: JSON.stringify(producerPkg.version),
  },
  esbuildOptions(options) {
    options.alias = {
      // Exact subpaths are generated from the same contracts as package
      // exports, avoiding esbuild's root-alias prefix substitution trap.
      ...sourceAliases(resolve(__dirname, "../producer"), [".", "./distributed"]),
      ...sourceAliases(resolve(__dirname, "../engine"), [".", "./shader-transitions"]),
    };
    options.loader = { ...options.loader, ".browser.js": "text" };
  },
});
