// Serves the test pages on http://localhost:4931.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const pages = new URL("pages/", import.meta.url);
// Pipeup's own file, for the pages that have it built in (built-in-on.html), from the library's build.
const library = new URL("../../../libs/ts/pipeup/dist/pipeup.min.js", import.meta.url);
createServer(async (req, res) => {
  const name = (req.url ?? "/").split("?")[0].replace(/^\/+/, "") || "plain.html";
  try {
    if (name === "pipeup.min.js") {
      res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" }).end(await readFile(library));
      return;
    }
    if (!/^[\w-]+\.html$/.test(name)) throw new Error("not a page");
    const body = await readFile(new URL(name, pages));
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(4931);
