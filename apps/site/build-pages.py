#!/usr/bin/env python3
"""Builds the plain reading pages from Markdown: Privacy (docs/store/privacy-policy.md, the extension's policy that the
stores link to) and Support (apps/site/support.md). Each gets the site's frame from details.html (head, header and
footer) and a Markdown copy beside it. Spec: docs/WEBSITE_SPEC.md §3 item 2b. Light only.

    python3 apps/site/build-pages.py <out>
"""

import html
import re
import sys
from pathlib import Path

site = Path(__file__).resolve().parent
root = site.parent.parent
out = Path(sys.argv[1])

PAGES = [
    (root / "docs/store/privacy-policy.md", "privacy.html", "Privacy",
     "What Pipeup for browsers keeps, what leaves your browser and when, and how to remove it."),
    (site / "support.md", "support.html", "Support",
     "Getting started with Pipeup for browsers, common questions, and how to report a problem."),
]


def inline(text: str) -> str:
    """Bold, code and links, on escaped text."""
    t = html.escape(text, quote=False)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", lambda m: f'<a href="{html.escape(m[2])}">{m[1]}</a>', t)
    t = re.sub(r'(?<![="\w])(https://[^\s<,)]+[^\s<,.)])', r'<a href="\1">\1</a>', t)
    return t


def render(md: str) -> tuple[str, str]:
    """The page's title and its body as HTML: headings, paragraphs and one level of lists."""
    lines = md.splitlines()
    title = lines[0].lstrip("# ").strip()
    parts: list[str] = []
    para: list[str] = []
    items: list[str] = []

    def flush() -> None:
        if para:
            parts.append(f"<p>{inline(' '.join(para))}</p>")
            para.clear()
        if items:
            parts.append("<ul>" + "".join(f"<li>{inline(i)}</li>" for i in items) + "</ul>")
            items.clear()

    for line in lines[1:]:
        if line.startswith("## "):
            flush()
            parts.append(f"<h2>{inline(line[3:].strip())}</h2>")
        elif line.startswith("- "):
            if para:
                flush()
            items.append(line[2:].strip())
        elif line.startswith("  ") and items:
            items[-1] += " " + line.strip()
        elif not line.strip():
            flush()
        else:
            if items:
                flush()
            para.append(line.strip())
    flush()
    return title, "\n".join(parts)


shell = (site / "details.html").read_text()
head_end = shell.index("</style>")
header = shell[shell.index('<header class="top">') : shell.index("</header>") + len("</header>")]
footer = shell[shell.index("<footer>") : shell.index("</footer>") + len("</footer>")]
style = shell[shell.index("<style>") : head_end + len("</style>")]

READING = """
    <style>
      .doc { max-width: 720px; padding: 32px 0 56px; }
      .doc h1 { margin-bottom: 8px; }
      .doc h2 { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; color: var(--strong); margin: 36px 0 10px; }
      .doc p, .doc li { font-size: 16px; line-height: 1.65; }
      .doc ul { padding-left: 1.2em; }
      .doc li { margin: 6px 0; }
      .doc li b, .doc p b { font-weight: 600; color: var(--strong); }
      .doc code { font-family: var(--mono); font-size: 14px; background: var(--bone); padding: 1px 5px; border-radius: 5px; }
      @media (max-width: 640px) { main { padding: 0 18px; } }
    </style>"""

for src, name, label, description in PAGES:
    md = src.read_text()
    md = md.split("\n## Change log")[0].rstrip() + "\n"
    title, body = render(md)
    page = f"""<!doctype html>
<!-- {label}: built by apps/site/build-pages.py from {src.relative_to(root)}. Spec: docs/WEBSITE_SPEC.md §3 item 2b. Light only. -->
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{html.escape(label)} · Pipeup</title>
    <meta name="description" content="{html.escape(description)}" />
    <link rel="icon" type="image/svg+xml" href="favicon.svg" />
    <link rel="canonical" href="https://pipeup-ai.github.io/pipeup/{name}" />
    <link rel="alternate" type="text/markdown" href="{name}.md" title="This page as Markdown" />
    {style}{READING}
    <link rel="stylesheet" href="pages.css" />
  </head>
  <body>
    <main>
      {header}

      <article class="doc">
        <h1>{inline(title)}</h1>
{body}
      </article>

      {footer.replace("details.html.md", f"{name}.md")}
    </main>
  </body>
</html>
"""
    (out / name).write_text(page)
    (out / f"{name}.md").write_text(md)
print("pages: privacy.html, support.html")
