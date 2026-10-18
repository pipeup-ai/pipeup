# @pipeup/github

When a comment you write mentions someone who can be reached on GitHub, a menu row, **Mention @name on GitHub**,
opens GitHub's new-issue page on the author's repository with their `@name`, your words (as a quote) and the page
filled in. Nothing is sent until you submit the issue there, and GitHub tells them in its own way. Design:
[docs/design/mentions.md](../../../../docs/design/mentions.md).

## Add it

```html
<html data-pipeup-github-repo="owner/repo" data-pipeup-github-people="octocat hubot">
  <script src="https://cdn.jsdelivr.net/npm/pipeup/dist/pipeup.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@pipeup/github/dist/github.min.js"></script>
</html>
```

`data-pipeup-github-repo` is where the issue goes; the add-on stays off, saying why, on a page without it.
`data-pipeup-github-people` lists GitHub names that appear in the `@` list. Someone who shared `gh:<name>` as how to
reach them (My identity in the menu, from `@pipeup/identity`) can also be told this way.

## What it sends, and to whom

Nothing by itself. Pressing the row opens `github.com` in a new tab with the issue filled in; you submit it there.
