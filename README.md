# Pipeup

Comments and feedback right on any HTML page: documents, slide decks and whole sites. Add one
script tag and reviewers can select words, click a block or drop a pin, and comment in place. No
accounts and no servers: comments stay in each reviewer's browser, and **Copy as Markdown** turns them into
Markdown that says exactly where each comment is, ready to send to the author or paste into an AI
agent.

> **Status: alpha (0.4.0-beta.1).** The API and the stored comment format may change before 1.0. Pin an
> exact version.

- Website: https://pipeup-ai.github.io/pipeup/
- Try it on a [document](https://pipeup-ai.github.io/pipeup/try/document.html),
  [slides](https://pipeup-ai.github.io/pipeup/try/slides.html) or a
  [website](https://pipeup-ai.github.io/pipeup/try/website.html)
- npm: [`pipeup`](https://www.npmjs.com/package/pipeup)

## Quick start

### A script tag

Give the page a document key once, then load the pinned script just before `</body>`:

```html
<html data-pipeup-doc="<key>">
  ...
  <script
    src="https://cdn.jsdelivr.net/npm/pipeup@0.4.0-beta.1/dist/pipeup.min.js"
    integrity="sha384-…"
    crossorigin="anonymous"
  ></script>
</html>
```

Make a key in any browser console on a page with Pipeup loaded: `await Pipeup.newDocumentAttribute()`.
Keep it exactly as it is once people have commented. Each release's notes give the `integrity`
value. Pipeup is one file with no dependencies, so you can also download `pipeup.min.js`, put it
next to the page and use `<script src="pipeup.min.js"></script>`: it works when the page is opened
straight from disk.

### From npm

```sh
npm i pipeup
```

```js
import { mount } from "pipeup";
const pipeup = await mount(); // options: root, name, store
```

`pipeup/core` is the headless core (signed comments, anchoring, storage, copying all comments) for tools that
never draw UI. See the [package README](libs/ts/pipeup/README.md).

### With an AI agent

The website's **Copy prompt** button gives a prompt to paste into Claude, Codex or another coding
agent. To install the skill instead:

```sh
# Claude Code
mkdir -p ~/.claude/skills/pipeup-integrate && curl -fsSL https://pipeup-ai.github.io/pipeup/skills/pipeup-integrate/SKILL.md -o ~/.claude/skills/pipeup-integrate/SKILL.md
```

Other agents can read [llms.txt](https://pipeup-ai.github.io/pipeup/llms.txt). The three skills
(integrate, summarise, apply) are in [apps/agent-skills](apps/agent-skills/).

## Repository layout

| Path | What |
|---|---|
| `libs/ts/pipeup` | The library: npm package `pipeup` and the CDN build `dist/pipeup.min.js` |
| `apps/site` | The website, its Try pages, `llms.txt` and the build script (`apps/site/build.sh`) |
| `apps/agent-skills` | Agent skills: integrate, summarise and apply |
| `docs` | Functional spec, website spec, architecture and release process |
| `.github` | CI, Pages deployment, releases, issue and PR templates |

## Development

Requires Node 20 or later.

```sh
cd libs/ts/pipeup
npm ci
npx playwright install chromium   # once, for the browser tests
npm run check                     # types, lint, unit tests, build, size budget, browser tests
```

Build the website into `apps/site/_site` with `apps/site/build.sh`.

## Contributing and licence

- [CONTRIBUTING.md](CONTRIBUTING.md): building, testing and what a pull request needs.
- [SECURITY.md](SECURITY.md): how to report a vulnerability privately.
- [CHANGELOG.md](CHANGELOG.md): what changed in each release.
- [MIT licence](LICENSE). The website's bundled fonts keep their own licence; see [NOTICE](NOTICE).
