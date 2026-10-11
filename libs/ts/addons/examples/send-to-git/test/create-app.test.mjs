import { createServer } from "node:http";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../service/create-app.mjs";

/** GitHub's side of the manifest flow: it turns a code into the App's id, name and key. */
async function fakeApi() {
  const server = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/app-manifests/good-code/conversions")
      return res.writeHead(201, { "content-type": "application/json" }).end(
        JSON.stringify({
          id: 123,
          slug: "send-to-git-reviews",
          pem: "-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----\n",
        }),
      );
    res.writeHead(404, { "content-type": "application/json" }).end(JSON.stringify({ message: "Not Found" }));
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return { server, api: `http://127.0.0.1:${server.address().port}` };
}

describe("creating the GitHub App with two button presses", () => {
  it("sends GitHub a manifest, keeps the key in a private file and the settings in a file, and never prints the key", async () => {
    const gh = await fakeApi();
    const dir = mkdtempSync(join(tmpdir(), "stg-app-"));
    const said = [];
    let form = "";
    const done = await createApp({
      repo: "your-org/reviews",
      org: "your-org",
      api: gh.api,
      web: "https://github.example",
      dir,
      log: (m) => said.push(m),
      // The person's browser: it loads our page, which sends GitHub the manifest; then GitHub sends them back, twice.
      open: async (url) => {
        const origin = new URL(url).origin;
        form = await (await fetch(url)).text();
        const state = /state=([0-9a-f]+)/.exec(form)[1];
        const wrong = await fetch(`${origin}/created?code=good-code&state=nope`, { redirect: "manual" });
        expect(wrong.status).toBe(403);
        const back = await fetch(`${origin}/created?code=good-code&state=${state}`, { redirect: "manual" });
        expect(back.status).toBe(302);
        expect(back.headers.get("location")).toBe(
          "https://github.example/apps/send-to-git-reviews/installations/new",
        );
        await fetch(`${origin}/installed?installation_id=77&setup_action=install`);
      },
    });
    gh.server.close();
    expect(form).toContain('action="https://github.example/organizations/your-org/settings/apps/new?state=');
    const manifest = JSON.parse(
      /name="manifest" value="([^"]+)"/
        .exec(form)[1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<"),
    );
    expect(manifest.default_permissions).toEqual({ contents: "write", pull_requests: "write" });
    expect(manifest.public).toBe(false);
    expect(manifest.hook_attributes.active).toBe(false);
    expect(done.installationId).toBe("77");
    const env = readFileSync(join(dir, "send-to-git.env"), "utf8");
    expect(env).toContain("APP_ID=123");
    expect(env).toContain(`PRIVATE_KEY_FILE=${join(dir, "send-to-git-app.pem")}`);
    expect(env).toContain("INSTALLATION_ID=77");
    expect(statSync(join(dir, "send-to-git-app.pem")).mode & 0o777).toBe(0o600);
    expect(statSync(join(dir, "send-to-git.env")).mode & 0o777).toBe(0o600);
    expect(said.join("\n")).not.toContain("PRIVATE KEY");
  });

  it("says in words when GitHub doesn't make the App", async () => {
    const gh = await fakeApi();
    const dir = mkdtempSync(join(tmpdir(), "stg-app-"));
    await expect(
      createApp({
        api: gh.api,
        dir,
        log: () => {},
        open: async (url) => {
          const origin = new URL(url).origin;
          const state = /state=([0-9a-f]+)/.exec(await (await fetch(url)).text())[1];
          await fetch(`${origin}/created?code=bad&state=${state}`, { redirect: "manual" });
        },
      }),
    ).rejects.toThrow(/didn't make the App/);
    gh.server.close();
  });
});
