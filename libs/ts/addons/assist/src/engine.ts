/** What the add-on needs from a model, and the browser's built-in one (the Prompt API) as the default. */
export type Availability = "ready" | "download" | "none";

export interface Session {
  /** The whole answer. With `schema`, the engine limits it to that shape where it can. */
  prompt(text: string, o?: { schema?: object; signal?: AbortSignal }): Promise<string>;
  /** The answer in pieces, as it is made. */
  stream(text: string, o?: { signal?: AbortSignal }): AsyncIterable<string>;
  destroy(): void;
}

export interface Engine {
  /** What the consent panel tells the reviewer. */
  info: { name: string; maker: string; download?: string; memory?: string };
  availability(): Promise<Availability>;
  create(o?: { onProgress?(fraction: number): void; signal?: AbortSignal }): Promise<Session>;
}

/** A page's author may supply their own engine (WebLLM, Transformers.js ...) here before Pipeup starts. */
export const authorEngine = (): Engine | undefined =>
  (globalThis as { pipeupAssistEngine?: Engine }).pipeupAssistEngine;

interface PromptModel {
  prompt(t: string, o?: object): Promise<string>;
  promptStreaming(t: string, o?: object): ReadableStream<string>;
  clone(): Promise<PromptModel>;
  destroy(): void;
}
interface LanguageModelApi {
  availability(o?: object): Promise<"unavailable" | "downloadable" | "downloading" | "available">;
  create(o?: object): Promise<PromptModel>;
}
const api = (): LanguageModelApi | undefined =>
  (globalThis as { LanguageModel?: LanguageModelApi }).LanguageModel;
const LANG = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
};

const isChrome = (): boolean =>
  /\bChrome\//.test(navigator.userAgent) && !/\bEdg\//.test(navigator.userAgent);

/** The browser's built-in model, through the Prompt API (Chrome: Gemini Nano). Nothing leaves the device. */
export const promptApi: Engine = {
  // Chrome's is Gemini Nano. It comes to the machine once, shared by every site, the first time a page asks for it.
  info: {
    name: isChrome() ? "Chrome's built-in model (Gemini Nano)" : "Your browser's built-in model",
    maker: isChrome() ? "Google" : "your browser's maker",
    download: "Once, by your browser, and shared with other sites; it is kept",
    memory: "about 1 GB while it writes, then freed",
  },
  async availability() {
    const lm = api();
    if (!lm) return "none";
    try {
      const a = await lm.availability(LANG);
      return a === "available" ? "ready" : a === "unavailable" ? "none" : "download";
    } catch {
      return "none";
    }
  },
  async create(o = {}) {
    const lm = api();
    if (!lm) throw new Error("no model");
    const base = await lm.create({
      ...LANG,
      signal: o.signal,
      monitor: (m: EventTarget) =>
        m.addEventListener("downloadprogress", (e) =>
          o.onProgress?.((e as Event & { loaded: number }).loaded),
        ),
    });
    // Every prompt runs on its own copy, so one comment's words never reach the next.
    const run = async <T>(fn: (m: PromptModel) => T | Promise<T>): Promise<T> => {
      const m = await base.clone();
      try {
        return await fn(m);
      } finally {
        m.destroy();
      }
    };
    return {
      prompt: (text, p = {}) =>
        run((m) => m.prompt(text, { responseConstraint: p.schema, signal: p.signal })),
      async *stream(text, p = {}) {
        const m = await base.clone();
        try {
          const reader = m.promptStreaming(text, { signal: p.signal }).getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) return;
            yield value;
          }
        } finally {
          m.destroy();
        }
      },
      destroy: () => base.destroy(),
    };
  },
};
