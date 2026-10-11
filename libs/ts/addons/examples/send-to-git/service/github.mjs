// A reference service that saves each review into a GitHub repository. Read it, copy it, change it: it uses no outside
// code, and it follows the contract in ../README.md. It sits behind your sign-in (a proxy that sets a header naming
// the signed-in person) and holds the credentials, so neither the page nor the add-on ever does.
//
// Settings (environment):
//   REPO             owner/name of the repository to save into (required)
//   GITHUB_API       https://api.github.com (GitHub Enterprise Server: https://HOST/api/v3)
//   BASE_BRANCH      main
//   MODE             "pr" (default: a branch and a pull request) or "direct" (commit to BASE_BRANCH)
//   ORIGIN           the one page address allowed to call this service (required)
//   USER_HEADER      the header your sign-in proxy sets (default x-company-user)
//   DEV_USER         ONLY for trying it on your own computer, with no sign-in proxy: treat every request as this person.
//                    Never set it on a service anyone else can reach.
//   Credentials, one of:
//   GITHUB_TOKEN     a fine-grained access token limited to REPO (contents and pull requests: write), for a pilot
//   APP_ID, INSTALLATION_ID, and PRIVATE_KEY (its PEM text) or PRIVATE_KEY_FILE (a file holding it)   a GitHub App installed on REPO (best)
//                    node service/create-app.mjs makes the App and writes these into ./send-to-git.env for you
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { handler } from "./lib.mjs";

// Settings may also come from ./send-to-git.env (KEY=value lines), which create-app.mjs writes for you.
try {
  for (const line of readFileSync(process.env.ENV_FILE ?? "send-to-git.env", "utf8").split("\n")) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch {
  /* no settings file: the environment alone */
}
const env = (k, d) => process.env[k] ?? d;
/** The App's private key: the PEM text, or a file holding it (PRIVATE_KEY_FILE, kept private on this computer). */
const privateKey = () =>
  env("PRIVATE_KEY_FILE") ? readFileSync(env("PRIVATE_KEY_FILE"), "utf8") : env("PRIVATE_KEY");
const API = env("GITHUB_API", "https://api.github.com").replace(/\/$/, "");
const REPO = env("REPO");
const BASE = env("BASE_BRANCH", "main");
const MODE = env("MODE", "pr");
const ORIGIN = env("ORIGIN");
const USER_HEADER = env("USER_HEADER", "x-company-user").toLowerCase();

const b64u = (b) => Buffer.from(b).toString("base64url");

/** A short-lived token for the installed GitHub App (or the fine-grained token you set). */
async function token() {
  if (env("GITHUB_TOKEN")) return env("GITHUB_TOKEN");
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64u(JSON.stringify({ iat: now - 30, exp: now + 540, iss: env("APP_ID") }));
  const sig = createSign("RSA-SHA256")
    .update(`${head}.${body}`)
    .sign(privateKey().replace(/\\n/g, "\n"))
    .toString("base64url");
  const res = await gh(
    `/app/installations/${env("INSTALLATION_ID")}/access_tokens`,
    { method: "POST" },
    `${head}.${body}.${sig}`,
  );
  return res.token;
}

async function gh(path, init = {}, bearer) {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${bearer}`,
      "x-github-api-version": "2022-11-28",
      "content-type": "application/json",
      ...init.headers,
    },
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GitHub answered ${res.status}: ${out.message ?? ""}`);
  return out;
}

async function save({ review, path, user }) {
  const t = await token();
  const message = `Review of ${review.title} (${review.openThreads} open) by ${user}`;
  const content = Buffer.from(review.markdown).toString("base64");
  if (MODE === "direct") {
    const put = await gh(
      `/repos/${REPO}/contents/${path}`,
      { method: "PUT", body: JSON.stringify({ message, content, branch: BASE }) },
      t,
    );
    return { path, commit: put.commit.sha };
  }
  const base = await gh(`/repos/${REPO}/git/ref/heads/${BASE}`, {}, t);
  const branch = `reviews/${path.split("/").pop().replace(/\.md$/, "")}`;
  await gh(
    `/repos/${REPO}/git/refs`,
    { method: "POST", body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha }) },
    t,
  );
  const put = await gh(
    `/repos/${REPO}/contents/${path}`,
    { method: "PUT", body: JSON.stringify({ message, content, branch }) },
    t,
  );
  const pr = await gh(
    `/repos/${REPO}/pulls`,
    {
      method: "POST",
      body: JSON.stringify({
        title: message,
        head: branch,
        base: BASE,
        body: `Saved from ${review.url} by ${user}.`,
      }),
    },
    t,
  );
  return { path, commit: put.commit.sha, pr: pr.html_url };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!REPO || !ORIGIN)
    throw new Error("Set REPO (owner/name) and ORIGIN (the page's address); see the top of this file.");
  if (
    !env("GITHUB_TOKEN") &&
    !(env("APP_ID") && env("INSTALLATION_ID") && (env("PRIVATE_KEY") || env("PRIVATE_KEY_FILE")))
  )
    throw new Error("Set GITHUB_TOKEN, or APP_ID, INSTALLATION_ID and PRIVATE_KEY.");
  if (env("DEV_USER"))
    console.warn(
      `DEV_USER is set: every request is treated as "${env("DEV_USER")}". Use it only on your own computer.`,
    );
  const who = (req) => req.headers[USER_HEADER] || env("DEV_USER") || null;
  createServer(handler({ save, who, origin: ORIGIN })).listen(Number(env("PORT", "8788")), () =>
    console.log(`Send to Git service for ${REPO} on port ${env("PORT", "8788")}`),
  );
}
export { save };
