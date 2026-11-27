import { describe, expect, it } from "vitest";
import { publicExtension } from "../../src/ui/invite";

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
const EDGE_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0";
const SAFARI_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15";
const FIREFOX_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:144.0) Gecko/20100101 Firefox/144.0";
const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1";
const BRAVE_LINUX =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";

describe("publicExtension: which store to offer, from the browser's own name (§7c)", () => {
  it("offers the Chrome Web Store in Chrome and the browsers that install from it", () => {
    for (const ua of [CHROME_MAC, BRAVE_LINUX]) {
      const got = publicExtension(ua);
      expect(got?.browser).toBe("Chrome");
      expect(got?.store).toBe("Chrome Web Store");
      expect(got?.url).toMatch(/^https:\/\/chromewebstore\.google\.com\//);
    }
  });

  it("reads the most specific name first: Edge names Chrome too, and isn't sent to Chrome's store", () => {
    expect(publicExtension(EDGE_WIN)).toBeNull();
  });

  it("offers nothing where the listing isn't public yet (Safari, Firefox) or on a phone", () => {
    for (const ua of [SAFARI_MAC, FIREFOX_MAC, CHROME_ANDROID, SAFARI_IPHONE])
      expect(publicExtension(ua)).toBeNull();
  });

  it("offers nothing to a browser it doesn't know", () => {
    expect(publicExtension("Lynx/2.9.2")).toBeNull();
  });
});
