"""Fills in what the site says about the copy of Pipeup it carries, and checks it: the core's integrity hash in the
prompts and the lines for a page, and the version and compressed size in The details (details.html).

Run by `apps/site/build.sh`, once every page is in place. The version is the one the site's pipeup.min.js was built as
(libs/ts/pipeup/package.json), and the size is that file's, gzipped as the size budget measures it; the build stops if
a page pins another version, or if anything is left unfilled, so the site can't go out of date. The hash is of the file
the CDN serves for that version (so a pinned page loads), read when the site is built. If the CDN can't be reached, the
hash is left out with a warning, never taken from the file built here: a wrong hash would stop every page that uses it
from loading Pipeup.
"""
import base64, gzip, hashlib, json, pathlib, re, sys, urllib.request

root = pathlib.Path(__file__).resolve().parents[2]
out = pathlib.Path(sys.argv[1])
version = json.loads((root / "libs/ts/pipeup/package.json").read_text())["version"]
lib = (out / "pipeup.min.js").read_bytes()
pages = [out / n for n in ("index.html", "index.html.md", "prompt.html", "prompt.html.md", "details.html", "details.html.md", "add-comments.html", "add-comments.html.md", "create-html.html.md", "llms.txt", "llms-full.txt")]
script = out / "prompts.js"

def fail(why: str) -> None:
    print(f"inject-core: {why}", file=sys.stderr)
    sys.exit(1)

if f'"{version}"'.encode() not in lib:
    fail(f"pipeup.min.js wasn't built as {version}")
for f in [*pages, script]:
    for pinned in set(re.findall(r"\bpipeup@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)/", f.read_text())):
        if pinned != version:
            fail(f"{f.name} pins pipeup@{pinned}, but the site carries {version} (tools/set-version.sh sets both)")

sri = ""
try:
    with urllib.request.urlopen(f"https://cdn.jsdelivr.net/npm/pipeup@{version}/dist/pipeup.min.js", timeout=10) as r:
        sri = "sha384-" + base64.b64encode(hashlib.sha384(r.read()).digest()).decode()
except Exception as e:
    print(f"inject-core: warning: the CDN's pipeup@{version} couldn't be read ({e}); the integrity hash is left out", file=sys.stderr)

size = f"{round(len(gzip.compress(lib, compresslevel=6)) / 1024)} KB"
for f in pages:
    text = f.read_text()
    text = text.replace("{{VERSION}}", version).replace("{{SIZE}}", size)
    text = text.replace("{{SRI:pipeup}}", sri) if sri else text.replace(' integrity="{{SRI:pipeup}}" crossorigin="anonymous"', "")
    if re.search(r"\{\{(VERSION|SIZE|SRI:pipeup)", text):
        fail(f"{f.name} still has a placeholder")
    f.write_text(text)
if sri:
    script.write_text(script.read_text().replace("{{SRI:pipeup}}", sri))
print(f"core: {version}, {size} gzip, integrity hash {'from the CDN' if sri else 'left out'}")
