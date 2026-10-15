# Send to Git (example, not from Pipeup)

An example add-on from another company, shown on Pipeup's site: Pipeup doesn't publish or vouch for it.

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
- **Setting it up for a company**: the skill https://pipeup-ai.github.io/pipeup/skills/pipeup-send-to-git-setup/SKILL.md (it makes the GitHub App with two button presses by the person). Never put a Git token in a page or a chat.

[All add-ons as Markdown](../addons.html.md) · [This add-on's page](https://pipeup-ai.github.io/pipeup/addons/send-to-git.html) · [llms.txt](../llms.txt)
