export type Support = "old" | "builtin" | "addon" | "unknown";
export function served(
  html: string,
  o: { base: string; agent: string; key: string; file: string; addon?: boolean },
): string;
export function pageSupport(
  html: string,
  dir: string,
): Promise<{ support: Support; version: string; loaded: boolean }>;
export function watch(o: {
  page: string;
  agent: string;
  key: string;
  port?: number;
  log?: (line: string) => void;
}): Promise<{ url: string; sidecar: string; support: Support; addon: boolean; close(): Promise<void> }>;
export function comments(o: { page: string; all?: boolean; json?: boolean }): Promise<string>;
