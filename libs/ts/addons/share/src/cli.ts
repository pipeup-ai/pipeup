import { readFile, writeFile } from "node:fs/promises";
import { run } from "./cli-run";

process.exitCode = await run(process.argv.slice(2), {
  fetch: (i, n) => fetch(i, n),
  env: process.env,
  read: (p) => readFile(p, "utf8"),
  write: (p, t) => writeFile(p, t),
  out: (t) => console.log(t),
  err: (t) => console.error(t),
});
