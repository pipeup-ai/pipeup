"""Builds the "Try it" pages: the site's three examples, each with a slim bar back to the site.

Run by `apps/site/build.sh`. Each example in try/ is a complete page with its own look; this only adds the bar.
"""
import pathlib, sys

site = pathlib.Path(__file__).parent
out = pathlib.Path(sys.argv[1]) / "try"
out.mkdir(parents=True, exist_ok=True)
PAGES = [("document", "Document"), ("slides", "Slides"), ("website", "Website")]

BAR = """
    <style>
      .pu-try { position: fixed; top: 0; left: 0; right: 0; z-index: 2147483000; height: 44px; display: flex; align-items: center; gap: 18px;
        padding: 0 20px; margin: 0; text-transform: none; letter-spacing: normal; font-weight: 400; background: rgba(255, 255, 255, 0.94); border-bottom: 1px solid rgba(0, 0, 0, 0.08); font: 14px/1 -apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif; color: #787774; }
      .pu-try a { color: #787774; text-decoration: none; text-transform: none; letter-spacing: normal; transition: color 0.2s ease; }
      .pu-try a:hover, .pu-try a[aria-current] { color: #111; }
      .pu-try .gh { display: inline-flex; align-items: center; gap: 6px; }
      .pu-try .gh svg { display: block; transition: transform 0.26s ease; }
      .pu-try .gh:hover svg { transform: translateY(-1px); }
      .pu-try .back { color: #111; font-weight: 500; margin-right: auto; }
      .pu-try kbd { display: inline-grid; place-items: center; min-width: 22px; height: 22px; padding: 0 5px; margin: 0 1px; font: 500 13px/1 -apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
        color: #2f3437; background: #f7f6f3; border: 1px solid #eaeaea; border-bottom-width: 2px; border-radius: 5px; }
      .pu-try .hint { display: inline-flex; align-items: center; gap: 4px; }
      html { scroll-padding-top: 44px; }
      body { padding-top: 44px !important; box-sizing: border-box; }
      @media (max-width: 640px) { .pu-try .hint { display: none; } }
    </style>
    <div class="pu-try" role="navigation" data-pipeup-ignore aria-label="Pipeup examples">
      <a class="back" href="../index.html">← Pipeup</a>
      <span class="hint">Press <span data-shortcut><kbd>⇧</kbd><kbd>⌥</kbd><kbd>C</kbd></span> and click anything</span>
      {links}
      <a class="gh" href="https://github.com/pipeup-ai/pipeup" aria-label="Pipeup on GitHub"><svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" /></svg>GitHub</a>
    </div>
    <script>
      if (!/Mac|iP(hone|ad|od)/.test(navigator.platform))
        document.querySelectorAll(".pu-try [data-shortcut]").forEach((el) => (el.innerHTML = "<kbd>Shift</kbd><kbd>Alt</kbd><kbd>C</kbd>"));
    </script>
"""

for slug, _ in PAGES:
    html = (site / "try" / f"{slug}.html").read_text()
    current = ' aria-current="page"'
    links = "\n      ".join(f'<a href="{s}.html"{current if s == slug else ""}>{l}</a>' for s, l in PAGES)
    assert "<body>" in html and "../pipeup.min.js" in html, slug
    (out / f"{slug}.html").write_text(html.replace("<body>", "<body>" + BAR.replace("{links}", links), 1))
