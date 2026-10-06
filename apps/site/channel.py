"""Turns a built site into the pre-release ("next") copy, published under /next/.

Run by `apps/site/build.sh --channel next`. It changes the built files only: the sources stay
channel-free. Absolute site addresses point to /next/, every page is marked noindex, and the home
page and Try pages say which pre-release this is, with a link back to the stable site.

  python3 channel.py <built site dir> <version>
"""
import html, pathlib, sys

out, version = pathlib.Path(sys.argv[1]), sys.argv[2]
STABLE = "https://pipeup-ai.github.io/pipeup/"
NEXT = STABLE + "next/"
v = html.escape(version)

# 1. Absolute addresses of the site point at this copy (llms.txt, llms-full.txt, the Markdown page,
#    the skills and the pages' own from-disk fallback).
for f in out.rglob("*"):
    if f.suffix in {".html", ".md", ".txt"}:
        text = f.read_text()
        if STABLE in text:
            f.write_text(text.replace(STABLE, NEXT))

# 2. Search engines index only the stable site.
for f in out.rglob("*.html"):
    text = f.read_text()
    assert "<head>" in text, f
    f.write_text(text.replace("<head>", '<head>\n    <meta name="robots" content="noindex" />', 1))

# 3. Say it's a pre-release. The home page gets a bar above its header; each Try page gets a label in
#    its Try bar.
BAR = f"""
    <div role="note" data-pipeup-ignore style="margin:0;padding:9px 16px;background:#fbf3db;border-bottom:1px solid #eadfb8;color:#5c4b16;font:14px/1.4 -apple-system,'Segoe UI',system-ui,sans-serif;text-align:center">
      <b style="font-weight:600">Pre-release {v}</b> — for testing; it may change.
      <a href="{STABLE}" style="color:#111;margin-left:6px">Stable version →</a>
    </div>"""
index = out / "index.html"
text = index.read_text()
assert "<body>" in text
index.write_text(text.replace("<body>", "<body>" + BAR, 1))

LABEL = f'<a class="pre" href="{STABLE}" style="color:#5c4b16;background:#fbf3db;border-radius:999px;padding:4px 10px" title="Go to the stable site">Pre-release {v}</a>\n      <a class="gh"'
for f in (out / "try").glob("*.html"):
    text = f.read_text()
    assert '<a class="gh"' in text, f
    f.write_text(text.replace('<a class="gh"', LABEL, 1))

print(f"Marked {out} as pre-release {version} at {NEXT}")
