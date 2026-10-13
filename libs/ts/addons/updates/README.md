# @pipeup/updates

Tells the author, on their own computer, when a newer Pipeup or a security fix is out. A patch or minor release is a
line in the browser console; a major release, a recommended update, or a security fix or unsupported version is also a
**menu notice** with what to do. It never changes the page and never updates anything. Spec:
[FUNCTIONAL_SPEC §14a](../../../../docs/FUNCTIONAL_SPEC.md); design:
[docs/design/update-notices.md](../../../../docs/design/update-notices.md).

## When it runs

Only where the author is the one looking: a page opened from disk, on `localhost` (or `.test` / `.localhost`), or
where the page says `data-pipeup-updates="on"`. Reviewers' browsers never make the request. `data-pipeup-updates="off"`
switches it off.

## Add it

```html
<script src="https://cdn.jsdelivr.net/npm/pipeup/dist/pipeup.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@pipeup/updates/dist/updates.min.js"></script>
```

## What it sends, and to whom

It fetches one small file, `https://pipeup-ai.github.io/pipeup/updates.json`, once a day, with no cookies and no
referrer. GitHub Pages can see your network address. The file is **signed** by the project; the add-on checks the
signature against keys built into it and ignores a file that is forged, changed or out of date. Notices are plain
words and link only to the project's own addresses.
