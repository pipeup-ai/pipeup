import type { Thread } from "../src/model/types";

export interface PageAsk {
  id: string;
  question: string;
  kind: "open" | "agree" | "choice";
  options: string[];
  other: boolean;
  needed: boolean;
}
export interface ReadAnswer {
  thread: string;
  name: string;
  author: string;
  choice: string;
  words: string;
  text: string;
  at: string;
  edited: boolean;
  replies: number;
  askedAs?: string;
}
export function asksIn(html: string): PageAsk[];
export function parseAnswer(ask: PageAsk, text: string): { choice: string; words: string } | null;
export function asksWithAnswers(
  html: string,
  threads: readonly Thread[],
): (PageAsk & { answers: ReadAnswer[] })[];
export function asksMarkdown(
  asks: (PageAsk & { answers: ReadAnswer[] })[],
  nameOf: (key: string) => string,
): string;
