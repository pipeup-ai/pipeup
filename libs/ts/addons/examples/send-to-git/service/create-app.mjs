// Makes the GitHub App the service signs in as, with two button presses (yours) and nothing pasted anywhere.
//
//   node service/create-app.mjs --repo your-org/reviews [--org your-org] [--web https://HOST --api https://HOST/api/v3]
//
// It uses GitHub's own "create an app from a manifest" flow: a page opens in your browser, you press GitHub's "Create GitHub App"
// button, then GitHub asks you to install the App (choose only the review repository). The App's private key goes to a file only
// you can read (./send-to-git-app.pem) and the settings to ./send-to-git.env, which service/github.mjs reads. Nothing is printed
// or sent anywhere else.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, chmodSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, resolve } from "node:path";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Opens a page in the person's browser (or says its address if that fails). */
export function openBrowser(url, log = console.log) {
  const [cmd, ...args] =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];
  try {
    const p = spawn(cmd, args, { stdio: "ignore", detached: true });
    p.on("error", () => log(`Open this address in your browser: ${url}`));
    p.unref();
  } catch {
    log(`Open this address in your browser: ${url}`);
  }
}

export function createApp({
  repo,
  org,
  name,
  web = "https://github.com",
  api = "https://api.github.com",
  dir = ".",
  open = openBrowser,
  log = console.log,
  port = 0,
} = {}) {
  const state = randomBytes(12).toString("hex");
  const pem = resolve(join(dir, "send-to-git-app.pem"));
  const envFile = resolve(join(dir, "send-to-git.env"));
  return new Promise((done, fail) => {
    let origin = "";
    let slug = "";
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, "http://x");
      const page = (status, body) =>
        res
          .writeHead(status, { "content-type": "text/html; charset=utf-8" })
          .end(
            `<!doctype html><meta charset="utf-8"><title>Send to Git</title><body style="font:16px/1.5 system-ui,sans-serif;max-width:560px;margin:60px auto;padding:0 20px">${body}`,
          );
      try {
        if (url.pathname === "/") {
          const manifest = {
            name: name ?? `Send to Git (${repo ?? "reviews"})`.slice(0, 34),
            url: repo ? `${web}/${repo}` : web,
            redirect_url: `${origin}/created`,
            setup_url: `${origin}/installed`,
            public: false,
            hook_attributes: { url: "https://example.com/unused", active: false },
            default_permissions: { contents: "write", pull_requests: "write" },
            default_events: [],
          };
          const action = `${web}/${org ? `organizations/${org}/` : ""}settings/apps/new?state=${state}`;
          return page(
            200,
            `<h1>Create the GitHub App</h1><p>Press the button on the next page, "Create GitHub App". Nothing else is needed.</p><form method="post" action="${esc(action)}"><input type="hidden" name="manifest" value="${esc(JSON.stringify(manifest))}"><button>Continue to GitHub</button></form><script>document.forms[0].submit()</script>`,
          );
        }
        if (url.pathname === "/created" && url.searchParams.get("state") === state) {
          const r = await fetch(
            `${api}/app-manifests/${encodeURIComponent(url.searchParams.get("code") ?? "")}/conversions`,
            { method: "POST", headers: { accept: "application/vnd.github+json" } },
          );
          const app = await r.json();
          if (!r.ok || !app.pem) throw new Error(`GitHub didn't make the App: ${app.message ?? r.status}`);
          slug = app.slug;
          writeFileSync(pem, app.pem, { mode: 0o600 });
          chmodSync(pem, 0o600);
          writeFileSync(envFile, `APP_ID=${app.id}\nPRIVATE_KEY_FILE=${pem}\n`, { mode: 0o600 });
          chmodSync(envFile, 0o600);
          log("The App is made. Now install it: choose only the review repository.");
          return res.writeHead(302, { location: `${web}/apps/${slug}/installations/new` }).end();
        }
        if (url.pathname === "/installed" && url.searchParams.get("installation_id")) {
          const id = url.searchParams.get("installation_id");
          if (!/^\d+$/.test(id)) throw new Error("GitHub gave no installation number");
          appendFileSync(envFile, `INSTALLATION_ID=${id}\n`);
          page(200, "<h1>Done</h1><p>You can close this tab and go back to your terminal.</p>");
          server.close();
          return done({ appId: undefined, slug, installationId: id, envFile, pem });
        }
        page(403, "<p>That wasn't expected here.</p>");
      } catch (e) {
        page(500, `<p>${esc(String(e.message))}</p>`);
        server.close();
        fail(e);
      }
    });
    server.listen(port, "127.0.0.1", () => {
      origin = `http://127.0.0.1:${server.address().port}`;
      log(
        `A page opens in your browser. Press GitHub's "Create GitHub App" button, then install the App on only the review repository.`,
      );
      open(`${origin}/`, log);
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (f) => (process.argv.indexOf(f) > 0 ? process.argv[process.argv.indexOf(f) + 1] : undefined);
  const out = await createApp({
    repo: arg("--repo"),
    org: arg("--org"),
    name: arg("--name"),
    web: arg("--web"),
    api: arg("--api"),
  });
  console.log(
    `Done. Settings are in ${out.envFile} (the App's key is in ${out.pem}, readable only by you).\nStart the service: REPO=${arg("--repo") ?? "<owner/name>"} ORIGIN=<the page's address> node service/github.mjs`,
  );
}
