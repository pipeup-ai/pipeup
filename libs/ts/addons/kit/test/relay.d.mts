export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}
export interface TestRelay {
  url: string;
  port: number;
  /** Every event accepted so far. */
  events: NostrEvent[];
  stats: { connections: number; open: number };
  dropAll(): void;
  close(): Promise<void>;
}
export function startRelay(port?: number): Promise<TestRelay>;
