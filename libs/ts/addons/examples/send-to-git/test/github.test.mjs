import { createVerify, generateKeyPairSync } from "node:crypto";
import { createServer } from "node:http";
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
