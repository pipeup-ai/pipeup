"""Puts each add-on's integrity hash into the Add-ons page's prompts and script tags.

Run by `apps/site/build.sh`. The hash is of the file the CDN serves for the pinned version (so a pinned page loads),
read when the site is built; offline, or if the CDN can't be reached, it falls back to the file built here (the same
bytes, for a released version). If neither is known the hash is left out and the tag has no integrity attribute.
"""
import base64, hashlib, json, pathlib, re, sys, urllib.request

root = pathlib.Path(__file__).resolve().parents[2]
out = pathlib.Path(sys.argv[1])
pages = [out / "addons.html", out / "addons.html.md"]
text = pages[0].read_text()
version = re.search(r'const ADDONS_VERSION = "([^"]+)"', text).group(1)

def sri(data: bytes) -> str:
    return "sha384-" + base64.b64encode(hashlib.sha384(data).digest()).decode()

values = {}
for id_ in ("share", "voice", "live", "assist"):
    value = ""
    try:
        with urllib.request.urlopen(f"https://cdn.jsdelivr.net/npm/@pipeup/{id_}@{version}/dist/{id_}.min.js", timeout=10) as r:
            value = sri(r.read())
    except Exception:
        local = root / f"libs/ts/addons/{id_}/dist/{id_}.min.js"
        if local.exists():
            value = sri(local.read_bytes())
    values[id_] = value
for page in pages:
    body = page.read_text()
    for id_, value in values.items():
        body = body.replace("{{SRI:%s}}" % id_, value)
    page.write_text(body)
text = "".join(p.read_text() for p in pages)
print("integrity hashes:", json.dumps({k: bool(re.search(k, text)) for k in ("sha384-",)}))
