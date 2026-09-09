# smashcut

CLI for creating, previewing, and rendering HTML video compositions.

## Install

```bash
npm install -g smashcut
```

Or use directly with npx:

```bash
npx smashcut <command>
```

**Requirements:** Node.js >= 22, FFmpeg

## Commands

### `init`

Scaffold a new Smashcut project from a template:

```bash
npx smashcut init my-video
cd my-video
```

### `preview`

Start the live preview studio in your browser:

```bash
npx smashcut preview
# Studio: http://localhost:3002/#project/my-video
# Server: http://localhost:3002

npx smashcut preview --port 4567
```

In an interactive terminal, the preview stays attached until you press
Ctrl+C. In a non-interactive shell such as a coding-agent session, the same
command starts a managed preview that survives after the command returns. Use
`--background` or `--foreground` to choose explicitly, and manage persistent
previews with `--status`, `--stop`, `--list`, and `--kill-all`. Add `--json` to
managed lifecycle commands for machine-readable output. `--foreground --json`
prints the ready-session envelope once, then remains attached until stopped.

### `normalize-audio`

Measure two local authored audio clips with integrated LUFS and match the target
to the unchanged reference. The command is a dry run unless `--write` is passed:

```bash
npx smashcut normalize-audio --reference target-audio --target user-audio
npx smashcut normalize-audio --reference target-audio --target user-audio --write
```

It updates only the target element's `data-volume` and refuses unsafe boosts
that exceed Studio's +12 dB ceiling or would clip.

### `render`

Render a composition to MP4. Run from the project directory; the positional
argument is the project directory (not a file), so render the project's
`index.html` directly, or point at a specific composition file with `-c`:

```bash
npx smashcut render -o output.mp4
npx smashcut render -c ./my-composition.html -o output.mp4
```

### `publish`

Upload a project directory and get a hosted URL that keeps working after the CLI exits.
Published projects are private by default:

```bash
npx smashcut publish
npx smashcut publish ./my-video
npx smashcut publish --public
npx smashcut publish --yes
```

Signed-out publishing returns an authentication-required claim URL; opening it
lets someone sign in and claim the project. Sign in first with
`npx smashcut auth login` to publish an owned project you can update. Use
`--public` to make the claimed project visible to anyone. `--yes` only skips the
confirmation prompt and does not change visibility.

Signed-in publishers can use `--update <url-or-id>` to target an existing project
or `--space <space-id>` to publish into a shared team space. If the requested
project is missing or inaccessible, publishing can create a new project instead;
check the printed URL and status.

See the [publish reference](https://hyperframes.heygen.com/packages/cli#publish)
for all options, including video proxy settings.

### `lint`

Validate your Smashcut HTML:

```bash
npx smashcut lint ./my-composition
npx smashcut lint ./my-composition --json      # JSON output for CI/tooling
npx smashcut lint ./my-composition --verbose   # Include info-level findings
```

By default only errors and warnings are shown. Use `--verbose` to also display informational findings (e.g., external script dependency notices). Use `--json` for machine-readable output with `errorCount`, `warningCount`, `infoCount`, and a `findings` array.

### `compositions`

List compositions found in the current project:

```bash
npx smashcut compositions
```

### `benchmark`

Run rendering benchmarks:

```bash
npx smashcut benchmark ./my-composition.html
```

### `doctor`

Check your environment for required dependencies (Chrome, FFmpeg, Node.js):

```bash
npx smashcut doctor
```

### `browser`

Manage the bundled Chrome/Chromium installation:

```bash
npx smashcut browser
```

### `info`

Print version and environment info:

```bash
npx smashcut info
```

### `docs`

Open the documentation in your browser:

```bash
npx smashcut docs
```

### `upgrade`

Check for updates and show upgrade instructions:

```bash
npx smashcut upgrade
npx smashcut upgrade --check --json  # machine-readable for agents
```

## Documentation

Full documentation: [hyperframes.heygen.com/packages/cli](https://hyperframes.heygen.com/packages/cli)

## Related packages

- [`@smashcut/core`](../core) — types, parsers, frame adapters
- [`@smashcut/engine`](../engine) — rendering engine
- [`@smashcut/producer`](../producer) — render pipeline
- [`@smashcut/studio`](../studio) — composition editor UI
