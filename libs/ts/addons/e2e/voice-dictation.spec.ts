import { expect, test, type Page } from "@playwright/test";
import { addon, blank, CORE, load, mount, openMenu } from "./helpers";

/** A scripted stand-in for the browser's engine: it "hears" one sentence after start(), word by word. */
const FAKE = () => {
  const w = window as any;
  w.__srLog = [] as string[];
  w.__srLive = 0;
  w.SpeechRecognition = class {
    static async available() {
      return "available";
    }
    static async install() {
      return true;
    }
    lang = "";
    interimResults = false;
    continuous = false;
    onstart: any = null;
    onspeechstart: any = null;
    onend: any = null;
    onerror: any = null;
    onresult: any = null;
    timers: number[] = [];
    at(ms: number, fn: () => void) {
      this.timers.push(window.setTimeout(fn, ms));
    }
    start() {
      w.__srLog.push(`start ${this.lang}`);
      w.__srLive++;
      this.at(20, () => this.onstart?.());
      this.at(40, () => this.onspeechstart?.());
      const say = (text: string, isFinal: boolean) =>
        this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal })] });
      this.at(80, () => say("the second", false));
      this.at(120, () => say("the second chart needs", false));
      this.at(w.__srFinalAt ?? 160, () => say("The second chart needs a clearer label.", true));
    }
    close() {
      this.timers.forEach(clearTimeout);
      this.timers = [window.setTimeout(() => (w.__srLive--, this.onend?.()), 20)];
    }
    stop() {
      w.__srLog.push("stop");
      this.close();
    }
    abort() {
      w.__srLog.push("abort");
      this.close();
    }
  };
  delete w.webkitSpeechRecognition;
};
const NONE = () => {
  const w = window as any;
  delete w.SpeechRecognition;
  delete w.webkitSpeechRecognition;
};

async function newBox(page: Page) {
  await blank(page);
  await load(page, CORE, addon("voice"));
  await mount(page);
  await openMenu(page);
  await page.locator(".menu.show").getByText("Start commenting").click();
  // The first click only closes the menu; the next chooses the block.
  await page.locator("[data-pipeup-id=p2]").click();
  await page.locator("[data-pipeup-id=p2]").click();
  const draft = page.locator(".draft");
  await expect(draft.locator("textarea")).toBeVisible();
  return draft;
}

test("press the microphone, agree, and the words appear in the box with the Send arrow", async ({ page }) => {
  await page.addInitScript(FAKE);
  const draft = await newBox(page);
  const mic = draft.locator(".tool");
  await expect(mic).toHaveAttribute("aria-label", "Dictate");
  await expect(mic).toHaveAttribute("aria-pressed", "false");
  await mic.click();
  const panel = page.locator(".xp.show");
  await expect(panel).toContainText("Your words are worked out on this device. Nothing is sent.");
  await expect(panel.locator("select")).toHaveValue("en");
  await panel.getByRole("button", { name: "Start" }).click();
  await expect(page.locator(".xp")).toHaveCount(0);

  const box = draft.locator("textarea");
  await expect(mic).toHaveAttribute("aria-pressed", "true");
  await expect(box).toHaveValue("The second chart needs a clearer label.");
  await expect(draft.locator(".send.show")).toBeVisible();
  expect(await page.evaluate(() => (window as any).__srLog)).toEqual(["start en"]);

  // A second press stops; the words stay, and nothing is sent until the reviewer presses Send.
  await mic.click();
  await expect(mic).toHaveAttribute("aria-pressed", "false");
  await expect(box).toHaveValue("The second chart needs a clearer label.");
  expect(await page.evaluate(() => (window as any).__srLog)).toEqual(["start en", "stop"]);
  expect(await page.evaluate(() => (window as any).pu.document.threads().length)).toBe(0);
});

test("the consent panel is not shown the second time", async ({ page }) => {
  await page.addInitScript(FAKE);
  const draft = await newBox(page);
  const mic = draft.locator(".tool");
  await mic.click();
  await page.locator(".xp.show").getByRole("button", { name: "Start" }).click();
  await expect(mic).toHaveAttribute("aria-pressed", "true");
  await mic.click();
  await expect.poll(() => page.evaluate(() => (window as any).__srLive)).toBe(0);
  await mic.click();
  await expect(mic).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".xp")).toHaveCount(0);
  expect(
    await page.evaluate(() => (window as any).__srLog.filter((l: string) => l.startsWith("start"))),
  ).toHaveLength(2);
});

test("Not now starts nothing", async ({ page }) => {
  await page.addInitScript(FAKE);
  const draft = await newBox(page);
  await draft.locator(".tool").click();
  await page.locator(".xp.show").getByRole("button", { name: "Not now" }).click();
  await expect(page.locator(".xp")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__srLog)).toEqual([]);
  await expect(draft.locator(".tool")).toHaveAttribute("aria-pressed", "false");
});

test("sending the box while listening stops the recognition and drops the words in progress", async ({
  page,
}) => {
  await page.addInitScript(() => ((window as any).__srFinalAt = 60_000));
  await page.addInitScript(FAKE);
  const draft = await newBox(page);
  const mic = draft.locator(".tool");
  await mic.click();
  await page.locator(".xp.show").getByRole("button", { name: "Start" }).click();
  const box = draft.locator("textarea");
  await expect(box).toHaveValue("the second chart needs");
  await box.press("Escape");
  await expect.poll(() => page.evaluate(() => (window as any).__srLog)).toContain("abort");
  await expect.poll(() => page.evaluate(() => (window as any).__srLive)).toBe(0);
});

test('"Listening" and "Stopped listening" are heard at once, even while words are being written', async ({
  page,
}) => {
  await page.addInitScript(FAKE);
  const draft = await newBox(page);
  const mic = draft.locator(".tool");
  await mic.click();
  await page.locator(".xp.show").getByRole("button", { name: "Start" }).click();
  await expect(draft.locator("textarea")).toHaveValue("The second chart needs a clearer label.");
  await mic.click();
  await expect(mic).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".sr")).toHaveText("Stopped listening");
});

test("without a speech engine there is no microphone anywhere", async ({ page }) => {
  await page.addInitScript(NONE);
  const draft = await newBox(page);
  await expect(draft.locator("textarea")).toBeVisible();
  await expect(page.locator(".tool")).toHaveCount(0);
  const [a] = await page.evaluate(() =>
    (window as any).Pipeup.addons().map((x: any) => `${x.id}:${x.state}`),
  );
  expect(a).toBe("voice:off");
});
