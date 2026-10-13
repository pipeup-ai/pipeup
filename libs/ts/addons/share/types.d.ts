import type { PipeupAddon } from "pipeup";

export interface ShareOptions {
  /** A sharing address, instead of the page's `data-pipeup-share` attribute. */
  share?: string;
}

/** The share add-on: comments shared through an encrypted service the page names (PrivateBin or an HTTP mailbox). */
export default function createAddon(options?: ShareOptions): PipeupAddon;
export { createAddon };
