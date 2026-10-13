import type { PipeupAddon } from "pipeup";

/**
 * The updates add-on: on the author's own computer (a page opened from disk, localhost, or where the author asked), it
 * reads the Pipeup project's signed update list and says in the console, and in the menu for security fixes and major
 * releases, when a newer Pipeup is out. It never changes the page and never updates anything.
 */
export default function createAddon(): PipeupAddon;
