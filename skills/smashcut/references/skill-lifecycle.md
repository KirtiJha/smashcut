# Skill installation and freshness

Read this reference when installing or updating skills, diagnosing unexpected workflow behavior, or running SmashCut setup in CI.

SmashCut installs the core set eagerly and workflow skills lazily.

- **Core set:** `/smashcut`, the `smashcut-*` domain skills, and `/media-use`.
- **Workflow skills:** installed when routing selects them through `npx smashcut skills update <workflow-name>`.

## What `init` does

`npx smashcut init` checks GitHub and refreshes the core set plus other skills already installed. It does not install workflows that have never been used. A current install is a no-op. Offline or rate-limited checks degrade gracefully and do not fail project scaffolding.

The `--skip-skills` CLI flag is temporarily ignored. CI and tests may opt out with `SMASHCUT_SKIP_SKILLS=1`.

## Diagnose and update

```bash
npx smashcut skills check
npx smashcut skills check --json
npx smashcut skills update
npx smashcut skills update <workflow-name>
npx smashcut skills
```

- `skills check` exits non-zero when an installed skill is stale or the core set is incomplete. Workflows available on demand but not installed are not failures.
- Bare `skills update` refreshes the core set and everything already installed, prunes unpublished skills, and does not expand the workflow set.
- Named `skills update <name...>` also installs those named workflows or domain skills.
- Bare `skills` installs the full published set explicitly.

If the SmashCut CLI is unavailable, use `npx skills add ./skills --skill <workflow-name>` for one workflow or `npx skills add ./skills --all` for the full published set.

The CLI may print a one-line stale-skill reminder during `render`, `lint`, or `check`. Treat a failed update as a visible tool failure; do not continue from a remembered workflow contract.
