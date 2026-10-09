# Making your own Pipeup add-on

An add-on is one extra script that gives Pipeup a new feature: a row in its menu, a panel, a note on a thread, a way
to bring in comments from somewhere else. Anyone can make one and publish it anywhere under their own name. Nothing
needs the Pipeup project's permission, a registration, or a place in its npm scope.

The quickest start is the [template](../libs/ts/addons/template): a small working add-on with a try page and a
browser test, usable on its own. This guide explains what is in it.

## What an add-on is

A page's author includes Pipeup, then your script, with one script tag each:

```html
<script src="https://cdn.jsdelivr.net/npm/pipeup@0.5.2/dist/pipeup.min.js"></script>
<script src="https://example.org/my-addon.min.js"></script>
```

Your script describes itself to Pipeup, and Pipeup runs it once it is mounted. Either order of the two tags works.

```ts
import type { PipeupAddon } from "pipeup";

export function createAddon(): PipeupAddon {
  return {
    id: "acme-hello", // yours: lower-case letters, digits, dashes; 2 to 24 characters
    api: 1, // the add-on API you wrote this for
    version: "0.1.0",
    needs: ["menu", "panel"], // the slots you use
    network: {
      when: "never",
      to: [],
      says: "Sends nothing: it only shows a note on this page.",
    },
    setup(host) {
      const row = host.addMenuItem({
        id: "hello",
        icon: ["M4 12h16", "M12 4v16"],
        label: () => "Say hello",
        hint: () => "Shows a short note",
        select: () => {
          const note = document.createElement("p");
          note.textContent = "Hello from my add-on.";
          host.openPanel(note, { label: "Hello" });
        },
      });
      return () => row.remove(); // runs at teardown: undo what you added
    },
  };
}
```

A classic script registers it by joining Pipeup's queue (`(globalThis.pipeupAddons ||= []).push(createAddon())`).
A page that bundles Pipeup as a module calls `use(createAddon())` instead. The template does both. Pipeup only needs
the types from the `pipeup` package at build time; never bundle a second copy of Pipeup into your add-on.

## What an add-on can do

`needs` lists the slots you use. If the page's Pipeup lacks one, your add-on stays off and says why. It never
half-works.

| Slot       | What it lets you do                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `menu`     | Add rows (an action, or a switch) to Pipeup's menu; show a short count at the end of a row.                                                                  |
| `panel`    | Open a panel with your own content (built from nodes, never HTML text).                                                                                      |
| `notify`   | Show a short message once, when the reviewer next opens Pipeup.                                                                                              |
| `note`     | Show a note under the new-comment box, a streaming line at the end of a thread (`setThreadNote`), or a quiet line with an optional button (`setThreadMark`). |
| `composer` | Add a tool to the comment box (dictation, for example) that puts words in the reviewer's hands to send.                                                      |
| `styles`   | Add CSS for your own elements.                                                                                                                               |
| `status`   | Show a status line and, if you like, people who are here.                                                                                                    |
| `overlay`  | Draw on a layer above the page that never changes the page's own content.                                                                                    |
| `here`     | Ask where the reviewer is (the slide, the page's own state) and go somewhere else.                                                                           |
| `sign`     | Sign something with the reviewer's identity, for a purpose that starts with your id.                                                                         |
| `sync`     | Read comments (`host.document`) and bring in other people's through `host.merge`.                                                                            |

Everything on `host` is documented in the types (`AddonHost` in the `pipeup` package). A few rules:

- **Only text.** Anything you show is text or nodes you build. Comment text is untrusted: never put it in HTML.
- **Look like Pipeup.** Use its colours (`var(--pu-accent)`, `var(--pu-line)`) and ease what moves. The look is light
  mode only.
- **Tidy up.** Return a function from `setup` that removes everything you added, and pass `host.signal` to anything
  that can be cancelled (`fetch`, timers).
- **Never lose words.** Don't take over a box someone is typing in.
- **Don't post for people.** Add-ons may fill in words that the reviewer then sends; they don't post, edit or
  resolve anything on someone's behalf.

## What an add-on can't do

Whatever your add-on does, **Pipeup checks every comment that arrives from elsewhere as strictly as one opened from a
file.** `host.merge` verifies each comment's shape, its document, its id and its signature. An add-on can't make
Pipeup accept a comment that is forged, altered or meant for another document, even on purpose.

## Say what you send

`network` is one plain sentence about what leaves the device and who sees what, plus when it happens
(`"never"`, `"after-consent"` or `"page-configured"`) and to which hosts. Reviewers are shown it before anything is
sent, and the website, docs and checks repeat it. Ask the reviewer before you send anything, and send nothing before
they agree. If you send nothing, say exactly that.

## Names

An add-on's `id` is its own: letters, digits and dashes, 2 to 24 characters, starting with a letter. Put your name or
project in front to keep it distinct (`acme-translate`). The ids `share`, `voice`, `live` and `assist` belong to the
Pipeup project's own add-ons; please don't use them. If two add-ons on a page share an id, the first is used and the
second is ignored, with a message in the console.

## Try it and test it

The template has a try page and a Playwright test:

```sh
npm install
npx playwright install chromium
npm run check
```

The test opens the page with the real, published Pipeup, turns comments on, checks that Pipeup lists your add-on as
on (`Pipeup.addons()`) with its sentence, and uses its row. Add tests for whatever yours does.

## What the Pipeup project stands behind

Only its own add-ons (`@pipeup/*`): they send only to the services they name, send nothing before the reviewer
agrees, never change the page's own content, and never post, edit or resolve anything for a reviewer. **Add-ons from
anyone else run with the page's full power.** Pipeup doesn't vouch for them, and neither the guide nor the template
changes that. Say plainly what yours does, pin versions, and only ship what you'd be happy to have read.
