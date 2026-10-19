# Local agents, end to end

Spec: [FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md) §15b (the prompt; The commands an agent runs; What agents are
told). Visual spec: [local-agents-mockups.html](local-agents-mockups.html). From a run on 19 October where a local agent
(pi, with a model in Ollama) couldn't get a reply onto a wiki shown through `viewer.html?file=…`.

## The prompt (`addons/agents/src/prompt.ts`)

- `agentCommand(version)`: `npx --yes pipeup@<major>` for a stable page (`@0` today), `npx --yes pipeup@<version>` for a
  pre-release, with a fallback sentence ("If npm refuses pipeup@0.9.0-beta.1, use pipeup@0"). `--yes` because npx
  otherwise asks "Ok to proceed?", which an agent can't answer; the major version because some computers' npm only
  accepts packages a few days old (`before` / minimum release age), and the replies format has been the same since 0.6.
- `pageToAnswer(url, file)`: the live link's file; else, from a `file:` URL, the decoded path (a folder's page is
  `index.html`; `/C:/…` loses its leading slash); else, served from a site, the URL path, written as "<the HTML file your
  site serves at /wiki/viewer.html>". The query and hash are never part of it, so a viewer's `?file=notes.md` never
  becomes the page.
- The replies file is written as a path for a `file:` page, else as its address. An unlisted agent is told to ask first,
  then `agent --name <name> --page <page> --yes`.

## The command line (`pipeup/cli/pipeup.mjs`)

- `pageDoc` reads the page once: its doc, its listed agents, and where it reads replies (`data-pipeup-replies` when it is
  a path beside the page, else `<page>.replies.js`; an address elsewhere is warned about and the default is used).
- A file without `data-pipeup-doc` goes to `notPipeup`, which writes nothing and names `nearbyPage`: the first HTML file,
  in name order, in the file's folder and up to three folders above, that runs Pipeup.
- `reply` always writes (so nothing is lost), then either says the page reads the file, or, when the agent isn't listed
  and no live link is running, says the page will ignore the replies and gives the one command that lists it.
- `listOn` (`agent --page`) uses `init.mjs`'s `survey`, `htmlAttr` (append) and `apply`, now exported, so the only bytes
  that change are inside the `<html>` start tag. It prints the tag as it will be; without `--yes` it asks in a terminal
  and, without one, exits 2 having changed nothing.
- `KNOWN` lists each agent command's options; others are said ("this release doesn't know --x") and the rest carry on.

## Surfaces

The apply and integrate skills (and the plugin's copy), `llms.txt`, the Markdown copies, the Add-ons page's prompts and
the README give `npx --yes pipeup@0 …`. The pre-release site's `channel.py` rewrites that form (and a bare `npx pipeup`)
to the pre-release's version.

## Testing

`e2e/agent-cli.spec.ts` runs the command line with no terminal, as an agent's shell does: a note refused with the
viewer named, replies where the page reads (and the page's own file), the unlisted message, listing only after `--yes`
with the page otherwise byte for byte the same, already listed, and an unknown option. The prompt's forms are unit tests
in `addons/agents/test/agents.test.ts`.

## Change log

- 2026-10-19 — First version.
