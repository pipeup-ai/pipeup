// Runs the whole path on your computer: a page with Send to Git, and the stand-in service that saves each review as a
// Markdown file in a Git repository (a temporary one) and commits it. Open the address it prints.
//
//   node demo.mjs                                              the page and the stand-in service
//   SERVICE_URL=http://127.0.0.1:8788/reviews node demo.mjs    only the page, talking to a service you run (for example
//                                                              service/github.mjs, which saves into a GitHub repository)
import { mkdtempSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { startStandIn } from "./service/stand-in.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = join(here, "../../.."); // libs/ts
const TYPES = { ".html": "text/html", ".js": "text/javascript" };
const external = process.env.SERVICE_URL;
const { dir } = external
  ? { dir: "" }
  : await startStandIn({
      repo: mkdtempSync(join(tmpdir(), "send-to-git-")),
      port: 8788,
      origin: "http://localhost:8789",
    });

createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(
    /^(\.\.[/\\])+/,
    "",
  );
  try {
    let body = readFileSync(join(root, path));
    if (external && path.endsWith(".html"))
      body = body.toString().replace("http://127.0.0.1:8788/reviews", external);
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(8789, () => {
  console.log("Open  http://localhost:8789/addons/examples/send-to-git/page/index.html");
  console.log(
    external
      ? `Press Shift+Option+C, comment, then Send to Git. Reviews go to ${external}.`
      : `Press Shift+Option+C, comment, then Send to Git. Reviews are committed in:\n  ${dir}\n  (try: git -C ${dir} log --stat)`,
  );
});
