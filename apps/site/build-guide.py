"""Builds the guide page (addons-guide.html) and its Markdown copy from the repository's guide, docs/ADDONS_GUIDE.md.

Run by `apps/site/build.sh`. One source: the page and the Markdown copy are the same guide shown two ways, so they never
differ. Handles only what the guide uses: headings, paragraphs, lists, tables, fenced code, **bold**, `code`, [links](url).
"""
import html, pathlib, re, sys

root = pathlib.Path(__file__).resolve().parents[2]
site = root / "apps/site"
out = pathlib.Path(sys.argv[1])
src = (root / "docs/ADDONS_GUIDE.md").read_text()
(out / "addons-guide.html.md").write_text(src)

def inline(t: str) -> str:
    t = html.escape(t, quote=False)
    t = re.sub(r"`([^`]+)`", lambda m: f"<code>{m.group(1)}</code>", t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", r'<a href="\2">\1</a>', t)
    return t

def render(md: str) -> str:
    lines, i, body = md.split("\n"), 0, []
    while i < len(lines):
        l = lines[i]
        if l.startswith("```"):
            lang, code = l[3:].strip(), []
            i += 1
            while i < len(lines) and not lines[i].startswith("```"):
                code.append(lines[i]); i += 1
            i += 1
            body.append(f'<div class="code"><button class="cp" type="button" aria-label="Copy this code">Copy</button><pre><code>{html.escape(chr(10).join(code))}</code></pre></div>')
        elif l.startswith("# "):
            body.append(f"<h1>{inline(l[2:])}</h1>"); i += 1
        elif l.startswith("## "):
            title = l[3:]
            body.append(f'<h2 id="{re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")}">{inline(title)}</h2>'); i += 1
        elif l.startswith("### "):
            body.append(f"<h3>{inline(l[4:])}</h3>"); i += 1
        elif l.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")]); i += 1
            head, rows = rows[0], rows[2:]
            th = "".join(f"<th>{inline(c)}</th>" for c in head)
            tr = "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in rows)
            body.append(f"<table><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table>")
        elif re.match(r"^(- |\d+\. )", l):
            ordered = bool(re.match(r"^\d+\. ", l))
            items = []
            while i < len(lines) and re.match(r"^(- |\d+\. )", lines[i]):
                item = re.sub(r"^(- |\d+\. )", "", lines[i]); i += 1
                while i < len(lines) and lines[i].startswith("   ") and lines[i].strip():
                    item += " " + lines[i].strip(); i += 1
                items.append(f"<li>{inline(item)}</li>")
            body.append(("<ol>" if ordered else "<ul>") + "".join(items) + ("</ol>" if ordered else "</ul>"))
        elif l.strip():
            para = [l]; i += 1
            while i < len(lines) and lines[i].strip() and not re.match(r"^(#|```|\||- |\d+\. )", lines[i]):
                para.append(lines[i]); i += 1
            body.append(f"<p>{inline(' '.join(para))}</p>")
        else:
            i += 1
    return "\n".join(body)

chassis = (site / "add-comments.html").read_text()
head = chassis[: chassis.index("    <style>")]
head = re.sub(r"<title>.*?</title>", "<title>Making your own add-on · Pipeup</title>", head, flags=re.S)
desc = "How to make, publish and run your own Pipeup add-on, including inside a company, with a worked example."
head = re.sub(r'(<meta name="description" content=")[^"]*"', lambda m: m.group(1) + desc + '"', head)
for key in ("og:title", "twitter:title"):
    head = re.sub(rf'({key}" content=")[^"]*"', lambda m: m.group(1) + 'Making your own add-on · Pipeup"', head)
for key in ("og:description", "twitter:description"):
    head = re.sub(rf'({key}" content=")[^"]*"', lambda m: m.group(1) + desc + '"', head)
head = re.sub(r'(og:url" content=")[^"]*"', lambda m: m.group(1) + 'https://pipeup-ai.github.io/pipeup/addons-guide.html"', head)
head = re.sub(r'(rel="canonical" href=")[^"]*"', lambda m: m.group(1) + 'https://pipeup-ai.github.io/pipeup/addons-guide.html"', head)
head = re.sub(r'data-pipeup-doc="[^"]*"', 'data-pipeup-doc="pIpEuPgUiDeAdDoN:GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"', head)
head = head.replace("add-comments.html.md", "addons-guide.html.md")
css = chassis[chassis.index("    <style>"): chassis.index("    </style>")]
css += """      .guide { max-width: 760px; padding-bottom: 28px; }
      .guide h1 { font-size: clamp(30px, 3.6vw, 42px); line-height: 1.08; margin: 0 0 14px; }
      .guide h2 { font-size: 24px; letter-spacing: -0.03em; color: var(--strong); margin: 40px 0 10px; scroll-margin-top: 12px; }
      .guide h3 { font-size: 19px; letter-spacing: -0.02em; color: var(--strong); margin: 28px 0 8px; }
      .guide p, .guide li { font-size: 16.5px; color: var(--ink); }
      .guide p { margin: 0 0 14px; } .guide ul, .guide ol { margin: 0 0 16px; padding-left: 22px; } .guide li { margin: 0 0 6px; }
      .guide code { font: 14px/1.4 var(--mono); background: var(--bone); padding: 1px 6px; border-radius: 5px; }
      .guide .code { position: relative; margin: 0 0 18px; }
      .guide pre { margin: 0; padding: 14px 70px 14px 16px; background: #f7f6f2; border: 1px solid var(--line); border-radius: 10px; overflow: auto; }
      .guide pre code { background: none; padding: 0; font-size: 13.5px; }
      .guide .cp { position: absolute; top: 8px; right: 8px; font: 500 12.5px var(--sans); color: var(--muted); background: var(--paper); border: 1px solid var(--line); border-radius: 7px; padding: 3px 10px; cursor: pointer; transition: color 0.2s var(--ease), border-color 0.2s var(--ease); }
      .guide .cp:hover, .guide .cp:focus-visible { color: var(--strong); border-color: #8f8d84; outline: none; }
      .guide table { width: 100%; border-collapse: collapse; margin: 0 0 18px; font-size: 15px; }
      .guide th, .guide td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: top; } .guide th { color: var(--strong); font-weight: 600; }
      .guide a { color: var(--violet); }
      main .guide { margin-top: 0; }
"""
header = chassis[chassis.index("      <header"): chassis.index("      </header>") + len("      </header>")]
footer = chassis[chassis.index("      <footer>"): chassis.index("      </footer>") + len("      </footer>")].replace("add-comments.html.md", "addons-guide.html.md")
back = '      <a class="back" href="addons.html"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>Add-ons</a>'
script = """    <script>
      for (const b of document.querySelectorAll(".guide .cp")) {
        b.addEventListener("click", async () => {
          const text = b.parentElement.querySelector("code").textContent;
          try { await navigator.clipboard.writeText(text); } catch { const t = document.createElement("textarea"); t.value = text; document.body.append(t); t.select(); document.execCommand("copy"); t.remove(); }
          b.textContent = "Copied"; setTimeout(() => (b.textContent = "Copy"), 2000);
        });
      }
      const agents = document.querySelector(".agents");
      const agentsLink = agents.querySelector(".agents-link");
      const setAgents = (on) => { agents.classList.toggle("open", on); agentsLink.setAttribute("aria-expanded", String(on)); };
      agentsLink.addEventListener("click", (e) => { if (matchMedia("(hover: none)").matches && !agents.classList.contains("open")) { e.preventDefault(); setAgents(true); } });
      agents.addEventListener("mouseenter", () => agentsLink.setAttribute("aria-expanded", "true"));
      agents.addEventListener("mouseleave", () => setAgents(false));
      agents.addEventListener("keydown", (e) => { if (e.key === "Escape") { setAgents(false); agentsLink.blur(); } });
      document.addEventListener("click", (e) => { if (!agents.contains(e.target)) setAgents(false); });
    </script>
"""
page = f"""{head}{css}    </style>
  </head>
  <body>
    <main>
{header}
{back}
      <article class="guide" data-pipeup-id="guide">
{render(src)}
      </article>

{footer}
    </main>
{script}    <script src="pipeup.min.js"></script>
  </body>
</html>
"""
(out / "addons-guide.html").write_text(page)
