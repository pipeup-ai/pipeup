# Making your own Pipeup add-on

An add-on is one extra script that gives Pipeup a new feature: a row in its menu, a panel, a note on a thread, a way to send comments somewhere. Anyone can make one and publish it anywhere under their own name. Nothing needs the Pipeup project's permission, a registration, or a place in its npm scope.

**Add-ons from anyone else run with the page's full power, and Pipeup doesn't vouch for them.** Read this guide with that in mind, and see "Keeping add-ons intentional" below.

The quickest start is the [template](https://github.com/pipeup-ai/pipeup/tree/main/libs/ts/addons/template): a small working add-on with a try page, a browser test and a build that makes one bundled file. Copy it with one command:

```sh
git clone --depth 1 https://github.com/pipeup-ai/pipeup pipeup-src && cp -R pipeup-src/libs/ts/addons/template my-addon && rm -rf pipeup-src
```

## What an add-on is

A page's author includes Pipeup, then your script, with one script tag each:

```html
<script src="https://cdn.jsdelivr.net/npm/pipeup@0.5.3/dist/pipeup.min.js"></script>
<script src="https://example.org/my-addon.min.js"></script>
```

Your script describes itself to Pipeup, and Pipeup runs it once it is mounted. Either order of the two tags works.

```ts
import type { PipeupAddon } from "pipeup";

export function createAddon(): PipeupAddon {
  return {
    id: "myteam-hello", // yours: lower-case letters, digits, dashes; 2 to 24 characters
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

A classic script registers by joining Pipeup's queue (`(globalThis.pipeupAddons ||= []).push(createAddon())`). A page that bundles Pipeup as a module calls `use(createAddon())` instead. The template does both. Pipeup only needs the types from the `pipeup` package at build time; never bundle a second copy of Pipeup into your add-on's own file.

## What an add-on can do

`needs` lists the slots you use. If the page's Pipeup lacks one, your add-on stays off and says why. It never half-works.

| Slot       | What it lets you do                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| `menu`     | Add rows (an action, or a switch) to Pipeup's menu, with a short count at the end.                             |
| `panel`    | Open a panel with your own content (built from nodes, never HTML text).                                        |
| `notify`   | Show a short message once, when the reviewer next opens Pipeup.                                                |
| `note`     | Show a note under the new-comment box, a streaming line at the end of a thread, or a quiet line with a button. |
| `composer` | Add a tool to the comment box (dictation, for example) that puts words in the reviewer's hands to send.        |
| `styles`   | Add CSS for your own elements.                                                                                 |
| `status`   | Show a status line and, if you like, the people who are here.                                                  |
| `overlay`  | Draw on a layer above the page that never changes the page's own content.                                      |
| `here`     | Ask where the reviewer is (the slide, the page's own state) and go somewhere else.                             |
| `sign`     | Sign something with the reviewer's identity, for a purpose that starts with your id.                           |
| `sync`     | Read the comments (`host.document`) and bring in other people's through `host.merge`.                          |

Everything on `host` is documented in the types (`AddonHost` in the `pipeup` package). A few rules:

- **Only text.** Anything you show is text or nodes you build. Comment text is untrusted: never put it in HTML.
- **Look like Pipeup.** Use its colours (`var(--pu-accent)`, `var(--pu-line)`) and ease what moves. The look is light mode only.
- **Tidy up.** Return a function from `setup` that removes everything you added, and pass `host.signal` to anything that can be cancelled (`fetch`, timers).
- **Never lose words.** Don't take over a box someone is typing in.
- **Don't post for people.** Add-ons may fill in words that the reviewer then sends; they don't post, edit or resolve anything on someone's behalf.

## What an add-on can't do

Whatever your add-on does, **Pipeup checks every comment that arrives from elsewhere as strictly as one opened from a file.** `host.merge` verifies each comment's shape, its document, its id and its signature. An add-on can't make Pipeup accept a comment that is forged, altered or meant for another document, even on purpose.

## What an add-on works with

You don't need any encryption to read comments. In the reviewer's browser they are plain text, and `host.document` gives them to you:

- **`threads()`**: the document's threads. Each has an `id`, whether it is `resolved`, where it is on the page (`anchor`: the element's `data-pipeup-id`, the quoted text, a position, the slide or view the reviewer was on, and a short excerpt), and its `root` comment with its `replies`.
- **A comment** has its `text`, who wrote it (`name`, and `author`, a public key), when (`at`), and whether it was `edited` or `deleted`.
- **`onChange(fn)`** tells you when comments change (and whether they came from here, a file or another add-on).
- **`ops()`** gives the signed comments underneath, for an add-on that carries them somewhere else (this is what the Share add-on does, after sealing them). A signed comment has a fixed form (`{ body, sig }`).
- **`me`, `name`, `id`**: who the reviewer is and which document this is. **`sign(purpose, data)`** signs something as the reviewer.
- **The review as Markdown.** Pipeup already writes the review as Markdown that says exactly where each comment is, ready for an AI to act on. It is on Pipeup's global: `Pipeup.copyAll(items, "ai", { title, url, exportedAt })`, with `items` made from the threads and `Pipeup.locate(...)`. The Send to Git example below does exactly this.

**What stays fixed.** The add-on API number (`api: 1`) changes only for breaking changes, and an add-on written for another number stays off and says why. The form of a signed comment is fixed. Everything else on `host` is additive.

Encryption matters only when comments leave for a store you don't control. Then you would seal them yourself with the browser's built-in crypto; Pipeup's own sealing code is private to its Share add-on. For your own servers, over a secure connection, you don't need it.

## Say what you send

`network` is one plain sentence about what leaves the device and who sees what, plus when it happens (`"never"`, `"after-consent"` or `"page-configured"`) and to which hosts. Reviewers are shown it before anything is sent. Ask the reviewer before you send anything, and send nothing before they agree. If you send nothing, say exactly that.

## Names

An add-on's `id` is its own: letters, digits and dashes, 2 to 24 characters, starting with a letter. Put your name or project in front to keep it distinct (`myteam-translate`). The ids `share`, `voice`, `live` and `assist` belong to the Pipeup project's own add-ons; please don't use them. If two add-ons on a page share an id, the first is used and the second is ignored, with a message in the console.

## Try it and test it

The template has a try page and a Playwright test:

```sh
npm install
npx playwright install chromium
npm run check
```

The test opens the page with the real, published Pipeup, turns comments on, checks that Pipeup lists your add-on as on (`Pipeup.addons()`) with its sentence, and uses its row. Add tests for whatever yours does.

## Keeping add-ons intentional

An add-on is a script on the page. **It runs with the page's full power, so nothing here can stop someone who can already edit the page.** What these steps do is stop add-ons the author didn't choose, such as a stray or copied-in script, and help authors and companies lock down what runs. They are best effort.

- **List the add-ons that may run.** Put one attribute on the page: `<html data-pipeup-addons="share,myteam-hello">`. When it is there, only those add-ons run; any other is ignored, shows as off with the reason "this page doesn't allow it", and writes one plain line to the console. `none` lets no add-on run. Without the attribute every add-on runs, as before. Ids must match exactly.
- **Pin each script.** Use a fixed version and an integrity hash: `<script src="…" integrity="sha384-…" crossorigin="anonymous">`. Or host one bundled file and pin that.
- **Set a content security policy.** An add-on's "what it sends" sentence is a statement; a policy that allows scripts and connections only to the hosts you intend is what enforces it. For Pipeup's own add-ons, the hosts each declares are in the `network.to` of its page on the [Add-ons page](https://pipeup-ai.github.io/pipeup/addons.html).
- **One bundled file.** For a company, host one file that holds Pipeup and the add-on together. The template's build makes it and prints its integrity hash.
- **A name can't prove who made an add-on.** The first add-on with a name wins. Listing the add-ons you expect, and pinning them, covers this.

Agents that add an add-on to a page do these things for you: they add the pinned script, put only the add-ons you asked for in the list, and suggest the matching policy for you to apply.

## Using add-ons inside a company

If your company wants comments to go somewhere it controls, there are two ways. Choose the first unless it can't do what you need.

1. **No new code: the Share add-on with your own mailbox.** A mailbox is a small server you run. It keeps only sealed comments that it can't read, and speaks a published contract (`pm1`). It is the safe default for "comments must stay inside the company". See the [mailbox server](https://github.com/pipeup-ai/pipeup/tree/main/services/mailbox).
2. **Your own add-on.** For what a mailbox can't do: turn comments into tickets, file them in your document system, use your company's sign-in, or save them in Git.

For your own add-on, the script is one file your company hosts, in any of these ways: on your intranet or artifact store, through a private package registry under your own scope, or beside the page. Pin it, list it in `data-pipeup-addons`, and review it like any code on your pages, because it runs with the page's full power. The sentence you write in `network.says` is what reviewers are shown first, so say what goes to your own servers.

### Example: Send to Git

[Send to Git](https://github.com/pipeup-ai/pipeup/tree/main/libs/ts/addons/examples/send-to-git) is a complete add-on written the way a company would write one. **It is not from the Pipeup project.** It adds a **Send to Git** row. It asks first, then sends the review as the Markdown that Copy as Markdown makes to a service your company runs, which files it in Git for later processing and for AI to work from. It never holds a Git token, never changes the page, and never posts, edits or resolves a comment.

The page names the service: `<html data-pipeup-send-to-git-url="https://reviews.example.com/reviews">`. The request is `POST` with `{ title, url, exportedAt, openThreads, markdown }`; the answer is `201` with `{ path, commit }` (and `pr` when it opened a pull request). The service must choose the file's path itself, know who is sending, answer the browser's check, limit size and rate, and hold the Git credentials. The example's README has the whole contract, a stand-in service that saves each review in a local Git repository (so you can see the whole path), and a **checker** that tells you in words whether your own service follows the contract.

### Setting up the GitHub side

The browser never talks to GitHub. A small service your company runs sits between: it knows who is sending (your sign-in), checks the request, chooses the path, limits size and rate, keeps a record, writes the Markdown to the repository, and answers with the saved path and commit or pull request. Ways to give it access, best first:

1. **A GitHub App** installed on only the review repository, writing to a branch and opening a pull request (never pushing to the main branch). The service gets a short-lived token for each request.
2. **A fine-grained access token** on a bot account, limited to one repository, for a pilot.
3. **A GitHub Actions workflow** started by a webhook, for short reviews (about 64 KB at most).

GitHub Enterprise Server works the same at your own address. The example includes a **reference service** for GitHub (no outside code: read it, copy it) and a **setup skill** for agents (`pipeup-send-to-git-setup`) that walks an engineer's agent through the steps: it can generate the service and the page settings, and it can't approve the GitHub App's permissions for you, because only you can. It never asks for a token to be pasted into a page or a chat.

## What the Pipeup project stands behind

Only its own add-ons (`@pipeup/*`): they send only to the services they name, send nothing before the reviewer agrees, never change the page's own content, and never post, edit or resolve anything for a reviewer. **Add-ons from anyone else run with the page's full power.** Pipeup doesn't vouch for them, and neither this guide nor the template changes that. Say plainly what yours does, pin versions, list what may run, and only ship what you'd be happy to have read.
