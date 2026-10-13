import type { SignedOp } from "pipeup";

/** One way of carrying batches of ops to and from other people: a service, a channel, a peer. */
export interface Transport {
  /** The merge source: what `host.merge` records as where these ops came from. */
  readonly id: string;
  /** Begins receiving; `deliver` takes untrusted ops (the engine merges them through Pipeup's checks). */
  start(deliver: (ops: unknown[]) => void): Promise<void>;
  /** Best effort; the engine retries what fails. May throw `RetryAfter`. */
  send(ops: readonly SignedOp[]): Promise<void>;
  /** The op ids the remote holds, when the backend can list them (known after the first full read). */
  remoteIds?(): Promise<ReadonlySet<string> | null>;
  stop(): void;
}

/** A transport answer meaning "later": the service asked for patience. */
export class RetryAfter extends Error {
  /** `limit`: the service's standing rule (one post per this long), so later sends keep at least this gap. */
  constructor(
    readonly seconds: number,
    readonly limit = false,
  ) {
    super(`try again in ${seconds} s`);
    this.name = "RetryAfter";
  }
}

/** A `BroadcastChannel` transport: tabs of one browser, for tests and the site's Try pages. */
export class TabTransport implements Transport {
  readonly id: string;
  private channel: BroadcastChannel | null = null;

  constructor(
    private readonly name: string,
    id = "tab",
  ) {
    this.id = id;
  }

  async start(deliver: (ops: unknown[]) => void): Promise<void> {
    this.channel = new BroadcastChannel(this.name);
    this.channel.onmessage = (e: MessageEvent<unknown>) => {
      if (Array.isArray(e.data)) deliver(e.data);
    };
  }

  async send(ops: readonly SignedOp[]): Promise<void> {
    this.channel?.postMessage(ops);
  }

  stop(): void {
    this.channel?.close();
    this.channel = null;
  }
}
