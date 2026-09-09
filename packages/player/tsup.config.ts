import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";

const packageVersion = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"))
  .version as string;

export default defineConfig({
  entry: ["src/smashcut-player.ts", "src/slideshow/smashcut-slideshow.ts"],
  format: ["esm", "cjs", "iife"],
  globalName: "SmashcutPlayer",
  noExternal: ["@smashcut/core"],
  dts: true,
  clean: true,
  minify: true,
  sourcemap: true,
  define: {
    __SMASHCUT_RUNTIME_CDN_URL__: JSON.stringify(
      `https://cdn.jsdelivr.net/npm/@smashcut/core@${packageVersion}/dist/smashcut.runtime.iife.js`,
    ),
  },
});
