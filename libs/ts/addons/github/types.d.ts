import type { PipeupAddon } from "pipeup";

/**
 * The GitHub add-on: when a comment you write mentions someone who can be reached on GitHub, a menu row opens GitHub's
 * new-issue page on the author's repository with their @name and the words filled in. Nothing is sent until you submit
 * the issue there.
 */
export default function createAddon(): PipeupAddon;
