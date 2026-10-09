/** What an add-on is writing into a thread, by thread id: shown at the end of the thread as a reply on its way. */
export const threadNotes = new Map<string, string>();

/** A quiet line an add-on keeps at the end of a thread, by thread id ("Reviewed by AI · nothing to add"). */
export const threadMarks = new Map<string, string>();

/** Where a reference pill goes when it is pressed (set by the app): "slide:5", or "quote:<text>" for a passage here. */
export const reveal: { go?: (target: string) => void } = {};

/** What a thread's views need to redraw when it changes. */
export const notesKey = (id: string): string => `${threadNotes.get(id) ?? ""}|${threadMarks.get(id) ?? ""}`;
