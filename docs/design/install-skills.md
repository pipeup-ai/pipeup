# Installing the skills

Functional requirements: [FUNCTIONAL_SPEC §15a](../FUNCTIONAL_SPEC.md). This note says how.

## One source, three carriers

The skills live in `apps/agent-skills/<name>/SKILL.md` and nowhere else is edited. They reach people three ways, all copies of that text:

- the website (`apps/site/build.sh` copies the folder, and `llms-full.txt` concatenates it);
- the Claude Code plugin: `.claude-plugin/marketplace.json` lists one plugin, `plugins/pipeup`, whose `skills/` holds copies made by
  `tools/sync-skills.mjs` (committed, and a test fails if they differ);
- the `pipeup` package: `scripts/skills.mjs` copies them into `libs/ts/pipeup/skills/` at build (not committed; in `files`), so
  `pipeup skills install` needs no network.

`tools/set-version.sh` rewrites the "Written for Pipeup X" line in every skill, the plugin's version and the plugin's copies; a test
checks they all equal the package version.

## The installer

`cli/skills.mjs`, run as `pipeup skills install|remove|list`. Targets: Claude Code `~/.claude/skills` and Codex `~/.agents/skills`
(OpenAI's documented user location; `.agents/skills` in a repository for `--project`). Each installed skill gets a `.pipeup-installed`
marker (version and the SHA-256 of what was written). Its state is *new* (nothing there), *ours* (the file still hashes to the marker:
safe to update or remove) or *changed* (no marker, or a different hash: yours, so it is kept unless `--replace`, or confirmed at a
prompt). Without `--yes` and without a terminal it prints the plan and writes nothing, so an agent has to say it is going ahead.
`PIPEUP_SKILLS_HOME` replaces the home folder (tests).

## Change log

- 2026-10-12 — First version, with the build.
