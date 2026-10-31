import type { Thread } from "../model/types";

/** What an add-on is writing into a thread, by thread id: shown at the end of the thread as a reply on its way. */
export const threadNotes = new Map<string, string>();

/** A quiet line an add-on keeps at the end of a thread, by thread id ("Reviewed by AI · nothing to add"). */
export const threadMarks = new Map<string, string>();

/** The "Check again" an add-on offers on a thread's mark, by thread id. */
export const markAgain = new Map<string, () => void>();

/** A quiet mark an add-on keeps on one comment, by comment id ("Only in this browser", why in its tooltip; `by` set it). */
export const commentMarks = new Map<string, { text: string; tip?: string; by: string }>();

/** Where a reference pill goes when it is pressed (set by the app): "slide:5", or "quote:<text>" for a passage here. */
export const reveal: { go?: (target: string) => void } = {};

/** What a thread's views need to redraw when it changes. */
export const notesKey = (t: Thread): string => {
  let key = `${threadNotes.get(t.id) ?? ""}|${threadMarks.get(t.id) ?? ""}`;
  for (const c of [t.root, ...t.root.replies]) {
    const m = commentMarks.get(c.id);
    if (m) key += `|${c.id}:${m.text}:${m.tip ?? ""}`;
  }
  return key;
};
