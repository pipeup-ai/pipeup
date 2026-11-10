// pipeup browser: the browser extension's link to agents on this computer. The extension sends a page's comments here
// (through Chrome's native messaging, to browser-host.mjs), an agent reads them with `pipeup browser read` and answers
// with `pipeup browser reply`, and the extension puts the replies into their threads. Everything stays in
// ~/.pipeup/browser, one folder per page; nothing leaves this computer.
import { chmod, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The name the extension asks the browser for. */
export const HOST = "ai.pipeup.browser";
/** The extension's id in Firefox, which (unlike Chrome's) is the same on every computer. */
export const FIREFOX_ID = "extension@pipeup.ai";
/** Where pages sent from the browser are kept. */
export const inbox = () => process.env.PIPEUP_BROWSER_DIR || join(homedir(), ".pipeup", "browser");
/** A document id as a folder name: Pipeup's ids are letters, digits, "-", "_" and ":" (kept as "_"). */
const folderOf = (doc) =>
  join(
    inbox(),
    String(doc)
      .replace(/[^A-Za-z0-9_-]/g, "_")
      .slice(0, 120),
  );

/** Where each browser looks for native messaging hosts, per platform. */
const PLACES = {
  darwin: {
    chrome: "Library/Application Support/Google/Chrome/NativeMessagingHosts",
    chromium: "Library/Application Support/Chromium/NativeMessagingHosts",
    edge: "Library/Application Support/Microsoft Edge/NativeMessagingHosts",
    brave: "Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts",
    firefox: "Library/Application Support/Mozilla/NativeMessagingHosts",
  },
  linux: {
    chrome: ".config/google-chrome/NativeMessagingHosts",
    chromium: ".config/chromium/NativeMessagingHosts",
    edge: ".config/microsoft-edge/NativeMessagingHosts",
    brave: ".config/BraveSoftware/Brave-Browser/NativeMessagingHosts",
    firefox: ".mozilla/native-messaging-hosts",
  },
};

/**
 * Lets the extension reach this computer's agents: writes a small launcher (with this Node's own path, since a
 * browser starts programs without the terminal's PATH) and the browser's host file, allowing only Pipeup's extension:
 * `extensionId` in Chrome and its kin (each computer's copy has its own), Pipeup's fixed id in Firefox.
 */
export async function install({ extensionId, browser = "chrome" }) {
  const firefox = browser === "firefox";
  if (!firefox && !/^[a-p]{32}$/.test(extensionId ?? ""))
    throw new Error(
      "give the extension's id: chrome://extensions shows it on Pipeup's card (32 letters a to p)",
    );
  const place = PLACES[platform()]?.[browser];
  if (!place)
    throw new Error(`setting up ${browser} on ${platform()} isn't supported yet (macOS and Linux are)`);
  const host = fileURLToPath(new URL("./browser-host.mjs", import.meta.url));
  const launcher = join(homedir(), ".pipeup", "browser-host.sh");
  await mkdir(dirname(launcher), { recursive: true });
  await writeFile(launcher, `#!/bin/sh\nexec "${process.execPath}" "${host}" "$@"\n`);
  await chmod(launcher, 0o755);
  const file = join(homedir(), place, `${HOST}.json`);
  await mkdir(dirname(file), { recursive: true });
  const manifest = {
    name: HOST,
    description: "Pipeup: comments from the browser for agents on this computer",
    path: launcher,
    type: "stdio",
    ...(firefox
      ? { allowed_extensions: [FIREFOX_ID] }
      : { allowed_origins: [`chrome-extension://${extensionId}/`] }),
  };
  await writeFile(file, JSON.stringify(manifest, null, 2) + "\n");
  return { file, launcher };
}

/** What the extension sent: the page, its comments as Markdown for an AI, and as a Pipeup comments file. */
export async function receive({ doc, url, title, markdown, file }) {
  if (!doc || typeof markdown !== "string") throw new Error("nothing to keep: no page or comments");
  const dir = folderOf(doc);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "page.json"),
    JSON.stringify({ doc, url, title, at: Date.now() }, null, 2) + "\n",
  );
  await writeFile(join(dir, "comments.md"), markdown);
  if (typeof file === "string") await writeFile(join(dir, "comments.json"), file);
  return { folder: dir };
}

/** The replies agents left for a page, oldest first. */
export async function replies(doc) {
  try {
    return JSON.parse(await readFile(join(folderOf(doc), "replies.json"), "utf8"));
  } catch {
    return [];
  }
}

/** Every page sent from the browser, newest first. */
export async function pages() {
  const names = await readdir(inbox()).catch(() => []);
  const out = [];
  for (const n of names) {
    try {
      out.push(JSON.parse(await readFile(join(inbox(), n, "page.json"), "utf8")));
    } catch {
      // Not a page's folder.
    }
  }
  return out.sort((a, b) => b.at - a.at);
}

/** The page whose doc, address or title contains `which` (the newest when there are several), or null. */
export async function find(which) {
  const all = await pages();
  if (!which) return all[0] ?? null;
  const w = String(which).toLowerCase();
  return (
    all.find((p) =>
      [p.doc, p.url, p.title].some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(w),
      ),
    ) ?? null
  );
}

/** A page's comments, as the extension last sent them. */
export async function readComments(doc) {
  return readFile(join(folderOf(doc), "comments.md"), "utf8");
}

/** Adds an agent's reply to a thread; the extension puts it in the thread the next time it looks. */
export async function reply({ doc, thread, agent, text }) {
  if (!thread || !text?.trim()) throw new Error("a reply needs --thread <id> and the words");
  const list = await replies(doc);
  const id = `${Date.now().toString(36)}-${list.length}`;
  list.push({ id, thread, agent: agent || "Agent", text: text.trim(), at: Date.now() });
  await mkdir(folderOf(doc), { recursive: true });
  await writeFile(join(folderOf(doc), "replies.json"), JSON.stringify(list, null, 2) + "\n");
  return id;
}
