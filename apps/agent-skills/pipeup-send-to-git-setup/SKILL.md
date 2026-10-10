---
name: pipeup-send-to-git-setup
description: Use when a company wants Pipeup reviews saved as Markdown files in its own Git repository (GitHub or GitHub Enterprise Server) through its own service, with the "Send to Git" example add-on. Walks the engineer through choosing the access method, creating the GitHub App, running the reference service, pointing the page at it and checking it. Never asks for a token to be pasted into a page or a chat.
---

# Set up "Send to Git" for a company

This skill is published at https://pipeup-ai.github.io/pipeup/skills/pipeup-send-to-git-setup/SKILL.md.

"Send to Git" is an example of an add-on a company writes for itself (it is **not** from the Pipeup project). It adds a
menu row that asks first, then sends a review, as the Markdown that Copy as Markdown makes, to **a service the company
runs**, which saves it in Git. The browser never talks to GitHub and the add-on never holds a Git token: the service does.

Source, with the contract in its README: https://github.com/pipeup-ai/pipeup/tree/main/libs/ts/addons/examples/send-to-git
Guide: https://pipeup-ai.github.io/pipeup/addons-guide.html.md

## Rules (read first)

- **Never put a token, key or password in an HTML page, in the page's attributes, or in a chat.** Tell the person where to
  set it (the service's environment, or the company's secret store) and let them do it.
- **You can't approve permissions for them.** Creating a GitHub App, installing it on the repository and granting its
  permissions needs someone who can: give them the exact steps and wait.
- **Ask before choosing the repository, the branch and the page's address.** Don't invent them.
- This is best effort safety, not a guarantee: say so. A script on a page runs with the page's full power.

## Steps

1. **Is the Share add-on with the company's own mailbox enough?** If the need is only "comments must stay inside the
   company", it is: use `@pipeup/share` with a mailbox the company runs (`npx @pipeup/mailbox`, see the mailbox README) and
   stop. Continue only if they want files in Git, tickets, or the company's sign-in.
2. **Choose how the service gets access to GitHub** (best first), and ask which:
   - A **GitHub App** installed on only the review repository, with contents and pull requests: write. It writes to a branch and opens
     a pull request, never pushing to the main branch. Set `APP_ID`, `INSTALLATION_ID`, `PRIVATE_KEY`.
   - A **fine-grained access token** on a bot account, limited to one repository, for a pilot: `GITHUB_TOKEN`.
   - A **GitHub Actions workflow** started by a webhook, for short reviews (about 64 KB at most).
   For GitHub Enterprise Server set `GITHUB_API=https://HOST/api/v3`.
3. **Create the GitHub App (if chosen).** Give the person these steps: in the organisation's settings, create a GitHub App (no
   webhook needed) with repository permissions Contents: Read and write and Pull requests: Read and write; install it on only
   the review repository; generate a private key; note the App ID and the installation ID. Tell them to keep the key in the
   service's secret store.
4. **Create the service from the reference one.** Copy `service/lib.mjs` and `service/github.mjs` from the example. It needs
   Node 22 or newer and no other code. Settings: `REPO` (owner/name), `BASE_BRANCH`, `MODE` (`pr` or `direct`), `ORIGIN` (the
   one page address allowed to call it), `USER_HEADER` (the header the company's sign-in proxy sets to the signed-in
   person's name; the service refuses requests without it), and the credentials from step 2. Put it **behind the company's
   sign-in** and behind HTTPS.
5. **Check it follows the contract**: `node service/check.mjs https://<service>/reviews --origin https://<page's address> --header "x-company-user: <a name>"`.
   It says in words what is wrong. Fix until it reports "This service follows the contract."
6. **Build and host the add-on.** In the example folder run `node build.mjs`. It makes `send-to-git.min.js` and one bundled
   file `pipeup+send-to-git.min.js` (Pipeup and the add-on together) and prints each file's integrity hash. Host the
   bundled file where the company hosts its own files (intranet, artifact store, private registry, or beside the page).
7. **Set up the page** (tell the person what you changed):
   - the script tag for the file with its `integrity` hash and `crossorigin="anonymous"`;
   - on `<html>`: `data-pipeup-send-to-git-url="https://<service>/reviews"` and `data-pipeup-addons="send-to-git"` (append to an
     existing list, keeping every entry; Pipeup's own add-ons the page already uses must stay in it);
   - keep `data-pipeup-doc` exactly as it is.
8. **Content-Security-Policy.** Tell the person about a policy that allows scripts only from the page and the host serving the
   bundled file, and connections only to the service's address. Don't apply it yourself: a strict one can break a page.
9. **Try it.** Open the page, press Shift+Option+C, comment, open the menu, choose Send to Git, confirm. The panel shows the saved
   path and commit (or pull request). Open the repository and check the file is there.

## When something fails

| What you see | Likely cause |
|---|---|
| The add-on shows "this page names no address" | `data-pipeup-send-to-git-url` is missing or not `https:` |
| "this page doesn't allow it" | its id isn't in `data-pipeup-addons` |
| "you are not signed in to the service" (401) | the sign-in proxy isn't setting `USER_HEADER`, or the request skipped the proxy |
| The browser blocks the request | the service doesn't allow the page's address (`ORIGIN`), or the content security policy doesn't allow the service |
| "the review is too large" (413) | the review is over 200 KB: resolve threads, or raise the limit in the service |
