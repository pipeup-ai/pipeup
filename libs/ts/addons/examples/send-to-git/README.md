# Send to Git: an add-on a company writes for itself

**This is an example, and it is not from the Pipeup project.** It shows what a company's own add-on looks like: written
by the company, hosted by the company, named by the company. Nothing here is published under the Pipeup names or npm
scope, and the Pipeup project doesn't vouch for add-ons from anyone else (see the [guide](../../../../docs/ADDONS_GUIDE.md)).

It adds one row to Pipeup's menu, **Send to Git**. It asks first, then sends the review, as the same AI-ready Markdown
that **Copy as Markdown** makes, to a service your company runs, which files it in Git. The add-on never holds a Git
password or token, never changes the page, and never posts, edits or resolves a comment for anyone.

## See it work, on your computer

```sh
cd libs/ts/pipeup && npm ci && npm run build      # once
cd ../addons && npm ci && node examples/send-to-git/build.mjs
node examples/send-to-git/demo.mjs
```

Open the address it prints, press Shift+Option+C, comment, open the menu, choose **Send to Git**, and confirm. A real
file appears in a real Git repository (a temporary one; the path is printed) and is committed:
`git -C <that path> log --stat`.

## The pieces

| File                   | What it is                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/addon.ts`         | The add-on. Reads the open comments, builds the Markdown with Pipeup's own writer, asks, sends.        |
| `build.mjs`            | Builds the add-on, and **one bundled file** (Pipeup and the add-on together) with its integrity hash.  |
| `service/stand-in.mjs` | A stand-in service for trying it: saves each review in a local Git repository and commits it.          |
| `service/github.mjs`   | A reference service that saves into a GitHub repository. No outside code: read it, copy it, change it. |
| `service/check.mjs`    | A checker: sends a sample review to a service and says in words whether it follows the contract.       |
| `page/index.html`      | A page that uses it.                                                                                   |

## The contract

The page names the service in an attribute on the `<html>` element:

```html
<html data-pipeup-send-to-git-url="https://reviews.example.com/reviews"></html>
```

The address must be `https:` (or `http:` on this computer, for trying it). `demo:` only shows what would be sent.

**The request.** `POST <address>` with `content-type: application/json`:

```json
{
  "title": "Q3 launch plan",
  "url": "https://pages.example.com/plans/launch-plan.html",
  "exportedAt": "2026-10-10T09:30:00.000Z",
  "openThreads": 2,
  "markdown": "# Review comments: Q3 launch plan\n..."
}
```

`markdown` is exactly what Copy as Markdown copies: each open thread says where it is on the page (the slide or section,
the element's `data-pipeup-id`, the quoted text) and what was said. Resolved threads are left out.

**The answer.** `201` with JSON: `{ "path": "reviews/launch-plan/20261010-093005-sam-ab12.md", "commit": "<sha>" }`, and
`"pr": "<link>"` when it opened a pull request. The add-on shows the path and commit (or pull request) to the person.

**Errors.** The add-on shows these in words and saves nothing:

| Status | Meaning                                                              |
| ------ | -------------------------------------------------------------------- |
| `400`  | The request isn't a review (not JSON, or fields missing).            |
| `401`  | The sender isn't signed in.                                          |
| `413`  | The review is too large (this service allows 200 KB).                |
| `429`  | Too many reviews from one person (this service allows ten a minute). |
| `5xx`  | The service couldn't save it.                                        |

**What a service must do.**

- **Choose the file's path itself**, never use one from the request: `reviews/<page>/<time>-<who>-<tag>.md`.
- **Know who is sending** (your sign-in), and refuse anyone who isn't signed in.
- **Answer the browser's check** (an `OPTIONS` request) and allow only the page's address.
- **Limit size and rate**, and keep a record of who saved what.
- **Hold the Git credentials.** They never go to the page or the add-on.

Check yours with the checker:

```sh
node service/check.mjs https://reviews.example.com/reviews --origin https://pages.example.com --header "x-company-user: sam"
```

## Setting up the GitHub side

The browser never talks to GitHub. `service/github.mjs` sits behind your sign-in and holds the credentials. Options, best
first:

1. **A GitHub App** installed on only the review repository (contents and pull requests: write). Set `APP_ID`,
   `INSTALLATION_ID` and `PRIVATE_KEY`. It writes to a branch and opens a pull request (`MODE=pr`, the default), so a
   person or an AI reviews each file.
2. **A fine-grained access token** on a bot account, limited to one repository, for a pilot: set `GITHUB_TOKEN`.
3. **A GitHub Actions workflow** started by a webhook, for short reviews (about 64 KB at most). The service still needs a
   credential to send the event.

GitHub Enterprise Server works the same: set `GITHUB_API=https://HOST/api/v3`. An agent can do the setup for you: hand it
the **pipeup-send-to-git-setup** skill.

## Handing the add-on out

It is one script file. Your company hosts it, in any of these ways:

- **On your intranet or artifact store**, as a file. Pages include it with a script tag.
- **Through a private package registry**, under your company's own scope, then served from there.
- **Beside the page**, as a file next to the HTML (it works from disk).

Build the **bundled file** (`dist/pipeup+send-to-git.min.js`: Pipeup and the add-on together), host that, and pin it with
the integrity hash `build.mjs` prints:

```html
<html data-pipeup-addons="send-to-git" data-pipeup-send-to-git-url="https://reviews.example.com/reviews">
  <script
    src="https://tools.example.com/pipeup+send-to-git.min.js"
    integrity="sha384-…"
    crossorigin="anonymous"
  ></script>
</html>
```

The `data-pipeup-addons` list says which add-ons may run on the page. Set a content security policy as well, allowing
only the script host and `https://reviews.example.com` for connections, because the add-on's "what it sends" sentence is
a statement and the policy is what enforces it. All of this is best effort: it stops add-ons you didn't choose, not a page
that is already compromised.
