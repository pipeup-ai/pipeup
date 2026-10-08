import type { PipeupDocument, SignedOp } from "pipeup";
import { ladder, SyncEngine } from "@pipeup/kit";
import { parseShare } from "./address";
import { idsOf } from "./backend";
import { Mailbox } from "./mailbox";
import { PrivateBin } from "./privatebin";
import { ShareTransport } from "./transport";

export interface ConnectOptions {
  /** The sharing address, as written in `data-pipeup-share`. */
  share: string;
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  signal?: AbortSignal;
  /** Wait (ms) after a change before sending. Default 0. */
  delay?: number;
  /** The least time (ms) between sends. Default 10,000, PrivateBin's own limit. */
  gap?: number;
  /** Which ops to send. Default: this reviewer's own, plus any received from the shared copy. */
  sendable?(op: SignedOp): boolean;
  /** Lets `http://localhost` and `http://127.0.0.1` through, for a server run during development. */
  local?: boolean;
}

export interface ShareConnection {
  /** Reads what is new and sends everything waiting; resolves once nothing waits, rejects if the service refuses. */
  flush(timeout?: number): Promise<void>;
  /** Why sharing stopped, if it did: "gone", "closed" (the write token is missing or wrong) or "full". */
  problem(): "gone" | "closed" | "full" | null;
  /** How many ops wait to be sent. */
  waiting(): number;
  stop(): void;
}

/**
 * Shares a document headlessly (add-ons design §7.6): the same transports, send policy and checks as the page, with
 * no interface. `doc` is a `PipeupDocument` from `pipeup/core`; ops from the shared copy are merged with the source
 * "share".
 */
export async function connectShare(doc: PipeupDocument, o: ConnectOptions): Promise<ShareConnection> {
  const address = parseShare(o.share, o.local);
  if (address.kind === "off") throw new Error(address.reason);
  const l = ladder(doc.id, address.key);
  const f = o.fetch ?? ((i: RequestInfo | URL, n?: RequestInit) => fetch(i, n));
  const backend =
    address.kind === "mailbox"
      ? new Mailbox(address, l, f, o.signal)
      : new PrivateBin(address, l, f, o.signal);
  const received = new Set<string>();
  const sendable = o.sendable ?? ((op: SignedOp) => received.has(op.body.id) || op.body.author === doc.me);
  const signal = o.signal ?? new AbortController().signal;
  const t = new ShareTransport(backend, {
    signal,
    gap: o.gap ?? 10_000,
    lock: false,
    allowed: () => doc.ops().filter(sendable),
    changed() {},
  });
  const engine = new SyncEngine({
    id: "share",
    document: doc,
    merge: async (ops) => {
      const n = await doc.merge(ops, "share");
      const have = new Set(doc.ops().map((x) => x.body.id));
      for (const id of idsOf(ops)) if (have.has(id)) received.add(id);
      return n;
    },
    transport: t,
    sendable,
    signal,
    delay: o.delay ?? 0,
    gap: o.gap ?? 10_000,
  });
  await engine.start();
  return {
    problem: () => t.problem,
    waiting: () => engine.waiting,
    stop: () => engine.stop(),
    flush: async (timeout = 120_000) => {
      await t.poll(); // read what is new first
      return new Promise<void>((resolve, reject) => {
        const t0 = Date.now();
        const poll = setInterval(check, 250);
        const off = engine.onState(check);
        function done(e?: Error) {
          clearInterval(poll);
          off();
          if (e) reject(e);
          else resolve();
        }
        function check() {
          if (t.problem)
            return done(
              new Error(
                `sharing stopped: the shared copy is ${t.problem === "gone" ? "gone" : t.problem === "full" ? "full" : "refusing this page"}`,
              ),
            );
          if (!engine.waiting && engine.state !== "sending") return done();
          if (Date.now() - t0 > timeout) done(new Error("timed out before everything was sent"));
        }
        engine.rescan();
        check();
      });
    },
  };
}
