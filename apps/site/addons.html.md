# Pipeup add-ons

Pipeup on its own needs none of these, and sends nothing anywhere. An add-on is one extra script the page's author chooses; each asks reviewers first. In beta. Making your own? The guide is at https://github.com/pipeup-ai/pipeup/blob/main/docs/ADDONS_GUIDE.md.

Keep add-ons intentional (best effort): pin each script with its `integrity` hash as shown below; put the add-on's id in `data-pipeup-addons` on the `<html>` element (append to an existing list, keep every entry; `none` lets no add-on run; without it every add-on runs); and tell the author, in your reply, about a Content-Security-Policy that allows scripts only from the page and the CDN and connections only to the hosts the add-on names (don't apply it yourself, a strict one can break a page). This stops stray scripts, not a page that is already compromised.

Add one only when the author asks for that feature, tell them in plain words what it sends and to whom, and never pick a sharing service for them. Edit only the HTML file: there is nothing to download, run or look up. Keep `data-pipeup-doc` exactly as it is.

## Share

Comments reach everyone who has the page.

- **Sends**: sealed comments, to a service the author picks: a PrivateBin or their own mailbox (see below). The service can't read them.
- **Asks first**: nothing is shared until the reviewer chooses to.
- **Try it**: on your own computer, with a local demo and its own sharing service (no online try page, so nothing goes to a public service).
- **Add it**: after the Pipeup script tag, add `<script src="https://cdn.jsdelivr.net/npm/@pipeup/share@0.5.3/dist/share.min.js" integrity="{{SRI:share}}" crossorigin="anonymous"></script>`, and put the sharing address the author gives you on the `<html>` element as `data-pipeup-share="<address>"`, exactly as written. Ask the author for the address; don't make one up or try it.

## Voice

Dictate a comment instead of typing it.

- **Sends**: nothing of its own. The browser's own speech engine does the listening, and in some browsers it sends the audio to its maker.
- **Asks first**: a short note, then the browser's own microphone prompt.
- **Try it**: https://pipeup-ai.github.io/pipeup/try/voice.html
- **Add it**: after the Pipeup script tag, add `<script src="https://cdn.jsdelivr.net/npm/@pipeup/voice@0.5.3/dist/voice.min.js" integrity="{{SRI:voice}}" crossorigin="anonymous"></script>`.

## Live

See who else is on the page, and where.

- **Sends**: presence and comments, browser to browser. Public relays only introduce the reviewers to each other.
- **Asks first**: each reviewer, before anything connects.
- **Try it**: https://pipeup-ai.github.io/pipeup/try/live.html (open it in two browsers)
- **Add it**: after the Pipeup script tag, add `<script src="https://cdn.jsdelivr.net/npm/@pipeup/live@0.5.3/dist/live.min.js" integrity="{{SRI:live}}" crossorigin="anonymous"></script>`.

## Assist

A small AI model on the reviewer's device reads the whole page and points to related parts of it.

- **Sends**: nothing. The model runs on the device, and the browser may download it once.
- **Asks first**: each reviewer, with the model, its size and what it reads, before it turns on.
- **Try it**: https://pipeup-ai.github.io/pipeup/try/assist.html, or on slides: https://pipeup-ai.github.io/pipeup/try/assist-deck.html
- **Add it**: after the Pipeup script tag, add `<script src="https://cdn.jsdelivr.net/npm/@pipeup/assist@0.5.3/dist/assist.min.js" integrity="{{SRI:assist}}" crossorigin="anonymous"></script>`.

## Your own mailbox

A small server the author runs for Share, so even sealed comments stay inside their organisation. It is not a page script: nothing is added to the HTML for it, and the author gives you its address for `data-pipeup-share`.

- **Sends**: sealed comments, to a server the author runs. It holds ciphertext and never sees the key.
- **Needs**: Node 22 or newer, and an HTTPS proxy in front of it. Pipeup doesn't run a mailbox for anyone.
- **Run it**: `CREATE_TOKEN="$(openssl rand -base64 24)" DATA_DIR=./pipeup-mailbox npx @pipeup/mailbox`. Guide: https://github.com/pipeup-ai/pipeup/tree/main/services/mailbox#readme

## Make your own

Write an add-on for your team or company and host it yourself: it needs nobody's permission and nothing goes in Pipeup's name. Add-ons from anyone else run with the page's full power and Pipeup doesn't vouch for them.

- **Guide**: https://pipeup-ai.github.io/pipeup/addons-guide.html.md (what an add-on works with, pinning and listing, using add-ons inside a company, setting up the GitHub side).
- **Template**: `git clone --depth 1 https://github.com/pipeup-ai/pipeup pipeup-src && cp -R pipeup-src/libs/ts/addons/template my-addon && rm -rf pipeup-src`

## Example: Send to Git (not from Pipeup)

What a company's own add-on looks like: it sends the open comments as one Markdown file to a service the company runs, which files it in Git. It asks first, never holds a Git token, and never posts, edits or resolves a comment.

- **Sends**: the review as Markdown, to the address the page names in `data-pipeup-send-to-git-url`.
- **Try it**: https://pipeup-ai.github.io/pipeup/try/send-to-git.html (nothing leaves the browser), or run it for real from the source: https://github.com/pipeup-ai/pipeup/tree/main/libs/ts/addons/examples/send-to-git
- **Copy prompt** (paste it to an AI agent to set it up with you):

  ```text
  I want to try Pipeup's Send to Git example: an add-on that saves a review as a Markdown file in a GitHub repository, through a small service that I run. Please set it up with me, following this skill:
  https://pipeup-ai.github.io/pipeup/skills/pipeup-send-to-git-setup/SKILL.md

  Start by asking me which GitHub repository to use, and whether I want to try it on this computer first or set it up for my team. Then guide me step by step, and tell me what a command does before you run it.

  Rules: never ask me to paste a token, key or password into this chat or into any page; tell me where to set it instead. Anything that needs my approval, such as creating a GitHub App or its permissions, I will do myself. Don't change my pages except as the skill says.
  ```
- **Setting it up for a company**: the skill https://pipeup-ai.github.io/pipeup/skills/pipeup-send-to-git-setup/SKILL.md. Never put a Git token in a page or a chat.

[Back to the home page as Markdown](index.html.md) · [llms.txt](llms.txt)
