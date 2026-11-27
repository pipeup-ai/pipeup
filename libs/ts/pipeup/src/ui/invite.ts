/**
 * Pipeup for browsers, offered from the page's own menu (§7c): which browser this is, and where its store listing is,
 * when that listing is public. The list ships in the build and changes only with a release: a browser joins it when
 * its listing is public, so until then its reviewers see nothing, as every browser not on the list does. Nothing is
 * fetched; the browser's own name decides.
 */
export interface Invite {
  /** The browser's name, as the stores list the extension: "Chrome", "Safari", "Edge", "Firefox". */
  browser: string;
  /** The store's name, said before the link is followed. */
  store: string;
  /** The listing, opened as the browser opens any link. */
  url: string;
}

/**
 * Most specific first: Edge and the Chromium browsers name Chrome too, and Chrome names Safari. A browser whose
 * listing isn't public yet has no address and is passed over. Brave, Vivaldi, Opera, Arc and the rest install from
 * Chrome's store, so they count as Chrome.
 */
const STORES: [RegExp, string, string, string][] = [
  [/\bEdg/, "Edge", "Edge Add-ons", ""],
  [/Firefox\//, "Firefox", "Firefox Add-ons", ""],
  [
    /Chrom(?:e|ium)\//,
    "Chrome",
    "Chrome Web Store",
    "https://chromewebstore.google.com/detail/pipeup/bpjgfiflacmcnnkiijgclbecnkeohcnd",
  ],
  [/Version\/.*Safari\//, "Safari", "App Store", ""],
];

/** The extension to offer in this browser, or null: a phone or tablet, a browser not on the list, no public listing. */
export function publicExtension(ua: string = navigator.userAgent): Invite | null {
  // No extension for phones and tablets yet (Safari on iPad says it is a Mac; a screen with only touch is caught by the menu).
  if (/Mobile|Android|iP(?:hone|ad)/.test(ua)) return null;
  const hit = STORES.find(([re]) => re.test(ua));
  if (!hit || !hit[3]) return null;
  return { browser: hit[1], store: hit[2], url: hit[3] };
}
