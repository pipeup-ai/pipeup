// Runs the whole path on your computer: a page with Send to Git, and the stand-in service that saves each review as a
// Markdown file in a Git repository (a temporary one) and commits it. Open the address it prints.
import { mkdtempSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { startStandIn } from "./service/stand-in.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = join(here, "../../.."); // libs/ts
const TYPES = { ".html": "text/html", ".js": "text/javascript" };
const repo = mkdtempSync(join(tmpdir(), "send-to-git-"));
const { dir } = await startStandIn({ repo, port: 8788, origin: "http://localhost:8789" });
createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(
    /^(\.\.[/\\])+/,
    "",
  );
  try {
    res
      .writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" })
      .end(readFileSync(join(root, path)));
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(8789, () => {
  console.log("Open  http://localhost:8789/addons/examples/send-to-git/page/index.html");
  console.log(
    `Press Shift+Option+C, comment, then Send to Git. Reviews are committed in:\n  ${dir}\n  (try: git -C ${dir} log --stat)`,
  );
});
