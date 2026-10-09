# A starting point for your own Pipeup add-on

A small working add-on: one row in Pipeup's menu that opens a panel with a note. Copy this folder anywhere, make it
yours, and publish it under your own name. You don't need the rest of Pipeup's source, and nobody's permission.
The full guide is [docs/ADDONS_GUIDE.md](../../../../docs/ADDONS_GUIDE.md).

## Try it

```sh
npm install
npx playwright install chromium   # once, for the test
npm run check                     # types, build, and a browser test of the add-on
node serve.mjs                    # then open http://localhost:4173/page/
```

On the page, press Shift+Option+C (Shift+Alt+C on Windows), open the comment control's menu, and choose **Say hello**.

## Make it yours

1. In `src/addon.ts`, change `id` (yours: lower-case letters, digits and dashes, 2 to 24 characters, for example
   `acme-translate`). Don't use `share`, `voice`, `live` or `assist`: those are the Pipeup project's.
2. Change `network.says` to one plain sentence: what leaves the device, and who sees what. Reviewers are shown it
   before anything is sent. If your add-on sends nothing, say so.
3. Change what `setup` does. The guide lists everything `host` offers.
4. Rename the package in `package.json` and the output file in `build.mjs`, and update `test/addon.spec.ts`.

## Publish it

An add-on is just a script file, so publish it wherever you like, under your own name:

- **npm:** `npm publish` under your own scope or name, then pages use
  `https://cdn.jsdelivr.net/npm/<your-package>@<version>/dist/hello.min.js` (set `"files": ["dist/*.js"]`).
- **Your own site, or a GitHub release:** put `dist/hello.min.js` anywhere a page can load it from.

A page includes it with one script tag after Pipeup's. Pin the version. Pipeup doesn't vouch for add-ons from anyone
else: they run with the page's full power, so say what yours does and only ship what you'd be happy to have read.
