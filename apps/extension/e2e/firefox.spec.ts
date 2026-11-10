import { BASE, expect, open, PAGES, panel, sidePanel, test, until } from "./firefox-fixtures";
import type { Page } from "puppeteer-core";

// The same extension in Firefox: the toolbar panel, comments written on the page and kept by the extension, Firefox's
// sidebar in place of Chrome's side panel, and the agents' setup without an id. Firefox is driven with Puppeteer (see
// firefox-fixtures.ts); Pipeup's own parts are in its shadow root.

/** Whether Pipeup's shadow root has something matching `selector`. */
const has = (page: Page, selector: string) =>
  page.evaluate((s) => !!document.querySelector("pipeup-root")?.shadowRoot?.querySelector(s), selector);

/** Presses the button whose words start with `name`. */
async function press(page: Page, name: string): Promise<void> {
  await until(
    () =>
      page.evaluate((n) => {
        const b = [...document.querySelectorAll("button")].find(
          (x) => x.textContent!.trim().startsWith(n) && !x.closest("[hidden]"),
        );
        b?.click();
        return !!b;
      }, name),
    `a "${name}" button`,
  );
}

async function writeComment(page: Page, text: string): Promise<void> {
  await page.bringToFront();
  await until(() => has(page, ".launch .mode.on"), "comment mode");
  const at = (await (await page.$("#p1"))!.boundingBox())!;
  await page.mouse.click(at.x + 20, at.y + at.height / 2);
  await until(
    () =>
      page.evaluate(
        () =>
          document.querySelector("pipeup-root")!.shadowRoot!.activeElement?.matches(".draft .line iframe") ??
          false,
      ),
    "the comment box, the extension's own frame, to take the cursor",
  );
  await page.keyboard.type(text);
  await until(
    () =>
      page.evaluate(
        (t) =>
          (
            document
              .querySelector("pipeup-root")!
              .shadowRoot!.querySelector(".draft .line textarea") as HTMLTextAreaElement
          )?.value === t,
        text,
      ),
    "the words to reach Pipeup",
  );
  await page.evaluate(() =>
    [
      ...document
        .querySelector("pipeup-root")!
        .shadowRoot!.querySelectorAll<HTMLButtonElement>(".draft button"),
    ]
      .find((b) => b.textContent!.trim() === "Comment")!
      .click(),
  );
  await until(async () => !(await has(page, ".pop.show .draft")), "the comment to be sent");
}

test("in Firefox, Comment on this page adds Pipeup in comment mode; comments are kept by the extension and come back", async ({
  browser,
}) => {
  const page = await open(browser, `${PAGES}plain.html`);
  let p = await panel(browser, page);
  expect(await p.$eval("#where", (e) => e.textContent)).toBe("localhost:4931/plain.html");
  // The page listens for everything typed anywhere.
  await page.evaluate(() => {
    const heard: string[] = ((window as unknown as { heard: string[] }).heard = []);
    for (const type of ["keydown", "keyup", "keypress", "beforeinput", "input", "paste"])
      window.addEventListener(type, (e) => heard.push(type + ":" + ((e as KeyboardEvent).key ?? "")), true);
  });
  await press(p, "Comment on this page");
  await until(() => has(page, ".launch.off"), "Pipeup, with its corner button hidden");
  await writeComment(page, "Which beta, Ada's or the public one?");
  // Typed in the extension's own frame: the page heard none of it.
  expect(await page.evaluate(() => (window as unknown as { heard: string[] }).heard)).toEqual([]);

  // Kept by the extension, not the site.
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes("pipeup")))).toEqual(
    [],
  );
  const kept = await p.evaluate(async () => Object.keys(await chrome.storage.local.get(null)));
  expect(kept.filter((k) => k.startsWith("doc:"))).toHaveLength(1);
  // A picture of where it was made, taken by Firefox too.
  await until(
    () =>
      p.evaluate(async () =>
        Object.keys(await chrome.storage.local.get(null)).some((k) => k.startsWith("shot:")),
      ),
    "a picture of where the comment was made",
  );

  // Firefox has a sidebar and reaches agents on this computer: both rows are offered; the setup needs no id.
  await p.close();
  p = await panel(browser, page);
  await until(() => p.$eval("#count", (e) => e.textContent === "1"), "the count");
  expect(await p.$eval("#pin-row", (e) => (e as HTMLElement).hidden)).toBe(false);
  expect(await p.$eval("#agent-group", (e) => (e as HTMLElement).hidden)).toBe(false);
  await press(p, "Send to my agent");
  // Firefox asks the reviewer to agree first; the test can't answer, so nothing is sent.
  await until(
    () => p.$eval("#agent-said", (e) => /Firefox wasn't allowed/.test(e.textContent ?? "")),
    "Firefox's question before anything is sent",
  );

  // After a reload, the extension's copy brings the comment back.
  await page.reload().catch(() => {});
  await until(async () => !(await page.$("pipeup-root")), "Pipeup to be gone after the reload");
  p = await panel(browser, page);
  await press(p, "Comment on this page");
  await until(() => p.$eval("#count", (e) => e.textContent === "1"), "the comment to come back");
});

test("in Firefox, the sidebar lists the page's comments, and a reply there reaches the thread", async ({
  browser,
}) => {
  const page = await open(browser, `${PAGES}plain.html`);
  const p = await panel(browser, page);
  await press(p, "Comment on this page");
  await writeComment(page, "Is June firm?");
  const side = await sidePanel(browser, page);
  await until(
    () =>
      side.evaluate(() => document.querySelector(".card")?.textContent?.includes("Is June firm?") ?? false),
    "the thread in the sidebar",
  );
  await side.evaluate(() => (document.querySelector(".card") as HTMLElement).click());
  await until(() => side.evaluate(() => !!document.querySelector(".card.open textarea")), "the reply box");
  await side.type(".card.open textarea", "Yes, Lee confirmed.");
  await press(side, "Reply");
  await until(
    () => side.evaluate(() => document.querySelector(".card")!.textContent!.includes("Yes, Lee confirmed.")),
    "the reply in the thread",
  );
});

test("in Firefox, the settings page offers the add-ons and the agents' setup for Firefox", async ({
  browser,
}) => {
  const p = await open(browser, `${BASE}comments.html`);
  const version = await p.evaluate(() => chrome.runtime.getManifest().version);
  expect(await p.$eval("#agent-cmd", (e) => e.textContent)).toBe(
    `npx --yes pipeup@${version} browser install --browser firefox`,
  );
  expect(await p.$eval("#agent-section", (e) => (e as HTMLElement).hidden)).toBe(false);
  await until(() => p.$eval("#addons", (e) => e.textContent!.includes("Emoji")), "the add-ons");
  // Firefox can't turn speech into text, so Voice isn't offered there.
  expect(await p.$eval("#addons", (e) => e.textContent!.includes("Voice"))).toBe(false);
});
