# Pipeup add-ons

Optional features for Pipeup, each one more script. The design is [docs/design/addons.md](../../../docs/design/addons.md).

| Folder    | npm package      | What                                                                                                                                  |
| --------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `share/`  | `@pipeup/share`  | Comments reach everyone who has the page, through an encrypted service (PrivateBin, or an HTTP mailbox)                               |
| `voice/`  | `@pipeup/voice`  | Dictating comments with the browser's own speech engine                                                                               |
| `live/`   | `@pipeup/live`   | Live comments and presence between people on the page, peer to peer                                                                   |
| `assist/` | `@pipeup/assist` | Short replies to comments from a small AI model on the reviewer's own device                                                          |
| `kit/`    | private          | The code the add-ons share: key ladder, sealed envelope, settings, sync engine, transports. Bundled into each add-on; never published |
| `test/`   | private          | A fixture add-on that uses every slot, for the browser tests                                                                          |

Making your own? See the [guide](../../../docs/ADDONS_GUIDE.md) and the [template](template/): you can publish an add-on under your own name, with no permission from this project. [`examples/send-to-git`](examples/send-to-git/) is a complete example of an add-on a company writes for itself (it saves a review as Markdown in Git through the company's own service), with a stand-in service, a GitHub reference service and a contract checker. It is not from this project.

The mailbox server for `share` is in [`services/mailbox`](../../../services/mailbox).

**No dependencies.** Nothing third-party is bundled into an add-on or loaded by one at run time; only browser APIs
and code in this repository. The tooling here (esbuild, vitest, Playwright, `ws` for a test relay) is for building
and testing only. `scripts/check-addon.mjs` fails an add-on that declares `dependencies` or whose built file uses
`import()`, `eval`, `innerHTML` or a script tag.

## Build, test, try

Build the core first; the add-ons are written against its types and the combined files use its classic build.

```sh
cd ../pipeup && npm ci && npm run build
cd ../addons && npm ci
npm run check      # types, lint, unit tests, builds + size budgets, browser tests (needs Chromium: npx playwright install chromium)
npm run demo       # a local mailbox and relay and a try page for all three add-ons (see examples/demo.mjs)
```

Each add-on builds to `dist/<id>.min.js` (a classic script that registers itself), `dist/<id>.esm.js`
(`import share from "@pipeup/share"; use(share())`), and `dist/pipeup+<id>.min.js` (Pipeup and the add-on in
one file, byte for byte). Gzip budgets: share 8.5 KB, voice 4 KB, live 11 KB, assist 8 KB.
