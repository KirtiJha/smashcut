import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { resolveNpmSpawnCommand } from "./package-loader.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV = "SMASHCUT_SKILL_PKG_VERSION";

test("resolveNpmSpawnCommand routes Windows npm through node and npm-cli.js", () => {
  const npmCli = "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js";
  const node = "C:\\Program Files\\nodejs\\node.exe";
  const resolved = resolveNpmSpawnCommand(
    ["install", "@smashcut/producer@0.7.55", "value & calc"],
    "win32",
    { npm_execpath: npmCli, npm_node_execpath: node },
    node,
    (path) => path === npmCli,
  );

  assert.deepEqual(resolved, {
    cmd: node,
    args: [npmCli, "install", "@smashcut/producer@0.7.55", "value & calc"],
    opts: { stdio: "inherit", windowsHide: true },
  });
  assert.equal(resolved.opts.shell, undefined);
});

test("resolveNpmSpawnCommand finds npm-cli.js beside node for direct Windows runs", () => {
  const node = "C:\\Program Files\\nodejs\\node.exe";
  const npmCli = "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js";
  const resolved = resolveNpmSpawnCommand(
    ["install", "@smashcut/producer@0.7.55"],
    "win32",
    {},
    node,
    (path) => path === npmCli,
  );

  assert.equal(resolved?.cmd, node);
  assert.deepEqual(resolved?.args, [npmCli, "install", "@smashcut/producer@0.7.55"]);
});

test(
  "resolveNpmSpawnCommand launches the installed npm CLI on Windows",
  { skip: process.platform !== "win32" },
  () => {
    const resolved = resolveNpmSpawnCommand(["--version"]);
    assert.ok(resolved);

    const result = spawnSync(resolved.cmd, resolved.args, {
      encoding: "utf8",
      windowsHide: true,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout.trim(), /^\d+\./);
  },
);

// (a) env override wins — no ancestor lookup, exact version echoed back.
test("smashcutPackageSpec: env override wins", async () => {
  const prev = process.env[ENV];
  process.env[ENV] = "9.9.9";
  try {
    const { smashcutPackageSpec } = await import("./package-loader.mjs");
    assert.equal(smashcutPackageSpec("@smashcut/producer"), "@smashcut/producer@9.9.9");
  } finally {
    if (prev === undefined) delete process.env[ENV];
    else process.env[ENV] = prev;
  }
});

// (b) resolvable version (in-repo) pins the bundled smashcut/@smashcut/cli version.
test("smashcutPackageSpec: resolvable in-repo version pins it", async () => {
  const prev = process.env[ENV];
  delete process.env[ENV];
  try {
    const { smashcutPackageSpec } = await import("./package-loader.mjs");
    const spec = smashcutPackageSpec("@smashcut/producer");
    assert.match(spec, /^@smashcut\/producer@\d+\.\d+\.\d+/);
  } finally {
    if (prev !== undefined) process.env[ENV] = prev;
  }
});

// (c) unresolvable + no override -> @latest fallback, no throw (global-install case).
// Copy the loader into an isolated temp dir whose ancestor chain has no smashcut
// package.json, and run node from there so cwd cannot resolve one either.
test("smashcutPackageSpec: unresolvable falls back to @latest without throwing", () => {
  const dir = mkdtempSync(join(tmpdir(), "sc-pkgloader-"));
  try {
    copyFileSync(join(HERE, "package-loader.mjs"), join(dir, "package-loader.mjs"));
    const probe = join(dir, "probe.mjs");
    writeFileSync(
      probe,
      [
        'import { smashcutPackageSpec } from "./package-loader.mjs";',
        'process.stdout.write(smashcutPackageSpec("@smashcut/producer"));',
        "",
      ].join("\n"),
    );
    const res = spawnSync(process.execPath, [probe], { cwd: dir, encoding: "utf8" });
    assert.equal(res.status, 0, res.stderr);
    assert.equal(res.stdout.trim(), "@smashcut/producer@latest");
    assert.match(res.stderr, /using @latest/);
    assert.match(res.stderr, new RegExp(ENV));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
