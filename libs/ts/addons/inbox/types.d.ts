import type { PipeupAddon } from "pipeup";

/**
 * The inbox add-on: when a comment mentions someone, leaves them a sealed note at the inbox service the page names, and
 * shows you the notes left for you. Nothing is sent until you switch **Mentions by inbox** on.
 */
export default function createAddon(): PipeupAddon;
