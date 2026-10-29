import { settings, type Settings } from "@pipeup/kit";
import type { ComposerHandle, Dictation, PipeupAddon } from "pipeup";

interface Result {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  processLocally?: boolean;
  onstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string; message?: string }) => void) | null;
  onresult: ((e: { resultIndex: number; results: ArrayLike<Result> }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
interface Engine {
  new (): Recognition;
  available?(o: { langs: string[]; processLocally: boolean }): Promise<string>;
  install?(o: { langs: string[]; processLocally: boolean }): Promise<boolean>;
}

/**
 * Where the words would be worked out: on this device, after a speech-pack download, by the browser's service, or
 * nowhere (the engine says it can't do the language at all, on the device or otherwise).
 */
type Where = "device" | "download" | "service" | "none";
interface Choice {
  engine: string;
  mode: "device" | "service";
  lang?: string;
}

const SILENCE_MS = 60_000;
const LANGS = [
  "en-US",
  "en-GB",
  "es-ES",
  "fr-FR",
  "de-DE",
  "it-IT",
  "pt-BR",
  "nl-NL",
  "ja-JP",
  "ko-KR",
  "zh-CN",
];
const ICON = [
  "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z",
  "M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6",
];
const DEVICE = "Your words are worked out on this device. Nothing is sent.";
/** The service sentence. Safari works some languages out on the device and can't say which, so it says so. */
const SERVICE = {
  speech:
    "Your voice is sent to the browser's speech service to be turned into words. Pipeup doesn't keep it.",
  webkit:
    "Safari uses Apple's speech recognition. Depending on the language and device the words are worked out here or your voice is sent to Apple; Pipeup can't tell which, and doesn't keep it.",
};
const BLOCKED = "The microphone is blocked. Allow it for this page, then press the microphone again.";
/**
 * What went wrong, in words. Safari remembers a refusal for the life of the page (only a reload asks again), and its
 * "service-not-allowed" is never the microphone: it is Siri and Dictation off, Safari denied under Speech
 * Recognition in System Settings, or a language Apple has no recogniser for.
 */
const FAILS: Record<string, { speech: string; webkit: string }> = {
  "not-allowed": {
    speech: BLOCKED,
    webkit:
      "The microphone or speech recognition was refused for this page. Allow it, reload the page, then press the microphone again.",
  },
  "service-not-allowed": {
    speech:
      "This browser's speech service isn't available for that language, or is turned off in its settings.",
    webkit:
      "Safari isn't allowed to use Apple's speech recognition. Turn on Siri or Dictation, allow Safari under System Settings › Privacy & Security › Speech Recognition, then reload.",
  },
  "no-speech": {
    speech: "Didn't hear anything. Press the microphone to try again.",
    webkit: "Didn't hear anything. Press the microphone to try again.",
  },
  network: {
    speech: "The browser's speech service couldn't be reached. Check your connection and try again.",
    webkit: "Apple's speech service couldn't be reached. Check your connection and try again.",
  },
  "audio-capture": { speech: "No microphone was found.", webkit: "No microphone was found." },
  "language-not-supported": {
    speech: "This browser can't dictate in that language.",
    webkit: "Safari can't dictate in that language.",
  },
};
const CSS = `.voice-p{margin:0 0 10px}.voice-p.voice-swap{animation:voice-in .25s ease}
@keyframes voice-in{from{opacity:0}to{opacity:1}}
.voice-row{display:flex;gap:8px;align-items:center;margin:0 0 10px}
.voice-row select{font:inherit;color:var(--pu-text);background:var(--pu-surface);border:1px solid var(--pu-line);border-radius:8px;padding:4px 6px}
.voice-note{color:var(--pu-faint)}.voice-btns{display:flex;gap:8px}
.voice-btns button{font:inherit;color:inherit;background:none;cursor:pointer;padding:6px 12px;border:1px solid var(--pu-line);border-radius:8px;transition:background-color .2s var(--pu-ease),opacity .2s var(--pu-ease)}
.voice-btns button:hover,.voice-btns button:focus-visible{background:var(--pu-hover);outline:none}
.voice-btns button:disabled{opacity:.5;cursor:default}.voice-btns .voice-start{color:var(--pu-accent)}`;

const engineOf = (): Engine | undefined => {
  const w = globalThis as { SpeechRecognition?: Engine; webkitSpeechRecognition?: Engine };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
};

/** The nearest `lang` above the commenting area, else the page's, else the browser's. */
const pageLang = (root: Element): string =>
  root.closest("[lang]")?.getAttribute("lang") ||
  document.documentElement.lang ||
  navigator.language ||
  "en-US";

function langName(tag: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language", languageDisplay: "standard" }).of(tag) || tag;
  } catch {
    return tag;
  }
}

export function createAddon(): PipeupAddon {
  return {
    id: "voice",
    api: 1,
    version: "0.4.1",
    needs: ["composer", "panel", "notify", "styles"],
    network: {
      when: "after-consent",
      to: ["the browser's speech service", "the browser maker's speech pack download"],
      says: "Only when you press the microphone: your browser may download a speech pack once, and, only if it can't work on this device, your voice goes to the browser maker's speech service.",
    },
    setup(host) {
      const SR = engineOf();
      // No engine (Firefox up to 159): draw nothing at all. The core says why in the console.
      if (!SR) return host.off("this browser has no speech engine");
      const engine = (globalThis as { SpeechRecognition?: Engine }).SpeechRecognition ? "speech" : "webkit";
      const offStyles = host.addStyles(CSS);
      let store: Settings | undefined;
      let choice: Choice | undefined;
      let ready = false;
      const loaded = settings("voice", { memory: host.ephemeral }).then(async (s) => {
        store = s;
        choice = await s.get<Choice>("choice").catch(() => undefined);
        ready = true;
      });
      const caps = new Map<string, Where>();
      const detect = async (lang: string): Promise<Where> => {
        let w: Where = "service";
        try {
          if (SR.available) {
            const s = await SR.available({ langs: [lang], processLocally: true });
            if (s === "available") w = "device";
            else if (s === "downloadable" || s === "downloading") w = "download";
            // Not on the device: an engine with no service either (Firefox) says so here, before anything starts.
            else if ((await SR.available({ langs: [lang], processLocally: false })) === "unavailable")
              w = "none";
          }
        } catch {
          /* Safari and the rest: no way to ask, so the service sentence */
        }
        caps.set(lang, w);
        return w;
      };
      const langNow = () => choice?.lang || pageLang(host.root);
      const consented = (w: Where) =>
        !!choice &&
        choice.engine === engine &&
        (w === "device" || (w === "service" && choice.mode === "service"));

      let panel: { close(): void } | undefined;
      /** The consent panel: one sentence, the language, Start and Not now. Resolves to the choice, or null. */
      const ask = (first: string, w0: Where): Promise<{ lang: string; w: Where } | null> =>
        new Promise((resolve) => {
          let lang = first;
          let w = w0;
          let done = false;
          const el = (tag: string, cls: string, text = "") => {
            const e = document.createElement(tag);
            e.className = cls;
            e.textContent = text;
            return e;
          };
          const say = el("p", "voice-p");
          const sentence = () =>
            w === "download"
              ? `Your browser will first download a speech pack for ${langName(lang)}, once. Your words stay on this device.`
              : w === "none"
                ? `This browser can't dictate in ${langName(lang)} on this device. Choose another language.`
                : w === "device"
                  ? DEVICE
                  : SERVICE[engine];
          const show = (text: string) => {
            say.textContent = text;
            say.classList.remove("voice-swap");
            void say.offsetWidth;
            say.classList.add("voice-swap");
          };
          say.textContent = sentence();
          const select = document.createElement("select");
          // Where there is no way to dictate in the language, Start stays greyed until another is chosen.
          const refresh = () => {
            start.disabled = w === "none";
          };
          select.setAttribute("aria-label", "Language");
          for (const t of new Set([first, ...LANGS])) {
            const o = el("option", "", langName(t));
            (o as HTMLOptionElement).value = t;
            select.append(o);
          }
          select.value = lang;
          const row = el("div", "voice-row");
          const label = el("label", "", "Language");
          row.append(label, select);
          const start = el("button", "voice-start", "Start") as HTMLButtonElement;
          const no = el("button", "", "Not now") as HTMLButtonElement;
          start.type = no.type = "button";
          const btns = el("div", "voice-btns");
          btns.append(start, no);
          const box = el("div", "");
          box.append(say, row);
          if (store && !store.lasting)
            box.append(el("p", "voice-p voice-note", "This browser won't remember this choice."));
          box.append(btns);
          const finish = (r: { lang: string; w: Where } | null) => {
            if (done) return;
            done = true;
            resolve(r);
            panel?.close();
          };
          refresh();
          // Two quick changes answer in the order chosen, not the order the engine answers.
          let seq = 0;
          select.onchange = async () => {
            const my = ++seq;
            lang = select.value;
            start.disabled = true;
            const got = caps.get(lang) ?? (await detect(lang));
            if (my !== seq) return;
            w = got;
            show(sentence());
            refresh();
          };
          no.onclick = () => finish(null);
          start.onclick = async () => {
            if (w === "download") {
              start.disabled = no.disabled = select.disabled = true;
              show("Downloading the speech pack…");
              let ok = false;
              try {
                ok = (await SR.install?.({ langs: [lang], processLocally: true })) === true;
              } catch {
                /* told below */
              }
              if (!ok) host.notify("The speech pack couldn't be downloaded. Try again later.");
              else caps.set(lang, "device");
              return finish(ok ? { lang, w: "device" } : null);
            }
            finish({ lang, w });
          };
          panel = host.openPanel(box, { label: "Dictate", onClose: () => finish(null) });
        });

      // One recognition at a time; `cur` stays set until its `onend`, so nothing starts straight after an abort.
      let cur: { stop(): void; abort(): void } | undefined;
      let asking = false;
      const run = (handle: ComposerHandle, lang: string, local: boolean) => {
        let rec: Recognition;
        try {
          rec = new SR();
        } catch {
          return host.notify("Dictation couldn't start in this browser.");
        }
        try {
          rec.lang = lang;
          rec.interimResults = true;
          rec.continuous = true;
          if (local) rec.processLocally = true;
        } catch {
          return host.notify("Dictation couldn't start in this browser.");
        }
        const dict: Dictation = handle.dictate();
        let sep = !!handle.text() && !/\s$/.test(handle.text());
        let interim = "";
        /** Every final transcript of this run so far: Safari can send them all again as one new final. */
        let said = "";
        let began = false;
        let ours = false;
        let dropped = false;
        let ended = false;
        let timer: ReturnType<typeof setTimeout>;
        const poll = setInterval(() => {
          if (!handle.connected()) end(true);
        }, 500);
        const offEnd = handle.onEnd(() => end(true));
        const quiet = () => {
          clearTimeout(timer);
          timer = setTimeout(() => end(false), SILENCE_MS);
        };
        /** Stops listening: `drop` throws away what is in progress (the box was sent or is gone). */
        const end = (drop: boolean) => {
          ours = true;
          if (drop) {
            dropped = true;
            interim = "";
            dict.cancel();
          }
          try {
            if (drop) rec.abort();
            else rec.stop();
          } catch {
            /* already stopped */
          }
        };
        const words = (t: string) => (t.trim() ? (sep ? " " : "") + t.trim() : "");
        /**
         * What is new in a transcript. Safari may deliver everything said so far again, in a final or in the words in
         * progress before it: a transcript that repeats all of it, whole words, has that part taken off. (A phrase
         * said twice in a row that exactly repeats everything so far is written once there; Chrome is left alone.)
         */
        const fresh = (raw: string) => {
          const t = raw.trim();
          if (engine !== "webkit" || !said) return t;
          return t === said ? "" : t.startsWith(`${said} `) ? t.slice(said.length).trim() : t;
        };
        rec.onstart = () => {
          began = true;
          quiet();
          host.announce("Listening");
        };
        rec.onspeechstart = quiet;
        rec.onresult = (e) => {
          if (dropped) return;
          quiet();
          let live = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i]!;
            if (r.isFinal) {
              const t = fresh(r[0].transcript);
              if (t) {
                said = said ? `${said} ${t}` : t;
                dict.commit(words(t));
                sep = true;
              }
            } else live += r[0].transcript;
          }
          interim = fresh(live);
          if (interim) dict.update(words(interim));
        };
        /** The run is over, whether the engine said `end`, said `error` (Safari says only that), or never started. */
        const finish = () => {
          if (ended) return;
          ended = true;
          clearInterval(poll);
          clearTimeout(timer);
          offEnd();
          // Words still in progress are kept, not lost.
          if (!dropped && interim.trim()) dict.commit(words(interim));
          cur = undefined;
          handle.setPressed(false);
          if (began) host.announce("Stopped listening");
        };
        rec.onerror = (e) => {
          if (!(e.error === "aborted" && ours)) {
            const reason = e.error === "aborted" && e.message?.trim();
            host.notify(
              reason ? `Dictation stopped: ${reason}` : FAILS[e.error]?.[engine] || "Dictation stopped.",
            );
          }
          // Every error ends the session. Safari sends no `end` after it; the others do, and finish() runs once.
          finish();
        };
        rec.onend = finish;
        cur = { stop: () => end(false), abort: () => end(true) };
        handle.setPressed(true);
        try {
          rec.start();
        } catch {
          host.notify("Dictation couldn't start. Try again.");
          finish();
        }
      };

      const press = (handle: ComposerHandle) => {
        // A press while listening only stops (and one while stopping does nothing).
        if (cur) return cur.stop();
        if (asking) return;
        const lang = langNow();
        const w = caps.get(lang);
        if (ready && w && consented(w)) return run(handle, lang, w === "device");
        asking = true;
        void (async () => {
          try {
            await loaded;
            const l = langNow();
            let r = { lang: l, w: caps.get(l) ?? (await detect(l)) };
            if (!consented(r.w)) {
              const a = await ask(r.lang, r.w);
              if (!a) return;
              r = a;
              choice = {
                engine,
                mode: a.w === "service" ? "service" : "device",
                ...(a.lang !== pageLang(host.root) && { lang: a.lang }),
              };
              await store?.set("choice", choice).catch(() => {});
            }
            if (handle.connected() && !cur) run(handle, r.lang, r.w === "device");
          } finally {
            asking = false;
          }
        })();
      };

      // Warm the answers the first time a comment box appears (not at page load: a page that never opens one never
      // touches the speech API), so a later press can start at once while the click still counts.
      let warmed = false;
      const warm = () => {
        if (warmed) return;
        warmed = true;
        void loaded.then(() => detect(langNow()));
      };
      const offTool = host.addComposerTool({
        id: "voice",
        icon: ICON,
        label: "Dictate",
        available: () => {
          warm();
          return true;
        },
        press,
      });
      return () => {
        cur?.abort();
        panel?.close();
        offTool();
        offStyles();
      };
    },
  };
}
