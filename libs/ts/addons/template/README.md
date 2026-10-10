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
   `myteam-translate`). Don't use `share`, `voice`, `live` or `assist`: those are the Pipeup project's.
2. Change `network.says` to one plain sentence: what leaves the device, and who sees what. Reviewers are shown it
   before anything is sent. If your add-on sends nothing, say so.
3. Change what `setup` does. The guide lists everything `host` offers.
4. Rename the package in `package.json` and the output file in `build.mjs`, and update `test/addon.spec.ts`.

## Bundle and pin it

`npm run build` makes three files in `dist/`: your add-on (`hello.min.js`), a module build (`hello.esm.js`) and **one
bundled file with Pipeup and your add-on together** (`pipeup+hello.min.js`), and prints each file's integrity hash.
Hosting the bundled file is the simplest way to run an add-on inside a company: one file to review, pin and serve from
your own servers, and it works from disk.

On the page, pin it, list the add-ons that may run, and set a content security policy for the hosts you intend:

```html
<html data-pipeup-addons="myteam-hello">
  <script
    src="https://tools.example.com/pipeup+hello.min.js"
    integrity="sha384-…"
    crossorigin="anonymous"
  ></script>
</html>
```

This is best effort: it stops add-ons you didn't choose, not a page that is already compromised.

## Publish it

An add-on is just a script file, so publish it wherever you like, under your own name:

- **npm:** `npm publish` under your own scope or name, then pages use
  `https://cdn.jsdelivr.net/npm/<your-package>@<version>/dist/hello.min.js` (set `"files": ["dist/*.js"]`).
- **Your own site, or a GitHub release:** put `dist/hello.min.js` anywhere a page can load it from.

A page includes it with one script tag after Pipeup's. Pin the version. Pipeup doesn't vouch for add-ons from anyone
else: they run with the page's full power, so say what yours does and only ship what you'd be happy to have read.
