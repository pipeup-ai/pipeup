# Save to GitHub: an add-on that needs no server and no token

**This is an example, and it is not from the Pipeup project.** It shows the lowest-friction way to get a review into Git:
one menu row, **Save to GitHub**, opens GitHub's own "new file" page in a new tab with the review already filled in. The
reviewer signs in to GitHub as themselves and presses GitHub's commit button (or "propose changes", if they can't write to the
repository). There is no service to run, and nothing holds a token: GitHub's own page and the reviewer's own sign-in do the
saving. It never posts, edits or resolves a comment.

The file is the Markdown that **Copy as Markdown** makes: each open thread says where it is on the page and what was said, ready for an AI to
act on. Its path is chosen from the page's name and the time (`reviews/<page>/<time>-<reviewer>.md`); the reviewer can rename it in GitHub.

## Use it

Add the script and name the repository, on the `<html>` element:

```html
<html data-pipeup-addons="save-to-github" data-pipeup-save-to-github="your-org/reviews">
  <script src="…/pipeup+save-to-github.min.js" integrity="sha384-…" crossorigin="anonymous"></script>
</html>
```

| Attribute                           | Meaning                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `data-pipeup-save-to-github`        | The repository, `owner/name` (required). `demo:` only shows what it would open. |
| `data-pipeup-save-to-github-branch` | The branch (default `main`).                                                    |
| `data-pipeup-save-to-github-folder` | The folder for reviews (default `reviews`).                                     |
| `data-pipeup-save-to-github-host`   | A GitHub Enterprise Server host (default `github.com`).                         |

When a review is too long to travel in an address (about 6,000 characters), it copies the Markdown for the reviewer to paste and opens the same
page with the file name filled in, and says so in words. For long reviews, the example **Send to Git** (with a service) is the better fit.

## See it work

```sh
cd libs/ts/pipeup && npm ci && npm run build                    # once
cd ../addons && npm ci && node examples/save-to-github/build.mjs
node examples/send-to-git/demo.mjs   # serves libs/ts on http://localhost:8789; then open:
# http://localhost:8789/addons/examples/save-to-github/page/index.html   (change your-org/reviews to a repository you can write to)
```

**Lowest friction:** copy the prompt on the [Add-ons page](https://pipeup-ai.github.io/pipeup/addons.html#save-to-github) (the Save to
GitHub card) and give it to your AI agent. It follows the `pipeup-send-to-git-setup` skill, which needs only your repository's name.

## Handing it out and keeping it intentional

It is one script file your company hosts (intranet, artifact store, a private registry under your own scope, or beside the page). `build.mjs` also
makes one **bundled file** (Pipeup and the add-on together) and prints its integrity hash. Pin it, list it in `data-pipeup-addons`, and set a
content security policy that allows scripts only from where you host it. This add-on makes no network request of its own: it opens a link.
All of this is best effort: it stops add-ons you didn't choose, not a page that is already compromised.
