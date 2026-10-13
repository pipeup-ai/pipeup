// A stand-in for a company's service, to run on your own computer. It follows the contract in ../README.md and saves
// each review as a Markdown file in a local Git repository, then commits it. Nothing leaves this computer.
//
//   node service/stand-in.mjs            # PORT=8788, REPO_DIR=./reviews-repo, ORIGIN=http://localhost:8789
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { handler } from "./lib.mjs";

export function startStandIn({
  port = 8788,
  repo = "./reviews-repo",
  origin = "http://localhost:8789",
} = {}) {
  const dir = resolve(repo);
  const git = (...args) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  mkdirSync(dir, { recursive: true });
  if (!existsSync(join(dir, ".git"))) {
    git("init", "-q", "-b", "main");
    git("config", "user.name", "Send to Git (stand-in)");
    git("config", "user.email", "send-to-git@localhost");
    git("commit", "-q", "--allow-empty", "-m", "Start of the reviews repository");
  }
  const server = createServer(
    handler({
      origin,
      who: () => "local", // a stand-in: a real service knows who is signed in
      save: async ({ review, path, user }) => {
        const file = join(dir, path);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, review.markdown);
        git("add", path);
        git("commit", "-q", "-m", `Review of ${review.title} (${review.openThreads} open) by ${user}`);
        const commit = git("rev-parse", "HEAD");
        console.log(`saved ${path} as ${commit.slice(0, 7)}`);
        return { path, commit };
      },
    }),
  );
  return new Promise((ok) =>
    server.listen(port, "127.0.0.1", () =>
      ok({ server, dir, url: `http://127.0.0.1:${server.address().port}/reviews` }),
    ),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { dir, url } = await startStandIn({
    port: Number(process.env.PORT ?? 8788),
    repo: process.env.REPO_DIR ?? "./reviews-repo",
    origin: process.env.ORIGIN ?? "http://localhost:8789",
  });
  console.log(`Stand-in service: ${url}\nReviews are committed in ${dir}`);
}
