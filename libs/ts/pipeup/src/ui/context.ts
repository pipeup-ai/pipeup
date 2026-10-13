import type { Resolved } from "../anchor/resolve";
import type { PipeupDocument } from "../document";
import type { CopyAs, ExportItem } from "../export/format";
import type { Anchor, Thread } from "../model/types";
import type { Surface } from "./addons";
import type { DraftBox } from "./draft-view";
import type { Here } from "./here";
import type { ThreadActions } from "./thread-view";

/** A comment being written: what it's on, and where that is now. */
export interface Draft {
  anchor: Anchor;
  label: string;
  /** Text being commented on (highlighted while drafting). */
  ranges: Range[];
  /** Where the draft's content is: its range for text, its element for blocks and pins. */
  resolved: Resolved;
}

export interface UiState {
  active: string | null;
  hot: string | null;
  showResolved: boolean;
  /** Comments are out of sight: comment mode is off and All comments is closed. */
  hidden: boolean;
  mode: "column" | "bubbles";
  draft: Draft | null;
  /** Comment mode: the page is quiet and a click chooses a block to comment on. */
  commenting: boolean;
  /** All comments is open on the right: in the column layout it takes the column's place. */
  listing: boolean;
  /** A thread chosen from All comments on a narrow screen is open: comments show until it closes. */
  reading: boolean;
  /** The comment control's menu is open: in comment mode a click outside it only closes it. */
  menu: boolean;
}

/** Something that draws: rebuilt on render, repositioned every frame. */
export interface View {
  render(threads: readonly Thread[]): void;
  frame(): void;
  destroy(): void;
}

export interface MenuActions {
  copyAll(as: CopyAs): Promise<void>;
  toggleResolved(): void;
  rename(name: string): Promise<void>;
  /** The reviewer's name; "" until they add one. */
  name(): string;
  /** Every thread in page order, with where each one is. */
  all(): ExportItem[];
}

/** What every view shares: the document, state, and the few things views can ask the app to do. */
export interface Ctx {
  readonly doc: PipeupDocument;
  readonly root: Element;
  readonly layer: HTMLElement;
  readonly host: HTMLElement;
  readonly state: UiState;
  readonly resolved: ReadonlyMap<string, Resolved>;
  /** Threads whose fuzzy match hasn't had its turn yet: not placed, but not lost either. */
  readonly pending: ReadonlySet<string>;
  readonly actions: ThreadActions;
  readonly menu: MenuActions;
  /** Where the reviewer is: the slide, or the page's own view. */
  readonly here: Here;
  /** What add-ons put on the page. */
  readonly addons: Surface;
  /** The thread lives on another slide or view, or the page hides its content: nothing of it shows. */
  elsewhere(t: Thread): boolean;
  /** Sorts threads into here and elsewhere again now, re-rendering if that changed anything. */
  recheck(): void;
  visible(t: Thread): boolean;
  /** The shown text comment whose highlight is at (x, y), if any. */
  quoteAt(x: number, y: number): Thread | null;
  /**
   * A highlight takes the pointer (previews on hover, opens on click) unless a comment with words in it is being
   * written. One rule for hover and click, and for comment mode, which leaves such clicks to the highlight.
   */
  readsAt(x: number, y: number): Thread | null;
  /** The event happened inside Pipeup's own UI. */
  owns(e: Event): boolean;
  /** A view handled this page event; the app won't treat it as a click elsewhere. */
  claim(e: Event): void;
  /** A view already handled this event. */
  claimed(e: Event): boolean;
  open(id: string | null): void;
  /** Puts the cursor in thread `id`'s reply line, unless the reader is typing elsewhere. */
  focusReply(id: string): void;
  hot(id: string | null): void;
  startDraft(d: Draft): void;
  /** Moves the open draft to another block, keeping its words (starts one if none is open). */
  moveDraft(d: Draft): void;
  /** Nothing has been typed in the open draft. */
  draftEmpty(): boolean;
  /** Runs `fn`, then puts focus and the caret back in the open draft as they were. */
  keepCaret(fn: () => void): void;
  /** Goes back to the open draft: to its slide or view if that has gone, then focus and the caret into it. */
  backToDraft(): void;
  postDraft(text: string): Promise<void>;
  cancelDraft(): void;
  /** Turns comment mode on or off; comments show while it is on. `keys`: from the keyboard (the block cursor starts). */
  setCommenting(on: boolean, keys?: boolean): void;
  /** What a click on the page does: cancels an empty draft (back to one with words), else closes the open thread. */
  dismiss(): void;
  registerDraft(box: DraftBox | null): void;
  toast(message: string): void;
  /** Tells screen readers (a polite live region), once. */
  say(text: string): void;
  /** Comment mode's hint goes, if it is showing. */
  hideHint(): void;
  /** Escape's step back: the draft, the open thread, then comment mode's own, then comment mode. */
  back(): void;
  /** Tells the reviewer what went wrong. */
  report(e: unknown): void;
  pulse(id: string): void;
  render(): void;
}
