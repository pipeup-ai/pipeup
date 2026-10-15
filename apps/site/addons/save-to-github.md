# Save to GitHub (example, not from Pipeup)

An example add-on from another company, shown on Pipeup's site: Pipeup doesn't publish or vouch for it.

The quickest way to get a review into Git: it opens GitHub's own "new file" page with the review filled in as a Markdown file. No server and no token: the reviewer signs in to GitHub as themselves and presses its commit button. It asks first and never posts, edits or resolves a comment.

- **Sends**: nothing from the page. It opens a GitHub link with the Markdown in it (for long reviews it copies the Markdown to paste instead).
- **Add it**: set `data-pipeup-save-to-github="owner/name"` on the `<html>` element (optional `-branch`, `-folder`, `-host`), and `data-pipeup-addons="save-to-github"`. The script is built from source (it is an example, not published): see the skill.
- **Try it**: https://pipeup-ai.github.io/pipeup/try/save-to-github.html (nothing is opened until you press Open GitHub), source: https://github.com/pipeup-ai/pipeup/tree/main/libs/ts/addons/examples/save-to-github
- **Copy prompt** (paste it to an AI agent to set it up with you; it only needs the repository's name):

  ```text
  I want to add Pipeup's Save to GitHub example to my HTML page, so reviewers can save a review as a Markdown file in a GitHub repository: it opens GitHub's own "new file" page with the review filled in (no server, no token). Please set it up with me, following this skill:
  https://pipeup-ai.github.io/pipeup/skills/pipeup-send-to-git-setup/SKILL.md

  Start by asking me which GitHub repository to use (and the branch), and which HTML page. Then do the setup step by step, and tell me what a command does before you run it.

  Rules: never ask me to paste a token, key or password into this chat or into any page. Keep data-pipeup-doc exactly as it is. Don't change my pages except as the skill says.
  ```

[All add-ons as Markdown](../addons.html.md) · [This add-on's page](https://pipeup-ai.github.io/pipeup/addons/save-to-github.html) · [llms.txt](../llms.txt)
