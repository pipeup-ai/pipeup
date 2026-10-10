import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, normalize } from "node:path";

/** The example add-on that needs no server: it opens GitHub's own new-file page with the review filled in. */
test.describe.configure({ mode: "serial" });

const base = new URL("../..", import.meta.url).pathname; // libs/ts
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript" };
let pages: Server;

test.beforeAll(async () => {
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
  await new Promise<void>((ok) => pages.listen(8790, ok));
});
test.afterAll(() => pages?.close());

const PAGE = "http://localhost:8790/addons/examples/save-to-github/page/index.html";

test("Save to GitHub asks first, then opens GitHub's new-file page with the review filled in", async ({
  page,
  context,
}) => {
  test.skip(
    !existsSync(join(base, "addons/examples/save-to-github/dist/pipeup+save-to-github.min.js")),
    "build the example first",
  );
  const asked: string[] = [];
  await context.route("https://github.com/**", (route) => {
    asked.push(route.request().url());
    return route.fulfill({ body: "GitHub (a stand-in)", contentType: "text/html" });
  });
  await page.goto(PAGE);
  await expect(page.locator(".launch")).toHaveCount(1);
  await page.keyboard.press("Shift+Alt+KeyC");
  await expect(page.locator(".launch .mode.on")).toHaveCount(1);
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
  await page.locator(".menu.show").getByText("Save to GitHub").click();
  const panel = page.locator(".xp.show");
  await expect(panel).toContainText("This will open GitHub in a new tab with 1 open comment");
  await expect(panel).toContainText("in your-org/reviews (main) on github.com");
  expect(asked).toEqual([]); // it asked first: nothing has been opened

  const [popup] = await Promise.all([
    context.waitForEvent("page"),
    panel.getByRole("button", { name: "Open GitHub" }).click(),
  ]);
  await popup.waitForLoadState();
  const url = new URL(popup.url());
  expect(url.origin + url.pathname).toBe("https://github.com/your-org/reviews/new/main");
  expect(url.searchParams.get("filename")).toMatch(/^reviews\/index\/\d{8}-\d{6}-.+\.md$/);
  expect(url.searchParams.get("value")).toContain("Is this lift firm?");
  await expect(panel).toContainText("Opened GitHub in a new tab.");
});

test("a page that names no repository keeps it off, saying why", async ({ page }) => {
  await page.route(PAGE, async (route) => {
    const res = await route.fetch();
    await route.fulfill({
      response: res,
      body: (await res.text()).replace(/data-pipeup-save-to-github="[^"]*"/, ""),
    });
  });
  await page.goto(PAGE);
  await expect(page.locator(".launch")).toHaveCount(1);
  const info = await page.evaluate(() =>
    (window as any).Pipeup.addons().find((a: any) => a.id === "save-to-github"),
  );
  expect(info.state).toBe("off");
  expect(info.reason).toContain("names no repository");
});
