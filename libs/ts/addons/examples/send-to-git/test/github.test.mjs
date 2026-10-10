import { spawn } from "node:child_process";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer as listen } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

/** A stand-in for GitHub's API, recording what the reference service asks of it. */
async function fakeGitHub() {
  const calls = [];
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const c of req) body += c;
    const call = {
      method: req.method,
      path: req.url,
      auth: req.headers.authorization,
      body: body ? JSON.parse(body) : null,
    };
    calls.push(call);
    const json = (status, out) =>
      res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(out));
    if (req.url.startsWith("/repos/co/reviews/git/ref/heads/"))
      return json(200, { object: { sha: "base-sha" } });
    if (req.url === "/repos/co/reviews/git/refs") return json(201, {});
    if (req.url.startsWith("/repos/co/reviews/contents/"))
      return json(201, { commit: { sha: "commit-sha" } });
    if (req.url === "/repos/co/reviews/pulls")
      return json(201, { html_url: "https://github.example/co/reviews/pull/7" });
    if (req.url === "/app/installations/42/access_tokens") return json(201, { token: "installation-token" });
    return json(404, { message: "not found" });
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return { calls, server, api: `http://127.0.0.1:${server.address().port}` };
}

/** A port nothing is using, so a stray server on this computer can't be the one that answers. */
const freePort = () =>
  new Promise((ok) => {
    const s = listen().listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => ok(port));
    });
  });

const review = {
  title: "Q3 launch plan",
  url: "https://pages.example.com/launch-plan.html",
  openThreads: 2,
  markdown: "# Review comments\n\n- Sam: Is this date firm?\n",
};
const path = "reviews/launch-plan/20261010-093005-sam-ab12.md";
const load = async (env) => {
  vi.resetModules();
  Object.assign(process.env, { REPO: "co/reviews", ORIGIN: "https://pages.example.com", ...env });
  return import("../service/github.mjs");
};
afterEach(() => {
  for (const k of [
    "REPO",
    "ORIGIN",
    "GITHUB_API",
    "GITHUB_TOKEN",
    "MODE",
    "APP_ID",
    "INSTALLATION_ID",
    "PRIVATE_KEY",
  ])
    delete process.env[k];
});

describe("the GitHub reference service", () => {
  it("saves a review on a new branch and opens a pull request, with the token it was given", async () => {
    const gh = await fakeGitHub();
    const { save } = await load({ GITHUB_API: gh.api, GITHUB_TOKEN: "pilot-token" });
    const out = await save({ review, path, user: "sam" });
    gh.server.close();
    expect(out).toEqual({ path, commit: "commit-sha", pr: "https://github.example/co/reviews/pull/7" });
    expect(gh.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      "GET /repos/co/reviews/git/ref/heads/main",
      "POST /repos/co/reviews/git/refs",
      `PUT /repos/co/reviews/contents/${path}`,
      "POST /repos/co/reviews/pulls",
    ]);
    expect(gh.calls.every((c) => c.auth === "Bearer pilot-token")).toBe(true);
    const put = gh.calls[2].body;
    expect(Buffer.from(put.content, "base64").toString()).toBe(review.markdown);
    expect(put.branch).toMatch(/^reviews\/20261010-093005-sam-ab12$/);
    expect(gh.calls[1].body).toMatchObject({ sha: "base-sha" });
  });

  it("can commit straight to the base branch instead", async () => {
    const gh = await fakeGitHub();
    const { save } = await load({ GITHUB_API: gh.api, GITHUB_TOKEN: "t", MODE: "direct" });
    const out = await save({ review, path, user: "sam" });
    gh.server.close();
    expect(out).toEqual({ path, commit: "commit-sha" });
    expect(gh.calls).toHaveLength(1);
    expect(gh.calls[0].body.branch).toBe("main");
  });

  it("as a GitHub App, signs a short-lived request and uses the installation token it gets back", async () => {
    const gh = await fakeGitHub();
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const { save } = await load({
      GITHUB_API: gh.api,
      APP_ID: "123",
      INSTALLATION_ID: "42",
      PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    });
    await save({ review, path, user: "sam" });
    gh.server.close();
    const first = gh.calls[0];
    expect(first.path).toBe("/app/installations/42/access_tokens");
    const [head, body, sig] = first.auth.replace("Bearer ", "").split(".");
    expect(JSON.parse(Buffer.from(head, "base64url"))).toEqual({ alg: "RS256", typ: "JWT" });
    const claims = JSON.parse(Buffer.from(body, "base64url"));
    expect(claims.iss).toBe("123");
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(600);
    expect(
      createVerify("RSA-SHA256").update(`${head}.${body}`).verify(publicKey, Buffer.from(sig, "base64url")),
    ).toBe(true);
    expect(gh.calls.slice(1).every((c) => c.auth === "Bearer installation-token")).toBe(true);
  });
});

describe("settings made by create-app.mjs", () => {
  it("reads the App's key from a file and its settings from send-to-git.env", async () => {
    const gh = await fakeGitHub();
    const dir = mkdtempSync(join(tmpdir(), "stg-env-"));
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    writeFileSync(join(dir, "app.pem"), privateKey.export({ type: "pkcs8", format: "pem" }).toString(), {
      mode: 0o600,
    });
    writeFileSync(
      join(dir, "send-to-git.env"),
      `APP_ID=123\nINSTALLATION_ID=42\nPRIVATE_KEY_FILE=${join(dir, "app.pem")}\n`,
    );
    const { save } = await load({ GITHUB_API: gh.api, ENV_FILE: join(dir, "send-to-git.env") });
    const out = await save({ review, path, user: "sam" });
    gh.server.close();
    delete process.env.ENV_FILE;
    for (const k of ["APP_ID", "INSTALLATION_ID", "PRIVATE_KEY_FILE"]) delete process.env[k];
    expect(out.pr).toBe("https://github.example/co/reviews/pull/7");
    expect(gh.calls[0].path).toBe("/app/installations/42/access_tokens");
  });
});

describe("the GitHub service, run as a program", () => {
  it("answers a review from the page with a pull request, for the person the sign-in names", async () => {
    const gh = await fakeGitHub();
    const port = await freePort();
    const child = spawn("node", ["service/github.mjs"], {
      cwd: new URL("..", import.meta.url).pathname,
      env: {
        ...process.env,
        REPO: "co/reviews",
        ORIGIN: "http://localhost:8789",
        GITHUB_API: gh.api,
        GITHUB_TOKEN: "t",
        PORT: String(port),
        USER_HEADER: "x-company-user",
      },
    });
    await new Promise((ok) =>
      child.stdout.on("data", (d) => String(d).includes("Send to Git service") && ok()),
    );
    const url = `http://127.0.0.1:${port}/reviews`;
    const post = (headers) =>
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:8789", ...headers },
        body: JSON.stringify({ ...review, exportedAt: new Date().toISOString() }),
      });
    const unsigned = await post({});
    const signed = await post({ "x-company-user": "Sam Lee" });
    const out = await signed.json();
    child.kill();
    gh.server.close();
    expect(unsigned.status).toBe(401);
    expect(signed.status).toBe(201);
    expect(signed.headers.get("access-control-allow-origin")).toBe("http://localhost:8789");
    expect(out.pr).toBe("https://github.example/co/reviews/pull/7");
    expect(out.path).toMatch(/^reviews\/launch-plan\/.+-sam-lee-[0-9a-f]{4}\.md$/);
  });

  it("with DEV_USER set (only for trying it on your own computer), takes every request as that person", async () => {
    const gh = await fakeGitHub();
    const port = await freePort();
    const child = spawn("node", ["service/github.mjs"], {
      cwd: new URL("..", import.meta.url).pathname,
      env: {
        ...process.env,
        REPO: "co/reviews",
        ORIGIN: "http://localhost:8789",
        GITHUB_API: gh.api,
        GITHUB_TOKEN: "t",
        PORT: String(port),
        DEV_USER: "sam",
      },
    });
    await new Promise((ok) =>
      child.stdout.on("data", (d) => String(d).includes("Send to Git service") && ok()),
    );
    const res = await fetch(`http://127.0.0.1:${port}/reviews`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...review, exportedAt: new Date().toISOString() }),
    });
    child.kill();
    gh.server.close();
    expect(res.status).toBe(201);
  });
});
