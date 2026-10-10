import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";

/** The example add-on, end to end: a page with Send to Git, the stand-in service, and a real Git repository. */
test.describe.configure({ mode: "serial" });

const base = new URL("../..", import.meta.url).pathname; // libs/ts
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript" };
let pages: Server;
let svc: { server: Server; dir: string };

test.beforeAll(async () => {
  const { startStandIn } = (await import(
    pathToFileURL(join(base, "addons/examples/send-to-git/service/stand-in.mjs")).href
  )) as {
    startStandIn(o: object): Promise<{ server: Server; dir: string }>;
  };
  svc = await startStandIn({
    repo: mkdtempSync(join(tmpdir(), "stg-e2e-")),
    port: 8788,
    origin: "http://localhost:8789",
  });
  pages = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url!, "http://x").pathname)).replace(
      /^(\.\.[/\\])+/,
      "",
    );
    try {
      res
        .writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" })
        .end(readFileSync(join(base, path)));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((ok) => pages.listen(8789, ok));
});
test.afterAll(() => {
  svc?.server.close();
  pages?.close();
});

const PAGE = "http://localhost:8789/addons/examples/send-to-git/page/index.html";

test("Send to Git asks first, sends the review as Markdown, and it is committed in Git", async ({ page }) => {
  test.skip(
    !existsSync(join(base, "addons/examples/send-to-git/dist/pipeup+send-to-git.min.js")),
    "build the example first",
  );
  await page.goto(PAGE);
  await expect(page.locator(".launch")).toHaveCount(1);
  await page.keyboard.press("Shift+Alt+KeyC");
  await expect(page.locator(".launch .mode.on")).toHaveCount(1);
  // One comment, on some words.
  await page.evaluate(() => {
    const el = document.querySelector("[data-pipeup-id=p1]")!;
    const n = el.firstChild!;
    const i = n.textContent!.indexOf("20% lift");
    const r = document.createRange();
    r.setStart(n, i);
    r.setEnd(n, i + 8);
    const sel = getSelection()!;
    sel.removeAllRanges();
    sel.addRange(r);
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page.locator(".selbar.show button").click();
  await page.keyboard.type("Is this lift firm?");
  await page.keyboard.press("Enter");
  await expect(page.locator(".bub, .th").first()).toBeVisible();

  await page.locator(".launch .mode").click();
  await page.locator(".menu.show").getByText("Send to Git").click();
  const panel = page.locator(".xp.show");
  await expect(panel).toContainText("This will send 1 open comment");
  await expect(panel).toContainText("127.0.0.1:8788/reviews");
  // Nothing has been saved yet: it asked first.
  const files = () => (existsSync(join(svc.dir, "reviews")) ? readdirSync(join(svc.dir, "reviews")) : []);
  expect(files()).toEqual([]);

  await panel.getByRole("button", { name: "Send" }).click();
  await expect(panel).toContainText("Saved reviews/", { timeout: 10000 });
  const saved = (await panel.textContent())!.match(/reviews\/[^\s,]+\.md/)![0];
  expect(readFileSync(join(svc.dir, saved), "utf8")).toContain("Is this lift firm?");
  expect(execFileSync("git", ["log", "-1", "--format=%s"], { cwd: svc.dir, encoding: "utf8" })).toContain(
    "Review of Q3 launch plan",
  );
});

test("a page that doesn't list it keeps it off, and one that names no address says why", async ({ page }) => {
  const state = async () => {
    await expect(page.locator(".launch")).toHaveCount(1);
    return page.evaluate(() => (window as any).Pipeup.addons().find((a: any) => a.id === "send-to-git"));
  };
  /** The same page, with its <html> attributes changed before Pipeup reads them. */
  const serve = (change: (html: string) => string) =>
    page.route(PAGE, async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, body: change(await res.text()) });
    });
  await page.goto(PAGE);
  expect((await state()).state).toBe("on");

  await serve((h) => h.replace('data-pipeup-addons="send-to-git"', 'data-pipeup-addons="voice"'));
  await page.goto(PAGE);
  expect(await state()).toMatchObject({ state: "off", reason: "this page doesn't allow it" });

  await page.unroute(PAGE);
  await serve((h) => h.replace(/data-pipeup-send-to-git-url="[^"]*"/, ""));
  await page.goto(PAGE);
  expect((await state()).reason).toContain("names no address");

  await page.unroute(PAGE);
  await serve((h) =>
    h.replace(
      /data-pipeup-send-to-git-url="[^"]*"/,
      'data-pipeup-send-to-git-url="http://reviews.example.com/reviews"',
    ),
  );
  await page.goto(PAGE);
  expect((await state()).reason).toContain("isn't secure");
});
