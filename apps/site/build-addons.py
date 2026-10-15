"""Builds the Add-ons page's cards and each add-on's own page, from addons/catalog.json.

Run by `apps/site/build.sh` after the pages are copied. One source for each part, so the card, the page and the Markdown
copies never differ:
- addons/catalog.json: the cards in order (title, one sentence, what Copy offers, where a click goes);
- addons/viz/<id>.svg: the card's visual (also shown, larger, on a page that has no demo);
- addons/<id>.html: the add-on's own part of its page (what it does and sends, its buttons, its demo);
- addons/<id>.md: its Markdown copy, for agents; addons.html.md lists them all.

  python3 build-addons.py <built site dir>
"""
import html, json, pathlib, re, sys

site = pathlib.Path(__file__).parent
src = site / "addons"
out = pathlib.Path(sys.argv[1])
(out / "addons").mkdir(parents=True, exist_ok=True)
catalog = json.loads((src / "catalog.json").read_text())
SITE = "https://pipeup-ai.github.io/pipeup/"

COPY_IC = '<svg class="ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>'
OK_IC = '<svg class="ok" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>'
CHEVRON = '<svg class="cv" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>'


def viz(id_: str, crop: bool = False) -> str:
    """The add-on's picture. `crop`: on a card, a phone shows it in a narrower box, filled from the middle."""
    svg = (src / "viz" / f"{id_}.svg").read_text().strip()
    return svg.replace("<svg ", '<svg preserveAspectRatio="xMidYMid slice" ', 1) if crop else svg


def href(card: dict, up: bool = False) -> str:
    to = card.get("href") or f"addons/{card['id']}.html"
    return ("../" + to) if up else to


def copy_control(card: dict) -> str:
    """One option: a button that copies it. More: a Copy button whose menu lists them."""
    title = html.escape(card["title"])
    if len(card["copy"]) == 1:
        key, label = card["copy"][0]
        return f'<button class="btn sm" type="button" data-copy="{key}">{COPY_IC}{OK_IC}<span class="label">{html.escape(label)}</span></button>'
    items = "".join(
        f'<button class="mi" type="button" role="menuitem" data-copy="{key}">{html.escape(label)}</button>' for key, label in card["copy"]
    )
    return (
        f'<button class="btn sm" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="copy-{card["id"]}">{COPY_IC}{OK_IC}'
        f'<span class="label">Copy</span>{CHEVRON}</button>'
        f'<div class="cmenu" id="copy-{card["id"]}" role="menu" aria-label="Copy for {title}">{items}</div>'
    )


def card_html(card: dict, note: str | None) -> str:
    eg = f'<p class="eg">{html.escape(note)}</p>' if note else ""
    return (
        f'        <article class="card" id="{card["anchor"]}" data-pipeup-id="card-{card["id"]}">\n'
        f'          <div class="viz" aria-hidden="true">{viz(card["id"], crop=True)}</div>\n'
        f'          <div class="body">{eg}<h3><a class="go" href="{href(card)}">{html.escape(card["title"])}</a></h3>'
        f'<p>{html.escape(card["sentence"])}</p></div>\n'
        f'          <div class="copy">{copy_control(card)}</div>\n'
        f"        </article>\n"
    )


# 1. The Add-ons page: a group of cards per kind, each card leading to its page.
groups = ""
for g in catalog["groups"]:
    cards = "".join(card_html(c, g.get("note")) for c in g["cards"])
    slug = re.sub(r"[^a-z]+", "-", g["title"].lower()).strip("-")
    groups += (
        f'      <section class="group" aria-labelledby="g-{slug}" data-pipeup-id="group-{slug}">\n'
        f'        <h2 id="g-{slug}">{html.escape(g["title"])}</h2>\n'
        f'        <div class="cards">\n{cards}        </div>\n'
        f"      </section>\n"
    )
index = out / "addons.html"
text = index.read_text()
MARK = "      <!-- CARDS: build-addons.py puts the cards here, from addons/catalog.json -->\n"
assert MARK in text, "addons.html needs its CARDS mark"
index.write_text(text.replace(MARK, groups))

# 2. Each add-on's own page: the shell, its part, and (with no demo) its visual beside the words.
shell = (src / "page.html").read_text()
n = 0
for g in catalog["groups"]:
    for c in g["cards"]:
        if c.get("page") is False:
            continue
        body = (src / f"{c['id']}.html").read_text()
        body = re.sub(r"^<!--.*?-->\n", "", body)
        # From one folder down, the site's own links go up one.
        body = re.sub(r'href="(?!https?:|#|mailto:|\.\./)([^"]+)"', r'href="../\1"', body)
        # The page's title is its one heading.
        body = body.replace("<h2>", "<h1>", 1).replace("</h2>", "</h1>", 1)
        if 'class="demo"' not in body:
            body = body.replace("</section>", f'  <div class="viz big" aria-hidden="true">{viz(c["id"])}</div>\n</section>', 1)
        body = "\n".join(("      " + l) if l else l for l in body.rstrip().split("\n"))
        # Its own document for comments, the same every build (made from the id, not the order).
        doc = ("pIpEuPaD" + c["id"].replace("-", "") + "0" * 16)[:16] + ":" + "W" * 43
        page = (
            shell.replace("{{BODY}}", body)
            .replace("{{TITLE}}", html.escape(c["title"]))
            .replace("{{DESCRIPTION}}", html.escape(c["sentence"]))
            .replace("{{ID}}", c["id"])
            .replace("{{DOC}}", doc)
        )
        (out / "addons" / f"{c['id']}.html").write_text(page)
        md = src / f"{c['id']}.md"
        (out / "addons" / f"{c['id']}.html.md").write_text(md.read_text())
        n += 1

# 3. The Markdown copy of the Add-ons page: the rules every add-on shares, then each card with its page's Markdown.
lines = []
for g in catalog["groups"]:
    lines += [f"## {g['title']}", ""]
    if g.get("note"):
        lines += [f"{g['note']}.", ""]
    for c in g["cards"]:
        md = f"{SITE}{href(c)}.md" if c.get("page") is not False else f"{SITE}addons-guide.html.md"
        lines.append(f"- **{c['title']}**: {c['sentence']} [As Markdown]({md})")
    lines.append("")
index_md = out / "addons.html.md"
text = index_md.read_text()
assert "{{CARDS}}" in text, "addons.html.md needs its {{CARDS}} mark"
index_md.write_text(text.replace("{{CARDS}}", "\n".join(lines).rstrip()))
print(f"Built the Add-ons page's cards and {n} add-on pages")
