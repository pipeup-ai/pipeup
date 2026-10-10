---
name: pipeup-send-to-git-setup
description: Use when someone wants Pipeup reviews saved as Markdown files in their own Git repository (GitHub or GitHub Enterprise Server), with the example add-ons "Save to GitHub" (no server, no token) or "Send to Git" (through the company's own service). Asks which fits, then does the setup with the person, keeping their own steps to one click each. Never asks for a token or key to be pasted into a page or a chat.
---

# Set up "Save to GitHub" or "Send to Git"

This skill is published at https://pipeup-ai.github.io/pipeup/skills/pipeup-send-to-git-setup/SKILL.md.

Two example add-ons (written the way a company writes its own; **not** from the Pipeup project) get a review into Git as a
Markdown file, the same Markdown that Copy as Markdown makes (each comment says where it is, ready for an AI to act on):

- **Save to GitHub** needs **no server and no token**. One menu row opens GitHub's own "new file" page in a new tab with the review filled in;
  the reviewer signs in to GitHub as themselves and presses its commit button. Best to start with, and for short reviews.
- **Send to Git** sends the review to **a service the company runs**, which saves it in Git (pull requests, sign-in, a record of who saved
  what). Best for teams and long reviews.

Source and READMEs: https://github.com/pipeup-ai/pipeup/tree/main/libs/ts/addons/examples
Guide: https://pipeup-ai.github.io/pipeup/addons-guide.html.md

## Rules (read first)

- **Never put a token, key or password in an HTML page, in a page's attributes, or in a chat.** Tell the person where to set it (the service's
  environment, or the company's secret store) and let them do it. Keys this skill makes go to a file only the person can read.
- **You can't approve permissions for them.** Pressing GitHub's "Create GitHub App" and "Install" buttons is theirs: give them the steps and wait.
- **Ask before choosing the repository, the branch and which page to edit.** Don't invent them.
- **Say what you will run before you run it,** and what you changed afterwards. Keep `data-pipeup-doc` exactly as it is.
- This is best effort safety, not a guarantee: a script on a page runs with the page's full power. Pin the script, list the add-on, and tell the person about
  a Content-Security-Policy (see "On the page" below).

## First, ask which fits

1. **Which repository** (owner/name), and the branch (default `main`)? A test repository is best for a first try.
2. **No server (Save to GitHub), or the company's service (Send to Git)?** If they only want to see it work, or reviews are short, start with Save to GitHub.
   If "comments must stay inside the company" is the need and files in Git aren't, the Share add-on with the company's own mailbox is enough instead
   (`npx @pipeup/mailbox`; see the mailbox README).
3. **Which HTML page** will carry it? (Or use the example page to try it.)

## Get and build the example (both paths)

Needs Node 22 or newer and git. In a folder the person chooses:

1. `git clone --depth 1 https://github.com/pipeup-ai/pipeup`
2. `cd pipeup/libs/ts/pipeup && npm ci && npm run build`
3. `cd ../addons && npm ci`, then `node examples/save-to-github/build.mjs` (or `node examples/send-to-git/build.mjs`). It prints each built file's size and
   integrity hash. The file to use is `dist/pipeup+save-to-github.min.js` (or `dist/pipeup+send-to-git.min.js`): **Pipeup and the add-on together**.

## Path A: Save to GitHub (no server, no token)

1. Copy the built `pipeup+save-to-github.min.js` next to the page (or where the company hosts its files).
2. **On the page** (tell the person what you changed): replace Pipeup's own script tag with one for that file (it already contains Pipeup; never include both). If
   the page is served over http(s), add its `integrity="sha384-…"` and `crossorigin="anonymous"`; if it is opened from a file on disk, leave those two out.
3. On the `<html>` element set:
   - `data-pipeup-addons="save-to-github"` (append to an existing list, keeping every entry; the page's other add-ons must stay in it),
   - `data-pipeup-save-to-github="owner/name"`, and if needed `data-pipeup-save-to-github-branch`, `-folder` (default `reviews`) and, for GitHub Enterprise Server, `-host`.
4. **They try it**: open the page, press Shift+Option+C, comment, open the menu, choose Save to GitHub, confirm. GitHub opens with the file filled in; they sign in and
   press its commit button (or "propose changes" if they can't write to the repository). Have them open the repository and check the file.
5. If a review is too long for an address (about 6,000 characters), the add-on copies the Markdown and opens the page with only the file name filled in: say that is
   expected, and offer Path B for long reviews.

There is nothing for them to approve and no token. That is the whole setup.

## Path B: Send to Git (the company's service)

### B1. Try it on this computer first (about ten minutes)

1. **Make the GitHub App with two button presses.** In `libs/ts/addons/examples/send-to-git`, run
   `node service/create-app.mjs --repo <owner/name>` (add `--org <org>` to make it in an organisation; for GitHub Enterprise Server add
   `--web https://HOST --api https://HOST/api/v3`). A page opens in their browser: they press GitHub's **Create GitHub App**, then GitHub asks them to **install** it: they
   choose **only the review repository**. The App's key goes to `./send-to-git-app.pem` (readable only by them) and its settings to `./send-to-git.env`; nothing is printed.
   Tell them these are the only two things they must do.
   *(Alternative for a quick pilot: a fine-grained access token limited to the one repository, Contents and Pull requests: Read and write, which they make on GitHub and
   put in their own terminal as `GITHUB_TOKEN`; never paste it to you.)*
2. **Start the service**: `REPO=<owner/name> ORIGIN=http://localhost:8789 DEV_USER=<their name> PORT=8788 node service/github.mjs` (it reads `./send-to-git.env`).
   `DEV_USER` stands in for the company sign-in; it is for their own computer only.
3. **Start the page**: `SERVICE_URL=http://127.0.0.1:8788/reviews node demo.mjs` in the same folder, and give them the address it prints.
4. **They try it**: press Shift+Option+C, comment, open the menu, choose Send to Git, confirm. The panel shows a pull request link; have them open it and check the
   Markdown file is there. Optionally run the checker (it saves a few test files): `node service/check.mjs http://127.0.0.1:8788/reviews --origin http://localhost:8789`.

### B2. Set it up for a team

1. **Choose how the service gets access** (best first): the GitHub App from B1 (installed on only the review repository), a fine-grained token on a bot account for a pilot, or a
   GitHub Actions workflow started by a webhook for short reviews (about 64 KB). The service writes to a branch and opens a pull request, never pushing to the main branch.
2. **Run `service/github.mjs` where the company runs services**, behind its sign-in and HTTPS. Settings: `REPO`, `BASE_BRANCH`, `MODE` (`pr` or `direct`), `ORIGIN` (the one page
   address allowed to call it), `USER_HEADER` (the header the sign-in proxy sets to the signed-in person's name; the service refuses requests without it), and the credentials.
   Credentials go in the company's secret store, not in the repository.
3. **Check it follows the contract**: `node service/check.mjs https://<service>/reviews --origin https://<page's address> --header "x-company-user: <a name>"`. Fix until it
   reports "This service follows the contract."
4. **Put the built file where the company hosts files** (intranet, artifact store, private registry, or beside the page) and set up the page as below, with
   `data-pipeup-addons="send-to-git"` and `data-pipeup-send-to-git-url="https://<service>/reviews"`.

## On the page (both paths)

- Pin the script with its integrity hash (when served over http(s)); list the add-on in `data-pipeup-addons`.
- Tell the person about a **Content-Security-Policy** that allows scripts only from the page and the host serving the file, and for Send to Git connections only to the
  service's address (Save to GitHub makes no request of its own: it opens a link). Don't apply it yourself: a strict policy can break a page.

## When something fails

| What you see | Likely cause |
|---|---|
| "this page names no repository" / "no address to send to" | the page's attribute is missing, or isn't `owner/name` / `https:` |
| "this page doesn't allow it" | the add-on's id isn't in `data-pipeup-addons` |
| GitHub's page says the file can't be created, or 404 | the repository or branch name is wrong, or the person can't see the repository |
| "you are not signed in to the service" (401) | the sign-in proxy isn't setting `USER_HEADER`, or the request skipped the proxy |
| The browser blocks the request | the service doesn't allow the page's address (`ORIGIN`), or the content security policy doesn't allow the service |
| "the review is too large" (413) | the review is over 200 KB: resolve threads, or raise the limit in the service |
